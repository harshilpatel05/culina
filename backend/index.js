const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

const execFileAsync = promisify(execFile);

dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, ".env.local"), override: true });

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
	process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const MONTH_CLOSE_JOB_SECRET = process.env.MONTH_CLOSE_JOB_SECRET;
const ENABLE_MONTH_CLOSE_AUTOMATION = process.env.ENABLE_MONTH_CLOSE_AUTOMATION !== "false";
const MONTH_CLOSE_CHECK_INTERVAL_MS = Number(process.env.MONTH_CLOSE_CHECK_INTERVAL_MS || 1000 * 60 * 60);
const STATE_FILE_PATH = process.env.MONTH_CLOSE_STATE_FILE || path.join(__dirname, ".month-close-state.json");
const PYTHON_BIN = process.env.PYTHON_BIN || "python";

const supabase =
	SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
		? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
		: null;

let isMonthCloseRunning = false;
let isInsightsJobRunning = false;

function getPreviousMonthKey(now = new Date()) {
	const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
	d.setUTCMonth(d.getUTCMonth() - 1);
	const year = d.getUTCFullYear();
	const month = String(d.getUTCMonth() + 1).padStart(2, "0");
	return `${year}-${month}`;
}

function shouldRunMonthCloseNow(now = new Date()) {
	return now.getUTCDate() === 1;
}

function escapeCsv(value) {
	const text = String(value ?? "");
	if (/[",\n\r]/.test(text)) {
		return `"${text.replace(/"/g, '""')}"`;
	}
	return text;
}

async function writeCsv(filePath, headers, rows) {
	const lines = [headers.join(",")];
	for (const row of rows) {
		const line = headers.map((header) => escapeCsv(row[header])).join(",");
		lines.push(line);
	}

	await fs.writeFile(filePath, lines.join("\n"), "utf8");
}

async function readState() {
	try {
		const raw = await fs.readFile(STATE_FILE_PATH, "utf8");
		return JSON.parse(raw);
	} catch {
		return { lastProcessedMonthKey: null, lastRunAt: null, lastResult: null };
	}
}

async function writeState(nextState) {
	await fs.writeFile(STATE_FILE_PATH, JSON.stringify(nextState, null, 2), "utf8");
}

async function runMonthClose({ source = "scheduler", force = false } = {}) {
	if (!supabase) {
		throw new Error(
			"Supabase is not configured. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
		);
	}

	if (isMonthCloseRunning) {
		return { ok: true, skipped: true, reason: "already-running" };
	}

	isMonthCloseRunning = true;

	try {
		const monthKey = getPreviousMonthKey();
		const state = await readState();

		if (!force && state.lastProcessedMonthKey === monthKey) {
			return {
				ok: true,
				skipped: true,
				reason: "already-processed",
				monthKey,
				lastResult: state.lastResult || null,
			};
		}

		const { data: rows, error: rowsError } = await supabase
			.from("inventory")
			.select("id, current_stock, wastage_qty");

		if (rowsError) {
			throw new Error(rowsError.message);
		}

		const inventoryRows = Array.isArray(rows) ? rows : [];
		let movedWastageTotal = 0;

		for (const row of inventoryRows) {
			const currentStock = Math.max(0, Number(row.current_stock) || 0);
			const wastage = Math.max(0, Number(row.wastage_qty) || 0);
			const nextWastage = wastage + currentStock;

			const { error: updateError } = await supabase
				.from("inventory")
				.update({
					current_stock: 0,
					wastage_qty: nextWastage,
				})
				.eq("id", row.id);

			if (updateError) {
				throw new Error(updateError.message);
			}

			movedWastageTotal += currentStock;
		}

		const result = {
			monthKey,
			source,
			processedItems: inventoryRows.length,
			movedWastageTotal,
			executedAt: new Date().toISOString(),
		};

		await writeState({
			lastProcessedMonthKey: monthKey,
			lastRunAt: result.executedAt,
			lastResult: result,
		});

		return { ok: true, skipped: false, ...result };
	} finally {
		isMonthCloseRunning = false;
	}
}

async function runScheduledMonthCloseTick() {
	if (!ENABLE_MONTH_CLOSE_AUTOMATION) {
		return;
	}

	if (!shouldRunMonthCloseNow()) {
		return;
	}

	try {
		const result = await runMonthClose({ source: "scheduler" });
		if (!result.skipped) {
			console.log("[month-close] run completed", result);
		}
	} catch (error) {
		console.error("[month-close] run failed", error);
	}
}

async function runInventoryInsightsJob() {
	if (!supabase) {
		throw new Error(
			"Supabase is not configured. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
		);
	}

	if (isInsightsJobRunning) {
		throw new Error("Inventory insights job is already running");
	}

	isInsightsJobRunning = true;

	try {
		const { data: snapshotItems, error: snapshotError } = await supabase
			.from("inventory_snapshot_items")
			.select(`
				ingredient_id,
				ingredient_name,
				unit,
				reorder_level,
				current_stock,
				wastage_qty,
				captured_at,
				inventory_snapshots (
					snapshot_type,
					captured_at
				)
			`)
			.order("captured_at", { ascending: true });

		if (snapshotError) {
			throw new Error(`Failed to read snapshots: ${snapshotError.message}`);
		}

		const { data: restocks, error: restockError } = await supabase
			.from("restocks")
			.select("ingredient_id, restock_time, restocked_qty")
			.order("restock_time", { ascending: true });

		if (restockError) {
			throw new Error(`Failed to read restocks: ${restockError.message}`);
		}

		const snapshotRows = (Array.isArray(snapshotItems) ? snapshotItems : []).map((item) => {
			const snapshot = Array.isArray(item.inventory_snapshots)
				? item.inventory_snapshots[0]
				: item.inventory_snapshots;

			return {
				ingredient_id: item.ingredient_id,
				snapshot_type: snapshot?.snapshot_type ?? "",
				snapshot_captured_at: snapshot?.captured_at ?? item.captured_at,
				ingredient_name: item.ingredient_name,
				unit: item.unit,
				reorder_level: item.reorder_level,
				current_stock: item.current_stock,
				wastage_qty: item.wastage_qty,
			};
		});

		const restockRows = (Array.isArray(restocks) ? restocks : []).map((item) => ({
			ingredient_id: item.ingredient_id,
			restock_time: item.restock_time,
			restocked_qty: item.restocked_qty,
		}));

		if (snapshotRows.length === 0) {
			throw new Error("No inventory snapshots available for insights generation");
		}

		const snapshotsCsvPath = path.join(__dirname, "inventory_snapshots.csv");
		const restocksCsvPath = path.join(__dirname, "restocks.csv");
		const recommendationsCsvPath = path.join(__dirname, "restock_recommendations.csv");

		await writeCsv(
			snapshotsCsvPath,
			[
				"ingredient_id",
				"snapshot_type",
				"snapshot_captured_at",
				"ingredient_name",
				"unit",
				"reorder_level",
				"current_stock",
				"wastage_qty",
			],
			snapshotRows
		);

		await writeCsv(restocksCsvPath, ["ingredient_id", "restock_time", "restocked_qty"], restockRows);

		const pythonCandidates = Array.from(
			new Set([PYTHON_BIN, "python3", "python", "py"].filter(Boolean))
		);

		let pythonRunError = null;
		for (const candidate of pythonCandidates) {
			try {
				await execFileAsync(candidate, [path.join(__dirname, "invetory_prediction.py")], {
					cwd: __dirname,
					maxBuffer: 1024 * 1024 * 10,
					timeout: 5 * 60 * 1000,
				});

				pythonRunError = null;
				break;
			} catch (error) {
				pythonRunError = error;
				if (error && error.code !== "ENOENT") {
					break;
				}
			}
		}

		if (pythonRunError) {
			if (pythonRunError.code === "ENOENT") {
				throw new Error(
					`Python runtime not found. Tried: ${pythonCandidates.join(", ")}. Set PYTHON_BIN or install Python in deployment image.`
				);
			}

			const stderrText =
				typeof pythonRunError.stderr === "string" ? pythonRunError.stderr.trim() : "";
			const message = stderrText || pythonRunError.message || "Python execution failed";
			throw new Error(message);
		}

		const recommendationsCsv = await fs.readFile(recommendationsCsvPath, "utf8");
		return recommendationsCsv;
	} finally {
		isInsightsJobRunning = false;
	}
}

app.get("/", (_req, res) => {
	res.json({ status: "ok", message: "Culina backend is running" });
});

app.get("/jobs/month-close/status", async (_req, res) => {
	const state = await readState();
	res.json({
		automationEnabled: ENABLE_MONTH_CLOSE_AUTOMATION,
		isRunning: isMonthCloseRunning,
		nextTargetMonth: getPreviousMonthKey(),
		state,
	});
});

app.post("/jobs/month-close/run", async (req, res) => {
	if (!MONTH_CLOSE_JOB_SECRET || req.headers["x-job-secret"] !== MONTH_CLOSE_JOB_SECRET) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	try {
		const result = await runMonthClose({
			source: "manual",
			force: Boolean(req.query.force === "1" || req.query.force === "true"),
		});

		return res.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Month close failed";
		return res.status(500).json({ error: message });
	}
});

app.post("/jobs/inventory-insights/run", async (req, res) => {
	const expectedSecret = String(process.env.INVENTORY_INSIGHTS_JOB_SECRET || MONTH_CLOSE_JOB_SECRET || "").trim();
	const headerSecret = String(req.headers["x-job-secret"] || "").trim();
	const bearerHeader = String(req.headers.authorization || "");
	const bearerSecret = bearerHeader.startsWith("Bearer ") ? bearerHeader.slice(7).trim() : "";
	const providedSecret = headerSecret || bearerSecret;

	if (!expectedSecret || providedSecret !== expectedSecret) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	try {
		const csv = await runInventoryInsightsJob();
		const dateStamp = new Date().toISOString().slice(0, 10);
		res.setHeader("Content-Type", "text/csv; charset=utf-8");
		res.setHeader("Content-Disposition", `attachment; filename="inventory-insights-${dateStamp}.csv"`);
		res.setHeader("Cache-Control", "no-store");
		return res.status(200).send(csv);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Inventory insights generation failed";
		return res.status(500).json({ error: message });
	}
});

setInterval(() => {
	void runScheduledMonthCloseTick();
}, MONTH_CLOSE_CHECK_INTERVAL_MS);

void runScheduledMonthCloseTick();

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
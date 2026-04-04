"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  Boxes,
  Building2,
  LayoutDashboard,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MacOSSidebar } from "@/components/ui/macos-sidebar-base";

type Ingredient = {
  id: string;
  name: string | null;
  unit: string | null;
};

type InventoryRecord = {
  id: string;
  ingredient_id: string | null;
  current_stock: number | null;
  reorder_level: number | null;
  wastage_qty: number | null;
  updated_at: string | null;
};

type InventoryFormState = {
  ingredientId: string;
  currentStock: string;
  reorderLevel: string;
};

type InventorySnapshot = {
  id: string;
  snapshot_type: "opening" | "closing";
  note: string | null;
  item_count: number | null;
  captured_at: string | null;
};

const EMPTY_FORM: InventoryFormState = {
  ingredientId: "",
  currentStock: "0",
  reorderLevel: "0",
};

const PANEL_SHELL = "rounded-2xl border border-slate-300/90 bg-card/70 p-4 shadow-sm backdrop-blur-sm dark:border-slate-600/70";
const SUBTLE_PANEL = "rounded-2xl border border-slate-300/80 bg-card/60 shadow-sm backdrop-blur-sm dark:border-slate-600/60";
const FIELD_INPUT = "w-full rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm outline-none ring-primary transition focus:border-primary/60 focus:ring-2";

function formatQty(value: number | null, unit?: string | null) {
  if (value == null || Number.isNaN(Number(value))) {
    return "-";
  }

  const normalized = Number(value);
  return `${normalized.toFixed(2)}${unit ? ` ${unit}` : ""}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ManagerInventoryPage() {
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);
  const [isDownloadingSnapshots, setIsDownloadingSnapshots] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InventoryFormState>(EMPTY_FORM);
  const [snapshots, setSnapshots] = useState<InventorySnapshot[]>([]);
  const [snapshotModalType, setSnapshotModalType] = useState<"opening" | "closing" | null>(null);
  const [snapshotNote, setSnapshotNote] = useState("");

  const ingredientMap = useMemo(() => {
    return ingredients.reduce<Record<string, Ingredient>>((acc, ingredient) => {
      acc[ingredient.id] = ingredient;
      return acc;
    }, {});
  }, [ingredients]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [inventoryRes, ingredientsRes, snapshotsRes] = await Promise.all([
        fetch("/api/inventory"),
        fetch("/api/ingredients"),
        fetch("/api/inventory/snapshots"),
      ]);

      if (!inventoryRes.ok || !ingredientsRes.ok || !snapshotsRes.ok) {
        throw new Error(`Could not load inventory data (${inventoryRes.status}/${ingredientsRes.status}/${snapshotsRes.status})`);
      }

      const inventoryData = await inventoryRes.json();
      const ingredientsData = await ingredientsRes.json();
      const snapshotsData = await snapshotsRes.json();

      const normalizedInventory = Array.isArray(inventoryData)
        ? inventoryData
        : Array.isArray(inventoryData?.data)
          ? inventoryData.data
          : [];

      setInventory(normalizedInventory as InventoryRecord[]);
      setIngredients(Array.isArray(ingredientsData) ? ingredientsData : []);
      setSnapshots(Array.isArray(snapshotsData) ? snapshotsData : []);
    } catch (loadErr) {
      const message = loadErr instanceof Error ? loadErr.message : "Failed to load inventory data.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredInventory = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return inventory;
    }

    return inventory.filter((item) => {
      const ingredient = item.ingredient_id ? ingredientMap[item.ingredient_id] : undefined;
      const name = ingredient?.name?.toLowerCase() ?? "";
      const unit = ingredient?.unit?.toLowerCase() ?? "";
      const currentStock = String(item.current_stock ?? "");
      const reorderLevel = String(item.reorder_level ?? "");
      const wastageQty = String(item.wastage_qty ?? "");

      return (
        name.includes(normalizedQuery) ||
        unit.includes(normalizedQuery) ||
        currentStock.includes(normalizedQuery) ||
        reorderLevel.includes(normalizedQuery) ||
        wastageQty.includes(normalizedQuery)
      );
    });
  }, [ingredientMap, inventory, query]);

  const metrics = useMemo(() => {
    const totalItems = inventory.length;
    const lowStockCount = inventory.filter((item) => {
      const stock = Number(item.current_stock ?? 0);
      const reorder = Number(item.reorder_level ?? 0);
      return reorder > 0 && stock <= reorder;
    }).length;

    const totalWastage = inventory.reduce((sum, item) => sum + Number(item.wastage_qty ?? 0), 0);

    return {
      totalItems,
      lowStockCount,
      totalWastage,
      projectedMonthEndWastage: inventory.reduce((sum, item) => sum + Math.max(0, Number(item.current_stock ?? 0)), 0),
    };
  }, [inventory]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (item: InventoryRecord) => {
    setEditingId(item.id);
    setForm({
      ingredientId: item.ingredient_id ?? "",
      currentStock: String(item.current_stock ?? 0),
      reorderLevel: String(item.reorder_level ?? 0),
    });
    setIsFormOpen(true);
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.ingredientId) {
      setError("Ingredient is required.");
      return;
    }

    const currentStock = Number(form.currentStock);
    const reorderLevel = Number(form.reorderLevel);

    if ([currentStock, reorderLevel].some((value) => Number.isNaN(value) || value < 0)) {
      setError("Stock values must be valid positive numbers.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const payload = {
        ingredient_id: form.ingredientId,
        current_stock: currentStock,
        reorder_level: reorderLevel,
      };

      const isEditing = Boolean(editingId);
      const endpoint = isEditing ? `/api/inventory/${editingId}` : "/api/inventory";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        throw new Error(responseBody?.error ?? "Could not save inventory record.");
      }

      await loadData();
      resetForm();
    } catch (submitErr) {
      const message = submitErr instanceof Error ? submitErr.message : "Failed to save inventory record.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteItem = async (id: string) => {
    const shouldDelete = window.confirm("Delete this inventory record? This action cannot be undone.");
    if (!shouldDelete) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/inventory/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        throw new Error(responseBody?.error ?? "Could not delete inventory record.");
      }
      await loadData();
    } catch (deleteErr) {
      const message = deleteErr instanceof Error ? deleteErr.message : "Failed to delete inventory record.";
      setError(message);
    }
  };

  const captureSnapshot = async (snapshotType: "opening" | "closing", note: string | null) => {
    try {
      setIsCapturingSnapshot(true);
      setError(null);

      const response = await fetch("/api/inventory/snapshots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snapshot_type: snapshotType,
          note,
        }),
      });

      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        throw new Error(responseBody?.error ?? `Could not capture ${snapshotType} snapshot.`);
      }

      await loadData();
    } catch (snapshotErr) {
      const message = snapshotErr instanceof Error ? snapshotErr.message : "Failed to capture stock snapshot.";
      setError(message);
    } finally {
      setIsCapturingSnapshot(false);
    }
  };

  const openSnapshotModal = (snapshotType: "opening" | "closing") => {
    setSnapshotModalType(snapshotType);
    setSnapshotNote("");
  };

  const closeSnapshotModal = () => {
    if (isCapturingSnapshot) {
      return;
    }

    setSnapshotModalType(null);
    setSnapshotNote("");
  };

  const submitSnapshotCapture = async () => {
    if (!snapshotModalType) {
      return;
    }

    await captureSnapshot(snapshotModalType, snapshotNote.trim() || null);
    setSnapshotModalType(null);
    setSnapshotNote("");
  };

  const downloadHistoricalStockData = async () => {
    try {
      setIsDownloadingSnapshots(true);
      setError(null);

      const response = await fetch("/api/inventory/snapshots/export");
      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        throw new Error(responseBody?.error ?? "Could not download historical stock data.");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition") ?? "";
      const fileNameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const fileName = fileNameMatch?.[1] ?? `inventory-historical-snapshots-${new Date().toISOString().slice(0, 10)}.csv`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadErr) {
      const message = downloadErr instanceof Error ? downloadErr.message : "Failed to download historical stock data.";
      setError(message);
    } finally {
      setIsDownloadingSnapshots(false);
    }
  };

  const generateInventoryInsights = async () => {
    try {
      setIsGeneratingInsights(true);
      setError(null);

      const response = await fetch("/api/inventory/insights", {
        method: "POST",
      });

      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        throw new Error(responseBody?.error ?? "Could not generate inventory insights.");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition") ?? "";
      const fileNameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const fileName = fileNameMatch?.[1] ?? `inventory-insights-${new Date().toISOString().slice(0, 10)}.csv`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (insightsErr) {
      const message = insightsErr instanceof Error ? insightsErr.message : "Failed to generate inventory insights.";
      setError(message);
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const handleSidebarNav = (label: string) => {
    switch (label) {
      case "Dashboard":
        router.push("/manager-dash");
        break;
      case "Staff":
        router.push("/manager-dash/staff");
        break;
      case "Inventory":
        router.push("/manager-dash/inventory");
        break;
      case "Recipe":
        router.push("/manager-dash/recipe");
        break;
      case "Restaurant":
        router.push("/manager-dash/restaurant");
        break;
      default:
        break;
    }
  };

  return (
    <main className="min-h-screen w-full bg-background dark:bg-linear-to-br dark:from-background dark:via-background dark:to-card">
      <MacOSSidebar
        items={[
          { label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
          { label: "Staff", icon: <Users className="size-4" /> },
          { label: "Inventory", icon: <Boxes className="size-4" /> },
          { label: "Recipe", icon: <BookOpen className="size-4" /> },
          { label: "Restaurant", icon: <Building2 className="size-4" /> },
        ]}
        defaultOpen={false}
        initialSelectedIndex={2}
        onItemClick={handleSidebarNav}
        className="w-full max-w-384 p-1 sm:p-2 lg:p-4"
      >
        <div className="flex w-full flex-col gap-6 pl-3 sm:pl-4 lg:pl-5">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
            <header className="rounded-3xl border border-lime-400/70 bg-linear-to-br from-lime-100 via-lime-200 to-emerald-300 p-6 shadow-[0_8px_22px_rgba(77,124,15,0.2)] backdrop-blur dark:border-lime-400/50 dark:from-lime-950/80 dark:via-emerald-900/90 dark:to-emerald-950/95">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Manager Console</p>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground">Inventory Management</h1>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    Track stock levels, reorder thresholds, and wastage by ingredient to keep kitchen operations stable.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                  <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex min-w-58 items-center justify-center gap-2 rounded-xl border border-black/50 bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(0,0,0,0.28)] transition hover:bg-black/90"
                  >
                    <Plus className="h-4 w-4" />
                    Add Inventory Record
                  </button>

                  <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={isCapturingSnapshot}
                      onClick={() => openSnapshotModal("opening")}
                      className="inline-flex items-center justify-center rounded-xl border border-emerald-700/40 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCapturingSnapshot ? "Capturing..." : "Capture Opening Snapshot"}
                    </button>
                    <button
                      type="button"
                      disabled={isCapturingSnapshot}
                      onClick={() => openSnapshotModal("closing")}
                      className="inline-flex items-center justify-center rounded-xl border border-blue-700/40 bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCapturingSnapshot ? "Capturing..." : "Capture Closing Snapshot"}
                    </button>
                  </div>
                </div>
              </div>
            </header>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <article className={SUBTLE_PANEL + " p-4"}>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Tracked Items</p>
                <div className="mt-3 flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-primary" />
                  <p className="text-2xl font-semibold text-foreground">{metrics.totalItems}</p>
                </div>
              </article>
              <article className={SUBTLE_PANEL + " p-4"}>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Low Stock Items</p>
                <div className="mt-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <p className="text-2xl font-semibold text-foreground">{metrics.lowStockCount}</p>
                </div>
              </article>
              <article className={SUBTLE_PANEL + " p-4"}>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Total Wastage</p>
                <p className="mt-3 text-2xl font-semibold text-foreground">{metrics.totalWastage.toFixed(2)}</p>
              </article>
              <article className={SUBTLE_PANEL + " p-4"}>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Projected Month-End Wastage</p>
                <p className="mt-3 text-2xl font-semibold text-foreground">{metrics.projectedMonthEndWastage.toFixed(2)}</p>
              </article>
            </section>

            <section className={PANEL_SHELL}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Recent Stock Snapshots</h2>
                  <p className="text-xs text-muted-foreground">Opening and closing snapshots are persisted for ML analysis.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isGeneratingInsights}
                    onClick={generateInventoryInsights}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-700/30 bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {isGeneratingInsights ? "Generating..." : "Insights"}
                  </button>
                  <button
                    type="button"
                    disabled={isDownloadingSnapshots}
                    onClick={downloadHistoricalStockData}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-800/40 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDownloadingSnapshots ? "Preparing CSV..." : "Download Historical Stock Data"}
                  </button>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-150 border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/70 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      <th className="px-3 py-3 font-medium">Type</th>
                      <th className="px-3 py-3 font-medium">Captured At</th>
                      <th className="px-3 py-3 font-medium">Items</th>
                      <th className="px-3 py-3 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                          No snapshots yet. Capture opening or closing stock to create one.
                        </td>
                      </tr>
                    ) : (
                      snapshots.map((snapshot) => (
                        <tr key={snapshot.id} className="border-b border-border/40 hover:bg-muted/40">
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${
                              snapshot.snapshot_type === "opening"
                                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "border-blue-400/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                            }`}>
                              {snapshot.snapshot_type === "opening" ? "Opening" : "Closing"}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">{formatDate(snapshot.captured_at)}</td>
                          <td className="px-3 py-3 text-muted-foreground">{snapshot.item_count ?? 0}</td>
                          <td className="px-3 py-3 text-muted-foreground">{snapshot.note || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={PANEL_SHELL}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-foreground">Inventory Register</h2>
                <div className="relative w-full sm:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by ingredient, unit, or values"
                    className="w-full rounded-xl border border-border/70 bg-background py-2 pl-9 pr-3 text-sm outline-none ring-primary transition focus:ring-2"
                  />
                </div>
              </div>

              {error ? (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  {error}
                </p>
              ) : null}

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-190 border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/70 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      <th className="px-3 py-3 font-medium">Ingredient</th>
                      <th className="px-3 py-3 font-medium">Current Stock</th>
                      <th className="px-3 py-3 font-medium">Reorder Level</th>
                      <th className="px-3 py-3 font-medium">Wastage Qty</th>
                      <th className="px-3 py-3 font-medium">Updated</th>
                      <th className="px-3 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                          Loading inventory records...
                        </td>
                      </tr>
                    ) : filteredInventory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                          No inventory records found. Add your first inventory item.
                        </td>
                      </tr>
                    ) : (
                      filteredInventory.map((item) => {
                        const ingredient = item.ingredient_id ? ingredientMap[item.ingredient_id] : undefined;
                        const unit = ingredient?.unit ?? "";
                        const stock = Number(item.current_stock ?? 0);
                        const reorder = Number(item.reorder_level ?? 0);
                        const isLow = reorder > 0 && stock <= reorder;

                        return (
                          <tr key={item.id} className={`border-b border-border/40 ${isLow ? "bg-amber-500/5" : "hover:bg-muted/40"}`}>
                            <td className="px-3 py-3 font-medium text-foreground">{ingredient?.name ?? "Unknown ingredient"}</td>
                            <td className="px-3 py-3 text-muted-foreground">{formatQty(item.current_stock, unit)}</td>
                            <td className="px-3 py-3 text-muted-foreground">{formatQty(item.reorder_level, unit)}</td>
                            <td className="px-3 py-3 text-muted-foreground">{formatQty(item.wastage_qty, unit)}</td>
                            <td className="px-3 py-3 text-muted-foreground">{formatDate(item.updated_at)}</td>
                            <td className="px-3 py-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEdit(item)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition hover:text-foreground"
                                  aria-label="Edit inventory"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteItem(item.id)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/40 text-red-500 transition hover:bg-red-500/10"
                                  aria-label="Delete inventory"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <AnimatePresence>
              {snapshotModalType ? (
                <motion.div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                  onClick={closeSnapshotModal}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <motion.section
                    className="w-full max-w-xl rounded-2xl border border-slate-300/90 bg-card p-6 shadow-2xl sm:p-7 dark:border-slate-600/70"
                    onClick={(event) => event.stopPropagation()}
                    initial={{ opacity: 0, y: 18, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground">
                        Capture {snapshotModalType === "opening" ? "Opening" : "Closing"} Snapshot
                      </h3>
                      <button
                        type="button"
                        onClick={closeSnapshotModal}
                        className="rounded-lg border border-border/70 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      <label className="text-sm font-medium text-foreground" htmlFor="snapshot-note">
                        Optional note
                      </label>
                      <textarea
                        id="snapshot-note"
                        value={snapshotNote}
                        onChange={(event) => setSnapshotNote(event.target.value)}
                        placeholder="E.g. Morning receiving done, pre-shift physical count completed"
                        className="min-h-28 w-full rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm outline-none ring-primary transition focus:border-primary/60 focus:ring-2"
                      />
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={closeSnapshotModal}
                        className="inline-flex items-center justify-center rounded-xl border border-border/70 px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isCapturingSnapshot}
                        onClick={submitSnapshotCapture}
                        className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          snapshotModalType === "opening"
                            ? "border border-emerald-700/40 bg-emerald-600 hover:bg-emerald-700"
                            : "border border-blue-700/40 bg-blue-600 hover:bg-blue-700"
                        }`}
                      >
                        {isCapturingSnapshot ? "Capturing..." : `Capture ${snapshotModalType === "opening" ? "Opening" : "Closing"} Snapshot`}
                      </button>
                    </div>
                  </motion.section>
                </motion.div>
              ) : null}

              {isFormOpen ? (
                <motion.div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                  onClick={resetForm}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <motion.section
                    className="w-full max-w-2xl rounded-2xl border border-slate-300/90 bg-card p-6 shadow-2xl sm:p-7 dark:border-slate-600/70"
                    onClick={(event) => event.stopPropagation()}
                    initial={{ opacity: 0, y: 18, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground">
                        {editingId ? "Edit Inventory Record" : "Add Inventory Record"}
                      </h3>
                      <button
                        type="button"
                        onClick={resetForm}
                        className="rounded-lg border border-border/70 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>

                    <form onSubmit={submitForm} className="mt-1">
                      <div className="grid max-h-[72vh] gap-5 overflow-y-auto px-1 pb-1 md:grid-cols-2">
                        <label className="space-y-2.5 md:col-span-2">
                          <span className="text-sm font-medium text-foreground">Ingredient</span>
                          <Select
                            value={form.ingredientId || undefined}
                            onValueChange={(value) => setForm((previous) => ({ ...previous, ingredientId: value }))}
                          >
                            <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background px-3 text-sm">
                              <SelectValue placeholder="Select ingredient" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/70">
                              {ingredients.map((ingredient) => (
                                <SelectItem key={ingredient.id} value={ingredient.id}>
                                  {ingredient.name ?? "Unnamed ingredient"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </label>

                        <label className="space-y-2.5">
                          <span className="text-sm font-medium text-foreground">Current Stock</span>
                          <input
                            value={form.currentStock}
                            onChange={(event) => setForm((previous) => ({ ...previous, currentStock: event.target.value }))}
                            type="number"
                            min="0"
                            step="0.01"
                            className={FIELD_INPUT}
                            required
                          />
                        </label>

                        <label className="space-y-2.5">
                          <span className="text-sm font-medium text-foreground">Reorder Level</span>
                          <input
                            value={form.reorderLevel}
                            onChange={(event) => setForm((previous) => ({ ...previous, reorderLevel: event.target.value }))}
                            type="number"
                            min="0"
                            step="0.01"
                            className={FIELD_INPUT}
                            required
                          />
                        </label>

                      </div>

                      <div className="mt-6">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isSubmitting ? "Saving..." : editingId ? "Save Changes" : "Create Inventory Record"}
                        </button>
                      </div>
                    </form>
                  </motion.section>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </MacOSSidebar>
    </main>
  );
}

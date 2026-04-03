"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

type OrderRecord = {
	id: string;
	table_id: string | null;
	customer_id: string | null;
	status: string | null;
	payment_status: string | null;
	total_amount: number | null;
	num_people: number | null;
	created_at: string | null;
	customers?: { name?: string | null } | null;
	restaurant_tables?: { table_number?: number | null } | null;
	staff?: { name?: string | null } | null;
	restaurants?: { name?: string | null } | null;
};

type OrderItem = {
	id: string;
	quantity: number | null;
	price: number | null;
	total: number | null;
	dishes?: { name?: string | null; category?: string | null } | null;
};

type InvoiceRecord = {
	id: string;
	invoice_number: string;
	issued_at: string | null;
	due_at: string | null;
	subtotal: number | null;
	tax_percent: number | null;
	tax_amount: number | null;
	service_charge_percent: number | null;
	service_charge_amount: number | null;
	discount_percent: number | null;
	discount_amount: number | null;
	grand_total: number | null;
	notes: string | null;
};

type FormState = {
	issuedAt: string;
	dueAt: string;
	taxPercent: string;
	serviceChargePercent: string;
	discountPercent: string;
	notes: string;
};

const EMPTY_FORM: FormState = {
	issuedAt: "",
	dueAt: "",
	taxPercent: "0",
	serviceChargePercent: "0",
	discountPercent: "0",
	notes: "",
};

function toDateInput(value: string | null | undefined) {
	if (!value) {
		return "";
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}

	return date.toISOString().slice(0, 10);
}

function formatCurrency(amount: number) {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 2,
	}).format(amount);
}

function safeNumber(value: number | string | null | undefined) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function paymentToneClass(paymentStatus: string | null | undefined) {
	const normalized = String(paymentStatus ?? "").toLowerCase();

	if (normalized === "paid") {
		return "border-blue-400/50 bg-blue-500/10 text-blue-700 dark:text-blue-300";
	}

	if (normalized === "partial") {
		return "border-sky-400/50 bg-sky-500/10 text-sky-700 dark:text-sky-300";
	}

	return "border-slate-400/50 bg-slate-500/10 text-slate-700 dark:text-slate-300";
}

export default function BillingPage() {
	const router = useRouter();
	const params = useParams<{ id: string }>();
	const orderId = params?.id;
	const { user, loading: authLoading } = useAuth();

	const [order, setOrder] = useState<OrderRecord | null>(null);
	const [items, setItems] = useState<OrderItem[]>([]);
	const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
	const [form, setForm] = useState<FormState>(EMPTY_FORM);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	const subtotal = useMemo(() => {
		return items.reduce((sum, item) => {
			const lineTotal = safeNumber(item.total) || safeNumber(item.quantity) * safeNumber(item.price);
			return sum + lineTotal;
		}, 0);
	}, [items]);

	const totals = useMemo(() => {
		const taxPercent = Math.max(0, safeNumber(form.taxPercent));
		const serviceChargePercent = Math.max(0, safeNumber(form.serviceChargePercent));
		const discountPercent = Math.max(0, safeNumber(form.discountPercent));

		const taxAmount = (subtotal * taxPercent) / 100;
		const serviceChargeAmount = (subtotal * serviceChargePercent) / 100;
		const discountAmount = (subtotal * discountPercent) / 100;
		const grandTotal = subtotal + taxAmount + serviceChargeAmount - discountAmount;

		return {
			taxPercent,
			taxAmount,
			serviceChargePercent,
			serviceChargeAmount,
			discountPercent,
			discountAmount,
			grandTotal,
		};
	}, [form.discountPercent, form.serviceChargePercent, form.taxPercent, subtotal]);

	useEffect(() => {
		if (!orderId) {
			return;
		}

		const load = async () => {
			try {
				setIsLoading(true);
				setError(null);

				const [orderRes, itemsRes, invoiceRes] = await Promise.all([
					fetch(`/api/orders/${orderId}`),
					fetch(`/api/orders/${orderId}/items`),
					fetch(`/api/orders/${orderId}/invoice`),
				]);

				if (!orderRes.ok || !itemsRes.ok) {
					throw new Error(`Unable to load billing data (${orderRes.status}/${itemsRes.status})`);
				}

				const orderData = await orderRes.json();
				const itemsData = await itemsRes.json();

				setOrder(orderData ?? null);
				setItems(Array.isArray(itemsData) ? itemsData : []);

				if (invoiceRes.ok) {
					const invoiceData = await invoiceRes.json();
					if (invoiceData) {
						setInvoice(invoiceData);
						setForm({
							issuedAt: toDateInput(invoiceData.issued_at),
							dueAt: toDateInput(invoiceData.due_at),
							taxPercent: String(safeNumber(invoiceData.tax_percent)),
							serviceChargePercent: String(safeNumber(invoiceData.service_charge_percent)),
							discountPercent: String(safeNumber(invoiceData.discount_percent)),
							notes: invoiceData.notes ?? "",
						});
					} else {
						const today = new Date().toISOString().slice(0, 10);
						setInvoice(null);
						setForm({ ...EMPTY_FORM, issuedAt: today });
					}
				} else {
					const today = new Date().toISOString().slice(0, 10);
					setInvoice(null);
					setForm({ ...EMPTY_FORM, issuedAt: today });
				}
			} catch (loadErr) {
				const message = loadErr instanceof Error ? loadErr.message : "Failed to load billing data.";
				setError(message);
			} finally {
				setIsLoading(false);
			}
		};

		void load();
	}, [orderId]);

	const saveInvoice = async () => {
		if (!orderId) {
			setError("Invalid order id.");
			return;
		}

		try {
			setIsSaving(true);
			setError(null);
			setSuccessMessage(null);

			const payload = {
				issued_at: form.issuedAt ? new Date(form.issuedAt).toISOString() : new Date().toISOString(),
				due_at: form.dueAt ? new Date(form.dueAt).toISOString() : null,
				subtotal,
				tax_percent: totals.taxPercent,
				tax_amount: totals.taxAmount,
				service_charge_percent: totals.serviceChargePercent,
				service_charge_amount: totals.serviceChargeAmount,
				discount_percent: totals.discountPercent,
				discount_amount: totals.discountAmount,
				grand_total: totals.grandTotal,
				notes: form.notes.trim() || null,
			};

			const endpoint = `/api/orders/${orderId}/invoice`;
			const method = invoice ? "PUT" : "POST";
			const response = await fetch(endpoint, {
				method,
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const responseBody = await response.json().catch(() => null);
				throw new Error(responseBody?.error ?? "Failed to save invoice.");
			}

			const savedInvoice = await response.json();
			setInvoice(savedInvoice);
			setSuccessMessage(invoice ? "Invoice updated successfully." : "Invoice created successfully.");
		} catch (saveErr) {
			const message = saveErr instanceof Error ? saveErr.message : "Failed to save invoice.";
			setError(message);
		} finally {
			setIsSaving(false);
		}
	};

	if (authLoading) {
		return <main className="min-h-screen bg-background" />;
	}

	if (!user) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-background p-8 text-center">
				<p className="text-sm text-muted-foreground">Please login to access billing.</p>
			</main>
		);
	}

	return (
		<main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eff6ff_100%)] px-4 py-6 sm:px-6 lg:px-8 print:bg-white print:px-0 print:py-0 dark:bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)]">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
				<header className="no-print flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							onClick={() => router.back()}
							className="gap-1.5 border-blue-300/60 bg-white/80 text-blue-900 hover:bg-blue-50 dark:bg-slate-900/60 dark:text-blue-100 dark:hover:bg-slate-800"
						>
							<ArrowLeft className="h-4 w-4" />
							Back
						</Button>
						<div>
							<h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Order Invoice</h1>
							<p className="text-sm text-slate-600 dark:text-slate-300">Clean cobalt ledger theme</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							onClick={() => window.print()}
							className="gap-1.5 border-blue-300/60 bg-white/80 text-blue-900 hover:bg-blue-50 dark:bg-slate-900/60 dark:text-blue-100 dark:hover:bg-slate-800"
						>
							<Printer className="h-4 w-4" />
							Print
						</Button>
						<Button
							onClick={saveInvoice}
							disabled={isSaving || isLoading}
							className="gap-1.5 border border-blue-500/40 bg-linear-to-r from-blue-600 to-sky-600 text-white shadow-[0_8px_24px_-12px_rgba(37,99,235,0.6)] hover:from-blue-700 hover:to-sky-700"
						>
							<Save className="h-4 w-4" />
							{isSaving ? "Saving..." : invoice ? "Update Invoice" : "Save Invoice"}
						</Button>
					</div>
				</header>

				{error ? (
					<p className="no-print rounded-lg border border-rose-400/40 bg-rose-500/12 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
						{error}
					</p>
				) : null}

				{successMessage ? (
					<p className="no-print rounded-lg border border-blue-400/45 bg-blue-500/10 px-3 py-2 text-sm text-blue-700 dark:text-blue-300">
						{successMessage}
					</p>
				) : null}

				<div className="grid gap-6 lg:grid-cols-2 print:block">
					<section className="no-print rounded-2xl border border-blue-200/70 bg-white/85 p-5 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/60">
						<h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Invoice Controls</h2>
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="space-y-1.5">
								<span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">Date Issued</span>
								<Input
									type="date"
									value={form.issuedAt}
									onChange={(event) => setForm((prev) => ({ ...prev, issuedAt: event.target.value }))}
									className="border-blue-200 bg-white focus-visible:ring-blue-400/40 dark:border-slate-600 dark:bg-slate-900"
								/>
							</label>

							<label className="space-y-1.5">
								<span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">Due Date</span>
								<Input
									type="date"
									value={form.dueAt}
									onChange={(event) => setForm((prev) => ({ ...prev, dueAt: event.target.value }))}
									className="border-blue-200 bg-white focus-visible:ring-blue-400/40 dark:border-slate-600 dark:bg-slate-900"
								/>
							</label>

							<label className="space-y-1.5">
								<span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">Tax (%)</span>
								<Input
									type="number"
									min="0"
									step="0.01"
									value={form.taxPercent}
									onChange={(event) => setForm((prev) => ({ ...prev, taxPercent: event.target.value }))}
									className="border-blue-200 bg-white focus-visible:ring-blue-400/40 dark:border-slate-600 dark:bg-slate-900"
								/>
							</label>

							<label className="space-y-1.5">
								<span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">Service Charge (%)</span>
								<Input
									type="number"
									min="0"
									step="0.01"
									value={form.serviceChargePercent}
									onChange={(event) => setForm((prev) => ({ ...prev, serviceChargePercent: event.target.value }))}
									className="border-blue-200 bg-white focus-visible:ring-blue-400/40 dark:border-slate-600 dark:bg-slate-900"
								/>
							</label>

							<label className="space-y-1.5 sm:col-span-2">
								<span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">Discount (%)</span>
								<Input
									type="number"
									min="0"
									step="0.01"
									value={form.discountPercent}
									onChange={(event) => setForm((prev) => ({ ...prev, discountPercent: event.target.value }))}
									className="border-blue-200 bg-white focus-visible:ring-blue-400/40 dark:border-slate-600 dark:bg-slate-900"
								/>
							</label>

							<label className="space-y-1.5 sm:col-span-2">
								<span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">Notes</span>
								<textarea
									value={form.notes}
									onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
									placeholder="Special billing notes"
									className="min-h-28 w-full rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-400/40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
								/>
							</label>
						</div>
					</section>

					<section className="rounded-2xl border border-blue-200/70 bg-white/85 p-6 shadow-sm backdrop-blur print:border-none print:bg-white print:p-0 print:shadow-none dark:border-slate-700 dark:bg-slate-900/60">
						{isLoading ? (
							<p className="py-20 text-center text-sm text-slate-600 dark:text-slate-300">Loading invoice preview...</p>
						) : !order ? (
							<p className="py-20 text-center text-sm text-slate-600 dark:text-slate-300">Order not found.</p>
						) : (
							<div className="space-y-7">
								<div className="space-y-4 border-b border-blue-200 pb-4 dark:border-slate-700">
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div>
											<p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Invoice</p>
											<h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
												{invoice?.invoice_number ?? "Draft Invoice"}
											</h2>
										</div>
										<div className="text-right text-sm text-slate-600 dark:text-slate-300">
											<p>{order.restaurants?.name ?? "Restaurant"}</p>
											<p>Table {order.restaurant_tables?.table_number ?? "-"}</p>
											<p>Guests: {order.num_people ?? "-"}</p>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-4 text-sm">
										<div>
											<p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Billed To</p>
											<p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{order.customers?.name ?? "Walk-in Customer"}</p>
										</div>
										<div className="text-right">
											<p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Payment</p>
											<p className={`mt-1 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${paymentToneClass(order.payment_status)}`}>
												{order.payment_status ?? "pending"}
											</p>
										</div>
									</div>
								</div>

								<div className="overflow-hidden rounded-lg border border-blue-200 dark:border-slate-700">
									<table className="w-full border-collapse text-left text-sm">
										<thead className="bg-blue-50 text-xs uppercase tracking-[0.12em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
											<tr>
												<th className="px-3 py-2.5">Item</th>
												<th className="px-3 py-2.5 text-center">Qty</th>
												<th className="px-3 py-2.5 text-right">Price</th>
												<th className="px-3 py-2.5 text-right">Total</th>
											</tr>
										</thead>
										<tbody>
											{items.length === 0 ? (
												<tr>
													<td colSpan={4} className="px-3 py-5 text-center text-slate-600 dark:text-slate-300">
														No order items found.
													</td>
												</tr>
											) : (
												items.map((item) => {
													const quantity = safeNumber(item.quantity);
													const price = safeNumber(item.price);
													const lineTotal = safeNumber(item.total) || quantity * price;
													return (
														<tr key={item.id} className="border-t border-blue-100 dark:border-slate-700">
															<td className="px-3 py-2.5 text-slate-900 dark:text-slate-100">{item.dishes?.name ?? "Unknown Item"}</td>
															<td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">{quantity}</td>
															<td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{formatCurrency(price)}</td>
															<td className="px-3 py-2.5 text-right font-medium text-slate-900 dark:text-slate-100">{formatCurrency(lineTotal)}</td>
														</tr>
													);
												})
											)}
										</tbody>
									</table>
								</div>

								<div className="ml-auto w-full max-w-sm space-y-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/40">
									<div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
										<span>Subtotal</span>
										<span>{formatCurrency(subtotal)}</span>
									</div>
									<div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
										<span>Tax ({totals.taxPercent.toFixed(2)}%)</span>
										<span>{formatCurrency(totals.taxAmount)}</span>
									</div>
									<div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
										<span>Service ({totals.serviceChargePercent.toFixed(2)}%)</span>
										<span>{formatCurrency(totals.serviceChargeAmount)}</span>
									</div>
									<div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
										<span>Discount ({totals.discountPercent.toFixed(2)}%)</span>
										<span>-{formatCurrency(totals.discountAmount)}</span>
									</div>
									<div className="flex items-center justify-between rounded-lg border border-blue-300/70 bg-blue-100/70 px-2.5 py-2 text-base font-semibold text-blue-900 dark:border-blue-500/40 dark:bg-blue-900/30 dark:text-blue-200">
										<span>Grand Total</span>
										<span>{formatCurrency(totals.grandTotal)}</span>
									</div>
								</div>

								{form.notes ? (
									<div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
										<p className="mb-1 text-xs uppercase tracking-[0.12em]">Notes</p>
										<p>{form.notes}</p>
									</div>
								) : null}
							</div>
						)}
					</section>
				</div>
			</div>

			<style jsx global>{`
				@media print {
					.no-print {
						display: none !important;
					}
				}
			`}</style>
		</main>
	);
}

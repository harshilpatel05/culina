"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { BarChart3, BookOpen, Boxes, Building2, LayoutDashboard, Users } from "lucide-react";

import { ProtectedRoute } from "@/components/protected-route";
import { MacOSSidebar } from "@/components/ui/macos-sidebar-base";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type InvoiceRecord = {
  id: string;
  order_id: string | null;
  invoice_number: string;
  issued_at: string | null;
  due_at: string | null;
  subtotal: number | string | null;
  tax_percent: number | string | null;
  tax_amount: number | string | null;
  service_charge_percent: number | string | null;
  service_charge_amount: number | string | null;
  discount_percent: number | string | null;
  discount_amount: number | string | null;
  grand_total: number | string | null;
  notes?: string | null;
};

type TrendPoint = {
  label: string;
  revenue: number;
};

const PANEL_SHELL = "rounded-2xl border border-slate-300/90 bg-linear-to-br from-blue-50/40 to-card/75 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] backdrop-blur-sm dark:border-slate-500/80 dark:from-blue-500/10 dark:to-card/75";
const METRIC_CARD = "rounded-lg border border-blue-200/60 bg-linear-to-b from-blue-50/70 to-card/70 px-3 py-2 dark:border-blue-500/20 dark:from-blue-500/10 dark:to-card/70";
const SALES_HEADER_SHELL = "rounded-2xl border border-rose-400/70 bg-linear-to-br from-rose-100 via-rose-200 to-red-400 p-5 shadow-[0_8px_22px_rgba(159,18,57,0.22)] backdrop-blur-sm dark:border-rose-400/55 dark:from-rose-950/90 dark:via-red-900/90 dark:to-red-950/95";

const chartConfig = {
  revenue: {
    label: "Revenue",
    theme: {
      light: "var(--accent)",
      dark: "var(--primary)",
    },
  },
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatRevenueAxis(value: number | string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "₹0";
  }

  if (Math.abs(amount) < 1000) {
    return `₹${Math.round(amount)}`;
  }

  const compactValue = (amount / 1000).toFixed(1).replace(/\.0$/, "");
  return `₹${compactValue}k`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(value: string | null) {
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
  });
}

export default function ManagerSalesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInvoices = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/invoices");
        if (!response.ok) {
          const responseBody = await response.json().catch(() => null);
          throw new Error(responseBody?.error ?? `Failed to load invoices (${response.status})`);
        }

        const data = await response.json();
        const normalized = Array.isArray(data) ? data : [];
        setInvoices(normalized);
        setSelectedInvoiceId((current) => {
          if (!current) {
            return null;
          }

          return normalized.some((invoice) => invoice.id === current) ? current : null;
        });
      } catch (loadErr) {
        const message = loadErr instanceof Error ? loadErr.message : "Failed to load invoices.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadInvoices();
  }, []);

  const salesTrend = useMemo<TrendPoint[]>(() => {
    const grouped = new Map<string, { timestamp: number; revenue: number }>();

    invoices.forEach((invoice) => {
      const sourceDate = invoice.issued_at ?? null;
      if (!sourceDate) {
        return;
      }

      const date = new Date(sourceDate);
      if (Number.isNaN(date.getTime())) {
        return;
      }

      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const existing = grouped.get(key);
      const grandTotal = toNumber(invoice.grand_total);
      if (existing) {
        existing.revenue += grandTotal;
      } else {
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        grouped.set(key, { timestamp: dayStart, revenue: grandTotal });
      }
    });

    return Array.from(grouped.values())
      .sort((left, right) => left.timestamp - right.timestamp)
      .slice(-7)
      .map((point) => ({
        label: new Date(point.timestamp).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        revenue: Math.round(point.revenue),
      }));
  }, [invoices]);

  const metrics = useMemo(() => {
    const totalRevenue = invoices.reduce((sum, invoice) => sum + toNumber(invoice.grand_total), 0);
    const totalTax = invoices.reduce((sum, invoice) => sum + toNumber(invoice.tax_amount), 0);
    const totalDiscount = invoices.reduce((sum, invoice) => sum + toNumber(invoice.discount_amount), 0);

    return {
      invoiceCount: invoices.length,
      totalRevenue,
      avgTicket: invoices.length > 0 ? totalRevenue / invoices.length : 0,
      totalTax,
      totalDiscount,
    };
  }, [invoices]);

  const selectedInvoice = useMemo(() => {
    if (!selectedInvoiceId) {
      return null;
    }

    return invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null;
  }, [invoices, selectedInvoiceId]);

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
      case "Sales":
        router.push("/manager-dash/sales");
        break;
      default:
        break;
    }
  };

  return (
    <ProtectedRoute requiredRole="manager">
      <main className="min-h-screen w-full bg-linear-to-b from-background via-blue-50/20 to-background dark:bg-linear-to-br dark:from-background dark:via-background dark:to-card">
        <MacOSSidebar
          items={[
            { label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
            { label: "Staff", icon: <Users className="size-4" /> },
            { label: "Inventory", icon: <Boxes className="size-4" /> },
            { label: "Recipe", icon: <BookOpen className="size-4" /> },
            { label: "Restaurant", icon: <Building2 className="size-4" /> },
            { label: "Sales", icon: <BarChart3 className="size-4" /> },
          ]}
          defaultOpen={false}
          initialSelectedIndex={5}
          onItemClick={handleSidebarNav}
          className="w-full max-w-384 p-1 sm:p-2 lg:p-4"
        >
          <div className="flex w-full flex-col gap-6 px-2 sm:px-4 lg:px-6 py-4">
            <header className={SALES_HEADER_SHELL}>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Sales</h1>
              <p className="mt-2 text-sm text-muted-foreground">All invoices and daily sales trend for your restaurant.</p>

              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                <div className={METRIC_CARD}>
                  <p className="text-xs text-muted-foreground">Invoices</p>
                  <p className="text-lg font-semibold text-foreground">{metrics.invoiceCount}</p>
                </div>
                <div className={METRIC_CARD}>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(metrics.totalRevenue)}</p>
                </div>
                <div className={METRIC_CARD}>
                  <p className="text-xs text-muted-foreground">Avg Ticket</p>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(metrics.avgTicket)}</p>
                </div>
                <div className={METRIC_CARD}>
                  <p className="text-xs text-muted-foreground">Tax</p>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(metrics.totalTax)}</p>
                </div>
                <div className={METRIC_CARD}>
                  <p className="text-xs text-muted-foreground">Discount</p>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(metrics.totalDiscount)}</p>
                </div>
              </div>
            </header>

            <section className={PANEL_SHELL}>
              <div className="mb-3">
                <h2 className="text-xl font-semibold text-foreground">Sales Trend</h2>
                <p className="text-sm text-muted-foreground">Same trend style as manager dashboard, based on issued invoices.</p>
              </div>

              <ChartContainer config={chartConfig} className="h-72 w-full">
                <AreaChart data={salesTrend} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={formatRevenueAxis} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-revenue)"
                    fill="url(#salesRevenue)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ChartContainer>
            </section>

            <section className={PANEL_SHELL}>
              <div className="mb-3">
                <h2 className="text-xl font-semibold text-foreground">All Invoices</h2>
                <p className="text-sm text-muted-foreground">Latest invoices generated for this restaurant.</p>
              </div>

              {error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <p className="text-sm font-medium text-destructive">{error}</p>
                </div>
              ) : null}

              {isLoading ? (
                <div className="rounded-lg border border-blue-200/40 bg-blue-50/30 px-4 py-3 dark:border-blue-500/20 dark:bg-blue-500/10">
                  <p className="text-sm text-muted-foreground">Loading invoices...</p>
                </div>
              ) : invoices.length === 0 ? (
                <div className="rounded-lg border border-blue-200/40 bg-blue-50/30 px-4 py-3 dark:border-blue-500/20 dark:bg-blue-500/10">
                  <p className="text-sm text-muted-foreground">No invoices found yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-blue-50/60 dark:bg-blue-500/10">
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead>Issued</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="text-right">Grand Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow
                          key={invoice.id}
                          onClick={() => setSelectedInvoiceId(invoice.id)}
                          className={`cursor-pointer ${selectedInvoiceId === invoice.id ? "bg-blue-100/60 dark:bg-blue-500/15" : ""}`}
                        >
                          <TableCell className="font-medium text-foreground">{invoice.invoice_number}</TableCell>
                          <TableCell className="text-muted-foreground">{invoice.order_id ? invoice.order_id.slice(0, 8) : "-"}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDateTime(invoice.issued_at)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatShortDate(invoice.due_at)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatCurrency(toNumber(invoice.subtotal))}</TableCell>
                          <TableCell className="text-right font-semibold text-foreground">{formatCurrency(toNumber(invoice.grand_total))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

            </section>

            {selectedInvoice ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <button
                  type="button"
                  aria-label="Close invoice details"
                  onClick={() => setSelectedInvoiceId(null)}
                  className="absolute inset-0 bg-black/50"
                />

                <section className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-blue-200/60 bg-linear-to-b from-background to-blue-50/20 p-5 shadow-2xl dark:border-blue-500/25 dark:to-blue-500/5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Invoice Details: {selectedInvoice.invoice_number}</h3>
                      <p className="text-xs text-muted-foreground">Full invoice data</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedInvoice.order_id ? (
                        <button
                          type="button"
                          onClick={() => router.push(`/billing/${selectedInvoice.order_id}`)}
                          className="rounded-md border border-primary/30 bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                        >
                          Open Billing
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setSelectedInvoiceId(null)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-lg border border-blue-200/60 bg-blue-50/60 p-3 dark:border-blue-500/20 dark:bg-blue-500/10">
                      <p className="text-xs text-muted-foreground">Order ID</p>
                      <p className="mt-1 font-medium text-foreground">{selectedInvoice.order_id ?? "-"}</p>
                    </div>
                    <div className="rounded-lg border border-blue-200/60 bg-blue-50/60 p-3 dark:border-blue-500/20 dark:bg-blue-500/10">
                      <p className="text-xs text-muted-foreground">Issued At</p>
                      <p className="mt-1 font-medium text-foreground">{formatDateTime(selectedInvoice.issued_at)}</p>
                    </div>
                    <div className="rounded-lg border border-blue-200/60 bg-blue-50/60 p-3 dark:border-blue-500/20 dark:bg-blue-500/10">
                      <p className="text-xs text-muted-foreground">Due At</p>
                      <p className="mt-1 font-medium text-foreground">{formatDateTime(selectedInvoice.due_at)}</p>
                    </div>
                    <div className="rounded-lg border border-blue-200/60 bg-blue-50/60 p-3 dark:border-blue-500/20 dark:bg-blue-500/10">
                      <p className="text-xs text-muted-foreground">Subtotal</p>
                      <p className="mt-1 font-medium text-foreground">{formatCurrency(toNumber(selectedInvoice.subtotal))}</p>
                    </div>
                    <div className="rounded-lg border border-blue-200/60 bg-blue-50/60 p-3 dark:border-blue-500/20 dark:bg-blue-500/10">
                      <p className="text-xs text-muted-foreground">Tax</p>
                      <p className="mt-1 font-medium text-foreground">
                        {toNumber(selectedInvoice.tax_percent).toFixed(2)}% ({formatCurrency(toNumber(selectedInvoice.tax_amount))})
                      </p>
                    </div>
                    <div className="rounded-lg border border-blue-200/60 bg-blue-50/60 p-3 dark:border-blue-500/20 dark:bg-blue-500/10">
                      <p className="text-xs text-muted-foreground">Service Charge</p>
                      <p className="mt-1 font-medium text-foreground">
                        {toNumber(selectedInvoice.service_charge_percent).toFixed(2)}% ({formatCurrency(toNumber(selectedInvoice.service_charge_amount))})
                      </p>
                    </div>
                    <div className="rounded-lg border border-blue-200/60 bg-blue-50/60 p-3 dark:border-blue-500/20 dark:bg-blue-500/10">
                      <p className="text-xs text-muted-foreground">Discount</p>
                      <p className="mt-1 font-medium text-foreground">
                        {toNumber(selectedInvoice.discount_percent).toFixed(2)}% ({formatCurrency(toNumber(selectedInvoice.discount_amount))})
                      </p>
                    </div>
                    <div className="rounded-lg border border-blue-300/70 bg-blue-100/70 p-3 sm:col-span-2 lg:col-span-1 dark:border-blue-500/35 dark:bg-blue-500/15">
                      <p className="text-xs text-muted-foreground">Grand Total</p>
                      <p className="mt-1 text-base font-semibold text-foreground">{formatCurrency(toNumber(selectedInvoice.grand_total))}</p>
                    </div>
                  </div>

                  {selectedInvoice.notes ? (
                    <div className="mt-3 rounded-lg border border-border/70 bg-card/60 p-3">
                      <p className="text-xs text-muted-foreground">Notes</p>
                      <p className="mt-1 text-sm text-foreground">{selectedInvoice.notes}</p>
                    </div>
                  ) : null}
                </section>
              </div>
            ) : null}
          </div>
        </MacOSSidebar>
      </main>
    </ProtectedRoute>
  );
}

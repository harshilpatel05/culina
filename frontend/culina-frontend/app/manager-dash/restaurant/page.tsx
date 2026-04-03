"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Boxes,
  Building2,
  LayoutDashboard,
  Pencil,
  Plus,
  Receipt,
  Search,
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

type TableStatus = "available" | "occupied";

type RestaurantTable = {
  id: string;
  restaurant_id: string | null;
  table_number: number;
  capacity: number | null;
  status: TableStatus | null;
};

type TableFormState = {
  tableNumber: string;
  capacity: string;
  status: TableStatus;
};

const EMPTY_FORM: TableFormState = {
  tableNumber: "",
  capacity: "",
  status: "available",
};

const PANEL_SHELL = "rounded-2xl border border-slate-300/90 bg-card/70 p-4 shadow-sm backdrop-blur-sm dark:border-slate-600/70";
const SUBTLE_PANEL = "rounded-2xl border border-slate-300/80 bg-card/60 shadow-sm backdrop-blur-sm dark:border-slate-600/60";
const FIELD_INPUT = "w-full rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm outline-none ring-primary transition focus:border-primary/60 focus:ring-2";

const statusLabelMap: Record<TableStatus, string> = {
  available: "Available",
  occupied: "Occupied",
};

const statusClassMap: Record<TableStatus, string> = {
  available: "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  occupied: "border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

export default function ManagerRestaurantPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const managerRestaurantId = user?.restaurant_id ?? null;
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [billingTableId, setBillingTableId] = useState<string | null>(null);
  const [form, setForm] = useState<TableFormState>(EMPTY_FORM);

  const loadData = async (restaurantId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const tablesRes = await fetch("/api/tables");

      if (!tablesRes.ok) {
        throw new Error(`Could not load table data (${tablesRes.status})`);
      }

      const tablesData: RestaurantTable[] = await tablesRes.json();
      setTables(
        Array.isArray(tablesData)
          ? tablesData.filter((t) => t.restaurant_id === restaurantId)
          : []
      );
    } catch (loadErr) {
      const message = loadErr instanceof Error ? loadErr.message : "Failed to load table data.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (managerRestaurantId) {
      loadData(managerRestaurantId);
    }
  }, [managerRestaurantId]);

  const filteredTables = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return tables;
    }

    return tables.filter((table) => {
      const tableNumber = String(table.table_number ?? "");
      const capacity = String(table.capacity ?? "");
      const status = (table.status ?? "").toLowerCase();

      return (
        tableNumber.includes(normalizedQuery) ||
        capacity.includes(normalizedQuery) ||
        status.includes(normalizedQuery)
      );
    });
  }, [query, tables]);

  const metrics = useMemo(() => {
    const totalTables = tables.length;
    const availableTables = tables.filter((table) => (table.status ?? "available") === "available").length;
    const occupiedTables = tables.filter((table) => table.status === "occupied").length;

    return {
      totalTables,
      availableTables,
      occupiedTables,
    };
  }, [tables]);

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

  const openEdit = (table: RestaurantTable) => {
    setEditingId(table.id);
    setForm({
      tableNumber: String(table.table_number),
      capacity: table.capacity != null ? String(table.capacity) : "",
      status: (table.status ?? "available") as TableStatus,
    });
    setIsFormOpen(true);
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!managerRestaurantId) {
      setError("No restaurant is associated with your account.");
      return;
    }

    const parsedTableNumber = Number(form.tableNumber);
    if (Number.isNaN(parsedTableNumber) || parsedTableNumber <= 0 || !Number.isInteger(parsedTableNumber)) {
      setError("Table number must be a valid positive integer.");
      return;
    }

    const parsedCapacity = form.capacity.trim() ? Number(form.capacity) : null;
    if (parsedCapacity != null && (Number.isNaN(parsedCapacity) || parsedCapacity < 0 || !Number.isInteger(parsedCapacity))) {
      setError("Capacity must be a valid positive integer.");
      return;
    }

    if (!(["available", "occupied"] as const).includes(form.status)) {
      setError("Please select a valid status.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const payload = {
        restaurant_id: managerRestaurantId,
        table_number: parsedTableNumber,
        capacity: parsedCapacity,
        status: form.status,
      };

      const isEditing = Boolean(editingId);
      const endpoint = isEditing ? `/api/tables/${editingId}` : "/api/tables";
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
        throw new Error(responseBody?.error ?? "Could not save table record.");
      }

      await loadData(managerRestaurantId);
      resetForm();
    } catch (submitErr) {
      const message = submitErr instanceof Error ? submitErr.message : "Failed to save table record.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteTable = async (id: string) => {
    const shouldDelete = window.confirm("Delete this table? This action cannot be undone.");
    if (!shouldDelete) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/tables/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        throw new Error(responseBody?.error ?? "Could not delete table.");
      }
      if (managerRestaurantId) await loadData(managerRestaurantId);
    } catch (deleteErr) {
      const message = deleteErr instanceof Error ? deleteErr.message : "Failed to delete table.";
      setError(message);
    }
  };

  const openBillingForTable = async (table: RestaurantTable) => {
    try {
      setBillingTableId(table.id);
      setError(null);

      const searchParams = new URLSearchParams({
        table_id: table.id,
      });

      const response = await fetch(`/api/orders?${searchParams.toString()}`);

      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        throw new Error(responseBody?.error ?? "Could not resolve billable order for this table.");
      }

      const orders = await response.json();
      const billableStatuses = new Set(["served", "completed"]);
      const unpaidStatuses = new Set(["", "pending", "unpaid", "partial"]);
      const latestOrder = Array.isArray(orders)
        ? orders.find((order) => {
            const normalizedStatus = String(order?.status ?? "").toLowerCase();
            const normalizedPaymentStatus = String(order?.payment_status ?? "").toLowerCase();
            return billableStatuses.has(normalizedStatus) && unpaidStatuses.has(normalizedPaymentStatus);
          })
        : null;

      if (!latestOrder?.id) {
        throw new Error("No pending bill found for this table.");
      }

      router.push(`/billing/${latestOrder.id}`);
    } catch (billingErr) {
      const message = billingErr instanceof Error ? billingErr.message : "Failed to open billing page.";
      setError(message);
    } finally {
      setBillingTableId((current) => (current === table.id ? null : current));
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

  if (authLoading) {
    return <main className="min-h-screen bg-background" />;
  }

  if (!managerRestaurantId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No restaurant is associated with your account. Contact your administrator.
        </p>
      </main>
    );
  }

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
        onItemClick={handleSidebarNav}
        className="w-full max-w-384 p-1 sm:p-2 lg:p-4"
      >
        <div className="flex w-full flex-col gap-6 pl-3 sm:pl-4 lg:pl-5">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
            <header className="rounded-3xl border border-cyan-400/75 bg-linear-to-br from-cyan-100 via-sky-200 to-blue-300 p-6 shadow-[0_8px_22px_rgba(14,116,144,0.18)] backdrop-blur dark:border-cyan-400/55 dark:from-cyan-950 dark:via-sky-900/90 dark:to-blue-950/90">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Manager Console</p>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground">Table Management</h1>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    Manage restaurant table inventory, assign capacities, and track availability status in real time.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Add Table
                </button>
              </div>
            </header>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <article className={SUBTLE_PANEL + " p-4"}>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Total Tables</p>
                <div className="mt-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <p className="text-2xl font-semibold text-foreground">{metrics.totalTables}</p>
                </div>
              </article>
              <article className={SUBTLE_PANEL + " p-4"}>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Available</p>
                <p className="mt-3 text-2xl font-semibold text-foreground">{metrics.availableTables}</p>
              </article>
              <article className={SUBTLE_PANEL + " p-4 sm:col-span-2 xl:col-span-1"}>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Occupied</p>
                <p className="mt-3 text-2xl font-semibold text-foreground">{metrics.occupiedTables}</p>
              </article>
            </section>

            <section className={PANEL_SHELL}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-foreground">Table Register</h2>
                <div className="relative w-full sm:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by table number, capacity, or status"
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
                      <th className="px-3 py-3 font-medium">Table #</th>
                      <th className="px-3 py-3 font-medium">Capacity</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-3 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                          Loading table records...
                        </td>
                      </tr>
                    ) : filteredTables.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                          No tables found. Add your first table.
                        </td>
                      </tr>
                    ) : (
                      filteredTables.map((table) => {
                        const normalizedStatus = (table.status ?? "available") as TableStatus;
                        return (
                          <tr key={table.id} className="border-b border-border/40 hover:bg-muted/40">
                            <td className="px-3 py-3 font-medium text-foreground">{table.table_number}</td>
                            <td className="px-3 py-3 text-muted-foreground">{table.capacity ?? "-"}</td>
                            <td className="px-3 py-3 text-muted-foreground">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClassMap[normalizedStatus]}`}>
                                {statusLabelMap[normalizedStatus]}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openBillingForTable(table)}
                                  disabled={billingTableId === table.id}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/40 text-emerald-600 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                                  aria-label="Open billing"
                                >
                                  <Receipt className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEdit(table)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition hover:text-foreground"
                                  aria-label="Edit table"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteTable(table.id)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/40 text-red-500 transition hover:bg-red-500/10"
                                  aria-label="Delete table"
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
                        {editingId ? "Edit Table" : "Add Table"}
                      </h3>
                      <button
                        type="button"
                        onClick={resetForm}
                        className="rounded-lg border border-border/70 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>

                    <form onSubmit={submitForm} className="grid gap-5 md:grid-cols-2">
                      <label className="space-y-2.5">
                        <span className="text-sm font-medium text-foreground">Table Number</span>
                        <input
                          value={form.tableNumber}
                          onChange={(event) => setForm((previous) => ({ ...previous, tableNumber: event.target.value }))}
                          type="number"
                          min="1"
                          step="1"
                          className={FIELD_INPUT}
                          placeholder="e.g. 12"
                          required
                        />
                      </label>

                      <label className="space-y-2.5">
                        <span className="text-sm font-medium text-foreground">Capacity</span>
                        <input
                          value={form.capacity}
                          onChange={(event) => setForm((previous) => ({ ...previous, capacity: event.target.value }))}
                          type="number"
                          min="0"
                          step="1"
                          className={FIELD_INPUT}
                          placeholder="e.g. 4"
                        />
                      </label>

                      <label className="space-y-2.5 md:col-span-2">
                        <span className="text-sm font-medium text-foreground">Status</span>
                        <Select
                          value={form.status}
                          onValueChange={(value) => setForm((previous) => ({ ...previous, status: value as TableStatus }))}
                        >
                          <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background px-3 text-sm">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border/70">
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="occupied">Occupied</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>

                      <div className="md:col-span-2">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isSubmitting ? "Saving..." : editingId ? "Save Changes" : "Create Table"}
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

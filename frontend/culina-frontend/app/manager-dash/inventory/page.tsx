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
  wastageQty: string;
};

const EMPTY_FORM: InventoryFormState = {
  ingredientId: "",
  currentStock: "0",
  reorderLevel: "0",
  wastageQty: "0",
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
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InventoryFormState>(EMPTY_FORM);

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

      const [inventoryRes, ingredientsRes] = await Promise.all([
        fetch("/api/inventory"),
        fetch("/api/ingredients"),
      ]);

      if (!inventoryRes.ok || !ingredientsRes.ok) {
        throw new Error(`Could not load inventory data (${inventoryRes.status}/${ingredientsRes.status})`);
      }

      const inventoryData = await inventoryRes.json();
      const ingredientsData = await ingredientsRes.json();

      const normalizedInventory = Array.isArray(inventoryData)
        ? inventoryData
        : Array.isArray(inventoryData?.data)
          ? inventoryData.data
          : [];

      setInventory(normalizedInventory as InventoryRecord[]);
      setIngredients(Array.isArray(ingredientsData) ? ingredientsData : []);
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
      wastageQty: String(item.wastage_qty ?? 0),
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
    const wastageQty = Number(form.wastageQty);

    if ([currentStock, reorderLevel, wastageQty].some((value) => Number.isNaN(value) || value < 0)) {
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
        wastage_qty: wastageQty,
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
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Add Inventory Record
                </button>
              </div>
            </header>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
              <article className={SUBTLE_PANEL + " p-4 sm:col-span-2 xl:col-span-1"}>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Total Wastage</p>
                <p className="mt-3 text-2xl font-semibold text-foreground">{metrics.totalWastage.toFixed(2)}</p>
              </article>
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

                        <label className="space-y-2.5 md:col-span-2">
                          <span className="text-sm font-medium text-foreground">Wastage Qty</span>
                          <input
                            value={form.wastageQty}
                            onChange={(event) => setForm((previous) => ({ ...previous, wastageQty: event.target.value }))}
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

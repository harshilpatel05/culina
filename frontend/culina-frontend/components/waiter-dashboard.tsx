"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, LogOut, Plus, ChevronRight, Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/theme-provider";

type TableStatus = "Seated" | "Order Taken" | "Dish Ready" | "Served" | "Needs Bill";

type ActiveTable = {
  id: string;
  tableNumber: string;
  status: TableStatus;
  guests: number;
  runningTotal: number;
};

type WaiterDashboardProps = {
  waiterName?: string;
  shiftHours?: number[];
};

const STATUS_FLOW: TableStatus[] = ["Seated", "Order Taken", "Dish Ready", "Served", "Needs Bill"];
const DEFAULT_SHIFT_HOURS = [3, 34, 28];

const INITIAL_TABLES: ActiveTable[] = [
  { id: "t1", tableNumber: "01", status: "Dish Ready", guests: 4, runningTotal: 124.5 },
  { id: "t2", tableNumber: "02", status: "Seated", guests: 2, runningTotal: 0 },
  { id: "t3", tableNumber: "03", status: "Order Taken", guests: 3, runningTotal: 63.0 },
  { id: "t4", tableNumber: "04", status: "Needs Bill", guests: 5, runningTotal: 212.8 },
];

const statusColorMap: Record<TableStatus, string> = {
  Seated: "border-blue-200/30 bg-blue-500/10 text-blue-300 dark:border-blue-400/30 dark:bg-blue-500/20 dark:text-blue-200",
  "Order Taken": "border-amber-200/30 bg-amber-500/10 text-amber-300 dark:border-amber-400/30 dark:bg-amber-500/20 dark:text-amber-200",
  "Dish Ready": "border-green-200/30 bg-green-500/10 text-green-300 dark:border-green-400/30 dark:bg-green-500/20 dark:text-green-200",
  Served: "border-purple-200/30 bg-purple-500/10 text-purple-300 dark:border-purple-400/30 dark:bg-purple-500/20 dark:text-purple-200",
  "Needs Bill": "border-red-200/30 bg-red-500/10 text-red-300 dark:border-red-400/30 dark:bg-red-500/20 dark:text-red-200",
};

export function WaiterDashboard({
  waiterName = "Harshil",
  shiftHours = DEFAULT_SHIFT_HOURS,
}: WaiterDashboardProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [tables, setTables] = useState<ActiveTable[]>(INITIAL_TABLES);
  const [openTableId, setOpenTableId] = useState<string | null>(null);
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [isLoggedOut, setIsLoggedOut] = useState(false);
  const [newOrder, setNewOrder] = useState({ tableNumber: "", guests: "2", notes: "" });

  const openTable = tables.find((table) => table.id === openTableId) ?? null;

  const metrics = useMemo(() => {
    const readyCount = tables.filter((table) => table.status === "Dish Ready").length;
    const billCount = tables.filter((table) => table.status === "Needs Bill").length;
    const revenue = tables.reduce((sum, table) => sum + table.runningTotal, 0);

    return {
      activeCount: tables.length,
      readyCount,
      billCount,
      revenue,
    };
  }, [tables]);

  const updateStatus = (tableId: string, status: TableStatus) => {
    setTables((prev) => prev.map((table) => (table.id === tableId ? { ...table, status } : table)));
  };

  const moveToNextStatus = (tableId: string) => {
    setTables((prev) =>
      prev.map((table) => {
        if (table.id !== tableId) {
          return table;
        }

        const currentIndex = STATUS_FLOW.indexOf(table.status);
        const nextStatus = STATUS_FLOW[(currentIndex + 1) % STATUS_FLOW.length];
        return { ...table, status: nextStatus };
      })
    );
  };

  const createOrder = (event: React.FormEvent) => {
    event.preventDefault();

    if (!newOrder.tableNumber.trim()) {
      return;
    }

    const created: ActiveTable = {
      id: `t-${Date.now()}`,
      tableNumber: newOrder.tableNumber.padStart(2, "0"),
      status: "Order Taken",
      guests: Number(newOrder.guests) || 1,
      runningTotal: 0,
    };

    setTables((prev) => [created, ...prev]);
    setOpenTableId(created.id);
    setNewOrder({ tableNumber: "", guests: "2", notes: "" });
    setIsOrderFormOpen(false);
  };

  return (
    <main className="min-h-screen w-full bg-background dark:bg-gradient-to-br dark:from-background dark:via-background dark:to-card">
      <div className="mx-auto w-full max-w-7xl flex flex-col gap-8 p-4 sm:p-6 lg:p-8">
          {/* Header Section */}
          <header className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-4 flex-1">
              <div>
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
                  Good day, {waiterName}
                </h1>
                <p className="text-muted-foreground mt-2">Manage your tables and shift performance</p>
              </div>
              
              {/* Metrics Cards */}
              <div className="grid grid-cols-3 gap-3">
                <motion.div
                  className="rounded-lg border border-border bg-card/50 backdrop-blur-sm px-4 py-3"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <p className="text-xs text-muted-foreground font-medium">Active Tables</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{metrics.activeCount}</p>
                </motion.div>
                
                <motion.div
                  className="rounded-lg border border-border bg-card/50 backdrop-blur-sm px-4 py-3"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <p className="text-xs text-muted-foreground font-medium">Dish Ready</p>
                  <p className="text-2xl font-bold text-green-400 mt-1">{metrics.readyCount}</p>
                </motion.div>
                
                <motion.div
                  className="rounded-lg border border-border bg-card/50 backdrop-blur-sm px-4 py-3"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <p className="text-xs text-muted-foreground font-medium">Needs Bill</p>
                  <p className="text-2xl font-bold text-red-400 mt-1">{metrics.billCount}</p>
                </motion.div>
              </div>
            </div>

            {/* Right Section */}
            <div className="flex flex-col items-start xl:items-end gap-6">
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Shift Hours</span>
                <div className="flex items-center gap-2">
                  {shiftHours.map((value, index) => (
                    <motion.div
                      key={`${value}-${index}`}
                      className="h-12 w-12 rounded-lg border border-border bg-card/50 flex items-center justify-center
                                 text-lg font-bold text-foreground backdrop-blur-sm"
                      whileHover={{ scale: 1.05, backgroundColor: "var(--card)" }}
                      transition={{ type: "spring", stiffness: 400, damping: 10 }}
                    >
                      {value}
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <motion.button
                  type="button"
                  onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                  className="flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-all
                             bg-card border border-border text-foreground hover:bg-secondary dark:hover:bg-secondary/50"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
                >
                  {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                  <span className="hidden sm:inline">
                    {resolvedTheme === "dark" ? "Light" : "Dark"}
                  </span>
                </motion.button>

                <motion.button
                  type="button"
                  onClick={() => setIsOrderFormOpen((prev) => !prev)}
                  disabled={isLoggedOut}
                  className="flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-all
                             bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed
                             border border-primary/20"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Plus size={18} />
                  {isOrderFormOpen ? "Close" : "New Order"}
                </motion.button>

                <motion.button
                  type="button"
                  onClick={() => setIsLoggedOut(true)}
                  className="flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-all
                             bg-card border border-border text-foreground hover:bg-secondary dark:hover:bg-secondary/50"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <LogOut size={18} />
                  <span className="hidden sm:inline">Logout</span>
                </motion.button>
              </div>
            </div>
          </header>

          {/* New Order Form */}
          <AnimatePresence>
            {isOrderFormOpen && (
              <motion.section
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-6"
              >
                <h3 className="text-lg font-semibold text-foreground mb-4">Create New Order</h3>
                <form className="grid grid-cols-1 md:grid-cols-4 gap-4" onSubmit={createOrder}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Table Number</label>
                    <input
                      value={newOrder.tableNumber}
                      onChange={(event) => setNewOrder((prev) => ({ ...prev, tableNumber: event.target.value.replace(/\D/g, "") }))}
                      placeholder="05"
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground
                                 outline-none transition-all focus:ring-2 focus:ring-accent focus:border-transparent"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Number of Guests</label>
                    <input
                      value={newOrder.guests}
                      onChange={(event) => setNewOrder((prev) => ({ ...prev, guests: event.target.value.replace(/\D/g, "") }))}
                      placeholder="2"
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground
                                 outline-none transition-all focus:ring-2 focus:ring-accent focus:border-transparent"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Special Notes (Optional)</label>
                    <input
                      value={newOrder.notes}
                      onChange={(event) => setNewOrder((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="Birthday celebration, allergies..."
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground
                                 outline-none transition-all focus:ring-2 focus:ring-accent focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsOrderFormOpen(false)}
                      className="rounded-lg px-5 py-2.5 text-sm font-medium transition-all
                                 bg-secondary text-foreground hover:bg-secondary/80 border border-border"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newOrder.tableNumber.trim()}
                      className="rounded-lg px-5 py-2.5 text-sm font-medium transition-all
                                 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed
                                 border border-primary/20"
                    >
                      Create Order
                    </button>
                  </div>
                </form>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Active Tables Section */}
          <section className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Active Tables</h2>
              <p className="text-muted-foreground mt-1">Tap a table to view details and manage orders</p>
            </div>

            {isLoggedOut && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
              >
                <p className="text-sm text-destructive font-medium">Logged out (demo state)</p>
              </motion.div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {tables.map((table) => (
                <motion.button
                  key={table.id}
                  type="button"
                  onClick={() => setOpenTableId(table.id)}
                  className={`relative aspect-square rounded-xl border transition-all
                             ${table.status === "Dish Ready" ? "border-green-400/50 bg-green-500/10 hover:bg-green-500/15" :
                               table.status === "Needs Bill" ? "border-red-400/50 bg-red-500/10 hover:bg-red-500/15" :
                               table.status === "Order Taken" ? "border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/15" :
                               table.status === "Seated" ? "border-blue-400/50 bg-blue-500/10 hover:bg-blue-500/15" :
                               "border-border bg-card/50 hover:bg-card"}
                             overflow-hidden group`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="h-full flex flex-col items-center justify-center gap-3 p-4">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-current bg-background/50 text-2xl font-bold text-foreground">
                      {table.tableNumber}
                    </div>
                    <div className="flex flex-col items-center gap-2 w-full">
                      <span className={`inline-flex items-center justify-center rounded-md border px-2.5 py-1 text-xs font-semibold text-center ${statusColorMap[table.status]}`}>
                        {table.status}
                      </span>
                      <div className="text-xs text-muted-foreground font-medium">
                        {table.guests} {table.guests === 1 ? "guest" : "guests"}
                      </div>
                    </div>
                  </div>
                  
                  {/* Hover indicator */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-xl backdrop-blur-sm">
                    <ChevronRight className="text-white" size={24} />
                  </div>
                </motion.button>
              ))}
            </div>
          </section>

          {/* Table Details Modal */}
          <AnimatePresence>
            {openTable && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setOpenTableId(null)}
                  className="fixed inset-0 backdrop-blur-md bg-black/60"
                />

                <div className="relative w-full max-w-2xl z-51 my-auto pointer-events-none">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: 40 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: 40 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300, mass: 0.8 }}
                    className="pointer-events-auto w-full rounded-2xl border border-border overflow-hidden
                               bg-gradient-to-b from-card to-card/95 shadow-2xl"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                      <div>
                        <h3 className="text-2xl font-bold text-foreground">
                          Table {openTable.tableNumber}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">{openTable.guests} {openTable.guests === 1 ? "guest" : "guests"}</p>
                      </div>
                      <motion.button
                        onClick={() => setOpenTableId(null)}
                        whileHover={{ rotate: 90 }}
                        className="text-muted-foreground hover:text-foreground transition-colors p-2"
                      >
                        <X size={24} />
                      </motion.button>
                    </div>

                    {/* Content */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 md:p-8">
                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Current Status</label>
                        <select
                          value={openTable.status}
                          onChange={(event) => updateStatus(openTable.id, event.target.value as TableStatus)}
                          className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground
                                     outline-none transition-all focus:ring-2 focus:ring-accent focus:border-transparent
                                     font-medium text-base"
                        >
                          {STATUS_FLOW.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Number of Guests</label>
                        <div className="w-full px-4 py-3 rounded-lg border border-border bg-background/50 text-foreground
                                        font-semibold text-lg">
                          {openTable.guests}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Running Total</label>
                        <div className="w-full px-4 py-3 rounded-lg border border-border bg-background/50 text-foreground font-bold text-lg">
                          <span className="text-green-400">${openTable.runningTotal.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Shift Revenue</label>
                        <div className="w-full px-4 py-3 rounded-lg border border-border bg-background/50 text-foreground font-bold text-lg">
                          <span className="text-accent">${metrics.revenue.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-5 md:px-8 flex flex-col-reverse sm:flex-row items-center justify-between gap-4 bg-card/50 border-t border-border">
                      <span className="text-xs text-muted-foreground text-center sm:text-left">Click outside to close</span>
                      <div className="flex gap-3 w-full sm:w-auto">
                        <motion.button
                          onClick={() => moveToNextStatus(openTable.id)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-sm font-medium transition-all
                                     bg-secondary text-foreground hover:bg-secondary/80 border border-border"
                        >
                          Next Status
                        </motion.button>
                        <motion.button
                          onClick={() => setOpenTableId(null)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-sm font-medium transition-all
                                     bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/20"
                        >
                          Done
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            )}
          </AnimatePresence>
      </div>
    </main>
  );
}

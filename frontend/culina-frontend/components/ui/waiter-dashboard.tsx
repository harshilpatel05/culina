"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, LogOut, Plus, ChevronRight, Moon, Sun, Clock } from "lucide-react";
import { useTheme } from "@/app/theme-provider";
import { AdaptiveSlider } from "@/components/ui/adaptive-slider";
import { useAuth } from "@/hooks/use-auth";

type TableStatus = "Seated" | "Order Taken" | "Dish Ready" | "Served" | "Needs Bill";

type OrderStatus = 'placed' | 'preparing' | 'served' | 'completed' | 'cancelled';

type ActiveTable = {
  id: string;
  tableNumber: string;
  status: TableStatus;
  guests: number;
  runningTotal: number;
  orderItems: OrderItem[];
};

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
};

type WaiterDashboardProps = {
  waiterName?: string;
  shiftHours?: number[];
};

type DraftOrderItem = {
  dishId: string;
  name: string;
  quantity: string;
  price: string;
};

type RestaurantTable = {
  id: string;
  table_number: number;
};

type MenuItem = {
  id: string;
  name: string;
  price: number;
};

const DEFAULT_SHIFT_HOURS = [3, 34, 28];


const statusColorMap: Record<TableStatus, string> = {
  Seated: "border-blue-200/30 bg-blue-500/10 text-blue-300 dark:border-blue-400/30 dark:bg-blue-500/20 dark:text-blue-200",
  "Order Taken": "border-amber-200/30 bg-amber-500/10 text-amber-300 dark:border-amber-400/30 dark:bg-amber-500/20 dark:text-amber-200",
  "Dish Ready": "border-green-200/30 bg-green-500/10 text-green-300 dark:border-green-400/30 dark:bg-green-500/20 dark:text-green-200",
  Served: "border-purple-200/30 bg-purple-500/10 text-purple-300 dark:border-purple-400/30 dark:bg-purple-500/20 dark:text-purple-200",
  "Needs Bill": "border-red-200/30 bg-red-500/10 text-red-300 dark:border-red-400/30 dark:bg-red-500/20 dark:text-red-200",
};

function mapOrderStatusToTableStatus(orderStatus: OrderStatus | string): TableStatus {
  switch (orderStatus) {
    case 'placed':
      return 'Order Taken';
    case 'preparing':
      return 'Dish Ready';
    case 'served':
      return 'Served';
    case 'completed':
      return 'Needs Bill';
    case 'cancelled':
      return 'Order Taken';
    default:
      return 'Order Taken';
  }
}

export function WaiterDashboard({
  waiterName,
  shiftHours = DEFAULT_SHIFT_HOURS,
}: WaiterDashboardProps) {
  const { user, logout } = useAuth();
  const displayName = waiterName ?? user?.name ?? "";
  const { resolvedTheme, setTheme } = useTheme();
  const [tables, setTables] = useState<ActiveTable[]>([]);
  const [openTableId, setOpenTableId] = useState<string | null>(null);
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [newOrder, setNewOrder] = useState({ tableNumber: "", guests: "2", notes: "", items: [] as DraftOrderItem[] });
  const [newItem, setNewItem] = useState({ itemName: "", quantity: 1 });
  const [isQtySliderOpen, setIsQtySliderOpen] = useState(false);
  const [isDishDropdownOpen, setIsDishDropdownOpen] = useState(false);
  const [isTableDropdownOpen, setIsTableDropdownOpen] = useState(false);
  const [draftQty, setDraftQty] = useState(1);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [allTables, setAllTables] = useState<RestaurantTable[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const refreshTablesAndOrders = useCallback(async () => {
    try {
      setIsLoadingOrders(true);
      setOrdersError(null);

      const [tablesRes, ordersRes] = await Promise.all([
        fetch('/api/tables'),
        fetch('/api/orders')
      ]);

      if (!tablesRes.ok || !ordersRes.ok) {
        throw new Error(`Failed to fetch data: tables(${tablesRes.status}), orders(${ordersRes.status})`);
      }

      const tablesData = await tablesRes.json();
      const ordersData = await ordersRes.json();

      const tablesList = Array.isArray(tablesData) ? tablesData : tablesData.data || [];
      const ordersList = Array.isArray(ordersData) ? ordersData : ordersData.data || [];

      setAllTables(
        tablesList.map((table: { id: string; table_number: number }) => ({
          id: table.id,
          table_number: table.table_number
        }))
      );

      const ordersByTableId: Record<string, { id: string; status: string; num_people: number; total_amount: number; order_items?: Array<{ quantity: number; price: number; dishes?: { name?: string } }> }> = {};
      ordersList.forEach((order: { id: string; table_id?: string; status: string; num_people?: number; total_amount?: number; order_items?: Array<{ quantity: number; price: number; dishes?: { name?: string } }> }) => {
        if (!order.table_id) {
          return;
        }

        if (order.status === 'completed' || order.status === 'cancelled') {
          return;
        }

        ordersByTableId[order.table_id] = {
          id: order.id,
          status: order.status,
          num_people: order.num_people ?? 1,
          total_amount: Number(order.total_amount ?? 0),
          order_items: order.order_items
        };
      });

      const transformedTables: ActiveTable[] = tablesList
        .map((table: { id: string; table_number: number }) => {
          const order = ordersByTableId[table.id];
          return {
            id: table.id,
            tableNumber: String(table.table_number).padStart(2, '0'),
            status: order ? mapOrderStatusToTableStatus(order.status) : 'Seated',
            guests: order?.num_people || 1,
            runningTotal: order?.total_amount || 0,
            orderItems: order?.order_items && Array.isArray(order.order_items)
              ? order.order_items.map((item, idx) => ({
                  id: `${order.id}-item-${idx}`,
                  name: item.dishes?.name || 'Unknown',
                  quantity: item.quantity || 1,
                  price: Number(item.price) || 0,
                }))
              : [],
          };
        })
        .filter((table: ActiveTable) => table.status !== 'Seated' || table.orderItems.length > 0);

      setTables(transformedTables);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching data';
      setOrdersError(errorMessage);
      console.error('Failed to fetch tables and orders:', error);
    } finally {
      setIsLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    void refreshTablesAndOrders();
  }, [refreshTablesAndOrders]);

  useEffect(() => {
    const fetchMenuItems = async () => {
      if (!user?.restaurant_id) {
        setMenuItems([]);
        setIsLoadingMenu(false);
        return;
      }

      try {
        setIsLoadingMenu(true);
        const response = await fetch('/api/dishes?is_active=true');
        if (!response.ok) {
          throw new Error(`Failed to fetch dishes (${response.status})`);
        }

        const data = await response.json();
        const dishes = Array.isArray(data) ? data : data.data || [];

        setMenuItems(
          dishes.map((dish: { id: string; name: string; price: number }) => ({
            id: dish.id,
            name: dish.name,
            price: Number(dish.price) || 0
          }))
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load dishes';
        setOrdersError(errorMessage);
      } finally {
        setIsLoadingMenu(false);
      }
    };

    void fetchMenuItems();
  }, [user?.restaurant_id]);

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

  const availableTableNumbers = useMemo(() => {
    const occupiedTables = new Set(tables.map((table) => table.tableNumber));
    return allTables
      .map((table) => String(table.table_number).padStart(2, '0'))
      .filter(
        (tableNumber) => !occupiedTables.has(tableNumber) || tableNumber === newOrder.tableNumber
      )
      .sort();
  }, [allTables, tables, newOrder.tableNumber]);

  const filteredTableNumbers = useMemo(() => {
    const query = newOrder.tableNumber.trim().toLowerCase();
    if (!query) {
      return availableTableNumbers.slice(0, 8);
    }

    return availableTableNumbers
      .filter((tableNumber) => tableNumber.toLowerCase().includes(query))
      .slice(0, 8);
  }, [availableTableNumbers, newOrder.tableNumber]);

  const handleTableSelect = (tableNumber: string) => {
    setNewOrder((prev) => ({ ...prev, tableNumber }));
    setIsTableDropdownOpen(false);
  };

  const getMenuItemByName = (itemName: string) => {
    const normalized = itemName.trim().toLowerCase();
    return menuItems.find((item) => item.name.toLowerCase() === normalized);
  };

  const filteredMenuItems = useMemo(() => {
    const query = newItem.itemName.trim().toLowerCase();
    if (!query) {
      return menuItems.slice(0, 8);
    }

    return menuItems
      .filter((item) => item.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [menuItems, newItem.itemName]);

  const handleDishSelect = (item: MenuItem) => {
    setNewItem((prev) => ({ ...prev, itemName: item.name }));
    setIsDishDropdownOpen(false);
  };

  const addDraftItem = () => {
    const selectedMenuItem = getMenuItemByName(newItem.itemName);

    if (!selectedMenuItem) {
      return;
    }

    const quantity = Math.max(1, newItem.quantity);

    setNewOrder((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          dishId: selectedMenuItem.id,
          name: selectedMenuItem.name,
          quantity: String(quantity),
          price: String(selectedMenuItem.price)
        },
      ],
    }));
    setNewItem({ itemName: "", quantity: 1 });
  };

  const removeDraftItem = (indexToRemove: number) => {
    setNewOrder((prev) => ({
      ...prev,
      items: prev.items.filter((_, index) => index !== indexToRemove),
    }));
  };

  const createOrder = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!newOrder.tableNumber.trim()) {
      setOrdersError('Please select a table');
      return;
    }

    if (!user?.staff_id || !user.restaurant_id) {
      setOrdersError('Session context missing. Please log in again.');
      return;
    }

    if (newOrder.items.length === 0) {
      setOrdersError('Add at least one dish to create an order');
      return;
    }

    const selectedTable = allTables.find(
      (table) => String(table.table_number).padStart(2, '0') === newOrder.tableNumber
    );

    if (!selectedTable) {
      setOrdersError('Selected table could not be resolved');
      return;
    }

    try {
      setIsCreatingOrder(true);
      setOrdersError(null);

      const payload = {
        table_id: selectedTable.id,
        customer_id: null,
        payment_status: 'pending',
        num_people: Math.max(1, Number(newOrder.guests) || 1),
        items: newOrder.items.map((item) => ({
          dish_id: item.dishId,
          quantity: Math.max(1, Number(item.quantity) || 1)
        }))
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || `Failed to create order (${response.status})`);
      }

      await refreshTablesAndOrders();
      setOpenTableId(null);
      setNewOrder({ tableNumber: '', guests: '2', notes: '', items: [] });
      setNewItem({ itemName: '', quantity: 1 });
      setIsOrderFormOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create order';
      setOrdersError(errorMessage);
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    try {
      setLogoutError(null);
      setIsLoggingOut(true);
      await logout();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Logout failed. Please try again.";
      setLogoutError(errorMessage);
      setIsLoggingOut(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-background dark:bg-linear-to-br dark:from-background dark:via-background dark:to-card">
      <div className="mx-auto w-full max-w-7xl flex flex-col gap-8 p-4 sm:p-6 lg:p-8">
          {/* Header Section */}
          <header className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-4 flex-1">
              <div>
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
                  Good day, {displayName}
                </h1>
                <p className="text-muted-foreground mt-2">Manage your tables and shift performance</p>
              </div>
              
              {/* Metrics Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

                <motion.div
                  className="rounded-lg border border-border bg-card/50 backdrop-blur-sm px-4 py-3"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <p className="text-xs text-muted-foreground font-medium">Shift Revenue</p>
                  <p className="text-2xl font-bold text-accent mt-1">₹{metrics.revenue.toFixed(2)}</p>
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

              <div className="grid w-full grid-cols-[3rem,1fr,auto] gap-3 sm:w-auto">
                <motion.button
                  type="button"
                  onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                  className="flex h-12 w-12 items-center justify-center rounded-md text-sm font-semibold transition-all
                             bg-card border border-border text-foreground hover:bg-secondary dark:hover:bg-secondary/50"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
                >
                  {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}

                </motion.button>

                <motion.button
                  type="button"
                  onClick={() => setIsOrderFormOpen((prev) => !prev)}
                  disabled={isLoggingOut}
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
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-all
                             bg-card border border-border text-foreground hover:bg-secondary dark:hover:bg-secondary/50
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <LogOut size={18} />
                  <span className="hidden sm:inline">{isLoggingOut ? "Logging out..." : "Logout"}</span>
                </motion.button>

                <motion.button
                  type="button"
                  onClick={() => setIsShiftActive((prev) => !prev)}
                  disabled={isLoggingOut}
                  className={`col-span-3 w-full rounded-lg px-5 py-2 text-sm font-bold tracking-wide transition-all border-2 shadow-lg ring-1 ${
                    isShiftActive
                      ? "bg-red-500 border-red-600 text-white hover:bg-red-600 ring-red-400/40"
                      : "bg-neutral-900 border-neutral-700 text-white hover:bg-black ring-neutral-600/40"
                  } disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <span className="flex items-center justify-center gap-2">
                    <Clock className="size-4" />
                    {isShiftActive ? "End Shift" : "Start Shift"}
                  </span>
                </motion.button>
              </div>
            </div>
          </header>

          {/* New Order Modal */}
          <AnimatePresence>
            {isOrderFormOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsOrderFormOpen(false)}
                  className="fixed inset-0 bg-black/60 backdrop-blur-md"
                />

                <motion.section
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: "spring", damping: 24, stiffness: 280 }}
                  className="relative z-51 w-full max-w-3xl rounded-xl border border-border bg-card/95 p-6 shadow-2xl"
                >
                  <h3 className="text-lg font-semibold text-foreground mb-4">Create New Order</h3>
                  <form className="grid grid-cols-1 gap-4 md:grid-cols-4" onSubmit={createOrder}>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Table Number</label>
                      <div className="relative">
                        <input
                          value={newOrder.tableNumber}
                          onChange={(event) => {
                            const normalized = event.target.value.replace(/\D/g, '').slice(0, 2);
                            setNewOrder((prev) => ({ ...prev, tableNumber: normalized }));
                            setIsTableDropdownOpen(true);
                          }}
                          onFocus={() => setIsTableDropdownOpen(true)}
                          onBlur={() => {
                            setTimeout(() => setIsTableDropdownOpen(false), 120);
                          }}
                          disabled={allTables.length === 0}
                          placeholder={allTables.length === 0 ? 'No tables configured' : 'Search table number'}
                          className="h-11 w-full rounded-xl border border-border/70 bg-card/60 px-4 pr-10 text-sm font-medium text-foreground shadow-xs outline-none transition-all focus:border-accent/60 focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={() => setIsTableDropdownOpen((prev) => !prev)}
                          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/80"
                          aria-label="Toggle table suggestions"
                        >
                          <ChevronRight className={`size-4 transition-transform ${isTableDropdownOpen ? 'rotate-90' : '-rotate-90'}`} />
                        </button>

                        {isTableDropdownOpen && allTables.length > 0 && (
                          <div className="absolute z-60 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-border bg-card p-1 shadow-xl">
                            {filteredTableNumbers.length > 0 ? (
                              filteredTableNumbers.map((tableNumber) => (
                                <button
                                  key={tableNumber}
                                  type="button"
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    handleTableSelect(tableNumber);
                                  }}
                                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-background"
                                >
                                  <span className="font-medium text-foreground">Table {tableNumber}</span>
                                </button>
                              ))
                            ) : (
                              <div className="px-3 py-2 text-sm text-muted-foreground">No matching tables</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Number of Guests</label>
                      <input
                        value={newOrder.guests}
                        onChange={(event) => setNewOrder((prev) => ({ ...prev, guests: event.target.value.replace(/\D/g, "") }))}
                        placeholder="2"
                        className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-foreground placeholder-muted-foreground
                                 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-accent"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-muted-foreground">Special Notes (Optional)</label>
                      <input
                        value={newOrder.notes}
                        onChange={(event) => setNewOrder((prev) => ({ ...prev, notes: event.target.value }))}
                        placeholder="Birthday celebration, allergies..."
                        className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-foreground placeholder-muted-foreground
                                 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-accent"
                      />
                    </div>

                    <div className="space-y-3 md:col-span-4 rounded-lg border border-border bg-background/40 p-4">
                      <p className="text-sm font-medium text-foreground">Add Food Items</p>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                        <div className="relative md:col-span-3">
                          <input
                            value={newItem.itemName}
                            onChange={(event) => {
                              setNewItem((prev) => ({ ...prev, itemName: event.target.value }));
                              setIsDishDropdownOpen(true);
                            }}
                            onFocus={() => setIsDishDropdownOpen(true)}
                            onBlur={() => {
                              setTimeout(() => setIsDishDropdownOpen(false), 120);
                            }}
                            disabled={isLoadingMenu || menuItems.length === 0}
                            placeholder={
                              isLoadingMenu
                                ? "Loading menu..."
                                : menuItems.length === 0
                                  ? "No dishes available"
                                  : "Search dish name"
                            }
                            className="h-11 w-full rounded-xl border border-border/70 bg-card/60 px-4 pr-10 text-sm font-medium text-foreground shadow-xs outline-none transition-all focus:border-accent/60 focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                          <button
                            type="button"
                            onClick={() => setIsDishDropdownOpen((prev) => !prev)}
                            className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/80"
                            aria-label="Toggle dish suggestions"
                          >
                            <ChevronRight className={`size-4 transition-transform ${isDishDropdownOpen ? 'rotate-90' : '-rotate-90'}`} />
                          </button>

                          {isDishDropdownOpen && !isLoadingMenu && menuItems.length > 0 && (
                            <div className="absolute z-60 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-border bg-card p-1 shadow-xl">
                              {filteredMenuItems.length > 0 ? (
                                filteredMenuItems.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onMouseDown={(event) => {
                                      event.preventDefault();
                                      handleDishSelect(item);
                                    }}
                                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-background"
                                  >
                                    <span className="font-medium text-foreground">{item.name}</span>
                                    <span className="text-muted-foreground">₹{item.price.toFixed(2)}</span>
                                  </button>
                                ))
                              ) : (
                                <div className="px-3 py-2 text-sm text-muted-foreground">No matching dishes</div>
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => { setDraftQty(newItem.quantity); setIsQtySliderOpen(true); }}
                          className="md:col-span-1 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground text-center transition-all hover:border-accent hover:ring-2 hover:ring-accent"
                        >
                          Qty: {newItem.quantity}
                        </button>
                        <div className="md:col-span-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground">
                          {getMenuItemByName(newItem.itemName)
                            ? `₹${((getMenuItemByName(newItem.itemName)?.price ?? 0) * newItem.quantity).toFixed(2)}`
                            : "Price"}
                        </div>
                        <button
                          type="button"
                          onClick={addDraftItem}
                          disabled={!getMenuItemByName(newItem.itemName)}
                          className="md:col-span-1 rounded-lg border border-primary/20 bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
                        >
                          Add
                        </button>
                      </div>

                      {newOrder.items.length > 0 && (
                        <div className="space-y-2">
                          {newOrder.items.map((item, index) => (
                            <div key={`${item.name}-${index}`} className="flex items-center justify-between rounded-md border border-border bg-card/40 px-3 py-2">
                              <div>
                                <p className="text-sm font-medium text-foreground">{item.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Qty: {item.quantity} · ₹{((Number(item.price) || 0) * (Number(item.quantity) || 0)).toFixed(2)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeDraftItem(index)}
                                className="rounded-md px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-4 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsOrderFormOpen(false);
                          setNewItem({ itemName: "", quantity: 1 });
                          setNewOrder({ tableNumber: "", guests: "2", notes: "", items: [] });
                        }}
                        className="rounded-lg border border-border bg-secondary px-5 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-secondary/80"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!newOrder.tableNumber.trim() || newOrder.items.length === 0 || isCreatingOrder || isLoadingMenu}
                        className="rounded-lg border border-primary/20 bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all
                                 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isCreatingOrder ? 'Creating...' : 'Create Order'}
                      </button>
                    </div>
                  </form>
                </motion.section>
              </div>
            )}
          </AnimatePresence>

          {/* Active Tables Section */}
          <section className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Active Tables</h2>
              <p className="text-muted-foreground mt-1">Tap a table to view details and manage orders</p>
            </div>

            {logoutError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
              >
                <p className="text-sm text-destructive font-medium">{logoutError}</p>
              </motion.div>
            )}

            {isLoadingOrders && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-border/50 bg-card/50 px-4 py-3"
              >
                <p className="text-sm text-muted-foreground font-medium">Loading tables and orders...</p>
              </motion.div>
            )}

            {ordersError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
              >
                <p className="text-sm text-destructive font-medium">Error loading orders: {ordersError}</p>
              </motion.div>
            )}

            {!isLoadingOrders && tables.length === 0 && !ordersError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-border/50 bg-card/50 px-4 py-3 text-center"
              >
                <p className="text-sm text-muted-foreground font-medium">No active orders yet</p>
              </motion.div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {tables.map((table) => (
                <motion.button
                  key={table.id}
                  type="button"
                  onClick={() => setOpenTableId(table.id)}
                  className="relative aspect-square rounded-xl border border-border bg-white transition-all hover:bg-white overflow-hidden group"
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
                               bg-linear-to-b from-card to-card/95 shadow-2xl"
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
                        <div className="w-full px-4 py-3 rounded-lg border border-border bg-background/50 text-foreground font-medium text-base">
                          <span className={`inline-flex items-center justify-center rounded-md border px-2.5 py-1 text-xs font-semibold ${statusColorMap[openTable.status]}`}>
                            {openTable.status}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Number of Guests</label>
                        <div className="w-full px-4 py-3 rounded-lg border border-border bg-background/50 text-foreground
                                        font-semibold text-lg">
                          {openTable.guests}
                        </div>
                      </div>

                      <div className="space-y-3 md:col-span-2">
                        <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Running Total</label>
                        <div className="w-full px-5 py-4 rounded-lg border border-border bg-background/50 text-foreground font-bold text-xl">
                          <span className="text-green-400">₹{openTable.runningTotal.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="space-y-3 md:col-span-2">
                        <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Order Summary</label>
                        <div className="rounded-lg border border-border bg-background/40 p-4">
                          {openTable.orderItems.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No items ordered yet for this table.</p>
                          ) : (
                            <div className="space-y-3">
                              {openTable.orderItems.map((item) => (
                                <div key={item.id} className="flex items-center justify-between rounded-md border border-border bg-card/40 px-3 py-2">
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                                  </div>
                                  <p className="text-sm font-semibold text-foreground">₹{(item.price * item.quantity).toFixed(2)}</p>
                                </div>
                              ))}
                              <div className="flex items-center justify-between border-t border-border pt-3">
                                <span className="text-sm text-muted-foreground">Total</span>
                                <span className="text-base font-semibold text-accent">
                                  ₹{openTable.orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-5 md:px-8 flex flex-col-reverse sm:flex-row items-center justify-between gap-4 bg-card/50 border-t border-border">
                      <span className="text-xs text-muted-foreground text-center sm:text-left">Click outside to close</span>
                      <div className="flex gap-3 w-full sm:w-auto">
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

      {/* Qty Picker Bottom Sheet */}
      <AnimatePresence>
        {isQtySliderOpen && (
          <>
            <motion.div
              key="qty-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsQtySliderOpen(false)}
              className="fixed inset-0 z-70 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              key="qty-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed bottom-0 left-0 right-0 z-71 flex flex-col items-center gap-4 rounded-t-3xl bg-[#FEFEFE] px-6 pb-8 pt-4 shadow-2xl dark:bg-neutral-900"
            >
              <div className="h-1 w-10 rounded-full bg-border" />
              <p className="text-sm font-semibold text-muted-foreground tracking-widest uppercase">Select Quantity</p>
              <AdaptiveSlider
                label="Quantity"
                unit="qty"
                min={1}
                max={10}
                step={1}
                defaultValue={draftQty}
                value={draftQty}
                onChange={setDraftQty}
                className="h-auto w-full max-w-sm rounded-2xl p-4 sm:p-6 shadow-none"
              />
              <button
                type="button"
                onClick={() => {
                  setNewItem((prev) => ({ ...prev, quantity: draftQty }));
                  setIsQtySliderOpen(false);
                }}
                className="w-full max-w-sm rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
              >
                Done
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}

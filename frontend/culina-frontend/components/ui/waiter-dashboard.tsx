"use client";

import { useCallback, useMemo, useState, useEffect, type ReactElement } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, LogOut, Plus, ChevronRight, Moon, Sun, Clock, Receipt, ChefHat, CheckCircle2, ClipboardList, UserCheck, Wallet } from "lucide-react";
import { useTheme } from "@/app/theme-provider";
import { AdaptiveSlider } from "@/components/ui/adaptive-slider";
import { useAuth } from "@/hooks/use-auth";
import { extractAffectedTableIds, subscribeToTableOperationsRealtime, type TableOpsRealtimePayload } from "@/utils/supabase/table-operations-realtime";

type TableStatus = "Seated" | "Order Taken" | "Dish Ready" | "Served" | "Needs Bill";

type OrderStatus = 'placed' | 'preparing' | 'served' | 'completed' | 'cancelled';

type ActiveTable = {
  id: string;
  tableNumber: string;
  status: TableStatus;
  orderId: string | null;
  orderStatus: OrderStatus | null;
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

type ApiOrderItem = {
  quantity?: number;
  price?: number;
  dishes?: {
    name?: string;
  };
};

type ApiOrder = {
  id: string;
  table_id?: string;
  status: string;
  order_time?: string;
  num_people?: number;
  total_amount?: number;
  order_items?: ApiOrderItem[];
};

type ShiftRecord = {
  id: string;
  staff_id: string;
  start_time: string;
  end_time: string | null;
};

type MenuItem = {
  id: string;
  name: string;
  price: number;
};

type MetricVariant = "neutral" | "success" | "danger" | "info";

type MetricCardProps = {
  label: string;
  value: string | number;
  variant: MetricVariant;
  icon?: ReactElement;
};

type ShiftControlCardProps = {
  shiftHours: number[];
  isShiftActive: boolean;
  isShiftProcessing: boolean;
  isLoggingOut: boolean;
  isOrderFormOpen: boolean;
  resolvedTheme: string;
  shiftError: string | null;
  onLogout: () => void;
  onToggleTheme: () => void;
  onToggleOrderForm: () => void;
  onToggleShift: () => void;
  fillHeight?: boolean;
};

const DEFAULT_SHIFT_HOURS = [3, 34, 28];

const SEARCH_INPUT_CLASS = "h-11 w-full rounded-lg border border-border/70 bg-card/60 px-4 pr-10 text-sm font-medium text-foreground shadow-xs outline-none transition-all focus:border-accent/60 focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60";
const FIELD_INPUT_CLASS = "h-11 w-full rounded-lg border border-border/70 bg-background px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-accent";


const statusColorMap: Record<TableStatus, string> = {
  Seated: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-400/40 dark:bg-blue-500/15 dark:text-blue-300",
  "Order Taken": "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-300",
  "Dish Ready": "border-green-400 bg-green-50 text-green-800 dark:border-green-400/40 dark:bg-green-500/15 dark:text-green-300",
  Served: "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-400/40 dark:bg-purple-500/15 dark:text-purple-300",
  "Needs Bill": "border-red-400 bg-red-50 text-red-700 dark:border-red-400/40 dark:bg-red-500/15 dark:text-red-300",
};

const STATUS_URGENCY: Record<TableStatus, number> = {
  "Needs Bill": 0,
  "Dish Ready": 1,
  Served: 2,
  "Order Taken": 3,
  Seated: 4,
};

const ORDER_TRANSITION_RULES: Record<OrderStatus, OrderStatus[]> = {
  placed: ['preparing', 'cancelled'],
  preparing: ['served', 'cancelled'],
  served: ['completed'],
  completed: [],
  cancelled: [],
};

const ORDER_STATUS_ACTION_LABELS: Record<OrderStatus, string> = {
  placed: 'Mark Order Taken',
  preparing: 'Mark Dish Ready',
  served: 'Mark Served',
  completed: 'Mark Completed',
  cancelled: 'Cancel Order',
};

const statusIconMap: Record<TableStatus, ReactElement> = {
  Seated: <UserCheck size={11} />,
  "Order Taken": <ClipboardList size={11} />,
  "Dish Ready": <ChefHat size={11} />,
  Served: <CheckCircle2 size={11} />,
  "Needs Bill": <Receipt size={11} />,
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

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

function MetricCard({ label, value, variant, icon }: MetricCardProps) {
  const variantClassMap = {
    neutral: {
      border: "border-slate-300/80 dark:border-slate-600/70",
      surface: "bg-linear-to-br from-slate-200 via-slate-200 to-slate-300 dark:from-slate-900 dark:via-slate-800/90 dark:to-slate-700/90",
      value: "text-slate-700 dark:text-slate-100",
      icon: "text-slate-600 dark:text-slate-300",
    },
    success: {
      border: "border-emerald-300/70 dark:border-emerald-500/40",
      surface: "bg-linear-to-br from-emerald-100 via-emerald-200 to-teal-300 dark:from-emerald-950 dark:via-emerald-900/90 dark:to-teal-900/90",
      value: "text-emerald-700 dark:text-emerald-300",
      icon: "text-emerald-600 dark:text-emerald-300",
    },
    danger: {
      border: "border-rose-300/70 dark:border-rose-500/40",
      surface: "bg-linear-to-br from-rose-100 via-pink-200 to-rose-300 dark:from-rose-950 dark:via-rose-900/90 dark:to-pink-900/90",
      value: "text-rose-700 dark:text-rose-300",
      icon: "text-rose-600 dark:text-rose-300",
    },
    info: {
      border: "border-sky-300/70 dark:border-sky-500/40",
      surface: "bg-linear-to-br from-sky-100 via-sky-200 to-cyan-300 dark:from-sky-950 dark:via-sky-900/90 dark:to-cyan-900/90",
      value: "text-sky-700 dark:text-sky-300",
      icon: "text-sky-600 dark:text-sky-300",
    },
  };

  return (
    <motion.div
      className={`rounded-2xl border px-4 py-4 shadow-[0_8px_22px_rgba(30,64,175,0.18)] backdrop-blur ${variantClassMap[variant].surface} ${variantClassMap[variant].border}`}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
      <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        {icon ? <span className={variantClassMap[variant].icon}>{icon}</span> : null}
        {label}
      </p>
      <p className={`mt-2 text-[2.1rem] font-semibold leading-none ${variantClassMap[variant].value}`}>{value}</p>
    </motion.div>
  );
}

function ShiftControlCard({
  shiftHours,
  isShiftActive,
  isShiftProcessing,
  isLoggingOut,
  isOrderFormOpen,
  resolvedTheme,
  shiftError,
  onLogout,
  onToggleTheme,
  onToggleOrderForm,
  onToggleShift,
  fillHeight = false,
}: ShiftControlCardProps) {
  return (
    <motion.section
      className={`rounded-2xl border border-border bg-card/90 px-5 py-5 shadow-sm backdrop-blur-sm ${fillHeight ? "h-full" : ""}`}
      whileHover={{ scale: 1.01 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
    >
      <div className={`flex flex-col gap-6 ${fillHeight ? "h-full" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Shift Control</span>
            <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
              isShiftActive
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
                : "border-amber-300 bg-amber-50 text-orange-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isShiftActive ? "bg-emerald-500" : "bg-amber-500"}`} />
              {isShiftActive ? "Shift active" : "Shift not started"}
            </span>
          </div>

          <motion.button
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
            className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground/80 transition-colors hover:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <LogOut size={13} />
            <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
          </motion.button>
        </div>

        <div className="flex justify-center">
          <p className="text-center text-4xl font-bold leading-none tabular-nums tracking-tight text-foreground sm:text-[2.75rem]">
            {shiftHours[0] ?? 0}h {String(shiftHours[1] ?? 0).padStart(2, "0")}m {String(shiftHours[2] ?? 0).padStart(2, "0")}s
          </p>
        </div>

        <div className="border-t border-border/80" />

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              onClick={onToggleTheme}
              className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-card text-foreground transition-all hover:bg-secondary dark:hover:bg-secondary/50"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
              aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
            >
              {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </motion.button>

            <motion.button
              type="button"
              onClick={onToggleOrderForm}
              disabled={!isShiftActive || isLoggingOut}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:border-border/80 hover:bg-secondary/40 hover:text-foreground dark:hover:bg-secondary/30 disabled:cursor-not-allowed disabled:border-border/70 disabled:text-muted-foreground/60 disabled:opacity-100"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus size={16} />
              {isOrderFormOpen ? "Close" : "New Order"}
            </motion.button>
          </div>

          <motion.button
            type="button"
            onClick={onToggleShift}
            disabled={isLoggingOut || isShiftProcessing}
            className={`w-full rounded-lg border-2 px-5 py-2 text-sm font-bold tracking-wide shadow-md ring-1 transition-all ${
              isShiftActive
                ? "border-red-700 bg-red-600 text-white ring-red-500/35 hover:bg-red-700"
                : "border-slate-600 bg-slate-800 text-white ring-slate-500/35 hover:bg-slate-700"
            } disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.99 }}
          >
            <span className="flex items-center justify-center gap-2">
              <Clock className="size-4" />
              {isShiftProcessing ? (isShiftActive ? "Ending..." : "Starting...") : isShiftActive ? "End Shift" : "Start Shift"}
            </span>
          </motion.button>

          {shiftError && (
            <p className="pt-0.5 text-xs text-destructive">{shiftError}</p>
          )}

          {!isShiftActive && !isLoggingOut && (
            <p className="pt-0.5 text-xs text-muted-foreground">
              Start your shift to place new orders
            </p>
          )}
        </div>
      </div>
    </motion.section>
  );
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
  const [activeShift, setActiveShift] = useState<ShiftRecord | null>(null);
  const [isShiftProcessing, setIsShiftProcessing] = useState(false);
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [elapsedShiftSeconds, setElapsedShiftSeconds] = useState(0);
  const [newOrder, setNewOrder] = useState({ tableNumber: "", guests: "2", notes: "", items: [] as DraftOrderItem[] });
  const [newItem, setNewItem] = useState({ itemName: "", quantity: 1 });
  const [isQtySliderOpen, setIsQtySliderOpen] = useState(false);
  const [isDishDropdownOpen, setIsDishDropdownOpen] = useState(false);
  const [isTableDropdownOpen, setIsTableDropdownOpen] = useState(false);
  const [draftQty, setDraftQty] = useState(1);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isUpdatingOrderStatus, setIsUpdatingOrderStatus] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [allTables, setAllTables] = useState<RestaurantTable[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const mapTableRecordToActiveTable = useCallback((table: RestaurantTable, ordersList: ApiOrder[]) => {
    const latestActiveOrder = ordersList
      .filter((order) => order.table_id === table.id && order.status !== 'completed' && order.status !== 'cancelled')
      .sort((left, right) => {
        const leftTime = left.order_time ? new Date(left.order_time).getTime() : 0;
        const rightTime = right.order_time ? new Date(right.order_time).getTime() : 0;
        return rightTime - leftTime;
      })[0];

    return {
      id: table.id,
      tableNumber: String(table.table_number).padStart(2, '0'),
      status: latestActiveOrder ? mapOrderStatusToTableStatus(latestActiveOrder.status) : 'Seated',
      orderId: latestActiveOrder?.id ?? null,
      orderStatus: (latestActiveOrder?.status as OrderStatus) ?? null,
      guests: latestActiveOrder?.num_people || 1,
      runningTotal: Number(latestActiveOrder?.total_amount ?? 0),
      orderItems: latestActiveOrder?.order_items && Array.isArray(latestActiveOrder.order_items)
        ? latestActiveOrder.order_items.map((item, idx) => ({
            id: `${latestActiveOrder.id}-item-${idx}`,
            name: item.dishes?.name || 'Unknown',
            quantity: item.quantity || 1,
            price: Number(item.price) || 0,
          }))
        : [],
    } as ActiveTable;
  }, []);

  const displayedShiftHours = useMemo(() => {
    if (!isShiftActive) {
      return [0, 0, 0];
    }

    const hours = Math.floor(elapsedShiftSeconds / 3600);
    const minutes = Math.floor((elapsedShiftSeconds % 3600) / 60);
    const seconds = elapsedShiftSeconds % 60;

    return [hours, minutes, seconds];
  }, [elapsedShiftSeconds, isShiftActive]);

  const refreshActiveShift = useCallback(async () => {
    try {
      setShiftError(null);
      const response = await fetch('/api/shifts/active');

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Failed to load shift (${response.status})`);
      }

      const payload = await response.json();
      const nextActiveShift = (payload?.activeShift ?? null) as ShiftRecord | null;
      setActiveShift(nextActiveShift);
      setIsShiftActive(Boolean(nextActiveShift));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load shift';
      setShiftError(errorMessage);
      setActiveShift(null);
      setIsShiftActive(false);
    }
  }, []);

  const handleToggleShift = useCallback(async () => {
    if (isShiftProcessing) {
      return;
    }

    try {
      setIsShiftProcessing(true);
      setShiftError(null);

      if (activeShift?.id && isShiftActive) {
        const endResponse = await fetch(`/api/shifts/${activeShift.id}/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!endResponse.ok) {
          const payload = await endResponse.json().catch(() => null);
          throw new Error(payload?.error || `Failed to end shift (${endResponse.status})`);
        }
      } else {
        const startResponse = await fetch('/api/shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!startResponse.ok) {
          const payload = await startResponse.json().catch(() => null);
          throw new Error(payload?.error || `Failed to start shift (${startResponse.status})`);
        }
      }

      await refreshActiveShift();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update shift state';
      setShiftError(errorMessage);
    } finally {
      setIsShiftProcessing(false);
    }
  }, [activeShift?.id, isShiftActive, isShiftProcessing, refreshActiveShift]);

  const refreshTablesAndOrders = useCallback(async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
    try {
      if (showLoading) {
        setIsLoadingOrders(true);
      }
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
      const ordersList: ApiOrder[] = Array.isArray(ordersData) ? ordersData : ordersData.data || [];

      setAllTables(
        tablesList.map((table: { id: string; table_number: number }) => ({
          id: table.id,
          table_number: table.table_number
        }))
      );

      const transformedTables: ActiveTable[] = tablesList
        .map((table: { id: string; table_number: number }) => {
          return mapTableRecordToActiveTable(table, ordersList);
        })
        .filter((table: ActiveTable) => table.status !== 'Seated' || table.orderItems.length > 0);

      setTables(transformedTables);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching data';
      setOrdersError(errorMessage);
      console.error('Failed to fetch tables and orders:', error);
    } finally {
      if (showLoading) {
        setIsLoadingOrders(false);
      }
    }
  }, [mapTableRecordToActiveTable]);

  const refreshSingleTableFromApi = useCallback(async (tableId: string) => {
    const [tableResponse, ordersResponse] = await Promise.all([
      fetch(`/api/tables/${tableId}`),
      fetch(`/api/orders?table_id=${tableId}`),
    ]);

    if (tableResponse.status === 404) {
      setAllTables((previous) => previous.filter((table) => table.id !== tableId));
      setTables((previous) => previous.filter((table) => table.id !== tableId));
      return;
    }

    if (!tableResponse.ok || !ordersResponse.ok) {
      throw new Error(`Failed to refresh table ${tableId}: table(${tableResponse.status}), orders(${ordersResponse.status})`);
    }

    const tablePayload = await tableResponse.json();
    const ordersPayload = await ordersResponse.json();
    const tableRecord = (Array.isArray(tablePayload) ? tablePayload[0] : tablePayload) as RestaurantTable | undefined;
    const ordersList = (Array.isArray(ordersPayload) ? ordersPayload : ordersPayload?.data || []) as ApiOrder[];

    if (!tableRecord?.id) {
      setAllTables((previous) => previous.filter((table) => table.id !== tableId));
      setTables((previous) => previous.filter((table) => table.id !== tableId));
      return;
    }

    const nextTable = mapTableRecordToActiveTable(tableRecord, ordersList);

    setAllTables((previous) => {
      const index = previous.findIndex((table) => table.id === tableRecord.id);
      if (index === -1) {
        return [...previous, tableRecord];
      }

      const updated = [...previous];
      updated[index] = tableRecord;
      return updated;
    });

    setTables((previous) => {
      const shouldKeep = nextTable.status !== 'Seated' || nextTable.orderItems.length > 0;
      const existingIndex = previous.findIndex((table) => table.id === tableRecord.id);

      if (!shouldKeep) {
        if (existingIndex === -1) {
          return previous;
        }
        return previous.filter((table) => table.id !== tableRecord.id);
      }

      if (existingIndex === -1) {
        return [...previous, nextTable];
      }

      const updated = [...previous];
      updated[existingIndex] = nextTable;
      return updated;
    });
  }, [mapTableRecordToActiveTable]);

  const handleRealtimeTableChange = useCallback(async (payload: TableOpsRealtimePayload) => {
    const affectedTableIds = extractAffectedTableIds(payload);

    if (payload.table === 'restaurant_tables' && payload.eventType === 'DELETE') {
      setAllTables((previous) => previous.filter((table) => !affectedTableIds.includes(table.id)));
      setTables((previous) => previous.filter((table) => !affectedTableIds.includes(table.id)));
      return;
    }

    if (affectedTableIds.length === 0) {
      await refreshTablesAndOrders({ showLoading: false });
      return;
    }

    await Promise.all(affectedTableIds.map((tableId) => refreshSingleTableFromApi(tableId)));
  }, [refreshSingleTableFromApi, refreshTablesAndOrders]);

  useEffect(() => {
    void refreshTablesAndOrders();
  }, [refreshTablesAndOrders]);

  useEffect(() => {
    if (!user?.restaurant_id) {
      return;
    }

    const unsubscribe = subscribeToTableOperationsRealtime({
      restaurantId: user.restaurant_id,
      onChange: (payload) => {
        void handleRealtimeTableChange(payload);
      },
      onError: (error) => {
        console.error('Realtime table sync failed:', error);
      },
    });

    return () => {
      unsubscribe();
    };
  }, [handleRealtimeTableChange, user?.restaurant_id]);

  useEffect(() => {
    void refreshActiveShift();
  }, [refreshActiveShift]);

  useEffect(() => {
    if (!activeShift?.start_time || !isShiftActive) {
      setElapsedShiftSeconds(0);
      return;
    }

    const updateElapsed = () => {
      const startMs = new Date(activeShift.start_time).getTime();
      const nowMs = Date.now();
      const diffSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setElapsedShiftSeconds(diffSeconds);
    };

    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [activeShift?.start_time, isShiftActive]);

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

  const nextOrderStatuses = useMemo(() => {
    if (!openTable?.orderStatus) {
      return [];
    }

    return ORDER_TRANSITION_RULES[openTable.orderStatus] ?? [];
  }, [openTable?.orderStatus]);

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

  const updateOrderStatus = async (nextStatus: OrderStatus) => {
    if (!openTable?.orderId) {
      setStatusUpdateError('No active order found for this table.');
      return;
    }

    try {
      setIsUpdatingOrderStatus(true);
      setStatusUpdateError(null);

      const response = await fetch(`/api/orders/${openTable.orderId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || `Failed to update order status (${response.status})`);
      }

      await refreshTablesAndOrders();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update order status';
      setStatusUpdateError(errorMessage);
    } finally {
      setIsUpdatingOrderStatus(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-background dark:bg-linear-to-br dark:from-background dark:via-background dark:to-card">
      <div className="mx-auto w-full max-w-360 px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-8">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Good day, {displayName}
          </h1>
          <p className="mt-2 text-muted-foreground">Manage your tables and shift performance</p>
        </header>

        <div className="grid w-full gap-8 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
          <div className="min-w-0 space-y-8">
            <section className="space-y-6">
              {/* Metrics Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard label="Active Tables" value={metrics.activeCount} variant="neutral" />
                <MetricCard
                  label="Dishes Ready for Pickup"
                  value={metrics.readyCount}
                  variant="success"
                  icon={<ChefHat size={11} />}
                />
                <MetricCard
                  label="Waiting for Bill"
                  value={metrics.billCount}
                  variant="danger"
                  icon={<Receipt size={11} />}
                />
                <MetricCard
                  label="Shift Revenue"
                  value={formatCurrency(metrics.revenue)}
                  variant="info"
                  icon={<Wallet size={11} />}
                />
              </div>

              {/* Mobile Shift Control */}
              <div className="w-full xl:hidden">
                <ShiftControlCard
                  shiftHours={displayedShiftHours}
                  isShiftActive={isShiftActive}
                  isShiftProcessing={isShiftProcessing}
                  isLoggingOut={isLoggingOut}
                  isOrderFormOpen={isOrderFormOpen}
                  resolvedTheme={resolvedTheme}
                  shiftError={shiftError}
                  onLogout={handleLogout}
                  onToggleTheme={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                  onToggleOrderForm={() => setIsOrderFormOpen((prev) => !prev)}
                  onToggleShift={handleToggleShift}
                />
              </div>
            </section>

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
                          className={SEARCH_INPUT_CLASS}
                        />
                        <button
                          type="button"
                          onClick={() => setIsTableDropdownOpen((prev) => !prev)}
                          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/80"
                          aria-expanded={isTableDropdownOpen}
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
                        className={FIELD_INPUT_CLASS}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-muted-foreground">Special Notes (Optional)</label>
                      <input
                        value={newOrder.notes}
                        onChange={(event) => setNewOrder((prev) => ({ ...prev, notes: event.target.value }))}
                        placeholder="Birthday celebration, allergies..."
                        className={FIELD_INPUT_CLASS}
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
                            className={SEARCH_INPUT_CLASS}
                          />
                          <button
                            type="button"
                            onClick={() => setIsDishDropdownOpen((prev) => !prev)}
                            className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/80"
                            aria-expanded={isDishDropdownOpen}
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
              <p className="text-muted-foreground mt-1">Select a table to manage orders</p>
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
                className="rounded-xl border border-border/50 bg-card/50 py-12 text-center"
              >
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card">
                  <ClipboardList className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No active tables</p>
                <p className="mt-1 text-xs text-muted-foreground">New orders will appear here once placed</p>
              </motion.div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {[...tables].sort((a, b) => STATUS_URGENCY[a.status] - STATUS_URGENCY[b.status]).map((table) => (
                <motion.button
                  key={table.id}
                  type="button"
                  onClick={() => setOpenTableId(table.id)}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-border bg-card/90 transition-all hover:border-border/80 hover:shadow-md dark:bg-card/70"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="h-full flex flex-col items-center justify-center gap-3 p-4">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-current bg-background/50 text-2xl font-bold text-foreground">
                      {table.tableNumber}
                    </div>
                    <div className="flex flex-col items-center gap-2 w-full">
                      <span className={`inline-flex items-center justify-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold text-center ${statusColorMap[table.status]}`}>
                        {statusIconMap[table.status]}
                        {table.status}
                      </span>
                      <div className="text-xs text-foreground/70 font-semibold">
                        {table.guests} {table.guests === 1 ? "guest" : "guests"}
                      </div>
                    </div>
                  </div>
                  
                  {/* Hover indicator */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-xl backdrop-blur-sm">
                    <ChevronRight className="text-white" size={22} />
                    <span className="text-white text-xs font-semibold">Manage</span>
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
                          <span className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${statusColorMap[openTable.status]}`}>
                            {statusIconMap[openTable.status]}
                            {openTable.status}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Update Order Status</label>
                        <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-background/40 p-3">
                          {nextOrderStatuses.length === 0 && (
                            <p className="text-sm text-muted-foreground">No further status transitions available.</p>
                          )}

                          {nextOrderStatuses.map((nextStatus) => (
                            <motion.button
                              key={nextStatus}
                              type="button"
                              onClick={() => void updateOrderStatus(nextStatus)}
                              disabled={isUpdatingOrderStatus}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.98 }}
                              className="rounded-md border border-primary/20 bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {ORDER_STATUS_ACTION_LABELS[nextStatus]}
                            </motion.button>
                          ))}
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

                    {statusUpdateError && (
                      <div className="mx-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive md:mx-8">
                        {statusUpdateError}
                      </div>
                    )}

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

        <aside className="hidden xl:block xl:self-start">
          <div className="xl:sticky xl:top-6 xl:h-[calc(100vh-136px)] xl:min-h-128">
            <ShiftControlCard
              shiftHours={displayedShiftHours}
              isShiftActive={isShiftActive}
              isShiftProcessing={isShiftProcessing}
              isLoggingOut={isLoggingOut}
              isOrderFormOpen={isOrderFormOpen}
              resolvedTheme={resolvedTheme}
              shiftError={shiftError}
              onLogout={handleLogout}
              onToggleTheme={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              onToggleOrderForm={() => setIsOrderFormOpen((prev) => !prev)}
              onToggleShift={handleToggleShift}
              fillHeight
            />
          </div>
        </aside>
        </div>
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
              className="fixed bottom-0 left-0 right-0 z-71 flex flex-col items-center gap-4 rounded-t-3xl bg-background px-6 pb-8 pt-4 shadow-2xl"
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

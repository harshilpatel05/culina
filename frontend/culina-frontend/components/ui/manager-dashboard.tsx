"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  Briefcase,
  ChevronRight,
  Clock3,
  LayoutDashboard,
  LogOut,
  Moon,
  Sun,
  Users,
  Wallet,
  X,
} from "lucide-react";

import { useTheme } from "@/app/theme-provider";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { MacOSSidebar } from "@/components/ui/macos-sidebar-base";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";

type TableStatus = "Unoccupied" | "Order Taken" | "Dish Ready" | "Served" | "Needs Bill";
type OrderStatus = 'placed' | 'preparing' | 'served' | 'completed' | 'cancelled';
type StaffStatus = "On Floor" | "On Break" | "Closing";
type TableFilter = "All" | TableStatus;

type StaffMember = {
  id: string;
  name: string;
  status: StaffStatus;
  zone: string;
  activeTables: number;
  revenue: number;
  tips: number;
  hours: number;
  tables: string[];
};

type ManagerTable = {
  id: string;
  tableNumber: string;
  waiterId: string;
  status: TableStatus;
  guests: number;
  runningTotal: number;
  elapsedMinutes: number;
  orderItems: OrderItem[];
};

type ApiOrderItem = {
  dish_id?: string;
  quantity?: number;
  price?: number | string;
  prep_time?: number | string | null;
  dishes?: {
    name?: string;
  };
};

type ApiOrder = {
  id: string;
  table_id?: string;
  taken_by?: string;
  status: OrderStatus | string;
  payment_status?: string;
  num_people?: number;
  total_amount?: number | string;
  order_time?: string;
  order_items?: ApiOrderItem[];
};

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
};

type TrendPoint = {
  hour: string;
  orders: number;
  tables: number;
};

type ManagerDashboardProps = {
  managerName?: string;
};

function buildTodayOrdersTrend(orders: ApiOrder[]): TrendPoint[] {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const hourlyOrders = new Array(24).fill(0);

  orders.forEach((order) => {
    if (!order.order_time) {
      return;
    }

    const orderTime = new Date(order.order_time);
    if (Number.isNaN(orderTime.getTime()) || orderTime < startOfDay || orderTime >= endOfDay) {
      return;
    }

    const normalizedStatus = String(order.status ?? "").toLowerCase();
    if (normalizedStatus === "cancelled") {
      return;
    }

    hourlyOrders[orderTime.getHours()] += 1;
  });

  return hourlyOrders.slice(0, now.getHours() + 1).map((orders, hourIndex) => {
    const hour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hourIndex).toLocaleTimeString("en-IN", {
      hour: "numeric",
      hour12: true,
    });

    return {
      hour,
      orders,
      tables: 0,
    };
  });
}

const FILTERS: TableFilter[] = ["All", "Unoccupied", "Order Taken", "Dish Ready", "Served", "Needs Bill"];
const DASHBOARD_SHELL = "rounded-2xl border border-slate-300/90 bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] dark:border-slate-500/80";
const SOFT_INSET_CARD = "rounded-xl border border-border/80 bg-card";

const statusColorMap: Record<TableStatus, string> = {
  Unoccupied: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-400/30 dark:bg-slate-500/20 dark:text-slate-200",
  "Order Taken": "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/20 dark:text-amber-200",
  "Dish Ready": "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:text-emerald-200",
  Served: "border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-400/30 dark:bg-violet-500/20 dark:text-violet-200",
  "Needs Bill": "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/20 dark:text-rose-200",
};

const staffStatusColorMap: Record<StaffStatus, string> = {
  "On Floor": "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:text-emerald-200",
  "On Break": "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/20 dark:text-amber-200",
  Closing: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-400/30 dark:bg-slate-500/20 dark:text-slate-200",
};

const chartConfig = {
  orders: {
    label: "Orders",
    theme: {
      light: "#6366f1",
      dark: "#818cf8",
    },
  },
  tables: {
    label: "Tables",
    theme: {
      light: "var(--primary)",
      dark: "var(--primary)",
    },
  },
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getOrderPrepMinutes(orderItems: ApiOrderItem[] | undefined, fallbackPerDish = 15) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    return 0;
  }

  const uniqueDishPrep = new Map<string, number>();

  orderItems.forEach((item, index) => {
    const key = item.dish_id || item.dishes?.name || `dish-${index}`;
    const parsedPrep = Number(item.prep_time ?? fallbackPerDish);
    const prepMinutes = Number.isFinite(parsedPrep) && parsedPrep > 0 ? parsedPrep : fallbackPerDish;
    const existing = uniqueDishPrep.get(key);

    if (existing === undefined || prepMinutes > existing) {
      uniqueDishPrep.set(key, prepMinutes);
    }
  });

  return Array.from(uniqueDishPrep.values()).reduce((sum, minutes) => sum + minutes, 0);
}

function StatusBadge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function InfoStatCard({ label, value, accentClassName = "text-foreground" }: { label: string; value: string | number; accentClassName?: string }) {
  return (
    <div className="rounded-lg border border-border/80 bg-card px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold ${accentClassName}`}>{value}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "neutral" | "success" | "danger" | "info" | "accent";
}) {
  const toneMap = {
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
    accent: {
      border: "border-indigo-300/70 dark:border-indigo-500/40",
      surface: "bg-linear-to-br from-indigo-100 via-indigo-200 to-violet-300 dark:from-indigo-950 dark:via-indigo-900/90 dark:to-violet-900/90",
      value: "text-indigo-700 dark:text-indigo-300",
      icon: "text-indigo-600 dark:text-indigo-300",
    },
  } as const;

  return (
    <motion.div
      className={`w-full rounded-2xl border px-5 py-5 text-center shadow-[0_8px_22px_rgba(30,64,175,0.18)] backdrop-blur sm:px-2 sm:py-3 xl:px-5 xl:py-5 ${toneMap[tone].surface} ${toneMap[tone].border}`}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
      <div className="flex flex-col items-center gap-2 sm:gap-1 xl:gap-2.5">
        <div className="flex size-11 items-center justify-center rounded-full border border-white/60 bg-white/70 dark:border-white/10 dark:bg-slate-900/60 sm:size-8 xl:size-11">
          <Icon className={`size-5 sm:size-3.5 xl:size-5 ${toneMap[tone].icon}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground sm:text-[11px] xl:text-sm">{label}</p>
          <p className={`mt-1 text-4xl font-semibold leading-none sm:text-2xl xl:text-4xl ${toneMap[tone].value}`}>{value}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function ManagerDashboard({ managerName }: ManagerDashboardProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const displayManagerName = user?.name ?? managerName ?? "Manager";
  const { resolvedTheme, setTheme } = useTheme();
  const [tables, setTables] = useState<ManagerTable[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<TableFilter>("All");
  const [openStaffId, setOpenStaffId] = useState<string | null>(null);
  const [openTableId, setOpenTableId] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isShiftOpen, setIsShiftOpen] = useState(true);
  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [isOpeningBilling, setIsOpeningBilling] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);

  // Map order status to table status for UI
  const mapOrderStatusToTableStatus = (orderStatus: OrderStatus | string): TableStatus => {
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
  };

  // Fetch tables and orders from API
  useEffect(() => {
    const fetchTablesAndOrders = async () => {
      try {
        setIsLoadingTables(true);
        setTablesError(null);
        
        // Fetch both tables and orders in parallel
        const [tablesRes, ordersRes] = await Promise.all([
          fetch('/api/tables'),
          fetch('/api/orders')
        ]);
        
        if (!tablesRes.ok || !ordersRes.ok) {
          throw new Error(`Failed to fetch data: tables(${tablesRes.status}), orders(${ordersRes.status})`);
        }
        
        const tablesData = await tablesRes.json();
        const ordersData = await ordersRes.json();
        
        // Extract arrays from responses
        const tablesList = Array.isArray(tablesData) ? tablesData : tablesData.data || [];
        const ordersList: ApiOrder[] = Array.isArray(ordersData) ? ordersData : ordersData.data || [];
        setTrendData(buildTodayOrdersTrend(ordersList));
        
        // Create a map of orders by table_id for quick lookup
        const activeStatuses = new Set(['placed', 'preparing', 'served']);
        const unpaidStatuses = new Set(['', 'pending', 'unpaid', 'partial']);
        const sortedActiveOrders = ordersList
          .filter((order) => {
            const normalizedStatus = String(order.status ?? '').toLowerCase();
            const normalizedPaymentStatus = String(order.payment_status ?? '').toLowerCase();
            return Boolean(order.table_id) && activeStatuses.has(normalizedStatus) && unpaidStatuses.has(normalizedPaymentStatus);
          })
          .sort((left, right) => {
            const leftTime = left.order_time ? new Date(left.order_time).getTime() : 0;
            const rightTime = right.order_time ? new Date(right.order_time).getTime() : 0;
            return rightTime - leftTime;
          });

        const ordersByTableId: Record<string, ApiOrder> = {};
        sortedActiveOrders.forEach((order) => {
          if (order.table_id && !ordersByTableId[order.table_id]) {
            ordersByTableId[order.table_id] = order;
          }
        });
        
        // Transform tables to ManagerTable format, including order data if available
        const transformedTables = tablesList
          .map((table: any) => {
            const order = ordersByTableId[table.id];
            const orderItems = order?.order_items && Array.isArray(order.order_items)
              ? order.order_items
              : [];
            // Same dish quantities should not multiply prep time; only unique dishes add up.
            const elapsedMinutes = getOrderPrepMinutes(orderItems);
            return {
              id: table.id,
              tableNumber: String(table.table_number).padStart(2, '0'),
              waiterId: order?.taken_by || 'unassigned',
              status: order ? mapOrderStatusToTableStatus(order.status) : 'Unoccupied',
              guests: order?.num_people || 1,
              runningTotal: order ? Number(order.total_amount ?? 0) : 0,
              elapsedMinutes,
              orderItems: orderItems.map((item: ApiOrderItem, idx: number) => ({
                id: `${order?.id ?? table.id}-item-${idx}`,
                name: item.dishes?.name || 'Unknown',
                quantity: item.quantity || 1,
                price: Number(item.price ?? 0),
              })),
            } as ManagerTable;
          });
        
        setTables(transformedTables);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching data';
        setTablesError(errorMessage);
        console.error('Failed to fetch tables and orders:', error);
      } finally {
        setIsLoadingTables(false);
      }
    };
    
    fetchTablesAndOrders();
  }, []);

  // Fetch staff from API
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setIsLoadingStaff(true);
        setStaffError(null);
        
        const staffRes = await fetch('/api/staff');
        
        if (!staffRes.ok) {
          throw new Error(`Failed to fetch staff: ${staffRes.status}`);
        }
        
        const staffData = await staffRes.json();
        const staffList = Array.isArray(staffData) ? staffData : staffData.data || [];
        
        // Transform staff records to ManagerDashboard StaffMember format
        const transformedStaff = staffList.map((staffRecord: any) => ({
          id: staffRecord.id,
          name: staffRecord.name,
          status: "On Floor" as StaffStatus, // Default status - can be enhanced with role-based logic
          zone: staffRecord.role === 'manager' ? 'Office' : 'Main Hall', // Default zone based on role
          activeTables: 0, // Will be calculated from table assignments if needed
          revenue: 0, // Operational metric - would need order data
          tips: 0, // Operational metric - would need order data
          hours: 0, // Operational metric - would need shift tracking
          tables: [], // Will be populated from table assignments if needed
        } as StaffMember));
        
        setStaff(transformedStaff);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching staff';
        setStaffError(errorMessage);
        console.error('Failed to fetch staff:', error);
      } finally {
        setIsLoadingStaff(false);
      }
    };
    
    fetchStaff();
  }, []);

  const metrics = useMemo(() => {
    const readyCount = tables.filter((table) => table.status === "Dish Ready").length;
    const billCount = tables.filter((table) => table.status === "Needs Bill").length;
    const revenue = tables.reduce((sum, table) => sum + table.runningTotal, 0);
    const onDuty = staff.filter((member) => member.status !== "On Break").length;
    const activeTables = tables.filter((table) => table.status !== 'Unoccupied').length;

    return {
      activeTables,
      readyCount,
      billCount,
      onDuty,
      revenue,
    };
  }, [staff, tables]);

  const visibleTables = useMemo(() => {
    if (selectedFilter === "All") {
      return tables;
    }

    return tables.filter((table) => table.status === selectedFilter);
  }, [selectedFilter, tables]);

  const selectedStaff = useMemo(
    () => staff.find((member) => member.id === openStaffId) ?? null,
    [openStaffId, staff]
  );

  const selectedStaffTables = useMemo(() => {
    if (!selectedStaff) {
      return [];
    }

    return tables.filter((table) => table.waiterId === selectedStaff.id);
  }, [selectedStaff, tables]);

  const openTable = useMemo(
    () => tables.find((table) => table.id === openTableId) ?? null,
    [openTableId, tables]
  );

  const openTableOwner = useMemo(
    () => staff.find((member) => member.id === openTable?.waiterId) ?? null,
    [openTable, staff]
  );

  const performanceLead = useMemo(() => {
    return [...staff].sort((left, right) => right.revenue - left.revenue)[0] ?? null;
  }, [staff]);

  const openTableDetails = (tableId: string) => {
    setOpenStaffId(null);
    setBillingError(null);
    setOpenTableId(tableId);
  };

  const handleBilling = async () => {
    if (!openTableId) {
      return;
    }

    try {
      setIsOpeningBilling(true);
      setBillingError(null);

      const searchParams = new URLSearchParams({
        table_id: openTableId,
      });

      const response = await fetch(`/api/orders?${searchParams.toString()}`);

      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        throw new Error(responseBody?.error ?? 'Could not resolve billable order for this table.')
      }

      const orders = await response.json();
      const billableStatuses = new Set(['served', 'completed']);
      const unpaidStatuses = new Set(['', 'pending', 'unpaid', 'partial']);
      const latestOrder = Array.isArray(orders)
        ? orders.find((order) => {
            const normalizedStatus = String(order?.status ?? '').toLowerCase();
            const normalizedPaymentStatus = String(order?.payment_status ?? '').toLowerCase();
            return billableStatuses.has(normalizedStatus) && unpaidStatuses.has(normalizedPaymentStatus);
          })
        : null;

      if (!latestOrder?.id) {
        throw new Error('No pending bill found for this table.');
      }

      setOpenTableId(null);
      router.push(`/billing/${latestOrder.id}`);
    } catch (billingErr) {
      const message = billingErr instanceof Error ? billingErr.message : 'Failed to open billing page.';
      setBillingError(message);
    } finally {
      setIsOpeningBilling(false);
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
      case "Sales":
        router.push("/manager-dash/sales");
        break;
      default:
        break;
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
          initialSelectedIndex={0}
          onItemClick={handleSidebarNav}
          className="w-full max-w-384 p-1 sm:p-2 lg:p-4"
        >
      <div className="flex w-full flex-col gap-8 px-2 sm:px-4 lg:px-6">
        <header className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Floor command, {displayManagerName}
              </h1>
              <p className="mt-2 text-muted-foreground">
                Track staff load, service bottlenecks, and revenue pacing from one surface.
              </p>
            </div>

            <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-1 xl:w-auto xl:flex-nowrap">
              <motion.button
                type="button"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                className="flex h-12 w-12 items-center justify-center rounded-lg border border-border/80 bg-card text-foreground transition-all hover:bg-secondary dark:hover:bg-secondary/50"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
              >
                {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </motion.button>

              <motion.button
                type="button"
                onClick={() => setIsShiftOpen((current) => !current)}
                disabled={isLoggingOut}
                className={`rounded-lg border px-4 py-3 text-sm font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.12)] transition-all ${
                  isShiftOpen
                    ? "border-red-500/30 bg-red-500 text-white hover:bg-red-600"
                    : "border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90"
                } disabled:cursor-not-allowed disabled:opacity-50`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isShiftOpen ? "Close Shift" : "Open Shift"}
              </motion.button>

              <motion.button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center justify-center gap-2 rounded-lg border border-border/80 bg-card px-4 py-3 text-sm font-semibold text-foreground transition-all hover:bg-secondary dark:hover:bg-secondary/50"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">{isLoggingOut ? "Logging out..." : "Logout"}</span>
              </motion.button>
            </div>

          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5 sm:gap-2">
            <MetricCard label="Active Tables" value={metrics.activeTables} icon={Activity} tone="neutral" />
            <MetricCard label="Dish Ready" value={metrics.readyCount} icon={Briefcase} tone="success" />
            <MetricCard label="Needs Bill" value={metrics.billCount} icon={Wallet} tone="danger" />
            <MetricCard label="On Duty" value={metrics.onDuty} icon={Users} tone="info" />
            <MetricCard label="Shift Revenue" value={formatCurrency(metrics.revenue)} icon={Wallet} tone="accent" />
          </div>
        </header>

        {logoutError && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
          >
            <p className="text-sm font-medium text-destructive">{logoutError}</p>
          </motion.div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <div className={`${DASHBOARD_SHELL} space-y-4`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="p-2">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Staff Overview</h2>
                <p className="mt-1 text-sm text-muted-foreground">Open a waiter card to review tables, pace, and shift output.</p>
              </div>
              <div className="text-sm text-muted-foreground">{staff.length} team members on roster</div>
            </div>

            <div className="grid max-h-120 gap-4 overflow-y-auto p-1 md:grid-cols-2">
              {staff.map((member) => (
                <motion.button
                  key={member.id}
                  type="button"
                  onClick={() => setOpenStaffId(member.id)}
                  className="group rounded-xl border border-border/80 bg-card p-4 text-left transition-all hover:border-accent/40 hover:bg-card"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-foreground">{member.name}</h3>
                        <StatusBadge label={member.status} className={staffStatusColorMap[member.status]} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{member.zone}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <InfoStatCard label="Tables" value={member.activeTables} />
                    <InfoStatCard label="Hours" value={`${member.hours.toFixed(1)}h`} />
                    <InfoStatCard label="Revenue" value={formatCurrency(member.revenue)} accentClassName="text-accent" />
                    <InfoStatCard label="Tips" value={formatCurrency(member.tips)} />
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          <div className={`${DASHBOARD_SHELL} space-y-4`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Order Pace</h2>
                <p className="mt-1 text-sm text-muted-foreground">Today&apos;s hourly order trend.</p>
              </div>
              <div className="text-sm text-muted-foreground">Today</div>
            </div>

            <ChartContainer config={chartConfig} className="h-65 w-full">
              <AreaChart data={trendData} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="managerOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-orders)" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="var(--color-orders)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="hour" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="orders"
                  stroke="var(--color-orders)"
                  fill="url(#managerOrders)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ChartContainer>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Peak Hour", value: "6 PM" },
                { label: "Avg Ticket", value: formatCurrency(Math.round(metrics.revenue / metrics.activeTables || 0)) },
                { label: "Table Load", value: `${Math.round(metrics.activeTables / Math.max(metrics.onDuty, 1))} / staff` },
              ].map((item) => (
                <div key={item.label} className={`${SOFT_INSET_CARD} px-3 py-3`}>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`${DASHBOARD_SHELL} space-y-5`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Table Operations Board</h2>
              <p className="mt-1 text-sm text-muted-foreground">Monitor service bottlenecks by status across the entire floor.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setSelectedFilter(filter)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                    selectedFilter === filter
                      ? "border-primary/20 bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-secondary"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {isLoadingTables && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-border/50 bg-card px-4 py-3"
            >
              <p className="text-sm text-muted-foreground font-medium">Loading tables and orders...</p>
            </motion.div>
          )}

          {tablesError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
            >
              <p className="text-sm text-destructive font-medium">Error loading tables: {tablesError}</p>
            </motion.div>
          )}

          {!isLoadingTables && tables.length === 0 && !tablesError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-border/50 bg-card px-4 py-3 text-center"
            >
              <p className="text-sm text-muted-foreground font-medium">No tables available</p>
            </motion.div>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visibleTables.map((table) => {
              const owner = staff.find((member) => member.id === table.waiterId);

              return (
                <motion.button
                  key={table.id}
                  type="button"
                  onClick={() => openTableDetails(table.id)}
                  className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-4 text-left transition-all hover:border-accent/40 hover:bg-card"
                  whileHover={{ y: -2 }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-current bg-background text-xl font-bold text-foreground">
                      {table.tableNumber}
                    </div>
                    <StatusBadge label={table.status} className={statusColorMap[table.status]} />
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-semibold text-foreground">{owner?.name ?? "Unassigned"}</p>
                    <p className="text-xs text-muted-foreground">{table.guests} guests</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatCurrency(table.runningTotal)}</span>
                      <span>{table.elapsedMinutes} min</span>
                    </div>
                  </div>

                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                    <ChevronRight className="size-5 text-white" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>

        <AnimatePresence>
          {openTable && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpenTableId(null)}
                className="fixed inset-0 bg-black/60 backdrop-blur-md"
              />

              <motion.section
                initial={{ opacity: 0, scale: 0.94, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 24 }}
                transition={{ type: "spring", damping: 24, stiffness: 280 }}
                className="relative z-51 w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
              >
                <div className="flex items-start justify-between border-b border-border px-6 py-5">
                  <div>
                    <h3 className="text-2xl font-bold text-foreground">Table {openTable.tableNumber}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Managed by {openTableOwner?.name ?? "Unassigned"}</p>
                  </div>
                  <motion.button
                    type="button"
                    onClick={() => setOpenTableId(null)}
                    whileHover={{ rotate: 90 }}
                    className="p-2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X size={24} />
                  </motion.button>
                </div>

                <div className="grid gap-4 p-6 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/80 bg-card p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                    <div className="mt-2">
                      <StatusBadge label={openTable.status} className={statusColorMap[openTable.status]} />
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/80 bg-card p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Guests</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{openTable.guests}</p>
                  </div>

                  <div className="rounded-xl border border-border/80 bg-card p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Running Total</p>
                    <p className="mt-2 text-lg font-semibold text-accent">{formatCurrency(openTable.runningTotal)}</p>
                  </div>

                  <div className="rounded-xl border border-border/80 bg-card p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Elapsed</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{openTable.elapsedMinutes} min</p>
                  </div>

                  <div className="rounded-xl border border-border/80 bg-card p-4 sm:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Order Items</p>
                    {openTable.orderItems.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">No items added yet.</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {openTable.orderItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
                            <div>
                              <p className="text-sm font-medium text-foreground">{item.name}</p>
                              <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                            </div>
                            <p className="text-sm font-semibold text-foreground">{formatCurrency(item.quantity * item.price)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-6 py-4">
                  <p className={`text-sm ${billingError ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {billingError ?? 'Complete billing to close the payment step for this table.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleBilling}
                    disabled={isOpeningBilling}
                    className="rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
                  >
                    {isOpeningBilling ? "Opening..." : "Billing"}
                  </button>
                </div>
              </motion.section>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedStaff && (
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpenStaffId(null)}
                className="fixed inset-0 bg-black/60 backdrop-blur-md"
              />

              <motion.section
                initial={{ opacity: 0, scale: 0.94, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 24 }}
                transition={{ type: "spring", damping: 24, stiffness: 280 }}
                className="relative z-51 my-4 w-full max-w-6xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl sm:my-6 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]"
              >
                <div className="flex items-start justify-between border-b border-border px-8 py-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-3xl font-bold text-foreground">{selectedStaff.name}</h3>
                      <StatusBadge label={selectedStaff.status} className={staffStatusColorMap[selectedStaff.status]} />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{selectedStaff.zone} zone oversight</p>
                  </div>
                  <motion.button
                    type="button"
                    onClick={() => setOpenStaffId(null)}
                    whileHover={{ rotate: 90 }}
                    className="p-2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X size={24} />
                  </motion.button>
                </div>

                <div className="grid gap-8 p-8 lg:grid-cols-[0.9fr,1.1fr]">
                  <div className="space-y-5">
                    <div>
                      <h4 className="text-base font-semibold text-foreground">Shift Performance</h4>
                      <p className="mt-1 text-sm text-muted-foreground">Quick pulse for workload and output.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl border border-border/80 bg-card p-5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Hours</p>
                        <p className="mt-2 text-lg font-semibold text-foreground">{selectedStaff.hours.toFixed(1)}h</p>
                      </div>
                      <div className="rounded-xl border border-border/80 bg-card p-5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Tables</p>
                        <p className="mt-2 text-lg font-semibold text-foreground">{selectedStaff.activeTables}</p>
                      </div>
                      <div className="rounded-xl border border-border/80 bg-card p-5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Revenue</p>
                        <p className="mt-2 text-lg font-semibold text-accent">{formatCurrency(selectedStaff.revenue)}</p>
                      </div>
                      <div className="rounded-xl border border-border/80 bg-card p-5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Tips</p>
                        <p className="mt-2 text-lg font-semibold text-foreground">{formatCurrency(selectedStaff.tips)}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/80 bg-card p-5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Assigned Tables</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedStaff.tables.map((tableNumber) => (
                          <span
                            key={tableNumber}
                            className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1 text-sm font-medium text-foreground"
                          >
                            Table {tableNumber}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/80 bg-card p-5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Manager Note</p>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Strong pacing on high-value tables. Keep an eye on bill delays and reassign if patio wait time exceeds 10 minutes.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/80 bg-card p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xl font-semibold text-foreground">Active Service Snapshot</h4>
                        <p className="mt-1 text-sm text-muted-foreground">Current tables and service timing for {selectedStaff.name}.</p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock3 className="size-4" />
                        Live view
                      </div>
                    </div>

                    <div className="mt-5 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Table</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Guests</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Elapsed</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedStaffTables.map((table) => (
                            <TableRow
                              key={table.id}
                              onClick={() => openTableDetails(table.id)}
                              className="cursor-pointer"
                            >
                              <TableCell className="font-medium text-foreground">{table.tableNumber}</TableCell>
                              <TableCell>
                                <StatusBadge label={table.status} className={statusColorMap[table.status]} />
                              </TableCell>
                              <TableCell>{table.guests}</TableCell>
                              <TableCell>{formatCurrency(table.runningTotal)}</TableCell>
                              <TableCell>{table.elapsedMinutes} min</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </motion.section>
            </div>
          )}
        </AnimatePresence>
      </div>
      </MacOSSidebar>
    </main>
  );
}
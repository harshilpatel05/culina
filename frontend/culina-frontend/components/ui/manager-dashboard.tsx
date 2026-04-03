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

type TableStatus = "Seated" | "Order Taken" | "Dish Ready" | "Served" | "Needs Bill";
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

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
};

type TrendPoint = {
  hour: string;
  revenue: number;
  tables: number;
};

type ManagerDashboardProps = {
  managerName?: string;
};

const INITIAL_STAFF: StaffMember[] = [
  {
    id: "w1",
    name: "Harshil",
    status: "On Floor",
    zone: "Patio",
    activeTables: 4,
    revenue: 12450,
    tips: 1890,
    hours: 6.5,
    tables: ["01", "04", "12", "15"],
  },
  {
    id: "w2",
    name: "Jordan",
    status: "On Floor",
    zone: "Main Hall",
    activeTables: 3,
    revenue: 9780,
    tips: 1420,
    hours: 5.75,
    tables: ["03", "08", "10"],
  },
  {
    id: "w3",
    name: "Sana",
    status: "On Break",
    zone: "Lounge",
    activeTables: 2,
    revenue: 6510,
    tips: 930,
    hours: 4.25,
    tables: ["05", "06"],
  },
  {
    id: "w4",
    name: "Mateo",
    status: "Closing",
    zone: "Private Dining",
    activeTables: 2,
    revenue: 7080,
    tips: 1110,
    hours: 7.1,
    tables: ["17", "18"],
  },
];

const INITIAL_TABLES: ManagerTable[] = [
  {
    id: "t1",
    tableNumber: "01",
    waiterId: "w1",
    status: "Dish Ready",
    guests: 4,
    runningTotal: 3240,
    elapsedMinutes: 52,
    orderItems: [
      { id: "t1-1", name: "Paneer Tikka", quantity: 2, price: 520 },
      { id: "t1-2", name: "Butter Naan", quantity: 6, price: 90 },
      { id: "t1-3", name: "Mango Lassi", quantity: 4, price: 180 },
    ],
  },
  {
    id: "t2",
    tableNumber: "03",
    waiterId: "w2",
    status: "Order Taken",
    guests: 2,
    runningTotal: 1850,
    elapsedMinutes: 28,
    orderItems: [
      { id: "t2-1", name: "Margherita Pizza", quantity: 1, price: 920 },
      { id: "t2-2", name: "Caesar Salad", quantity: 1, price: 560 },
      { id: "t2-3", name: "Sparkling Water", quantity: 2, price: 185 },
    ],
  },
  {
    id: "t3",
    tableNumber: "04",
    waiterId: "w1",
    status: "Needs Bill",
    guests: 5,
    runningTotal: 5790,
    elapsedMinutes: 94,
    orderItems: [
      { id: "t3-1", name: "Ribeye Steak", quantity: 2, price: 1620 },
      { id: "t3-2", name: "Truffle Pasta", quantity: 1, price: 980 },
      { id: "t3-3", name: "House Red Wine", quantity: 2, price: 775 },
    ],
  },
  {
    id: "t4",
    tableNumber: "05",
    waiterId: "w3",
    status: "Seated",
    guests: 2,
    runningTotal: 0,
    elapsedMinutes: 11,
    orderItems: [],
  },
  {
    id: "t5",
    tableNumber: "06",
    waiterId: "w3",
    status: "Served",
    guests: 3,
    runningTotal: 2640,
    elapsedMinutes: 67,
    orderItems: [
      { id: "t5-1", name: "Dal Makhani", quantity: 2, price: 640 },
      { id: "t5-2", name: "Butter Naan", quantity: 6, price: 90 },
      { id: "t5-3", name: "Gulab Jamun", quantity: 3, price: 120 },
    ],
  },
  {
    id: "t6",
    tableNumber: "08",
    waiterId: "w2",
    status: "Dish Ready",
    guests: 6,
    runningTotal: 4920,
    elapsedMinutes: 73,
    orderItems: [
      { id: "t6-1", name: "Grilled Salmon", quantity: 3, price: 1190 },
      { id: "t6-2", name: "French Fries", quantity: 2, price: 320 },
      { id: "t6-3", name: "Sparkling Water", quantity: 4, price: 185 },
    ],
  },
  {
    id: "t7",
    tableNumber: "10",
    waiterId: "w2",
    status: "Order Taken",
    guests: 2,
    runningTotal: 2210,
    elapsedMinutes: 31,
    orderItems: [
      { id: "t7-1", name: "Truffle Pasta", quantity: 1, price: 980 },
      { id: "t7-2", name: "Cheesecake", quantity: 2, price: 305 },
      { id: "t7-3", name: "Coffee", quantity: 2, price: 210 },
    ],
  },
  {
    id: "t8",
    tableNumber: "12",
    waiterId: "w1",
    status: "Served",
    guests: 4,
    runningTotal: 3380,
    elapsedMinutes: 61,
    orderItems: [
      { id: "t8-1", name: "Paneer Tikka", quantity: 1, price: 520 },
      { id: "t8-2", name: "Margherita Pizza", quantity: 2, price: 920 },
      { id: "t8-3", name: "Mango Lassi", quantity: 2, price: 180 },
    ],
  },
  {
    id: "t9",
    tableNumber: "15",
    waiterId: "w1",
    status: "Needs Bill",
    guests: 2,
    runningTotal: 2760,
    elapsedMinutes: 84,
    orderItems: [
      { id: "t9-1", name: "Ribeye Steak", quantity: 1, price: 1620 },
      { id: "t9-2", name: "House Red Wine", quantity: 1, price: 775 },
      { id: "t9-3", name: "Cheesecake", quantity: 1, price: 365 },
    ],
  },
  {
    id: "t10",
    tableNumber: "17",
    waiterId: "w4",
    status: "Seated",
    guests: 8,
    runningTotal: 0,
    elapsedMinutes: 16,
    orderItems: [],
  },
  {
    id: "t11",
    tableNumber: "18",
    waiterId: "w4",
    status: "Dish Ready",
    guests: 4,
    runningTotal: 4170,
    elapsedMinutes: 57,
    orderItems: [
      { id: "t11-1", name: "Grilled Salmon", quantity: 2, price: 1190 },
      { id: "t11-2", name: "Caesar Salad", quantity: 2, price: 560 },
      { id: "t11-3", name: "Sparkling Water", quantity: 2, price: 185 },
    ],
  },
];

const TREND_DATA: TrendPoint[] = [
  { hour: "12 PM", revenue: 8200, tables: 6 },
  { hour: "1 PM", revenue: 11200, tables: 8 },
  { hour: "2 PM", revenue: 13600, tables: 10 },
  { hour: "3 PM", revenue: 9800, tables: 7 },
  { hour: "4 PM", revenue: 7600, tables: 5 },
  { hour: "5 PM", revenue: 12900, tables: 9 },
  { hour: "6 PM", revenue: 16800, tables: 12 },
];

const FILTERS: TableFilter[] = ["All", "Seated", "Order Taken", "Dish Ready", "Served", "Needs Bill"];

const statusColorMap: Record<TableStatus, string> = {
  Seated: "border-blue-200/30 bg-blue-500/10 text-blue-300 dark:border-blue-400/30 dark:bg-blue-500/20 dark:text-blue-200",
  "Order Taken": "border-amber-200/30 bg-amber-500/10 text-amber-300 dark:border-amber-400/30 dark:bg-amber-500/20 dark:text-amber-200",
  "Dish Ready": "border-green-200/30 bg-green-500/10 text-green-300 dark:border-green-400/30 dark:bg-green-500/20 dark:text-green-200",
  Served: "border-purple-200/30 bg-purple-500/10 text-purple-300 dark:border-purple-400/30 dark:bg-purple-500/20 dark:text-purple-200",
  "Needs Bill": "border-red-200/30 bg-red-500/10 text-red-300 dark:border-red-400/30 dark:bg-red-500/20 dark:text-red-200",
};

const staffStatusColorMap: Record<StaffStatus, string> = {
  "On Floor": "border-emerald-200/30 bg-emerald-500/10 text-emerald-300 dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:text-emerald-200",
  "On Break": "border-amber-200/30 bg-amber-500/10 text-amber-300 dark:border-amber-400/30 dark:bg-amber-500/20 dark:text-amber-200",
  Closing: "border-slate-200/30 bg-slate-500/10 text-slate-300 dark:border-slate-400/30 dark:bg-slate-500/20 dark:text-slate-200",
};

const chartConfig = {
  revenue: {
    label: "Revenue",
    theme: {
      light: "var(--accent)",
      dark: "var(--primary)",
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

export function ManagerDashboard({ managerName = "Avery" }: ManagerDashboardProps) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [tables, setTables] = useState<ManagerTable[]>([]);
  const [staff] = useState<StaffMember[]>(INITIAL_STAFF);
  const [selectedFilter, setSelectedFilter] = useState<TableFilter>("All");
  const [openStaffId, setOpenStaffId] = useState<string | null>(null);
  const [openTableId, setOpenTableId] = useState<string | null>(null);
  const [isLoggedOut, setIsLoggedOut] = useState(false);
  const [isShiftOpen, setIsShiftOpen] = useState(true);
  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [tablesError, setTablesError] = useState<string | null>(null);

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
        const ordersList = Array.isArray(ordersData) ? ordersData : ordersData.data || [];
        
        // Create a map of orders by table_id for quick lookup
        const ordersByTableId: Record<string, any> = {};
        ordersList.forEach((order: any) => {
          if (order.table_id) {
            ordersByTableId[order.table_id] = order;
          }
        });
        
        // Transform tables to ManagerTable format, including order data if available
        const transformedTables = tablesList
          .map((table: any) => {
            const order = ordersByTableId[table.id];
            return {
              id: table.id,
              tableNumber: String(table.table_number).padStart(2, '0'),
              waiterId: order?.taken_by || 'unassigned',
              status: order ? mapOrderStatusToTableStatus(order.status) : 'Seated',
              guests: order?.num_people || 1,
              runningTotal: order ? parseFloat(order.total_amount) || 0 : 0,
              elapsedMinutes: order ? Math.floor((new Date().getTime() - new Date(order.order_time).getTime()) / 60000) : 0,
              orderItems: order?.order_items && Array.isArray(order.order_items)
                ? order.order_items.map((item: any, idx: number) => ({
                    id: `${order.id}-item-${idx}`,
                    name: item.name || item.dish_name || 'Unknown',
                    quantity: item.quantity || 1,
                    price: parseFloat(item.price) || 0,
                  }))
                : [],
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

  const metrics = useMemo(() => {
    const readyCount = tables.filter((table) => table.status === "Dish Ready").length;
    const billCount = tables.filter((table) => table.status === "Needs Bill").length;
    const revenue = tables.reduce((sum, table) => sum + table.runningTotal, 0);
    const onDuty = staff.filter((member) => member.status !== "On Break").length;

    return {
      activeTables: tables.length,
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
    setOpenTableId(tableId);
  };

  const handleBilling = () => {
    if (!openTableId) {
      return;
    }

    setTables((previous) =>
      previous.map((table) => (table.id === openTableId ? { ...table, status: "Served" } : table))
    );
    setOpenTableId(null);
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
    <main className="min-h-screen w-full bg-white">
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
      <div className="flex w-full flex-col gap-8 pl-3 sm:pl-4 lg:pl-5">
        <header className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex-1 space-y-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                Floor command, {managerName}
              </h1>
              <p className="mt-2 text-muted-foreground">
                Track staff load, service bottlenecks, and revenue pacing from one surface.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {[
                { label: "Active Tables", value: metrics.activeTables, accent: "text-foreground", icon: Activity },
                { label: "Dish Ready", value: metrics.readyCount, accent: "text-green-400", icon: Briefcase },
                { label: "Needs Bill", value: metrics.billCount, accent: "text-red-400", icon: Wallet },
                { label: "On Duty", value: metrics.onDuty, accent: "text-sky-400", icon: Users },
                { label: "Shift Revenue", value: formatCurrency(metrics.revenue), accent: "text-accent", icon: Wallet },
              ].map((item) => (
                <motion.div
                  key={item.label}
                  className="rounded-lg border border-border bg-card/50 px-4 py-3 backdrop-blur-sm"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 12 }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                      <p className={`mt-1 text-2xl font-bold ${item.accent}`}>{item.value}</p>
                    </div>
                    <item.icon className="mt-1 size-4 text-muted-foreground" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="flex w-full flex-col items-start gap-4 sm:w-[24rem] xl:items-end">
            <div className="w-full rounded-xl border border-border bg-card/50 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Shift State</p>
              <div className="mt-3 flex items-center gap-3">
                <span className={`inline-flex rounded-md border px-3 py-1 text-xs font-semibold ${isShiftOpen ? staffStatusColorMap["On Floor"] : staffStatusColorMap.Closing}`}>
                  {isShiftOpen ? "Service Live" : "Closing Mode"}
                </span>
                <span className="text-sm text-muted-foreground">
                  Peak lead: {performanceLead?.name ?? "-"}
                </span>
              </div>
            </div>

            <div className="grid w-full grid-cols-[3rem_1fr_auto] gap-3">
              <motion.button
                type="button"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-card text-foreground transition-all hover:bg-secondary dark:hover:bg-secondary/50"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
              >
                {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </motion.button>

              <motion.button
                type="button"
                onClick={() => setIsShiftOpen((current) => !current)}
                className={`rounded-md border px-5 py-3 text-sm font-semibold transition-all ${
                  isShiftOpen
                    ? "border-red-500/30 bg-red-500 text-white hover:bg-red-600"
                    : "border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isShiftOpen ? "Close Shift" : "Open Shift"}
              </motion.button>

              <motion.button
                type="button"
                onClick={() => setIsLoggedOut(true)}
                className="flex items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-all hover:bg-secondary dark:hover:bg-secondary/50"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">Logout</span>
              </motion.button>
            </div>
          </div>
        </header>

        {isLoggedOut && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
          >
            <p className="text-sm font-medium text-destructive">Logged out (demo state)</p>
          </motion.div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <div className="space-y-4 rounded-2xl border border-border bg-card/50 p-5 backdrop-blur-sm">
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
                  className="group rounded-xl border border-border bg-background/45 p-4 text-left transition-all hover:border-accent/40 hover:bg-background/70"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-foreground">{member.name}</h3>
                        <span className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-semibold ${staffStatusColorMap[member.status]}`}>
                          {member.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{member.zone}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Tables</p>
                      <p className="mt-1 font-semibold text-foreground">{member.activeTables}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Hours</p>
                      <p className="mt-1 font-semibold text-foreground">{member.hours.toFixed(1)}h</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Revenue</p>
                      <p className="mt-1 font-semibold text-accent">{formatCurrency(member.revenue)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Tips</p>
                      <p className="mt-1 font-semibold text-foreground">{formatCurrency(member.tips)}</p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-card/50 p-5 backdrop-blur-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Revenue Pace</h2>
                <p className="mt-1 text-sm text-muted-foreground">Mock hourly trend until API data is wired in.</p>
              </div>
              <div className="text-sm text-muted-foreground">Today</div>
            </div>

            <ChartContainer config={chartConfig} className="h-65 w-full">
              <AreaChart data={TREND_DATA} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="managerRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="hour" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `₹${Number(value) / 1000}k`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-revenue)"
                  fill="url(#managerRevenue)"
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
                <div key={item.label} className="rounded-lg border border-border bg-background/45 px-3 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-5 rounded-2xl border border-border bg-card/50 p-5 backdrop-blur-sm">
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
                      : "border-border bg-background/70 text-foreground hover:bg-secondary"
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
              className="rounded-lg border border-border/50 bg-card/50 px-4 py-3"
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
              className="rounded-lg border border-border/50 bg-card/50 px-4 py-3 text-center"
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
                  className="group relative overflow-hidden rounded-xl border border-border bg-background/45 p-4 text-left transition-all hover:border-accent/40"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-current bg-background/60 text-xl font-bold text-foreground">
                      {table.tableNumber}
                    </div>
                    <span className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-semibold ${statusColorMap[table.status]}`}>
                      {table.status}
                    </span>
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
                className="relative z-51 w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card/95 shadow-2xl"
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
                  <div className="rounded-xl border border-border bg-background/45 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                    <span className={`mt-2 inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${statusColorMap[openTable.status]}`}>
                      {openTable.status}
                    </span>
                  </div>

                  <div className="rounded-xl border border-border bg-background/45 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Guests</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{openTable.guests}</p>
                  </div>

                  <div className="rounded-xl border border-border bg-background/45 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Running Total</p>
                    <p className="mt-2 text-lg font-semibold text-accent">{formatCurrency(openTable.runningTotal)}</p>
                  </div>

                  <div className="rounded-xl border border-border bg-background/45 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Elapsed</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{openTable.elapsedMinutes} min</p>
                  </div>

                  <div className="rounded-xl border border-border bg-background/45 p-4 sm:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Order Items</p>
                    {openTable.orderItems.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">No items added yet.</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {openTable.orderItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between rounded-md border border-border bg-card/50 px-3 py-2">
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

                <div className="flex items-center justify-between gap-3 border-t border-border bg-card/60 px-6 py-4">
                  <p className="text-sm text-muted-foreground">Complete billing to close the payment step for this table.</p>
                  <button
                    type="button"
                    onClick={handleBilling}
                    className="rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
                  >
                    Billing
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
                className="relative z-51 my-4 w-full max-w-6xl overflow-y-auto rounded-2xl border border-border bg-card/95 shadow-2xl sm:my-6 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]"
              >
                <div className="flex items-start justify-between border-b border-border px-8 py-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-3xl font-bold text-foreground">{selectedStaff.name}</h3>
                      <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${staffStatusColorMap[selectedStaff.status]}`}>
                        {selectedStaff.status}
                      </span>
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
                      <div className="rounded-xl border border-border bg-background/45 p-5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Hours</p>
                        <p className="mt-2 text-lg font-semibold text-foreground">{selectedStaff.hours.toFixed(1)}h</p>
                      </div>
                      <div className="rounded-xl border border-border bg-background/45 p-5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Tables</p>
                        <p className="mt-2 text-lg font-semibold text-foreground">{selectedStaff.activeTables}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-background/45 p-5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Revenue</p>
                        <p className="mt-2 text-lg font-semibold text-accent">{formatCurrency(selectedStaff.revenue)}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-background/45 p-5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Tips</p>
                        <p className="mt-2 text-lg font-semibold text-foreground">{formatCurrency(selectedStaff.tips)}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-background/45 p-5">
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

                    <div className="rounded-xl border border-border bg-background/45 p-5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Manager Note</p>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Strong pacing on high-value tables. Keep an eye on bill delays and reassign if patio wait time exceeds 10 minutes.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-background/45 p-5">
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
                                <span className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-semibold ${statusColorMap[table.status]}`}>
                                  {table.status}
                                </span>
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
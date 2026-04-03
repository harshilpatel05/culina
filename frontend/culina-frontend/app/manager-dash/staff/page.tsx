"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Boxes, Building2, LayoutDashboard, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MacOSSidebar } from "@/components/ui/macos-sidebar-base";

type StaffRole = "manager" | "chef" | "waiter";

type StaffStatus = "active" | "holiday" | "inactive";

type StaffRecord = {
  id: string;
  staff_id: string | null;
  restaurant_id: string | null;
  name: string | null;
  role: StaffRole | null;
  salary: number | null;
  status: StaffStatus | null;
  created_at: string | null;
};

type StaffFormState = {
  staffId: string;
  name: string;
  role: StaffRole | "";
  salary: string;
  password: string;
  status: StaffStatus;
};

const EMPTY_FORM: StaffFormState = {
  staffId: "",
  name: "",
  role: "",
  salary: "",
  password: "",
  status: "inactive",
};

const STATUS_OPTIONS: StaffStatus[] = ["active", "holiday", "inactive"];
const ROLE_OPTIONS: StaffRole[] = ["manager", "chef", "waiter"];

const statusLabelMap: Record<StaffStatus, string> = {
  active: "Active",
  holiday: "Holiday",
  inactive: "Inactive",
};

const roleLabelMap: Record<StaffRole, string> = {
  manager: "Manager",
  chef: "Chef",
  waiter: "Waiter",
};

const PANEL_SHELL = "rounded-2xl border border-slate-300/90 bg-card/70 p-4 shadow-sm backdrop-blur-sm dark:border-slate-600/70";
const SUBTLE_PANEL = "rounded-2xl border border-slate-300/80 bg-card/60 shadow-sm backdrop-blur-sm dark:border-slate-600/60";
const FIELD_INPUT = "w-full rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm outline-none ring-primary transition focus:border-primary/60 focus:ring-2";

const statusClassMap: Record<StaffStatus, string> = {
  active: "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  holiday: "border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  inactive: "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
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

export default function ManagerStaffPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const managerRestaurantId = user?.restaurant_id ?? null;
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StaffFormState>(EMPTY_FORM);

  const loadData = async (restaurantId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const staffRes = await fetch("/api/staff");

      if (!staffRes.ok) {
        throw new Error(`Could not load staff data (${staffRes.status})`);
      }

      const staffData: StaffRecord[] = await staffRes.json();
      setStaff(
        Array.isArray(staffData)
          ? staffData.filter((m) => m.restaurant_id === restaurantId)
          : []
      );
    } catch (loadErr) {
      const message = loadErr instanceof Error ? loadErr.message : "Failed to load staff data.";
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

  const filteredStaff = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return staff;
    }

    return staff.filter((member) => {
      const name = member.name?.toLowerCase() ?? "";
      const staffId = member.staff_id?.toLowerCase() ?? "";
      const role = member.role?.toLowerCase() ?? "";
      const status = member.status?.toLowerCase() ?? "";
      return (
        staffId.includes(normalizedQuery) ||
        name.includes(normalizedQuery) ||
        role.includes(normalizedQuery) ||
        status.includes(normalizedQuery)
      );
    });
  }, [staff, query]);

  const metrics = useMemo(() => {
    const headcount = staff.length;
    const activeRoles = new Set(staff.map((member) => member.role).filter(Boolean)).size;
    const rateValues = staff
      .map((member) => Number(member.salary ?? 0))
      .filter((value) => Number.isFinite(value) && value > 0);

    const avgRate = rateValues.length
      ? rateValues.reduce((sum, value) => sum + value, 0) / rateValues.length
      : 0;

    return {
      headcount,
      activeRoles,
      avgRate,
    };
  }, [staff]);

  const staffStatusSummary = useMemo(() => {
    return staff.reduce(
      (summary, member) => {
        const normalizedStatus = member.status ?? "inactive";
        summary[normalizedStatus] += 1;
        return summary;
      },
      {
        active: 0,
        holiday: 0,
        inactive: 0,
      } as Record<StaffStatus, number>
    );
  }, [staff]);

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

  const openEdit = (member: StaffRecord) => {
    setEditingId(member.id);
    setForm({
      staffId: member.staff_id ?? "",
      name: member.name ?? "",
      role: member.role ?? "",
      salary: member.salary != null ? String(member.salary) : "",
      password: "",
      status: member.status ?? "inactive",
    });
    setIsFormOpen(true);
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!managerRestaurantId) {
      setError("No restaurant is associated with your account.");
      return;
    }

    if (!form.staffId.trim() || !form.name.trim() || !form.role.trim()) {
      setError("Staff ID, name, and role are required.");
      return;
    }

    if (!editingId && !form.password.trim()) {
      setError("Password is required when creating a staff member.");
      return;
    }

    if (!ROLE_OPTIONS.includes(form.role as StaffRole)) {
      setError("Please select a valid role.");
      return;
    }

    const parsedRate = form.salary.trim() ? Number(form.salary) : null;
    if (parsedRate !== null && (Number.isNaN(parsedRate) || parsedRate < 0)) {
      setError("Salary must be a valid positive number.");
      return;
    }

    if (!STATUS_OPTIONS.includes(form.status)) {
      setError("Please select a valid status.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const payload = {
        staff_id: form.staffId.trim(),
        restaurant_id: managerRestaurantId,
        name: form.name.trim(),
        role: form.role,
        salary: parsedRate,
        password: form.password.trim() || undefined,
        status: form.status,
      };

      const isEditing = Boolean(editingId);
      const endpoint = isEditing ? `/api/staff/${editingId}` : "/api/staff";
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
        throw new Error(responseBody?.error ?? "Could not save staff record.");
      }

      await loadData(managerRestaurantId);
      resetForm();
    } catch (submitErr) {
      const message = submitErr instanceof Error ? submitErr.message : "Failed to save staff record.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteMember = async (id: string) => {
    const shouldDelete = window.confirm("Delete this staff member? This action cannot be undone.");
    if (!shouldDelete) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/staff/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        throw new Error(responseBody?.error ?? "Could not delete staff member.");
      }
      if (managerRestaurantId) await loadData(managerRestaurantId);
    } catch (deleteErr) {
      const message = deleteErr instanceof Error ? deleteErr.message : "Failed to delete staff member.";
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
        <header className="rounded-3xl border border-sky-400/75 bg-linear-to-br from-slate-200 via-sky-200 to-blue-400 p-6 shadow-[0_8px_22px_rgba(30,64,175,0.18)] backdrop-blur dark:border-sky-400/55 dark:from-slate-900 dark:via-blue-900/90 dark:to-blue-950/90">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">Manager Console</p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Staff Management</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Manage your team, assign staff IDs, track salary and status, and keep each restaurant staffed with the right roles.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  Active: {staffStatusSummary.active}
                </span>
                <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                  Holiday: {staffStatusSummary.holiday}
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-400/30 bg-slate-500/10 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                  Inactive: {staffStatusSummary.inactive}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Add Staff
            </button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <article className={SUBTLE_PANEL + " p-4"}>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Total Staff</p>
            <div className="mt-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-2xl font-semibold text-foreground">{metrics.headcount}</p>
            </div>
          </article>
          <article className={SUBTLE_PANEL + " p-4"}>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Average Salary</p>
            <p className="mt-3 text-2xl font-semibold text-foreground">{formatCurrency(metrics.avgRate)}</p>
          </article>
          <article className={SUBTLE_PANEL + " p-4 sm:col-span-2 xl:col-span-1"}>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Active Roles</p>
            <p className="mt-3 text-2xl font-semibold text-foreground">{metrics.activeRoles}</p>
          </article>
        </section>

        <section className={PANEL_SHELL}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-foreground">Team Roster</h2>
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by staff ID, name, role, or status"
                className="w-full rounded-xl border border-border/70 bg-background pl-9 pr-3 py-2 text-sm outline-none ring-primary transition focus:ring-2"
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
                  <th className="px-3 py-3 font-medium">Staff ID</th>
                  <th className="px-3 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Role</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Salary</th>
                  <th className="px-3 py-3 font-medium">Joined</th>
                  <th className="px-3 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      Loading staff records...
                    </td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      No staff found. Add your first team member.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((member) => (
                    <tr key={member.id} className="border-b border-border/40 hover:bg-muted/40">
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{member.staff_id || "-"}</td>
                      <td className="px-3 py-3 font-medium text-foreground">{member.name || "-"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{member.role || "-"}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClassMap[member.status ?? "inactive"]}`}
                        >
                          {statusLabelMap[member.status ?? "inactive"]}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {member.salary != null ? formatCurrency(Number(member.salary)) : "-"}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{formatDate(member.created_at)}</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(member)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition hover:text-foreground"
                            aria-label="Edit staff"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMember(member.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/40 text-red-500 transition hover:bg-red-500/10"
                            aria-label="Delete staff"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
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
                  {editingId ? "Edit Staff Member" : "Add Staff Member"}
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
                <label className="space-y-2.5">
                  <span className="text-sm font-medium text-foreground">Staff ID</span>
                  <input
                    value={form.staffId}
                    onChange={(event) => setForm((prev) => ({ ...prev, staffId: event.target.value }))}
                    className={FIELD_INPUT}
                    placeholder="e.g. STF-104"
                    required
                  />
                </label>

                <label className="space-y-2.5">
                  <span className="text-sm font-medium text-foreground">Name</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    className={FIELD_INPUT}
                    placeholder="e.g. Priya Sharma"
                    required
                  />
                </label>

                <label className="space-y-2.5">
                  <span className="text-sm font-medium text-foreground">Role</span>
                  <Select
                    value={form.role || undefined}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        role: value as StaffRole,
                      }))
                    }
                  >
                    <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background px-3 text-sm">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/70">
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role} value={role}>
                          {roleLabelMap[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="space-y-2.5">
                  <span className="text-sm font-medium text-foreground">Salary (INR)</span>
                  <input
                    value={form.salary}
                    onChange={(event) => setForm((prev) => ({ ...prev, salary: event.target.value }))}
                    type="number"
                    min="0"
                    step="0.01"
                    className={FIELD_INPUT}
                    placeholder="e.g. 45000"
                  />
                </label>

                <label className="space-y-2.5">
                  <span className="text-sm font-medium text-foreground">Password</span>
                  <input
                    value={form.password}
                    onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                    type="password"
                    className={FIELD_INPUT}
                    placeholder={editingId ? "Leave blank to keep current password" : "Create a password"}
                    required={!editingId}
                  />
                </label>

                <label className="space-y-2.5">
                  <span className="text-sm font-medium text-foreground">Status</span>
                  <Select
                    value={form.status}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        status: value as StaffStatus,
                      }))
                    }
                  >
                    <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background px-3 text-sm">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/70">
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {statusLabelMap[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                </div>

                <div className="mt-6">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? "Saving..." : editingId ? "Save Changes" : "Create Staff Member"}
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

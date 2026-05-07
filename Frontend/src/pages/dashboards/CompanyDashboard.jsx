import { useEffect, useState } from "react";
import api, { BASE_URL } from "../../assets/js/axiosConfig";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/ui/kpi-card";
import { AreaChart } from "@/components/ui/area-chart";
import { DonutChart } from "@/components/ui/donut-chart";
import {
  Wallet, Banknote, CreditCard, TrendingUp,
  Bus, Route, MapPin, Users,
  Receipt, CheckCircle, Clock, XCircle,
  CalendarDays, AlertCircle, RefreshCw,
} from "lucide-react";

export default function CompanyDashboard() {
  // ── Section 1: User info ────────────────────────────────────────────────
  const storedUser = localStorage.getItem("user")
    ? JSON.parse(localStorage.getItem("user"))
    : null;
  const username = storedUser?.username || "User";
  const companyName = storedUser?.company_name || "Company";
  const companyId = storedUser?.company_id;

  // ── Section 2: State ────────────────────────────────────────────────────
  const [metrics, setMetrics] = useState({
    collections: { daily_cash: 0, daily_upi: 0, monthly_total: 0 },
    operations: {
      buses_active: 0, buses_total: 0,
      trips_completed: 0, trips_scheduled: 0,
      routes_active: 0, routes_total: 0,
      total_passengers: 0,
    },
    settlements: { total_transactions: 0, verified: 0, pending_verification: 0, failed: 0 },
  });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Section 3: Fetch ────────────────────────────────────────────────────
  useEffect(() => { fetchDashboardData(); }, [selectedDate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`${BASE_URL}/get_company_dashboard_metrics?date=${selectedDate}`);
      if (res.data?.data) {
        setMetrics(res.data.data);
      } else {
        setError("Unexpected response format from server");
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setError("Authentication expired. Please log in again.");
      } else if (err.response?.status === 400) {
        setError("Invalid date selected. Please choose a valid date.");
      } else if (!err.response) {
        setError("Cannot connect to server. Please check your connection.");
      } else {
        setError("Failed to load dashboard data. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Section 4: Formatters ───────────────────────────────────────────────
  const formatCurrency = (val) =>
    val === null || val === undefined
      ? "—"
      : `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const formatNumber = (val) =>
    val === null || val === undefined ? "—" : val.toLocaleString("en-IN");

  const formatActiveTotal = (active, total) =>
    active == null || total == null ? "—" : `${formatNumber(active)}/${formatNumber(total)}`;

  const formatPercentage = (part, total) => {
    if (!total || total === 0) return "0%";
    return `${Math.round((part / total) * 100)}%`;
  };

  const shortCurrency = (val) => {
    if (val == null) return "—";
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
  };

  // ── Derived values ──────────────────────────────────────────────────────
  const totalDailyCollection =
    (metrics.collections.daily_cash || 0) + (metrics.collections.daily_upi || 0);

  const selectedDateLabel = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : "";

  // Chart data for Collections AreaChart (single-day split visualised as two points)
  const collectionChartData = [
    { name: "Cash", Cash: metrics.collections.daily_cash || 0, UPI: 0 },
    { name: "UPI", Cash: 0, UPI: metrics.collections.daily_upi || 0 },
    { name: "Monthly", Cash: 0, UPI: 0 },
  ];

  // Chart data for Settlements DonutChart
  const settlementChartData = [
    { name: "Verified", value: metrics.settlements.verified || 0, color: "#22c55e" },
    { name: "Pending", value: metrics.settlements.pending_verification || 0, color: "#f59e0b" },
    { name: "Failed", value: metrics.settlements.failed || 0, color: "#ef4444" },
  ];

  // Progress bar helper
  const pct = (active, total) =>
    total > 0 ? Math.min(100, Math.round((active / total) * 100)) : 0;

  // ── Section 5: UI ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 animate-fade-in">
      {/* Background gradient decoration */}
      <div className="pointer-events-none fixed -top-24 left-1/2 h-72 w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-100 via-sky-100 to-emerald-100 blur-3xl opacity-60" />

      <div className="relative max-w-[1400px] mx-auto p-3 sm:p-4 lg:p-6">

        {/* ═══════ HEADER ═══════════════════════════════════════════════ */}
        <Card className="mb-6 overflow-hidden border-slate-200/80 bg-white/90 backdrop-blur shadow-sm rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white to-slate-50 pointer-events-none" />
          <CardContent className="relative p-4 sm:p-5 lg:p-6">

            {/* Title row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {companyName} Dashboard
                  {companyId && (
                    <span className="ml-2 normal-case font-normal text-slate-400">
                      (ID: {companyId})
                    </span>
                  )}
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  Company Overview
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                  Welcome back, <span className="font-semibold text-slate-700">{username}</span>.
                  Operational pulse for{" "}
                  <span className="font-semibold text-slate-700">{selectedDateLabel}</span>.
                </p>
              </div>

              {/* Date picker */}
              <label className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg shadow-sm w-fit hover:bg-slate-100 transition-colors cursor-pointer shrink-0">
                <CalendarDays size={15} className="text-slate-500" />
                <input
                  aria-label="Select date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="bg-transparent outline-none text-slate-700 cursor-pointer"
                />
              </label>
            </div>

            {/* Error banner */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">Error loading dashboard</p>
                  <p className="text-xs text-red-600 mt-0.5">{error}</p>
                </div>
                <button
                  onClick={fetchDashboardData}
                  className="flex items-center gap-1 text-xs text-red-700 hover:text-red-900 font-medium"
                >
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            )}

            {/* Quick stat cards */}
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Daily Collection",
                  value: loading ? null : formatCurrency(totalDailyCollection),
                  sub: `Cash: ${formatCurrency(metrics.collections.daily_cash)} · UPI: ${formatCurrency(metrics.collections.daily_upi)}`,
                },
                {
                  label: "Monthly Till Date",
                  value: loading ? null : formatCurrency(metrics.collections.monthly_total),
                  sub: new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) + " revenue",
                },
                {
                  label: "Total Passengers",
                  value: loading ? null : formatNumber(metrics.operations.total_passengers),
                  sub: `Across ${formatNumber(metrics.operations.trips_completed)} trips`,
                },
              ].map(({ label, value, sub }) => (
                <div key={label} className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
                  {loading
                    ? <Skeleton className="mt-2 h-7 w-28" />
                    : <p className="text-xl font-bold text-slate-900 mt-2">{value}</p>
                  }
                  {loading
                    ? <Skeleton className="mt-1.5 h-3 w-36" />
                    : <p className="text-xs text-slate-500 mt-1">{sub}</p>
                  }
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ═══════ COLLECTIONS ══════════════════════════════════════════ */}
        <Card className="mb-6 border-slate-200/80 bg-white/90 shadow-sm rounded-2xl">
          <CardHeader className="p-4 sm:p-5 pb-0">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md">
                <Wallet size={16} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Collection Overview</h2>
                <p className="text-xs text-slate-500">Daily and month-to-date revenue distribution</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KpiCard
                title="Total Daily Collection"
                value={loading ? "..." : formatCurrency(totalDailyCollection)}
                icon={Wallet}
                color="#3b82f6"
                loading={loading}
              />
              <KpiCard
                title="Daily Cash"
                value={loading ? "..." : formatCurrency(metrics.collections.daily_cash)}
                subtitle={totalDailyCollection > 0 ? formatPercentage(metrics.collections.daily_cash, totalDailyCollection) + " of total" : ""}
                icon={Banknote}
                color="#10b981"
                loading={loading}
              />
              <KpiCard
                title="Daily UPI"
                value={loading ? "..." : formatCurrency(metrics.collections.daily_upi)}
                subtitle={totalDailyCollection > 0 ? formatPercentage(metrics.collections.daily_upi, totalDailyCollection) + " of total" : ""}
                icon={CreditCard}
                color="#8b5cf6"
                loading={loading}
              />
              <KpiCard
                title="Monthly Till Date"
                value={loading ? "..." : formatCurrency(metrics.collections.monthly_total)}
                icon={TrendingUp}
                color="#f59e0b"
                loading={loading}
              />
            </div>

            {/* Area Chart */}
            {!loading && totalDailyCollection > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                  Cash vs UPI Breakdown
                </p>
                <AreaChart
                  className="h-40"
                  data={[
                    { name: "Cash", Cash: metrics.collections.daily_cash || 0, UPI: 0 },
                    { name: "UPI", Cash: 0, UPI: metrics.collections.daily_upi || 0 },
                  ]}
                  areas={[
                    { key: "Cash", name: "Daily Cash", color: "#10b981" },
                    { key: "UPI", name: "Daily UPI", color: "#8b5cf6" },
                  ]}
                  formatter={shortCurrency}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══════ OPERATIONS ═══════════════════════════════════════════ */}
        <Card className="mb-6 border-slate-200/80 bg-white/90 shadow-sm rounded-2xl">
          <CardHeader className="p-4 sm:p-5 pb-0">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md">
                <Bus size={16} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Operations Overview</h2>
                <p className="text-xs text-slate-500">Fleet activity and route performance</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KpiCard
                title="Buses (Active/Total)"
                value={loading ? "..." : formatActiveTotal(metrics.operations.buses_active, metrics.operations.buses_total)}
                subtitle={metrics.operations.buses_total > 0 ? formatPercentage(metrics.operations.buses_active, metrics.operations.buses_total) + " active" : ""}
                icon={Bus}
                color="#14b8a6"
                loading={loading}
              />
              <KpiCard
                title="Trips (Done/Scheduled)"
                value={loading ? "..." : formatActiveTotal(metrics.operations.trips_completed, metrics.operations.trips_scheduled)}
                subtitle={metrics.operations.trips_scheduled > 0 ? formatPercentage(metrics.operations.trips_completed, metrics.operations.trips_scheduled) + " completed" : ""}
                icon={Route}
                color="#22c55e"
                loading={loading}
              />
              <KpiCard
                title="Routes (Active/Total)"
                value={loading ? "..." : formatActiveTotal(metrics.operations.routes_active, metrics.operations.routes_total)}
                subtitle={metrics.operations.routes_total > 0 ? formatPercentage(metrics.operations.routes_active, metrics.operations.routes_total) + " active" : ""}
                icon={MapPin}
                color="#a855f7"
                loading={loading}
              />
              <KpiCard
                title="Total Passengers"
                value={loading ? "..." : formatNumber(metrics.operations.total_passengers)}
                subtitle={metrics.operations.trips_completed > 0 ? `Avg ${Math.round(metrics.operations.total_passengers / metrics.operations.trips_completed)} per trip` : ""}
                icon={Users}
                color="#3b82f6"
                loading={loading}
              />
            </div>

            {/* Utilization progress bars */}
            {!loading && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                  Utilization
                </p>
                {[
                  { label: "Buses", active: metrics.operations.buses_active, total: metrics.operations.buses_total, color: "#14b8a6" },
                  { label: "Trips", active: metrics.operations.trips_completed, total: metrics.operations.trips_scheduled, color: "#22c55e" },
                  { label: "Routes", active: metrics.operations.routes_active, total: metrics.operations.routes_total, color: "#a855f7" },
                ].map(({ label, active, total, color }) => {
                  const p = pct(active, total);
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="w-14 text-xs text-slate-500 shrink-0">{label}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${p}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className="w-16 text-right text-xs font-medium text-slate-600 shrink-0">
                        {formatActiveTotal(active, total)}
                      </span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 w-10 justify-center">
                        {p}%
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══════ SETTLEMENTS ══════════════════════════════════════════ */}
        <Card className="mb-6 border-slate-200/80 bg-white/90 shadow-sm rounded-2xl">
          <CardHeader className="p-4 sm:p-5 pb-0">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md">
                <Receipt size={16} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Settlements & Verification</h2>
                <p className="text-xs text-slate-500">UPI transaction status and reconciliation</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KpiCard
                title="Total Transactions"
                value={loading ? "..." : formatNumber(metrics.settlements.total_transactions)}
                subtitle="UPI payments received"
                icon={Receipt}
                color="#475569"
                loading={loading}
              />
              <KpiCard
                title="Verified"
                value={loading ? "..." : formatNumber(metrics.settlements.verified)}
                subtitle={metrics.settlements.total_transactions > 0 ? formatPercentage(metrics.settlements.verified, metrics.settlements.total_transactions) + " of total" : ""}
                icon={CheckCircle}
                color="#22c55e"
                loading={loading}
              />
              <KpiCard
                title="Pending"
                value={loading ? "..." : formatNumber(metrics.settlements.pending_verification)}
                subtitle={metrics.settlements.total_transactions > 0 ? formatPercentage(metrics.settlements.pending_verification, metrics.settlements.total_transactions) + " of total" : ""}
                icon={Clock}
                color="#f59e0b"
                loading={loading}
              />
              <KpiCard
                title="Failed"
                value={loading ? "..." : formatNumber(metrics.settlements.failed)}
                subtitle={metrics.settlements.total_transactions > 0 ? formatPercentage(metrics.settlements.failed, metrics.settlements.total_transactions) + " of total" : ""}
                icon={XCircle}
                color="#ef4444"
                loading={loading}
              />
            </div>

            {/* Donut chart */}
            {!loading && metrics.settlements.total_transactions > 0 && (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <DonutChart
                  className="h-44 w-full sm:w-64 shrink-0"
                  data={settlementChartData}
                />
                <div className="space-y-2 w-full">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                    Breakdown
                  </p>
                  {settlementChartData.map(({ name, value, color }) => {
                    const p = pct(value, metrics.settlements.total_transactions);
                    return (
                      <div key={name} className="flex items-center gap-3">
                        <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs text-slate-600 w-16 shrink-0">{name}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${p}%`, backgroundColor: color }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 w-10 text-right shrink-0">
                          {formatNumber(value)}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 w-10 justify-center shrink-0">
                          {p}%
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        {!loading && !error && (
          <p className="text-center text-xs text-slate-400 pb-4">
            Last updated: {new Date().toLocaleTimeString("en-IN")}
          </p>
        )}
      </div>
    </div>
  );
}

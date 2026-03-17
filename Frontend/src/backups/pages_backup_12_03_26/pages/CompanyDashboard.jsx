import { useEffect, useState } from "react";
import MetricCard from "../components/MetricCard";
import api, { BASE_URL } from "../assets/js/axiosConfig";

export default function CompanyDashboard() {
  // ── Section 1: User info from localStorage ──────────────────────────────
  const storedUser = localStorage.getItem("user")
    ? JSON.parse(localStorage.getItem("user"))
    : null;
  const username = storedUser?.username || "User";
  const companyName = storedUser?.company_name || "Company";

  // ── Section 2: State ────────────────────────────────────────────────────
  const [metrics, setMetrics] = useState({
    collections: {
      daily_cash: 0,
      daily_upi: 0,
      monthly_total: 0,
    },
    operations: {
      buses_active: 0,
      buses_total: 0,
      trips_completed: 0,
      trips_scheduled: 0,
      routes_active: 0,
      routes_total: 0,
      total_passengers: 0,
    },
    settlements: {
      total_transactions: 0,
      verified: 0,
      pending_verification: 0,
      failed: 0,
    },
  });

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Section 3: Fetch data on mount and when date changes ────────────────
  useEffect(() => {
    fetchDashboardData();
  }, [selectedDate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(
        `${BASE_URL}/get_company_dashboard_metrics?date=${selectedDate}`
      );
      
      if (res.data?.data) {
        setMetrics(res.data.data);
      } else {
        // Fallback if data structure is unexpected
        setError("Unexpected response format from server");
      }
    } catch (err) {
      console.error("Dashboard error:", err);
      
      // Better error messaging based on response
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
    active === null || active === undefined || total === null || total === undefined
      ? "—"
      : `${formatNumber(active)}/${formatNumber(total)}`;

  const formatPercentage = (part, total) => {
    if (!total || total === 0) return "0%";
    return `${Math.round((part / total) * 100)}%`;
  };

  // Calculate derived values
  const totalDailyCollection =
    (metrics.collections.daily_cash || 0) + (metrics.collections.daily_upi || 0);

  const selectedDateLabel = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

  // ── Section 5: UI Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 animate-fade-in">
      {/* Background gradient decoration */}
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-100 via-sky-100 to-emerald-100 blur-3xl" />
      </div>

      <div className="max-w-[1400px] mx-auto p-3 sm:p-4 lg:p-6 relative">
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* HEADER SECTION                                                   */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white to-slate-50" />
          <div className="relative p-4 sm:p-5 lg:p-6">
            {/* Title and date picker row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {companyName} Dashboard
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  Company Overview
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                  Welcome back, {username}. Here's your operational pulse for{" "}
                  <span className="font-semibold text-slate-700">
                    {selectedDateLabel}
                  </span>
                  .
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg shadow-sm w-fit hover:bg-slate-100 transition-colors cursor-pointer">
                <i className="fas fa-calendar-alt text-slate-500"></i>
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
                <i className="fas fa-exclamation-circle text-red-500 mt-0.5"></i>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">Error loading dashboard</p>
                  <p className="text-xs text-red-600 mt-1">{error}</p>
                </div>
                <button
                  onClick={fetchDashboardData}
                  className="text-xs text-red-700 hover:text-red-900 font-medium underline"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Quick stats cards */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Daily Collection
                </p>
                <p className="text-xl font-bold text-slate-900 mt-2">
                  {loading ? (
                    <span className="animate-pulse">Loading...</span>
                  ) : (
                    formatCurrency(totalDailyCollection)
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Cash: {formatCurrency(metrics.collections.daily_cash)} | UPI:{" "}
                  {formatCurrency(metrics.collections.daily_upi)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Monthly Till Date
                </p>
                <p className="text-xl font-bold text-slate-900 mt-2">
                  {loading ? (
                    <span className="animate-pulse">Loading...</span>
                  ) : (
                    formatCurrency(metrics.collections.monthly_total)
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(selectedDate).toLocaleDateString("en-IN", {
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  revenue
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Total Passengers
                </p>
                <p className="text-xl font-bold text-slate-900 mt-2">
                  {loading ? (
                    <span className="animate-pulse">Loading...</span>
                  ) : (
                    formatNumber(metrics.operations.total_passengers)
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Across {formatNumber(metrics.operations.trips_completed)} trips
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* COLLECTIONS SECTION                                              */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md">
              <i className="fas fa-wallet"></i>
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Collection Overview
              </h2>
              <p className="text-xs text-slate-500">
                Daily and month-to-date revenue distribution
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Daily Collection"
              value={
                loading
                  ? "..."
                  : formatCurrency(totalDailyCollection)
              }
              iconClass="fas fa-rupee-sign"
              color="#3b82f6"
              loading={loading}
            />
            <MetricCard
              title="Daily Cash"
              value={
                loading
                  ? "..."
                  : formatCurrency(metrics.collections.daily_cash)
              }
              subtitle={
                totalDailyCollection > 0
                  ? formatPercentage(
                      metrics.collections.daily_cash,
                      totalDailyCollection
                    ) + " of total"
                  : ""
              }
              iconClass="fas fa-money-bill-wave"
              color="#10b981"
              loading={loading}
            />
            <MetricCard
              title="Daily UPI"
              value={
                loading ? "..." : formatCurrency(metrics.collections.daily_upi)
              }
              subtitle={
                totalDailyCollection > 0
                  ? formatPercentage(
                      metrics.collections.daily_upi,
                      totalDailyCollection
                    ) + " of total"
                  : ""
              }
              iconClass="fas fa-credit-card"
              color="#8b5cf6"
              loading={loading}
            />
            <MetricCard
              title="Monthly Till Date"
              value={
                loading
                  ? "..."
                  : formatCurrency(metrics.collections.monthly_total)
              }
              iconClass="fas fa-chart-line"
              color="#f59e0b"
              loading={loading}
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* OPERATIONS SECTION                                               */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md">
              <i className="fas fa-bus"></i>
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Operations Overview
              </h2>
              <p className="text-xs text-slate-500">
                Fleet activity and route performance
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Buses (Active/Total)"
              value={
                loading
                  ? "..."
                  : formatActiveTotal(
                      metrics.operations.buses_active,
                      metrics.operations.buses_total
                    )
              }
              subtitle={
                metrics.operations.buses_total > 0
                  ? formatPercentage(
                      metrics.operations.buses_active,
                      metrics.operations.buses_total
                    ) + " active"
                  : ""
              }
              iconClass="fas fa-bus-alt"
              color="#14b8a6"
              loading={loading}
            />
            <MetricCard
              title="Trips (Done/Scheduled)"
              value={
                loading
                  ? "..."
                  : formatActiveTotal(
                      metrics.operations.trips_completed,
                      metrics.operations.trips_scheduled
                    )
              }
              subtitle={
                metrics.operations.trips_scheduled > 0
                  ? formatPercentage(
                      metrics.operations.trips_completed,
                      metrics.operations.trips_scheduled
                    ) + " completed"
                  : ""
              }
              iconClass="fas fa-route"
              color="#22c55e"
              loading={loading}
            />
            <MetricCard
              title="Routes (Active/Total)"
              value={
                loading
                  ? "..."
                  : formatActiveTotal(
                      metrics.operations.routes_active,
                      metrics.operations.routes_total
                    )
              }
              subtitle={
                metrics.operations.routes_total > 0
                  ? formatPercentage(
                      metrics.operations.routes_active,
                      metrics.operations.routes_total
                    ) + " active"
                  : ""
              }
              iconClass="fas fa-map-marked-alt"
              color="#a855f7"
              loading={loading}
            />
            <MetricCard
              title="Total Passengers"
              value={
                loading
                  ? "..."
                  : formatNumber(metrics.operations.total_passengers)
              }
              subtitle={
                metrics.operations.trips_completed > 0
                  ? `Avg ${Math.round(
                      metrics.operations.total_passengers /
                        metrics.operations.trips_completed
                    )} per trip`
                  : ""
              }
              iconClass="fas fa-users"
              color="#3b82f6"
              loading={loading}
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SETTLEMENTS SECTION                                              */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md">
              <i className="fas fa-file-invoice-dollar"></i>
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Settlements & Verification
              </h2>
              <p className="text-xs text-slate-500">
                UPI transaction status and reconciliation
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Transactions"
              value={
                loading
                  ? "..."
                  : formatNumber(metrics.settlements.total_transactions)
              }
              subtitle="UPI payments received"
              iconClass="fas fa-receipt"
              color="#475569"
              loading={loading}
            />
            <MetricCard
              title="Verified"
              value={
                loading ? "..." : formatNumber(metrics.settlements.verified)
              }
              subtitle={
                metrics.settlements.total_transactions > 0
                  ? formatPercentage(
                      metrics.settlements.verified,
                      metrics.settlements.total_transactions
                    ) + " of total"
                  : ""
              }
              iconClass="fas fa-check-circle"
              color="#22c55e"
              loading={loading}
            />
            <MetricCard
              title="Pending"
              value={
                loading
                  ? "..."
                  : formatNumber(metrics.settlements.pending_verification)
              }
              subtitle={
                metrics.settlements.total_transactions > 0
                  ? formatPercentage(
                      metrics.settlements.pending_verification,
                      metrics.settlements.total_transactions
                    ) + " of total"
                  : ""
              }
              iconClass="fas fa-clock"
              color="#f59e0b"
              loading={loading}
            />
            <MetricCard
              title="Failed"
              value={
                loading ? "..." : formatNumber(metrics.settlements.failed)
              }
              subtitle={
                metrics.settlements.total_transactions > 0
                  ? formatPercentage(
                      metrics.settlements.failed,
                      metrics.settlements.total_transactions
                    ) + " of total"
                  : ""
              }
              iconClass="fas fa-times-circle"
              color="#ef4444"
              loading={loading}
            />
          </div>
        </div>

        {/* Footer note */}
        {!loading && !error && (
          <div className="text-center text-xs text-slate-400 mt-6">
            Last updated: {new Date().toLocaleTimeString("en-IN")}
          </div>
        )}
      </div>
    </div>
  );
}

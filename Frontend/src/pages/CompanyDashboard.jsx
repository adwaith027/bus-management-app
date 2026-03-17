import { useEffect, useState } from "react";
import MetricCard from "../components/MetricCard";
import api, { BASE_URL } from "../assets/js/axiosConfig";

export default function CompanyDashboard() {
  const storedUser = localStorage.getItem("user")
    ? JSON.parse(localStorage.getItem("user"))
    : null;
  const username = storedUser?.username || "User";

  // ---- STATE ----
  const [metrics, setMetrics] = useState({
    collections: {},
    operations: {},
    settlements: {},
  });

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(true);

  // ---- FETCH ----
  useEffect(() => {
    fetchDashboardData();
  }, [selectedDate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`${BASE_URL}/get_company_dashboard_metrics/?date=${selectedDate}`);
      if (res.data?.data) setMetrics(res.data.data);
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ---- FORMATTERS ----
  const formatCurrency = (val) =>
    val === null || val === undefined
      ? "--"
      : `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const formatNumber = (val) =>
    val === null || val === undefined
      ? "--"
      : val.toLocaleString();

  const formatActiveTotal = (a, t) =>
    a === null || t === null ? "--" : `${formatNumber(a)}/${formatNumber(t)}`;

  const totalDailyCollection =
    (metrics.collections.daily_cash || 0) + (metrics.collections.daily_upi || 0);

  const selectedDateLabel = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

  // ---- UI ----
  return (
    <div className="min-h-screen bg-slate-50 animate-fade-in">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-100 via-sky-100 to-emerald-100 blur-3xl" />
      </div>

      <div className="max-w-[1400px] mx-auto p-3 sm:p-4 lg:p-6 relative">
        {/* HEADER */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur">
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white to-slate-50" />
          <div className="relative p-4 sm:p-5 lg:p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {storedUser.company_name} Dashboard
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  Company Overview
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                  Welcome back, {username}. Here’s your operational pulse for{" "}
                  <span className="font-semibold text-slate-700">{selectedDateLabel}</span>.
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg shadow-sm w-fit">
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

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Daily Collection
                </p>
                <p className="text-xl font-bold text-slate-900 mt-2">
                  {loading ? "..." : formatCurrency(totalDailyCollection)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Cash + UPI combined</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Monthly Till Date
                </p>
                <p className="text-xl font-bold text-slate-900 mt-2">
                  {loading ? "..." : formatCurrency(metrics.collections.monthly_total)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Revenue trend snapshot</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Total Passengers
                </p>
                <p className="text-xl font-bold text-slate-900 mt-2">
                  {loading ? "..." : formatNumber(metrics.operations.total_passengers)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Across all routes</p>
              </div>
            </div>
          </div>
        </div>

        {/* ===== COLLECTIONS ===== */}
        <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <i className="fas fa-wallet"></i>
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Collection Overview</h2>
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
                : formatCurrency(
                    (metrics.collections.daily_cash || 0) +
                      (metrics.collections.daily_upi || 0)
                  )
            }
            iconClass="fas fa-rupee-sign"
            color="#3b82f6"
            loading={loading}
          />
          <MetricCard
            title="Daily Cash"
            value={loading ? "..." : formatCurrency(metrics.collections.daily_cash)}
            iconClass="fas fa-money-bill-wave"
            color="#10b981"
            loading={loading}
          />
          <MetricCard
            title="Daily UPI"
            value={loading ? "..." : formatCurrency(metrics.collections.daily_upi)}
            iconClass="fas fa-credit-card"
            color="#8b5cf6"
            loading={loading}
          />
          <MetricCard
            title="Monthly Till Date"
            value={loading ? "..." : formatCurrency(metrics.collections.monthly_total)}
            iconClass="fas fa-chart-line"
            color="#f59e0b"
            loading={loading}
          />
          </div>
        </div>

        {/* ===== OPERATIONS ===== */}
        <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <i className="fas fa-bus"></i>
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Operations Overview</h2>
              <p className="text-xs text-slate-500">Fleet activity and route performance</p>
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
            iconClass="fas fa-map-marked-alt"
            color="#a855f7"
            loading={loading}
          />
          <MetricCard
            title="Total Passengers"
            value={loading ? "..." : formatNumber(metrics.operations.total_passengers)}
            iconClass="fas fa-users"
            color="#3b82f6"
            loading={loading}
          />
          </div>
        </div>

        {/* ===== SETTLEMENTS ===== */}
        <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <i className="fas fa-file-invoice-dollar"></i>
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Settlements & Verification
              </h2>
              <p className="text-xs text-slate-500">Transaction status and reconciliation</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Transactions"
            value={loading ? "..." : formatNumber(metrics.settlements.total_transactions)}
            iconClass="fas fa-receipt"
            color="#475569"
            loading={loading}
          />
          <MetricCard
            title="Verified"
            value={loading ? "..." : formatNumber(metrics.settlements.verified)}
            iconClass="fas fa-check-circle"
            color="#22c55e"
            loading={loading}
          />
          <MetricCard
            title="Pending"
            value={loading ? "..." : formatNumber(metrics.settlements.pending_verification)}
            iconClass="fas fa-clock"
            color="#f59e0b"
            loading={loading}
          />
          <MetricCard
            title="Failed"
            value={loading ? "..." : formatNumber(metrics.settlements.failed)}
            iconClass="fas fa-times-circle"
            color="#ef4444"
            loading={loading}
          />
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import MetricCard from "../components/MetricCard";
import api, { BASE_URL } from "../assets/js/axiosConfig";

export default function BranchDashboard() {
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
      const res = await api.get(`${BASE_URL}/branch-dashboard/?date=${selectedDate}`);
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

  // ---- UI ----
  return (
    <div className="min-h-screen bg-slate-100 animate-fade-in">
      <div className="max-w-[1400px] mx-auto p-4">

        {/* HEADER */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Branch Dashboard</h1>
            <p className="text-slate-500 text-sm">Welcome back, {username}</p>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg shadow-sm">
            <i className="fas fa-calendar-alt text-slate-500"></i>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="bg-transparent outline-none text-slate-700 cursor-pointer"
            />
          </label>
        </div>

        {/* ===== COLLECTIONS ===== */}
        <div className="flex items-center gap-2 mb-3">
          <i className="fas fa-wallet text-indigo-600"></i>
          <h2 className="text-lg font-semibold text-slate-800">Collection Overview</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
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

        {/* ===== OPERATIONS ===== */}
        <div className="flex items-center gap-2 mb-3">
          <i className="fas fa-bus text-indigo-600"></i>
          <h2 className="text-lg font-semibold text-slate-800">Operations Overview</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
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

        {/* ===== SETTLEMENTS ===== */}
        <div className="flex items-center gap-2 mb-3">
          <i className="fas fa-file-invoice-dollar text-indigo-600"></i>
          <h2 className="text-lg font-semibold text-slate-800">Settlements & Verification</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
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
  );
}

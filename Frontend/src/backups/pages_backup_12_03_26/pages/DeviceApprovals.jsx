import { useEffect, useMemo, useState } from "react";
import api, { BASE_URL } from "../assets/js/axiosConfig";

const STATUS_LABELS = {
  0: "Pending",
  1: "Approved",
  2: "Inactive",
};

const fmtDate = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString(undefined, {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return value;
  }
};

// ── Pending / Inactive Table ──
// Columns: Username | Company | Device Type | Status | Registered On | Last Seen | Action
const PendingTable = ({ rows, onApprove }) => (
  <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
    <table className="w-full text-sm">
      <thead className="bg-slate-50">
        <tr>
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Username</th>
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Company</th>
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Device Type</th>
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Registered On</th>
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Last Seen</th>
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td className="px-4 py-6 text-center text-slate-400" colSpan={7}>
              No records found
            </td>
          </tr>
        ) : (
          rows.map((item) => (
            <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{item.username || item.username_snapshot}</td>
              <td className="px-4 py-3 text-slate-600">{item.company_name || "-"}</td>
              <td className="px-4 py-3">
                <p className="text-slate-700 font-medium capitalize">{item.device_type || "-"}</p>
                <p className="text-slate-400 text-xs font-mono mt-0.5">{item.device_uid || ""}</p>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium
                  ${item.status === 0 ? "bg-amber-100 text-amber-700" : ""}
                  ${item.status === 2 ? "bg-red-100 text-red-700" : ""}
                `}>
                  {STATUS_LABELS[item.status] || item.status}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600 text-xs">{fmtDate(item.created_at)}</td>
              <td className="px-4 py-3 text-slate-600 text-xs">{fmtDate(item.last_seen_at)}</td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onApprove(item.id)}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                >
                  Approve
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

// ── Approved Table ──
// Columns: Username | Company | Device Type | Session | Approved By + At | Last Seen | Action
// Removed: Status (always Approved), Registered On (shown when pending)
// Merged: Approved By + Approved At into one stacked cell
const ApprovedTable = ({ rows, onRevoke }) => (
  <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
    <table className="w-full text-sm">
      <thead className="bg-slate-50">
        <tr>
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Username</th>
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Company</th>
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Device Type</th>
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Session</th>
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Approved By / At</th>
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Last Seen</th>
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td className="px-4 py-6 text-center text-slate-400" colSpan={7}>
              No records found
            </td>
          </tr>
        ) : (
          rows.map((item) => (
            <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{item.username || item.username_snapshot}</td>
              <td className="px-4 py-3 text-slate-600">{item.company_name || "-"}</td>
              <td className="px-4 py-3">
                <p className="text-slate-700 font-medium capitalize">{item.device_type || "-"}</p>
                <p className="text-slate-400 text-xs font-mono mt-0.5">{item.device_uid || ""}</p>
              </td>
              <td className="px-4 py-3">
                {item.is_active
                  ? <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Active</span>
                  : <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Idle</span>
                }
              </td>
              {/* Approved By + Approved At stacked in one cell */}
              <td className="px-4 py-3">
                <p className="text-slate-700 font-medium text-xs">{item.approved_by_username || "-"}</p>
                <p className="text-slate-400 text-xs">{fmtDate(item.approved_at)}</p>
              </td>
              <td className="px-4 py-3 text-slate-600 text-xs">{fmtDate(item.last_seen_at)}</td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onRevoke(item.id)}
                  className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
                >
                  Revoke
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

export default function DeviceApprovals() {
  const [pendingRows, setPendingRows] = useState([]);
  const [approvedRows, setApprovedRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedDeviceType, setSelectedDeviceType] = useState("ALL");
  const [selectedCompany, setSelectedCompany] = useState("ALL");

  const fetchDeviceApprovals = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`${BASE_URL}/device-approvals`);
      setPendingRows(response.data?.data?.pending || []);
      setApprovedRows(response.data?.data?.approved || []);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to fetch device approvals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeviceApprovals();
  }, []);

  const approveDevice = async (id) => {
    try {
      await api.post(`${BASE_URL}/device-approvals/${id}/approve`);
      fetchDeviceApprovals();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to approve device");
    }
  };

  const revokeDevice = async (id) => {
    try {
      await api.post(`${BASE_URL}/device-approvals/${id}/revoke`);
      fetchDeviceApprovals();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to revoke device");
    }
  };

  const allRows = useMemo(() => [...pendingRows, ...approvedRows], [pendingRows, approvedRows]);

  const companies = useMemo(
    () => ["ALL", ...new Set(allRows.map((row) => row.company_name).filter(Boolean))],
    [allRows]
  );

  const deviceTypes = useMemo(
    () => ["ALL", ...new Set(allRows.map((row) => row.device_type).filter(Boolean))],
    [allRows]
  );

  const applyFilters = (rows) =>
    rows.filter((row) => {
      if (selectedDeviceType !== "ALL" && row.device_type !== selectedDeviceType) return false;
      if (selectedCompany !== "ALL" && row.company_name !== selectedCompany) return false;
      if (!searchText.trim()) return true;
      const needle = searchText.toLowerCase();
      return (
        (row.username || row.username_snapshot || "").toLowerCase().includes(needle) ||
        (row.company_name || "").toLowerCase().includes(needle)
      );
    });

  const filteredPendingRows = useMemo(
    () => applyFilters(pendingRows),
    [pendingRows, selectedDeviceType, selectedCompany, searchText]
  );
  const filteredApprovedRows = useMemo(
    () => applyFilters(approvedRows),
    [approvedRows, selectedDeviceType, selectedCompany, searchText]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Device Approvals</h1>
        <p className="mt-1 text-sm text-slate-500">Approve or revoke user devices.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search username / company"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={selectedDeviceType}
          onChange={(e) => setSelectedDeviceType(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {deviceTypes.map((type) => (
            <option key={type} value={type}>
              {type === "ALL" ? "All device types" : type}
            </option>
          ))}
        </select>
        <select
          value={selectedCompany}
          onChange={(e) => setSelectedCompany(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {companies.map((company) => (
            <option key={company} value={company}>
              {company === "ALL" ? "All companies" : company}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
          Loading device approvals...
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">
              Pending / Inactive
              <span className="ml-2 text-sm font-normal text-slate-400">({filteredPendingRows.length})</span>
            </h2>
            <PendingTable rows={filteredPendingRows} onApprove={approveDevice} />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">
              Approved
              <span className="ml-2 text-sm font-normal text-slate-400">({filteredApprovedRows.length})</span>
            </h2>
            <ApprovedTable rows={filteredApprovedRows} onRevoke={revokeDevice} />
          </section>
        </>
      )}
    </div>
  );
}
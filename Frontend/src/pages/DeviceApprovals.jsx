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
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const DeviceTable = ({ rows, actionLabel, onAction }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
    <table className="min-w-full table-fixed text-sm">
      <thead className="bg-slate-50 sticky top-0 z-10">
        <tr>
          <th className="w-36 px-4 py-3 text-left font-semibold text-slate-700">Username</th>
          <th className="w-40 px-4 py-3 text-left font-semibold text-slate-700">Company</th>
          <th className="w-[360px] px-4 py-3 text-left font-semibold text-slate-700">Device UID</th>
          <th className="w-32 px-4 py-3 text-left font-semibold text-slate-700">Device Type</th>
          <th className="w-24 px-4 py-3 text-left font-semibold text-slate-700">Status</th>
          <th className="w-44 px-4 py-3 text-left font-semibold text-slate-700">Last Seen</th>
          <th className="w-28 px-4 py-3 text-left font-semibold text-slate-700">Action</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td className="px-4 py-6 text-slate-500" colSpan={7}>
              No records found
            </td>
          </tr>
        ) : (
          rows.map((item) => (
            <tr key={item.id} className="border-t border-slate-100">
              <td className="px-4 py-3 truncate">{item.username || item.username_snapshot}</td>
              <td className="px-4 py-3 truncate">{item.company_name || "-"}</td>
              <td className="px-4 py-3 font-mono text-xs break-all">{item.device_uid}</td>
              <td className="px-4 py-3">{item.device_type}</td>
              <td className="px-4 py-3">{STATUS_LABELS[item.status] || item.status}</td>
              <td className="px-4 py-3">{fmtDate(item.last_seen_at)}</td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onAction(item.id)}
                  className="rounded-md bg-slate-800 px-3 py-1.5 text-white hover:bg-slate-700"
                >
                  {actionLabel}
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
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedDeviceType, setSelectedDeviceType] = useState("ALL");
  const [selectedCompany, setSelectedCompany] = useState("ALL");

  const fetchDeviceApprovals = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`${BASE_URL}/device-approvals/`);
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
      await api.post(`${BASE_URL}/device-approvals/${id}/approve/`);
      fetchDeviceApprovals();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to approve device");
    }
  };

  const revokeDevice = async (id) => {
    try {
      await api.post(`${BASE_URL}/device-approvals/${id}/revoke/`);
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
      if (selectedStatus !== "ALL" && String(row.status) !== selectedStatus) return false;
      if (selectedDeviceType !== "ALL" && row.device_type !== selectedDeviceType) return false;
      if (selectedCompany !== "ALL" && row.company_name !== selectedCompany) return false;
      if (!searchText.trim()) return true;
      const needle = searchText.toLowerCase();
      return (
        (row.username || row.username_snapshot || "").toLowerCase().includes(needle) ||
        (row.device_uid || "").toLowerCase().includes(needle) ||
        (row.company_name || "").toLowerCase().includes(needle)
      );
    });

  const filteredPendingRows = useMemo(() => applyFilters(pendingRows), [pendingRows, selectedStatus, selectedDeviceType, selectedCompany, searchText]);
  const filteredApprovedRows = useMemo(() => applyFilters(approvedRows), [approvedRows, selectedStatus, selectedDeviceType, selectedCompany, searchText]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Device Approvals</h1>
        <p className="mt-1 text-sm text-slate-500">Approve or revoke user devices.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search username / UID / company"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ALL">All statuses</option>
          <option value="0">Pending</option>
          <option value="1">Approved</option>
          <option value="2">Inactive</option>
        </select>
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
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">Loading device approvals...</div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">Pending / Inactive</h2>
            <DeviceTable rows={filteredPendingRows} actionLabel="Approve" onAction={approveDevice} />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">Approved</h2>
            <DeviceTable rows={filteredApprovedRows} actionLabel="Revoke" onAction={revokeDevice} />
          </section>
        </>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import ExcelJS from "exceljs";
import api, { BASE_URL } from "../../assets/js/axiosConfig";
import TableSkeleton from "../../components/TableSkeleton";
import Modal from "../../components/Modal";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_BADGE = {
  Stock:      "bg-slate-100  text-slate-600  border-slate-300",
  DealerPool: "bg-blue-100   text-blue-700   border-blue-300",
  Allocated:  "bg-green-100  text-green-700  border-green-300",
  Inactive:   "bg-red-100    text-red-600    border-red-300",
};

const STATUS_TABS = ["All", "Stock", "DealerPool", "Allocated", "Inactive"];

// ── Small components ──────────────────────────────────────────────────────────

function StatusBadge({ value }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_BADGE[value] ?? "bg-slate-100 text-slate-600 border-slate-300"}`}>
      {value === "DealerPool" ? "Dealer Pool" : value}
    </span>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 flex flex-col gap-1">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value ?? "—"}</p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DeviceRegistry() {
  const user       = JSON.parse(localStorage.getItem("user") || "{}");
  const role       = user?.role;
  const isSuperadmin   = role === "superadmin";
  const isDealerAdmin  = role === "dealer_admin";
  const isProduction   = role === "production";

  // ── State ─────────────────────────────────────────────────────────────────
  const [devices,   setDevices]   = useState([]);
  const [companies, setCompanies] = useState([]);
  const [dealers,   setDealers]   = useState([]);
  const [summary,   setSummary]   = useState(null);
  const [loading,   setLoading]   = useState(true);

  const [activeTab,      setActiveTab]      = useState("All");
  const [filterCompany,  setFilterCompany]  = useState("");
  const [filterDealer,   setFilterDealer]   = useState("");

  // Selected rows (serial_number strings)
  const [selected, setSelected] = useState(new Set());

  // Upload
  const [uploading,     setUploading]     = useState(false);
  const [uploadResult,  setUploadResult]  = useState(null);
  const fileInputRef = useRef();

  // Assign modal state
  const [assignModal,  setAssignModal]  = useState(null); // "dealer" | "company" | "allocate"
  const [assignTarget, setAssignTarget] = useState(null); // device id (for allocate)
  const [assignValue,  setAssignValue]  = useState("");
  const [assignBusy,   setAssignBusy]   = useState(false);
  const [assignError,  setAssignError]  = useState("");

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab !== "All") params.set("status", activeTab);
      if (filterCompany) params.set("company", filterCompany);
      if (filterDealer)  params.set("dealer",  filterDealer);

      const reqs = [
        api.get(`${BASE_URL}/etm-devices?${params}`),
        api.get(`${BASE_URL}/etm-devices/summary`),
      ];
      if (isSuperadmin) {
        reqs.push(api.get(`${BASE_URL}/customer-data`));
        reqs.push(api.get(`${BASE_URL}/dealer-data`));
      }
      if (isDealerAdmin) {
        reqs.push(api.get(`${BASE_URL}/customer-data`));
      }

      const [devRes, sumRes, ...rest] = await Promise.all(reqs);
      setDevices(devRes.data?.data ?? []);
      setSummary(sumRes.data?.data ?? null);
      if (isSuperadmin) {
        setCompanies(rest[0]?.data?.data ?? []);
        setDealers(rest[1]?.data?.data ?? []);
      }
      if (isDealerAdmin) {
        setCompanies(rest[0]?.data?.data ?? []);
      }
    } catch (err) {
      console.error("DeviceRegistry fetch:", err);
    } finally {
      setLoading(false);
      setSelected(new Set());
    }
  };

  useEffect(() => { fetchAll(); }, [activeTab, filterCompany, filterDealer]);

  // ── Template download ─────────────────────────────────────────────────────
  const handleDownloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Devices");
    ws.columns = [{ header: "serial_number", key: "serial_number", width: 24 }];
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "device_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await api.post(`${BASE_URL}/etm-devices/upload`, formData);
      setUploadResult({ type: "success", ...res.data });
      fetchAll();
    } catch (err) {
      setUploadResult({ type: "error", message: err?.response?.data?.error || "Upload failed" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // ── Selection ─────────────────────────────────────────────────────────────
  const visibleSerials = devices.map(d => d.serial_number);
  const allSelected    = visibleSerials.length > 0 && visibleSerials.every(s => selected.has(s));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(visibleSerials));
  };
  const toggleOne = (serial) => {
    const next = new Set(selected);
    next.has(serial) ? next.delete(serial) : next.add(serial);
    setSelected(next);
  };

  // ── Assign actions ────────────────────────────────────────────────────────
  const openAssignDealer  = () => { setAssignModal("dealer");  setAssignValue(""); setAssignError(""); };
  const openAssignCompany = () => { setAssignModal("company"); setAssignValue(""); setAssignError(""); };
  const openAllocate      = (device) => { setAssignModal("allocate"); setAssignTarget(device); setAssignValue(""); setAssignError(""); };

  const handleAssignSubmit = async () => {
    if (!assignValue) { setAssignError("Please select a value"); return; }
    setAssignBusy(true);
    setAssignError("");
    try {
      if (assignModal === "dealer") {
        await api.post(`${BASE_URL}/etm-devices/bulk-assign-dealer`, {
          serial_numbers: [...selected],
          dealer_id: assignValue,
        });
      } else if (assignModal === "company") {
        await api.post(`${BASE_URL}/etm-devices/bulk-assign-company`, {
          serial_numbers: [...selected],
          company_id: assignValue,
        });
      } else if (assignModal === "allocate") {
        await api.post(`${BASE_URL}/etm-devices/${assignTarget.id}/allocate`, {
          company_id: assignValue,
        });
      }
      setAssignModal(null);
      fetchAll();
    } catch (err) {
      setAssignError(err?.response?.data?.error || "Action failed");
    } finally {
      setAssignBusy(false);
    }
  };

  const handleDeactivate = async (device) => {
    if (!window.confirm(`Deactivate device ${device.serial_number}?`)) return;
    try {
      await api.post(`${BASE_URL}/etm-devices/${device.id}/deactivate`);
      fetchAll();
    } catch (err) {
      alert(err?.response?.data?.error || "Deactivate failed");
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const by = summary?.by_status ?? {};
  const stockSelected = devices.filter(d => selected.has(d.serial_number) && d.allocation_status === "Stock");
  const canBulkDealer   = isSuperadmin && stockSelected.length > 0;
  const canBulkCompany  = isSuperadmin && stockSelected.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50 space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ETM Device Registry</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage device serial numbers and their allocation across dealers and companies.
          </p>
        </div>

        {/* Upload button — superadmin and production */}
        {(isSuperadmin || isProduction) && (
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
              <button
                onClick={handleDownloadTemplate}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 transition-colors"
              >
                Download Template
              </button>
              <label className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                {uploading ? "Uploading…" : "Upload Excel"}
                <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
            <span className="text-[10px] text-slate-400">Column required: serial_number</span>
          </div>
        )}
      </div>

      {/* Upload result */}
      {uploadResult && (
        <div className={`rounded-lg px-4 py-3 text-sm border ${uploadResult.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
          {uploadResult.type === "success"
            ? `${uploadResult.created} device(s) added to stock. ${uploadResult.skipped} skipped (duplicates).`
            : uploadResult.message}
          <button className="ml-3 text-xs underline opacity-60" onClick={() => setUploadResult(null)}>dismiss</button>
        </div>
      )}

      {/* Summary cards, tabs, filters, bulk bar — hidden for production users */}
      {!isProduction && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard label="Total"       value={summary?.total} />
            <SummaryCard label="Stock"       value={by.Stock} />
            <SummaryCard label="Dealer Pool" value={by.DealerPool} />
            <SummaryCard label="Allocated"   value={by.Allocated} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-sm font-medium border-r last:border-r-0 border-slate-200 transition-colors ${activeTab === tab ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  {tab === "DealerPool" ? "Dealer Pool" : tab}
                </button>
              ))}
            </div>

            {isSuperadmin && (
              <>
                <select
                  value={filterDealer}
                  onChange={e => setFilterDealer(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="">All dealers</option>
                  {dealers.map(d => <option key={d.id} value={d.id}>{d.dealer_name}</option>)}
                </select>
                <select
                  value={filterCompany}
                  onChange={e => setFilterCompany(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="">All companies</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </>
            )}

            <button onClick={fetchAll} className="ml-auto border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-600 bg-white hover:bg-slate-50 transition-colors">
              Refresh
            </button>
          </div>

          {(canBulkDealer || canBulkCompany) && (
            <div className="flex items-center gap-2 rounded-lg bg-slate-800 text-white px-4 py-2 text-sm">
              <span className="font-medium">{selected.size} selected</span>
              <span className="text-slate-400 text-xs">({stockSelected.length} Stock)</span>
              <div className="ml-auto flex gap-2">
                {canBulkDealer && (
                  <button onClick={openAssignDealer} className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-xs font-medium transition-colors">
                    Assign to Dealer
                  </button>
                )}
                {canBulkCompany && (
                  <button onClick={openAssignCompany} className="px-3 py-1 rounded-md bg-green-600 hover:bg-green-500 text-xs font-medium transition-colors">
                    Assign to Company
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-slate-50">
            <tr>
              {isSuperadmin && (
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
                </th>
              )}
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Serial Number</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Dealer</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Company</th>
              {(isSuperadmin || isDealerAdmin) && (
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton columns={["w-8","w-32","w-24","w-28","w-32","w-24"]} />
            ) : devices.length === 0 ? (
              <tr>
                <td colSpan={isSuperadmin ? 6 : 5} className="px-4 py-8 text-center text-slate-400">
                  No devices found
                </td>
              </tr>
            ) : devices.map(device => (
              <tr key={device.id} className="border-t border-slate-100 hover:bg-slate-50">
                {isSuperadmin && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(device.serial_number)}
                      onChange={() => toggleOne(device.serial_number)}
                      className="rounded"
                    />
                  </td>
                )}
                <td className="px-4 py-3 font-mono text-xs text-slate-800 font-medium">{device.serial_number}</td>
                <td className="px-4 py-3"><StatusBadge value={device.allocation_status} /></td>
                <td className="px-4 py-3 text-slate-500 text-xs">{device.dealer_name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700 text-xs">{device.company_name ?? <span className="text-slate-300 italic">Unassigned</span>}</td>
                {(isSuperadmin || isDealerAdmin) && (
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      {/* Dealer can allocate DealerPool devices */}
                      {isDealerAdmin && device.allocation_status === "DealerPool" && (
                        <button
                          onClick={() => openAllocate(device)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                        >
                          Allocate
                        </button>
                      )}
                      {/* Superadmin can deactivate any active device */}
                      {isSuperadmin && device.allocation_status !== "Inactive" && (
                        <button
                          onClick={() => handleDeactivate(device)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assign / Allocate Modal */}
      <Modal isOpen={!!assignModal} onClose={() => setAssignModal(null)}>
        <div className="space-y-4 w-full max-w-sm">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {assignModal === "dealer"   && "Assign to Dealer"}
              {assignModal === "company"  && "Assign to Company"}
              {assignModal === "allocate" && "Allocate to Company"}
            </h2>
            {assignModal !== "allocate" && (
              <p className="text-xs text-slate-400 mt-0.5">{selected.size} device(s) selected</p>
            )}
            {assignModal === "allocate" && (
              <p className="text-xs text-slate-400 mt-0.5 font-mono">{assignTarget?.serial_number}</p>
            )}
          </div>

          {assignError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{assignError}</p>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              {assignModal === "dealer" ? "Dealer" : "Company"} *
            </label>
            <select
              value={assignValue}
              onChange={e => setAssignValue(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">— Select —</option>
              {assignModal === "dealer"
                ? dealers.map(d => <option key={d.id} value={d.id}>{d.dealer_name}</option>)
                : companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)
              }
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setAssignModal(null)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAssignSubmit}
              disabled={assignBusy}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {assignBusy ? "Saving…" : "Confirm"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

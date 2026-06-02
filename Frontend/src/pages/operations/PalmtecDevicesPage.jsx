import { useCallback, useEffect, useState } from 'react';
import api, { BASE_URL } from '../../assets/js/axiosConfig';
import TableSkeleton from '../../components/TableSkeleton';
import Modal from '../../components/Modal';

export default function PalmtecDevicesPage() {
  const [devices, setDevices]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search,  setSearch]          = useState('');

  const [palmtecModal, setPalmtecModal] = useState(null); // { device }
  const [palmtecValue, setPalmtecValue] = useState('');
  const [palmtecError, setPalmtecError] = useState('');
  const [palmtecBusy,  setPalmtecBusy]  = useState(false);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`${BASE_URL}/etm-devices`);
      setDevices(res.data?.data ?? []);
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const openModal = (device) => {
    setPalmtecModal({ device });
    setPalmtecValue(device.palmtec_id ? String(device.palmtec_id) : '');
    setPalmtecError('');
  };

  const handleSave = async () => {
    const val = parseInt(palmtecValue, 10);
    if (!val || val <= 0) { setPalmtecError('Enter a positive integer.'); return; }
    setPalmtecBusy(true);
    setPalmtecError('');
    try {
      await api.post(`${BASE_URL}/etm-devices/${palmtecModal.device.id}/set-palmtec-id`, { palmtec_id: val });
      setPalmtecModal(null);
      fetchDevices();
    } catch (err) {
      setPalmtecError(err?.response?.data?.error || 'Failed to set Palmtec ID.');
    } finally {
      setPalmtecBusy(false);
    }
  };

  const filtered = devices.filter(d =>
    d.serial_number?.toLowerCase().includes(search.toLowerCase())
  );

  const assigned   = devices.filter(d => d.palmtec_id).length;
  const unassigned = devices.length - assigned;

  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50 space-y-6 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Palmtec Devices</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Assign Palmtec IDs to your allocated device serial numbers.
        </p>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-3">
        <SummaryChip label="Total"      value={devices.length} color="slate" />
        <SummaryChip label="Assigned"   value={assigned}       color="green" />
        <SummaryChip label="Unassigned" value={unassigned}     color="amber" />
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Search */}
        <div className="px-4 py-3 border-b border-slate-100">
          <input
            type="text"
            placeholder="Search by serial number…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-xs border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Serial Number</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Device Type</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Palmtec ID</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton columns={['w-40', 'w-24', 'w-28']} />
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-slate-400">
                  No devices found.
                </td>
              </tr>
            ) : filtered.map(device => (
              <tr key={device.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs font-medium text-slate-800">
                  {device.serial_number}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 capitalize">
                  {device.device_type ?? '—'}
                </td>
                <td className="px-4 py-3">
                  {device.palmtec_id ? (
                    <button
                      onClick={() => openModal(device)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 transition-colors"
                    >
                      <span className="font-mono">{device.palmtec_id}</span>
                      <EditIcon />
                    </button>
                  ) : (
                    <button
                      onClick={() => openModal(device)}
                      className="px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                    >
                      Set ID
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="px-4 py-2.5 text-xs text-slate-400 border-t border-slate-100">
          Showing {filtered.length} of {devices.length} device{devices.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Palmtec ID Modal */}
      <Modal isOpen={!!palmtecModal} onClose={() => setPalmtecModal(null)} title="Set Palmtec ID" narrow>
        <div className="space-y-4">
          <p className="text-xs text-slate-400 font-mono -mt-2">
            {palmtecModal?.device?.serial_number}
          </p>

          {palmtecError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {palmtecError}
            </p>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Palmtec ID *</label>
            <input
              type="number"
              min="1"
              value={palmtecValue}
              onChange={e => setPalmtecValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Enter positive integer"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setPalmtecModal(null)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={palmtecBusy}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {palmtecBusy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SummaryChip({ label, value, color }) {
  const colors = {
    slate: 'bg-white border-slate-200 text-slate-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-sm ${colors[color]}`}>
      <span className="text-slate-400 font-normal">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function EditIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

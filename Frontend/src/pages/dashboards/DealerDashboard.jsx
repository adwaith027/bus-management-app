import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { BASE_URL } from '../../assets/js/axiosConfig';
import { Building2, Cpu, CheckCircle2, Clock, XCircle } from 'lucide-react';

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-slate-800">{value ?? '—'}</p>
      </div>
    </div>
  );
}

function DevicePill({ label, count, cls }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {label}: {count}
    </span>
  );
}

export default function DealerDashboard() {
  const [data, setData]       = useState(null);   // { companies, summary }
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const navigate = useNavigate();

  useEffect(() => { fetchDashboard(); }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`${BASE_URL}/dealer-dashboard`);
      setData(res.data?.data ?? { companies: [], summary: {} });
    } catch (err) {
      console.error('DealerDashboard fetch error:', err);
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const summary   = data?.summary   ?? {};
  const companies = data?.companies ?? [];

  return (
    <div className="p-4 sm:p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Dealer Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your client companies and their device status.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          icon={Building2}
          label="Companies"
          value={summary.total_companies}
          color="bg-blue-50 text-blue-600"
        />
        <SummaryCard
          icon={Cpu}
          label="Total Devices"
          value={summary.total_devices}
          color="bg-slate-100 text-slate-600"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Active Devices"
          value={summary.active_devices}
          color="bg-green-50 text-green-600"
        />
        <SummaryCard
          icon={Clock}
          label="Pending Approval"
          value={summary.pending_devices}
          color="bg-yellow-50 text-yellow-600"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <XCircle size={15} />
          {error}
        </div>
      )}

      {/* Company cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-2/3 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-1/2 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Building2 size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No companies mapped to your dealer account yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map(company => {
            const dev = company.devices ?? {};
            const licColour =
              company.authentication_status === 'Approve'
                ? 'bg-green-50 text-green-700 border-green-200'
                : company.authentication_status === 'Expired'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-yellow-50 text-yellow-700 border-yellow-200';

            return (
              <div
                key={company.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                {/* Company name + licence badge */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800 leading-tight">{company.company_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{company.company_email}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${licColour}`}>
                    {company.authentication_status ?? 'Pending'}
                  </span>
                </div>

                {/* Location */}
                <p className="text-xs text-slate-500">{[company.city, company.state].filter(Boolean).join(', ')}</p>

                {/* Device pills */}
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
                  <DevicePill
                    label="Active"
                    count={dev.active ?? 0}
                    cls="bg-green-50 text-green-700 border-green-200"
                  />
                  {dev.pending > 0 && (
                    <DevicePill
                      label="Pending"
                      count={dev.pending}
                      cls="bg-yellow-50 text-yellow-700 border-yellow-200"
                    />
                  )}
                  {dev.expired > 0 && (
                    <DevicePill
                      label="Expired"
                      count={dev.expired}
                      cls="bg-red-50 text-red-600 border-red-200"
                    />
                  )}
                  {dev.total === 0 && (
                    <span className="text-xs text-slate-400 italic">No devices registered</span>
                  )}
                </div>

                {/* Link to device registry filtered by company */}
                <button
                  onClick={() => navigate(`/dashboard/device-registry?company=${company.id}`)}
                  className="mt-auto text-xs font-medium text-slate-500 hover:text-slate-800 text-left transition-colors"
                >
                  View devices →
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

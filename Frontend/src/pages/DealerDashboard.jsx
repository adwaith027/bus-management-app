import { useEffect, useState } from 'react';
import api, { BASE_URL } from '../assets/js/axiosConfig';

export default function DealerDashboard() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMappedCompanies();
  }, []);

  const fetchMappedCompanies = async () => {
    setLoading(true);
    try {
      const response = await api.get(`${BASE_URL}/dealer-dashboard/`);
      setCompanies(response.data?.data || []);
    } catch (err) {
      console.error('Error fetching dealer dashboard:', err);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Dealer Dashboard</h1>
        <p className="text-slate-500 mt-1">Mapped companies</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">City</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-500">Loading...</td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-500">No mapped companies found</td>
                </tr>
              ) : (
                companies.map(company => (
                  <tr key={company.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-700 font-medium">{company.company_name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{company.company_email}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{company.city}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{company.state}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import api, { BASE_URL } from "../assets/js/axiosConfig";

export default function AdminHome() {
  const storedUser = localStorage.getItem("user")
    ? JSON.parse(localStorage.getItem("user"))
    : null;
  const username = storedUser?.username || "User";

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    company_summary: null,
    user_summary: null,
  });

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`${BASE_URL}/get_admin_data`);
      if (response.data.message === "Success") {
        setSummary(response.data.data);
      }
    } catch (err) {
      console.error("Admin dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  const company = summary.company_summary;
  const users = summary.user_summary;

  return (
    <div className="w-full px-6 py-6 animate-fade-in">

      {/* Header */}
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">
        Welcome, {username}
      </h1>

      {/* Loading */}
      {loading && (
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm text-sm text-slate-500">
          Loading dashboard...
        </div>
      )}

      {!loading && (
        <>
          {/* ===================== DASHBOARD SUMMARY GROUP ===================== */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-800">
                Company Overview
              </h2>
              <p className="text-xs text-slate-500">
                Overview of company registrations & validation
              </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Companies */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg">
                  <i className="fa-solid fa-building"></i>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Companies</p>
                  <h2 className="text-2xl font-bold text-indigo-700 mt-1">
                    {company?.total_companies ?? 0}
                  </h2>
                </div>
              </div>

              {/* Validated */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center text-lg">
                  <i className="fa-solid fa-circle-check"></i>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Validated</p>
                  <h2 className="text-2xl font-bold text-green-600 mt-1">
                    {company?.validated_companies ?? 0}
                  </h2>
                </div>
              </div>

              {/* Unvalidated */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-lg">
                  <i className="fa-solid fa-circle-xmark"></i>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Unvalidated</p>
                  <h2 className="text-2xl font-bold text-red-600 mt-1">
                    {company?.unvalidated_companies ?? 0}
                  </h2>
                </div>
              </div>

              {/* Expired */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-500 flex items-center justify-center text-lg">
                  <i className="fa-solid fa-hourglass-end"></i>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Expired</p>
                  <h2 className="text-2xl font-bold text-orange-500 mt-1">
                    {company?.expired_companies ?? 0}
                  </h2>
                </div>
              </div>
            </div>
          </section>

          {/* ===================== USER STATS GROUP ===================== */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-800">
                User Overview
              </h2>
              <p className="text-xs text-slate-500">
                Registered users and distribution by company
              </p>
            </div>

            {/* Total Users */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                <i className="fa-solid fa-users"></i>
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Users</p>
                <h2 className="text-xl font-semibold text-indigo-700">
                  {users?.total_users ?? 0}
                </h2>
              </div>
            </div>

            {/* Users By Company */}
            <div className="flex flex-wrap gap-2 mt-2">
              {users?.users_by_company?.length > 0 ? (
                users.users_by_company.map((item, index) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg border border-indigo-200"
                  >
                    {item.company_name} — {item.count}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-400">
                  No user data available
                </span>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

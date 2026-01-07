import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import api, { BASE_URL } from '../assets/js/axiosConfig';

export default function SettlementPage() {
  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Settlement Management</h1>
          <p className="text-slate-500 mt-1">Manage & review settlement details</p>
        </div>
      </div>

      {/* Content Placeholder */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex items-center justify-center text-slate-500 text-lg">
        No settlement data available yet.
      </div>
    </div>
  );
}

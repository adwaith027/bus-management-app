import { IndianRupee, Construction } from 'lucide-react';

export default function ExpenseMasterPage() {
  return (
    <div className="p-3 sm:p-5 lg:p-7 min-h-screen bg-slate-50">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-slate-900">
          <IndianRupee size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Expense Master</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage expense category codes and names</p>
        </div>
      </div>

      {/* Placeholder */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
        <div className="flex justify-center mb-4">
          <Construction size={48} className="text-slate-300" />
        </div>
        <p className="text-slate-400 text-sm mt-1">Expense category management will be available here.</p>
      </div>

    </div>
  );
}

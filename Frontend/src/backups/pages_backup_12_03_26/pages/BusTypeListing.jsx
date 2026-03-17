import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import { useFilteredList } from '../assets/js/useFilteredList';
import { useModalForm }    from '../assets/js/useModalForm';
import { submitForm }      from '../assets/js/submitForm';
import api, { BASE_URL }   from '../assets/js/axiosConfig';

const emptyForm = { bustype_code: '', name: '', is_active: true };
const PAGE_SIZE = 10;

export default function BusTypeListing() {

  // ── Section 1: State ─────────────────────────────────────────────────────────
  const [busTypes, setBusTypes]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage]   = useState(1);

  // ── Section 2: Hooks ─────────────────────────────────────────────────────────
  const { filteredItems, searchTerm, setSearchTerm, resetSearch } = useFilteredList(
    busTypes, ['bustype_code', 'name']
  );

  const {
    isModalOpen, setIsModalOpen,
    modalMode, editingItem,
    formData, setFormData,
    submitting, setSubmitting,
    openCreateModal, openViewModal, openEditModal,
    handleInputChange, isReadOnly,
  } = useModalForm(emptyForm);

  // ── Section 3: Data Fetching ─────────────────────────────────────────────────
  useEffect(() => { fetchBusTypes(); }, []);

  const fetchBusTypes = async () => {
    setLoading(true);
    try {
      const res = await api.get(`${BASE_URL}/masterdata/bus-types`);
      setBusTypes(res.data?.data || []);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error fetching bus types:', err);
      setBusTypes([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Section 4: Submit ────────────────────────────────────────────────────────
  const handleSubmit = () => submitForm({
    modalMode, editingItem, formData,
    createUrl: `${BASE_URL}/masterdata/bus-types/create`,
    updateUrl: `${BASE_URL}/masterdata/bus-types/update/${editingItem?.id}`,
    setSubmitting,
    onSuccess: () => { setIsModalOpen(false); setFormData(emptyForm); fetchBusTypes(); },
  });

  // ── Section 5: Derived data ───────────────────────────────────────────────────
  const activeCount   = busTypes.filter(b => b.is_active).length;
  const inactiveCount = busTypes.filter(b => !b.is_active).length;

  const displayItems = filteredItems.filter(item => {
    if (statusFilter === 'active')   return item.is_active;
    if (statusFilter === 'inactive') return !item.is_active;
    return true;
  });

  const totalPages = Math.ceil(displayItems.length / PAGE_SIZE);
  const startIdx   = (currentPage - 1) * PAGE_SIZE;
  const pagedItems = displayItems.slice(startIdx, startIdx + PAGE_SIZE);

  const getModalTitle = () =>
    ({ view: 'Bus Type Details', edit: 'Edit Bus Type', create: 'Create Bus Type' }[modalMode]);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Section 6: Render ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div
        className="flex rounded-xl border border-slate-200 shadow-sm overflow-hidden"
        style={{ height: 'calc(100vh - 96px)' }}
      >

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* LEFT PANEL                                                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Mobile aside overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        shrink-0 bg-slate-800 flex flex-col p-5 gap-5 h-full overflow-y-auto z-30
        transition-all duration-300
        w-60
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'fixed top-0 left-0 translate-x-0' : 'hidden lg:flex'}
      `}>

        {/* Title */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">
            Master Data
          </p>
          <h1 className="text-xl font-bold text-white leading-snug">Bus Types</h1>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Manage bus categories for your company
          </p>
        </div>

        <div className="border-t border-slate-700" />

        {/* Stats */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Overview</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Total',    value: busTypes.length, color: 'text-white',        bg: 'bg-slate-700/60' },
              { label: 'Active',   value: activeCount,     color: 'text-emerald-400',  bg: 'bg-emerald-900/40 border border-emerald-800/50' },
              { label: 'Inactive', value: inactiveCount,   color: 'text-rose-400',     bg: 'bg-rose-900/30 border border-rose-800/40' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${bg} rounded-lg px-2 py-2.5 text-center`}>
                <p className={`text-lg font-bold leading-none ${color}`}>{value}</p>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-700" />

        {/* Status filter */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Filter</p>
          {[
            { key: 'all',      label: 'All Types',  count: busTypes.length },
            { key: 'active',   label: 'Active',     count: activeCount },
            { key: 'inactive', label: 'Inactive',   count: inactiveCount },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => { setStatusFilter(key); setCurrentPage(1); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                statusFilter === key
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <span>{label}</span>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                statusFilter === key ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Create CTA */}
        <button
          onClick={openCreateModal}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-lg shadow transition-all duration-150"
        >
          <span className="text-lg leading-none">+</span>
          Create Bus Type
        </button>
      </aside>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* RIGHT PANEL                                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col p-4 lg:p-6 gap-4 min-w-0 overflow-y-auto bg-slate-50">

        {/* Mobile top bar */}
        <div className="flex items-center gap-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Filters & Stats
          </button>
          <span className="text-sm font-semibold text-slate-700">Bus Types</span>
        </div>

        {/* Search row */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Search by code or name…"
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-lg shadow-sm
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400"
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => { resetSearch(); setCurrentPage(1); }}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition-all"
            >
              Reset
            </button>
          )}
        </div>

        {/* Count label */}
        {!loading && (
          <p className="text-xs text-slate-400 -mt-1">
            {displayItems.length === 0
              ? 'No results match your filter'
              : `${displayItems.length} bus type${displayItems.length !== 1 ? 's' : ''} found`}
          </p>
        )}

        {/* Table card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">

              <thead>
                <tr className="bg-slate-800">
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 w-16">ID</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Code</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Name</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {loading && (
                  <tr><td colSpan="5" className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-[3px] border-slate-200 border-t-slate-700 rounded-full animate-spin" />
                      <p className="text-sm text-slate-400">Loading bus types…</p>
                    </div>
                  </td></tr>
                )}

                {!loading && pagedItems.length === 0 && (
                  <tr><td colSpan="5" className="px-5 py-16 text-center">
                    <p className="text-sm font-semibold text-slate-500">No bus types found</p>
                    <p className="text-sm text-slate-400 mt-1">Try adjusting your search or filter</p>
                  </td></tr>
                )}

                {!loading && pagedItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors duration-100">

                    <td className="px-5 py-3.5">
                      <span className="text-sm text-slate-400 font-mono">#{item.id}</span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="inline-flex px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-300 text-slate-700 text-sm font-bold tracking-wide">
                        {item.bustype_code}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-slate-800">{item.name}</span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        item.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${item.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex justify-end items-center gap-1.5">
                        <button onClick={() => openViewModal(item)}
                          className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all">
                          View
                        </button>
                        <button onClick={() => openEditModal(item)}
                          className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-all">
                          Edit
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}

              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && displayItems.length > 0 && totalPages > 1 && (
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-700">{startIdx + 1}</span>
                {' – '}
                <span className="font-semibold text-slate-700">{Math.min(startIdx + PAGE_SIZE, displayItems.length)}</span>
                {' of '}
                <span className="font-semibold text-slate-700">{displayItems.length}</span>
              </p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(n => n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1)
                  .map((pageNum, idx, arr) => (
                    <span key={pageNum} className="flex items-center gap-1.5">
                      {idx > 0 && arr[idx - 1] !== pageNum - 1 && (
                        <span className="text-slate-400 text-sm">…</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(pageNum)}
                        className={`min-w-[2.25rem] px-3 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                          currentPage === pageNum
                            ? 'bg-slate-800 text-white shadow-sm'
                            : 'text-slate-600 bg-white border border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    </span>
                  ))}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      </div>{/* end split panel card */}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL                                                                */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={getModalTitle()}>
        <div className="space-y-4">

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">
              Bus Type Code <span className="text-rose-500">*</span>
            </label>
            <input type="text" name="bustype_code" value={formData.bustype_code}
              onChange={handleInputChange} readOnly={isReadOnly} placeholder="e.g., BT001"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent read-only:bg-slate-50 read-only:text-slate-500 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">
              Name <span className="text-rose-500">*</span>
            </label>
            <input type="text" name="name" value={formData.name}
              onChange={handleInputChange} readOnly={isReadOnly} placeholder="e.g., Luxury Coach"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent read-only:bg-slate-50 read-only:text-slate-500 transition-all"
            />
          </div>

          {modalMode !== 'create' && (
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
              <input type="checkbox" name="is_active" id="is_active"
                checked={formData.is_active} onChange={handleInputChange} disabled={isReadOnly}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-slate-700 cursor-pointer">
                Active — this bus type is currently in use
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-all">
              {isReadOnly ? 'Close' : 'Cancel'}
            </button>
            {!isReadOnly && (
              <button type="button" onClick={handleSubmit} disabled={submitting}
                className="px-5 py-2 text-sm font-semibold text-white bg-slate-800 rounded-lg hover:bg-slate-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {submitting ? 'Saving…' : modalMode === 'edit' ? 'Update' : 'Save'}
              </button>
            )}
          </div>

        </div>
      </Modal>

    </div>
  );
}
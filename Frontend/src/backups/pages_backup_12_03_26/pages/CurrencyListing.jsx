import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import { useFilteredList } from '../assets/js/useFilteredList';
import api, { BASE_URL } from '../assets/js/axiosConfig';

const emptyForm = { currency: '', country: '' };
const PAGE_SIZE = 10;

export default function CurrencyListing() {

  // ── Section 1: State ─────────────────────────────────────────────────────────
  const [currencies, setCurrencies]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode]     = useState('create');
  const [submitting, setSubmitting]   = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData]       = useState(emptyForm);
  const [currentPage, setCurrentPage] = useState(1);

  // ── Section 2: Search & Filter ───────────────────────────────────────────────
  const { filteredItems, searchTerm, setSearchTerm, resetSearch } = useFilteredList(
    currencies, ['currency', 'country']
  );

  // ── Section 3: Data Fetching ─────────────────────────────────────────────────
  useEffect(() => { fetchCurrencies(); }, []);

  const fetchCurrencies = async () => {
    setLoading(true);
    try {
      const res = await api.get(`${BASE_URL}/masterdata/currencies`);
      setCurrencies(res.data?.data || []);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error fetching currencies:', err);
      setCurrencies([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Section 4: Submit ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let response;
      if (modalMode === 'edit') {
        response = await api.put(`${BASE_URL}/masterdata/currencies/update/${editingItem.id}`, formData);
      } else {
        response = await api.post(`${BASE_URL}/masterdata/currencies/create`, formData);
      }
      if (response?.status === 200 || response?.status === 201) {
        window.alert(response.data.message || 'Success');
        setIsModalOpen(false);
        setFormData(emptyForm);
        fetchCurrencies();
      }
    } catch (err) {
      if (!err.response) return window.alert('Server unreachable. Try later.');
      const { data } = err.response;
      const firstError = data.errors ? Object.values(data.errors)[0][0] : data.message;
      window.alert(firstError || 'Validation failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Section 5: Modal Helpers ─────────────────────────────────────────────────
  const openCreateModal = () => { setFormData(emptyForm); setEditingItem(null); setModalMode('create'); setIsModalOpen(true); };
  const openViewModal   = (item) => { setFormData(item); setEditingItem(item); setModalMode('view');   setIsModalOpen(true); };
  const openEditModal   = (item) => { setFormData(item); setEditingItem(item); setModalMode('edit');   setIsModalOpen(true); };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const isReadOnly    = modalMode === 'view';
  const getModalTitle = () => ({ view: 'Currency Details', edit: 'Edit Currency', create: 'Create Currency' }[modalMode]);

  // ── Section 6: Derived / Pagination ──────────────────────────────────────────
  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);
  const startIdx   = (currentPage - 1) * PAGE_SIZE;
  const pagedItems = filteredItems.slice(startIdx, startIdx + PAGE_SIZE);

  // Unique countries count
  const uniqueCountries = new Set(currencies.map(c => c.country)).size;

  // ── Section 7: Render ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Split panel card — fills available space, rounded boundary, no overflow */}
      <div className="flex rounded-xl border border-slate-200 shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 96px)' }}>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* LEFT PANEL                                                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <aside className="w-60 shrink-0 bg-slate-800 flex flex-col p-5 gap-5 h-full overflow-y-auto">

        {/* Title */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">
            Master Data
          </p>
          <h1 className="text-xl font-bold text-white leading-snug">Currencies</h1>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Manage currency master data
          </p>
        </div>

        <div className="border-t border-slate-700" />

        {/* Stats */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Overview</p>
          <div className="bg-slate-700/60 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-slate-300">Total</span>
            <span className="text-xl font-bold text-white">{currencies.length}</span>
          </div>
          <div className="bg-indigo-900/40 border border-indigo-800/50 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-indigo-300">Countries</span>
            <span className="text-xl font-bold text-indigo-400">{uniqueCountries}</span>
          </div>
        </div>

        <div className="border-t border-slate-700" />

        {/* Search */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Search</p>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Code or country…"
              className="w-full pl-8 pr-3 py-2 text-sm bg-slate-700/60 border border-slate-600 rounded-lg text-slate-200 placeholder:text-slate-500
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => { resetSearch(); setCurrentPage(1); }}
              className="w-full py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-all"
            >
              Clear search
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* Create CTA */}
        <button
          onClick={openCreateModal}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-lg shadow transition-all duration-150"
        >
          <span className="text-base leading-none">+</span>
          Create Currency
        </button>
      </aside>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* RIGHT PANEL                                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col p-6 gap-4 min-w-0 overflow-y-auto bg-slate-50">

        {/* Count label */}
        {!loading && (
          <p className="text-xs text-slate-400">
            {filteredItems.length === 0
              ? 'No results found'
              : `${filteredItems.length} currenc${filteredItems.length !== 1 ? 'ies' : 'y'} found`}
          </p>
        )}

        {/* Table card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">

              <thead>
                <tr className="bg-slate-800">
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 w-16">ID</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Currency Code</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Country</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {loading && (
                  <tr><td colSpan="4" className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-[3px] border-slate-200 border-t-slate-700 rounded-full animate-spin" />
                      <p className="text-sm text-slate-400">Loading currencies…</p>
                    </div>
                  </td></tr>
                )}

                {!loading && pagedItems.length === 0 && (
                  <tr><td colSpan="4" className="px-5 py-16 text-center">
                    <p className="text-sm font-semibold text-slate-500">No currencies found</p>
                    <p className="text-sm text-slate-400 mt-1">Try adjusting your search or create a new one</p>
                  </td></tr>
                )}

                {!loading && pagedItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors duration-100">

                    <td className="px-5 py-3.5">
                      <span className="text-sm text-slate-400 font-mono">#{item.id}</span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="inline-flex px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-300 text-slate-700 text-sm font-bold tracking-widest uppercase">
                        {item.currency}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-slate-800">{item.country}</span>
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
          {!loading && filteredItems.length > 0 && totalPages > 1 && (
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-700">{startIdx + 1}</span>
                {' – '}
                <span className="font-semibold text-slate-700">{Math.min(startIdx + PAGE_SIZE, filteredItems.length)}</span>
                {' of '}
                <span className="font-semibold text-slate-700">{filteredItems.length}</span>
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

      {/* Close inner split panel card */}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL                                                                */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={getModalTitle()}>
        <div className="space-y-4">

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">
              Currency Code <span className="text-rose-500">*</span>
            </label>
            <input
              type="text" name="currency" value={formData.currency}
              onChange={handleInputChange} readOnly={isReadOnly}
              placeholder="e.g. INR" maxLength={3}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent read-only:bg-slate-50 read-only:text-slate-500 uppercase transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">
              Country <span className="text-rose-500">*</span>
            </label>
            <input
              type="text" name="country" value={formData.country}
              onChange={handleInputChange} readOnly={isReadOnly}
              placeholder="e.g. India"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent read-only:bg-slate-50 read-only:text-slate-500 transition-all"
            />
          </div>

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
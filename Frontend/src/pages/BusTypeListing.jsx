import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import SearchBar from '../components/SearchBar';
import { useFilteredList } from '../assets/js/useFilteredList';
import { usePagination }   from '../assets/js/usePagination';
import { useModalForm }    from '../assets/js/useModalForm';
import { submitForm }      from '../assets/js/submitForm';
import api, { BASE_URL }   from '../assets/js/axiosConfig';

const emptyForm = { bustype_code: '', name: '', is_active: true };

export default function BusTypeListing() {

  // ── Section 1: State ─────────────────────────────────────────────────────────
  const [busTypes, setBusTypes] = useState([]);
  const [loading, setLoading]   = useState(true);

  // ── Section 2: Shared Hooks ──────────────────────────────────────────────────
  const { filteredItems, searchTerm, setSearchTerm, resetSearch } = useFilteredList(
    busTypes, ['bustype_code', 'name']
  );

  const {
    currentItems, currentPage, totalPages,
    setCurrentPage, indexOfFirstItem, indexOfLastItem, getPageNumbers,
  } = usePagination(filteredItems);

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

  // ── Section 5: Helpers ───────────────────────────────────────────────────────
  const getModalTitle = () => ({ view: 'Bus Type Details', edit: 'Edit Bus Type', create: 'Create Bus Type' }[modalMode]);

  const getStatusBadge = (active) => active
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-rose-50 text-rose-700 border-rose-200';

  // ── Section 6: Render ────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-10 min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent tracking-tight">
            Bus Types
          </h1>
          <p className="text-slate-600 mt-1.5">Manage bus categories for your company</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-white px-6 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          <span className="mr-2 text-lg">+</span>
          <span className="font-medium">Create Bus Type</span>
        </button>
      </div>

      {/* Search Bar */}
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} onReset={resetSearch} placeholder="Search by code or name..." />

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200/60 overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-200">
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="5" className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800"></div>
                    <p className="text-slate-500 mt-3">Loading bus types...</p>
                  </div>
                </td></tr>
              ) : currentItems.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-12 text-center">
                  <p className="text-slate-500 font-medium">No bus types found</p>
                  <p className="text-slate-400 text-sm mt-1">Create your first bus type to get started</p>
                </td></tr>
              ) : currentItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-all duration-150">
                  <td className="px-6 py-4"><span className="text-sm text-slate-500 font-mono">#{item.id}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-slate-800 font-semibold">{item.bustype_code}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-slate-700">{item.name}</span></td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(item.is_active)}`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${item.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end items-center gap-2">
                      <button onClick={() => openViewModal(item)} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all duration-150">View</button>
                      <button onClick={() => openEditModal(item)} className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all duration-150">Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filteredItems.length > 0 && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Showing <span className="font-medium text-slate-900">{indexOfFirstItem + 1}</span> to{' '}
                <span className="font-medium text-slate-900">{Math.min(indexOfLastItem, busTypes.length)}</span> of{' '}
                <span className="font-medium text-slate-900">{busTypes.length}</span> results
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150">Previous</button>
                <div className="flex items-center gap-1">
                  {getPageNumbers().map(pageNum => (
                    <button key={pageNum} onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[2.5rem] px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 ${currentPage === pageNum ? 'bg-slate-800 text-white shadow-md' : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-50'}`}>
                      {pageNum}
                    </button>
                  ))}
                </div>
                <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150">Next</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={getModalTitle()}>
        <div className="space-y-5">

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Bus Type Code *</label>
            <input type="text" name="bustype_code" value={formData.bustype_code}
              onChange={handleInputChange} readOnly={isReadOnly}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent read-only:bg-slate-50 read-only:text-slate-600 transition-all"
              placeholder="e.g., BT001" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Name *</label>
            <input type="text" name="name" value={formData.name}
              onChange={handleInputChange} readOnly={isReadOnly}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent read-only:bg-slate-50 read-only:text-slate-600 transition-all"
              placeholder="e.g., Luxury Coach" />
          </div>

          {modalMode !== 'create' && (
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <input type="checkbox" name="is_active" id="is_active"
                checked={formData.is_active} onChange={handleInputChange} disabled={isReadOnly}
                className="w-4 h-4 rounded border-slate-300 text-slate-800 focus:ring-slate-500" />
              <label htmlFor="is_active" className="text-sm font-medium text-slate-700">Active Status</label>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-all">
              {isReadOnly ? 'Close' : 'Cancel'}
            </button>
            {!isReadOnly && (
              <button type="button" onClick={handleSubmit} disabled={submitting} className="px-5 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-xl hover:bg-slate-700 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {submitting ? 'Saving...' : modalMode === 'edit' ? 'Update' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </Modal>

    </div>
  );
}

import { useState, useEffect } from 'react';
import { Bus, Plus, Eye, Pencil, Search } from 'lucide-react';
import { useFilteredList } from '../../assets/js/useFilteredList';
import { usePagination }   from '../../assets/js/usePagination';
import { useModalForm }    from '../../assets/js/useModalForm';
import { submitForm }      from '../../assets/js/submitForm';
import api, { BASE_URL }   from '../../assets/js/axiosConfig';
import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const emptyForm = { bustype_code: '', name: '', is_active: true };

export default function BusTypeListing() {

  // ── State ────────────────────────────────────────────────────────────────────
  const [busTypes, setBusTypes] = useState([]);
  const [loading, setLoading]   = useState(true);

  // ── Hooks ────────────────────────────────────────────────────────────────────
  const { filteredItems, searchTerm, setSearchTerm } = useFilteredList(
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

  // ── Data ─────────────────────────────────────────────────────────────────────
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

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = () => submitForm({
    modalMode, editingItem, formData,
    createUrl: `${BASE_URL}/masterdata/bus-types/create`,
    updateUrl: `${BASE_URL}/masterdata/bus-types/update/${editingItem?.id}`,
    setSubmitting,
    onSuccess: () => { setIsModalOpen(false); setFormData(emptyForm); fetchBusTypes(); },
  });

  const getModalTitle = () => ({ view: 'Bus Type Details', edit: 'Edit Bus Type', create: 'Create Bus Type' }[modalMode]);

  // Stats
  const total    = busTypes.length;
  const active   = busTypes.filter(b => b.is_active).length;
  const inactive = total - active;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-3 sm:p-5 lg:p-7 min-h-screen bg-slate-50">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900">
            <Bus size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Bus Types</h1>
            <p className="text-slate-500 text-sm mt-0.5">Manage bus categories for your company</p>
          </div>
        </div>
        <Button onClick={openCreateModal} className="bg-slate-900 hover:bg-slate-700 text-white gap-2 shadow-sm">
          <Plus size={16} /> Create Bus Type
        </Button>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm shadow-xs">
          <span className="text-slate-500">Total</span>
          <span className="font-bold text-slate-800">{total}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-sm">
          <span className="text-emerald-600">Active</span>
          <span className="font-bold text-emerald-700">{active}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-sm">
          <span className="text-red-500">Inactive</span>
          <span className="font-bold text-red-700">{inactive}</span>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Search */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Search size={15} className="text-slate-400 shrink-0" />
          <Input
            placeholder="Search by code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 text-sm h-8 px-0"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['ID', 'Code', 'Name', 'Status', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {[60, 80, 140, 70, 60].map((w, j) => (
                      <td key={j} className="px-5 py-3">
                        <Skeleton className="h-4 rounded" style={{ width: w }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm">
                    No bus types found.
                  </td>
                </tr>
              ) : (
                currentItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-slate-500 text-xs font-semibold">#{item.id}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-slate-800 text-sm">{item.bustype_code}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-slate-700 text-sm">{item.name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {item.is_active
                        ? <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">Active</Badge>
                        : <Badge className="bg-red-100 text-red-700 border border-red-200 hover:bg-red-100">Inactive</Badge>
                      }
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openViewModal(item)}
                          className="p-2 rounded-md bg-slate-900 text-white hover:bg-slate-700 transition-colors"
                          title="View"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-2 rounded-md bg-slate-900 text-white hover:bg-slate-700 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filteredItems.length > 0 && totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Showing {indexOfFirstItem + 1}–{Math.min(indexOfLastItem, busTypes.length)} of {busTypes.length}
            </p>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)}
                disabled={currentPage === 1} className="h-7 px-2.5 text-xs">Prev</Button>
              {getPageNumbers().map(n => (
                <Button key={n} size="sm" onClick={() => setCurrentPage(n)}
                  className={`h-7 w-7 p-0 text-xs ${currentPage === n
                    ? 'bg-slate-900 hover:bg-slate-700 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                  {n}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage === totalPages} className="h-7 px-2.5 text-xs">Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <span className="p-1.5 rounded-lg bg-slate-900">
                <Bus size={14} className="text-white" />
              </span>
              {getModalTitle()}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-slate-700">Bus Type Code *</Label>
              <Input
                name="bustype_code"
                value={formData.bustype_code}
                onChange={handleInputChange}
                readOnly={isReadOnly}
                placeholder="e.g., BT001"
                className={isReadOnly ? 'bg-slate-50 text-slate-600' : ''}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700">Name *</Label>
              <Input
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                readOnly={isReadOnly}
                placeholder="e.g., Luxury Coach"
                className={isReadOnly ? 'bg-slate-50 text-slate-600' : ''}
              />
            </div>

            {modalMode !== 'create' && (
              <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  name="is_active"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={handleInputChange}
                  disabled={isReadOnly}
                  className="w-4 h-4 rounded border-slate-300 accent-slate-900"
                />
                <Label htmlFor="is_active" className="text-slate-700 cursor-pointer">Active Status</Label>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} className="text-slate-600">
                {isReadOnly ? 'Close' : 'Cancel'}
              </Button>
              {!isReadOnly && (
                <Button onClick={handleSubmit} disabled={submitting}
                  className="bg-slate-900 hover:bg-slate-700 text-white">
                  {submitting ? 'Saving...' : modalMode === 'edit' ? 'Update' : 'Save'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

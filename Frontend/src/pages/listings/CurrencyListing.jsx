import { useState, useEffect } from 'react';
import { Coins, Plus, Eye, Pencil, Search } from 'lucide-react';
import { useFilteredList } from '../../assets/js/useFilteredList';
import api, { BASE_URL } from '../../assets/js/axiosConfig';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export default function CurrencyListing() {

  // ── State ────────────────────────────────────────────────────────────────────
  const [currencies, setCurrencies]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode]     = useState('create');
  const [submitting, setSubmitting]   = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const emptyForm = { currency: '', country: '' };
  const [formData, setFormData] = useState(emptyForm);

  // ── Search ───────────────────────────────────────────────────────────────────
  const { filteredItems, searchTerm, setSearchTerm } = useFilteredList(
    currencies, ['currency', 'country']
  );

  // ── Pagination ───────────────────────────────────────────────────────────────
  const indexOfLast  = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirst, indexOfLast);
  const totalPages   = Math.ceil(filteredItems.length / itemsPerPage);
  const getPageNumbers = () => {
    let s = Math.max(1, currentPage - 1);
    let e = Math.min(totalPages, s + 2);
    if (e - s < 2) s = Math.max(1, e - 2);
    return Array.from({ length: e - s + 1 }, (_, i) => s + i);
  };

  // ── Data ─────────────────────────────────────────────────────────────────────
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
      window.alert((data.errors ? Object.values(data.errors)[0][0] : data.message) || 'Validation failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Modal helpers ─────────────────────────────────────────────────────────────
  const openCreateModal = () => { setFormData(emptyForm); setEditingItem(null); setModalMode('create'); setIsModalOpen(true); };
  const openViewModal   = (item) => { setFormData(item); setEditingItem(item); setModalMode('view');   setIsModalOpen(true); };
  const openEditModal   = (item) => { setFormData(item); setEditingItem(item); setModalMode('edit');   setIsModalOpen(true); };
  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const isReadOnly    = modalMode === 'view';
  const getModalTitle = () => ({ view: 'Currency Details', edit: 'Edit Currency', create: 'Create Currency' }[modalMode]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-3 sm:p-5 lg:p-7 min-h-screen bg-slate-50">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900">
            <Coins size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Currencies</h1>
            <p className="text-slate-500 text-sm mt-0.5">Manage currency master data</p>
          </div>
        </div>
        <Button onClick={openCreateModal} className="bg-slate-900 hover:bg-slate-700 text-white gap-2 shadow-sm">
          <Plus size={16} /> Create Currency
        </Button>
      </div>

      {/* Total chip */}
      <div className="flex gap-2 mb-5">
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm shadow-xs">
          <span className="text-slate-500">Total</span>
          <span className="font-bold text-slate-800">{currencies.length}</span>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Search */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Search size={15} className="text-slate-400 shrink-0" />
          <Input
            placeholder="Search by currency code or country..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 text-sm h-8 px-0"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['ID', 'Currency Code', 'Country', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{[60, 80, 140, 60].map((w, j) => (
                    <td key={j} className="px-5 py-3"><Skeleton className="h-4 rounded" style={{ width: w }} /></td>
                  ))}</tr>
                ))
              ) : currentItems.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400 text-sm">No currencies found.</td></tr>
              ) : currentItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5"><span className="font-mono text-slate-500 text-xs font-semibold">#{item.id}</span></td>
                  <td className="px-5 py-3.5"><span className="font-bold text-slate-800 uppercase text-sm tracking-wide">{item.currency}</span></td>
                  <td className="px-5 py-3.5"><span className="text-slate-700 text-sm">{item.country}</span></td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => openViewModal(item)} className="p-2 rounded-md bg-slate-900 text-white hover:bg-slate-700 transition-colors" title="View"><Eye size={16} /></button>
                      <button onClick={() => openEditModal(item)} className="p-2 rounded-md bg-slate-900 text-white hover:bg-slate-700 transition-colors" title="Edit"><Pencil size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filteredItems.length > 0 && totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Showing {indexOfFirst + 1}–{Math.min(indexOfLast, currencies.length)} of {currencies.length}
            </p>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="h-7 px-2.5 text-xs">Prev</Button>
              {getPageNumbers().map(n => (
                <Button key={n} size="sm" onClick={() => setCurrentPage(n)}
                  className={`h-7 w-7 p-0 text-xs ${currentPage === n ? 'bg-slate-900 hover:bg-slate-700 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                  {n}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} className="h-7 px-2.5 text-xs">Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <span className="p-1.5 rounded-lg bg-slate-900"><Coins size={14} className="text-white" /></span>
              {getModalTitle()}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-slate-700">Currency Code *</Label>
              <Input name="currency" value={formData.currency} onChange={handleInputChange} readOnly={isReadOnly}
                placeholder="e.g. INR" maxLength={3}
                className={`uppercase ${isReadOnly ? 'bg-slate-50 text-slate-600' : ''}`} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700">Country *</Label>
              <Input name="country" value={formData.country} onChange={handleInputChange} readOnly={isReadOnly}
                placeholder="e.g. India"
                className={isReadOnly ? 'bg-slate-50 text-slate-600' : ''} />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} className="text-slate-600">
                {isReadOnly ? 'Close' : 'Cancel'}
              </Button>
              {!isReadOnly && (
                <Button onClick={handleSubmit} disabled={submitting} className="bg-slate-900 hover:bg-slate-700 text-white">
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

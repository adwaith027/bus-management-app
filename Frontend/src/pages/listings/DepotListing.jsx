import { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
import {
  Eye, Pencil, Plus, Warehouse,
  ArrowUp, ArrowDown, ArrowUpDown, Search,
} from 'lucide-react';
import api, { BASE_URL } from '../../assets/js/axiosConfig';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function DepotListing() {
  const [depots, setDepots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [submitting, setSubmitting] = useState(false);
  const [editingDepot, setEditingDepot] = useState(null);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState([]);

  const [formData, setFormData] = useState({
    depot_code: '',
    depot_name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
  });

  useEffect(() => { fetchDepots(); }, []);

  const fetchDepots = async () => {
    setLoading(true);
    try {
      const res = await api.get(`${BASE_URL}/depots`);
      setDepots(res.data?.data || []);
    } catch (err) {
      console.error('Error fetching depots:', err);
      setDepots([]);
    } finally {
      setLoading(false);
    }
  };

  const resetFormData = () =>
    setFormData({ depot_code: '', depot_name: '', address: '', city: '', state: '', zip_code: '' });

  const openCreateModal = () => {
    resetFormData();
    setEditingDepot(null);
    setModalMode('create');
    setIsDialogOpen(true);
  };

  const openViewModal = (depot) => {
    setEditingDepot(depot);
    setFormData(depot);
    setModalMode('view');
    setIsDialogOpen(true);
  };

  const openEditModal = (depot) => {
    setEditingDepot(depot);
    setFormData(depot);
    setModalMode('edit');
    setIsDialogOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let response;
      if (modalMode === 'edit') {
        response = await api.put(`${BASE_URL}/update-depot-details/${editingDepot.id}`, formData);
      } else {
        response = await api.post(`${BASE_URL}/create-depot`, formData);
      }
      if (response?.status === 200 || response?.status === 201) {
        window.alert(response.data.message || 'Success');
        setIsDialogOpen(false);
        resetFormData();
        fetchDepots();
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

  const isReadOnly = modalMode === 'view';

  const getModalTitle = () => {
    if (modalMode === 'view') return 'Depot Details';
    if (modalMode === 'edit') return 'Edit Depot';
    return 'Create Depot';
  };

  // Stats
  const totalDepots = depots.length;
  const activeDepots = depots.filter((d) => d.is_active).length;
  const inactiveDepots = totalDepots - activeDepots;

  // TanStack Table columns
  const columns = useMemo(() => [
    {
      accessorKey: 'id',
      header: 'ID',
      cell: ({ getValue }) => (
        <span className="font-mono text-slate-500 text-xs font-semibold">#{getValue()}</span>
      ),
      size: 60,
    },
    {
      accessorKey: 'depot_code',
      header: 'Code',
      cell: ({ getValue }) => (
        <span className="font-semibold text-slate-800 text-sm">{getValue()}</span>
      ),
    },
    {
      accessorKey: 'depot_name',
      header: 'Name',
      cell: ({ getValue }) => (
        <span className="text-slate-700 text-sm">{getValue()}</span>
      ),
    },
    {
      id: 'location',
      header: 'Location',
      accessorFn: (row) => `${row.city}, ${row.state}`,
      cell: ({ row }) => (
        <div className="text-sm">
          <span className="text-slate-700">{row.original.city}, {row.original.state}</span>
          <span className="text-slate-400 text-xs block">{row.original.zip_code}</span>
        </div>
      ),
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ getValue }) =>
        getValue() ? (
          <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">Active</Badge>
        ) : (
          <Badge className="bg-red-100 text-red-700 border border-red-200 hover:bg-red-100">Inactive</Badge>
        ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => openViewModal(row.original)}
            className="p-2 rounded-md bg-slate-900 text-white hover:bg-slate-700 transition-colors"
            title="View"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => openEditModal(row.original)}
            className="p-2 rounded-md bg-slate-900 text-white hover:bg-slate-700 transition-colors"
            title="Edit"
          >
            <Pencil size={16} />
          </button>
        </div>
      ),
      size: 80,
    },
  ], []);

  const table = useReactTable({
    data: depots,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const SortIcon = ({ column }) => {
    if (!column.getCanSort()) return null;
    if (column.getIsSorted() === 'asc') return <ArrowUp size={13} className="inline ml-1 text-violet-500" />;
    if (column.getIsSorted() === 'desc') return <ArrowDown size={13} className="inline ml-1 text-violet-500" />;
    return <ArrowUpDown size={13} className="inline ml-1 text-slate-400" />;
  };

  return (
    <div className="p-3 sm:p-5 lg:p-7 min-h-screen bg-slate-50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900">
            <Warehouse size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Depot Management</h1>
            <p className="text-slate-500 text-sm mt-0.5">Manage and monitor company depots</p>
          </div>
        </div>
        <Button
          onClick={openCreateModal}
          className="bg-slate-900 hover:bg-slate-700 text-white gap-2 shadow-sm"
        >
          <Plus size={16} />
          Create Depot
        </Button>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm shadow-xs">
          <span className="text-slate-500">Total</span>
          <span className="font-bold text-slate-800">{totalDepots}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-sm">
          <span className="text-emerald-600">Active</span>
          <span className="font-bold text-emerald-700">{activeDepots}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-sm">
          <span className="text-red-500">Inactive</span>
          <span className="font-bold text-red-700">{inactiveDepots}</span>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Search bar */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Search size={15} className="text-slate-400 shrink-0" />
          <Input
            placeholder="Search depots..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 text-sm h-8 px-0"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="bg-slate-50 border-b border-slate-200">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <SortIcon column={header.column} />
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((_, j) => (
                      <td key={j} className="px-5 py-3">
                        <Skeleton className="h-4 w-full rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-10 text-center text-slate-400 text-sm">
                    No depots found.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-violet-50/40 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-5 py-3.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <span className="p-1.5 rounded-lg bg-slate-900">
                <Warehouse size={15} className="text-white" />
              </span>
              {getModalTitle()}
            </DialogTitle>
          </DialogHeader>

          <form className="space-y-4 mt-2" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-700">Depot Code *</Label>
                <Input
                  name="depot_code"
                  value={formData.depot_code}
                  onChange={handleInputChange}
                  readOnly={isReadOnly}
                  className={isReadOnly ? 'bg-slate-50 text-slate-600' : ''}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700">Depot Name *</Label>
                <Input
                  name="depot_name"
                  value={formData.depot_name}
                  onChange={handleInputChange}
                  readOnly={isReadOnly}
                  className={isReadOnly ? 'bg-slate-50 text-slate-600' : ''}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700">Address *</Label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                readOnly={isReadOnly}
                rows={3}
                className={`w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none ${isReadOnly ? 'bg-slate-50 text-slate-600' : ''}`}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-700">City *</Label>
                <Input
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  readOnly={isReadOnly}
                  className={isReadOnly ? 'bg-slate-50 text-slate-600' : ''}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700">State *</Label>
                <Input
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  readOnly={isReadOnly}
                  className={isReadOnly ? 'bg-slate-50 text-slate-600' : ''}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700">Zip *</Label>
                <Input
                  name="zip_code"
                  value={formData.zip_code}
                  onChange={handleInputChange}
                  readOnly={isReadOnly}
                  className={isReadOnly ? 'bg-slate-50 text-slate-600' : ''}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="text-slate-600"
              >
                {isReadOnly ? 'Close' : 'Cancel'}
              </Button>
              {!isReadOnly && (
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-slate-900 hover:bg-slate-700 text-white"
                >
                  {submitting ? 'Saving...' : modalMode === 'edit' ? 'Update Depot' : 'Save Depot'}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

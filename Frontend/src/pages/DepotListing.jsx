import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import api, { BASE_URL } from '../assets/js/axiosConfig';

export default function DepotListing() {
  const [depots, setDepots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [submitting, setSubmitting] = useState(false);
  const [editingDepot, setEditingDepot] = useState(null);

  const [formData, setFormData] = useState({
    depot_code: '',
    depot_name: '',
    address: '',
    city: '',
    state: '',
    zip_code: ''
  });

  useEffect(() => {
    fetchDepots();
  }, []);

  const fetchDepots = async () => {
    setLoading(true);
    try {
      const res = await api.get(`${BASE_URL}/depots`);
      setDepots(res.data?.data || []);
    } catch (err) {
      console.error("Error fetching depots:", err);
      setDepots([]);
    } finally {
      setLoading(false);
    }
  };

  const resetFormData = () => {
    setFormData({ depot_code:'', depot_name:'', address:'', city:'', state:'', zip_code:'' });
  };

  const openCreateModal = () => {
    resetFormData();
    setEditingDepot(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const openViewModal = (depot) => {
    setEditingDepot(depot);
    setFormData(depot);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const openEditModal = (depot) => {
    setEditingDepot(depot);
    setFormData(depot);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
        setIsModalOpen(false);
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

  const getStatusBadgeColor = (active) => {
    return active
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : "bg-red-100 text-red-700 border-red-200";
  };

  const getStatusLabel = (active) => active ? "Active" : "Inactive";

  const getModalTitle = () => {
    if (modalMode === 'view') return 'Depot Details';
    if (modalMode === 'edit') return 'Edit Depot';
    return 'Create Depot';
  };

  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Depot Management</h1>
          <p className="text-slate-500 mt-1">Manage company depots</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <span className="font-medium">+ Create Depot</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Address</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-500">Loading...</td>
                </tr>
              ) : depots.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">No depots found.</td></tr>
              ) : (
                depots.map(depot => (
                  <tr key={depot.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-500 font-mono">#{depot.id}</td>
                    <td className="px-6 py-4 text-sm text-slate-800 font-medium">{depot.depot_code}</td>
                    <td className="px-6 py-4 text-sm text-slate-800">{depot.depot_name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {depot.address}, {depot.city}, {depot.state}, {depot.zip_code}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeColor(depot.is_active)}`}>
                        {getStatusLabel(depot.is_active)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center space-x-2">
                        <button 
                          onClick={() => openViewModal(depot)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          View
                        </button>
                        <button 
                          onClick={() => openEditModal(depot)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={getModalTitle()}>
        <form className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Depot Code *</label>
            <input
              type="text"
              name="depot_code"
              value={formData.depot_code}
              onChange={handleInputChange}
              readOnly={isReadOnly}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-slate-500 read-only:bg-slate-50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Depot Name *</label>
            <input
              type="text"
              name="depot_name"
              value={formData.depot_name}
              onChange={handleInputChange}
              readOnly={isReadOnly}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-slate-500 read-only:bg-slate-50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Address *</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              readOnly={isReadOnly}
              rows="3"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-slate-500 read-only:bg-slate-50"
            ></textarea>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">City *</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                readOnly={isReadOnly}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-slate-500 read-only:bg-slate-50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">State *</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleInputChange}
                readOnly={isReadOnly}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-slate-500 read-only:bg-slate-50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Zip Code *</label>
              <input
                type="text"
                name="zip_code"
                value={formData.zip_code}
                onChange={handleInputChange}
                readOnly={isReadOnly}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-slate-500 read-only:bg-slate-50"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-100 mt-6">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              {modalMode === 'view' ? 'Close' : 'Cancel'}
            </button>

            {modalMode !== 'view' && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 shadow-md disabled:opacity-50"
              >
                {submitting ? 'Saving...' : modalMode === 'edit' ? 'Update Depot' : 'Save Depot'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}

import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import api, { BASE_URL } from '../assets/js/axiosConfig';

export default function BranchListing() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [submitting, setSubmitting] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);

  const [formData, setFormData] = useState({
    branch_code: '',
    branch_name: '',
    address: '',
    city: '',
    state: '',
    zip_code: ''
  });

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const res = await api.get(`${BASE_URL}/branches/`);
      setBranches(res.data?.data || []);
    } catch (err) {
      console.error("Error fetching branches:", err);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  const resetFormData = () => {
    setFormData({ branch_code:'', branch_name:'', address:'', city:'', state:'', zip_code:'' });
  };

  const openCreateModal = () => {
    resetFormData();
    setEditingBranch(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const openViewModal = (branch) => {
    setEditingBranch(branch);
    setFormData(branch);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const openEditModal = (branch) => {
    setEditingBranch(branch);
    setFormData(branch);
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
        response = await api.put(`${BASE_URL}/update-branch-details/${editingBranch.id}/`, formData);
      } else {
        response = await api.post(`${BASE_URL}/create-branch/`, formData);
      }

      if (response?.status === 200 || response?.status === 201) {
        window.alert(response.data.message || 'Success');
        setIsModalOpen(false);
        resetFormData();
        fetchBranches();
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
    if (modalMode === 'view') return 'Branch Details';
    if (modalMode === 'edit') return 'Edit Branch';
    return 'Create Branch';
  };

  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Branch Management</h1>
          <p className="text-slate-500 mt-1">Manage company branches</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <span className="font-medium">+ Create Branch</span>
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
              ) : branches.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">No branches found.</td></tr>
              ) : (
                branches.map(branch => (
                  <tr key={branch.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-500 font-mono">#{branch.id}</td>
                    <td className="px-6 py-4 text-sm text-slate-800 font-medium">{branch.branch_code}</td>
                    <td className="px-6 py-4 text-sm text-slate-800">{branch.branch_name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {branch.address}, {branch.city}, {branch.state}, {branch.zip_code}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeColor(branch.is_active)}`}>
                        {getStatusLabel(branch.is_active)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center space-x-2">
                        <button 
                          onClick={() => openViewModal(branch)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          View
                        </button>
                        <button 
                          onClick={() => openEditModal(branch)}
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
            <label className="text-sm font-medium text-slate-700">Branch Code *</label>
            <input
              type="text"
              name="branch_code"
              value={formData.branch_code}
              onChange={handleInputChange}
              readOnly={isReadOnly}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-slate-500 read-only:bg-slate-50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Branch Name *</label>
            <input
              type="text"
              name="branch_name"
              value={formData.branch_name}
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
                {submitting ? 'Saving...' : modalMode === 'edit' ? 'Update Branch' : 'Save Branch'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}

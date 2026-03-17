import { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import api, { BASE_URL } from '../assets/js/axiosConfig';

export default function DealerManagement() {
  const [dealers, setDealers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingDealer, setEditingDealer] = useState(null);

  const [formData, setFormData] = useState({
    dealer_code: '',
    dealer_name: '',
    contact_person: '',
    contact_number: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    gst_number: '',
    is_active: true,
    user_username: '',
    user_email: '',
    user_password: ''
  });

  const [mappingForm, setMappingForm] = useState({
    dealer: '',
    company: '',
    is_active: true
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [dealersRes, companiesRes, mappingsRes] = await Promise.all([
        api.get(`${BASE_URL}/dealers`),
        api.get(`${BASE_URL}/customer-data`),
        api.get(`${BASE_URL}/dealer-mappings`)
      ]);
      setDealers(dealersRes.data?.data || []);
      setCompanies(companiesRes.data?.data || []);
      setMappings(mappingsRes.data?.data || []);
    } catch (err) {
      console.error('Error fetching dealer data:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetFormData = () => {
    setFormData({
      dealer_code: '',
      dealer_name: '',
      contact_person: '',
      contact_number: '',
      email: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      gst_number: '',
      is_active: true,
      user_username: '',
      user_email: '',
      user_password: ''
    });
  };

  const populateFormData = (dealer) => {
    setFormData({
      dealer_code: dealer.dealer_code || '',
      dealer_name: dealer.dealer_name || '',
      contact_person: dealer.contact_person || '',
      contact_number: dealer.contact_number || '',
      email: dealer.email || '',
      address: dealer.address || '',
      city: dealer.city || '',
      state: dealer.state || '',
      zip_code: dealer.zip_code || '',
      gst_number: dealer.gst_number || '',
      is_active: dealer.is_active ?? true,
      user_username: '',
      user_email: '',
      user_password: ''
    });
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingDealer(null);
    resetFormData();
    setIsModalOpen(true);
  };

  const openEditModal = (dealer) => {
    setModalMode('edit');
    setEditingDealer(dealer);
    populateFormData(dealer);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDealer(null);
    setModalMode('create');
    resetFormData();
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleMappingChange = (e) => {
    const { name, value, type, checked } = e.target;
    setMappingForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let response;
      if (modalMode === 'create') {
        response = await api.post(`${BASE_URL}/create-dealer`, formData);
      } else {
        const updateData = { ...formData };
        delete updateData.user_username;
        delete updateData.user_email;
        delete updateData.user_password;
        response = await api.put(`${BASE_URL}/update-dealer-details/${editingDealer.id}`, updateData);
      }

      if (response?.status === 200 || response?.status === 201) {
        window.alert(response.data.message || 'Operation successful!');
        closeModal();
        fetchAll();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Operation failed';
      window.alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateMapping = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post(`${BASE_URL}/create-dealer-mapping`, mappingForm);
      if (response?.status === 201) {
        window.alert(response.data.message || 'Mapping created!');
        setMappingForm({ dealer: '', company: '', is_active: true });
        fetchAll();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Mapping failed';
      window.alert(errorMessage);
    }
  };

  const handleToggleMapping = async (mapping) => {
    try {
      const response = await api.put(`${BASE_URL}/update-dealer-mapping/${mapping.id}`, {
        is_active: !mapping.is_active
      });
      if (response?.status === 200) {
        fetchAll();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Update failed';
      window.alert(errorMessage);
    }
  };

  const getDealerName = (dealerId) => {
    const dealer = dealers.find(d => d.id === dealerId);
    return dealer ? dealer.dealer_name : 'N/A';
  };

  const getCompanyName = (companyId) => {
    const company = companies.find(c => c.id === companyId);
    return company ? company.company_name : 'N/A';
  };

  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Dealer Management</h1>
          <p className="text-slate-500 mt-1">Create dealers and map them to companies</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
        >
          <span className="font-medium">Add New Dealer</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dealer</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500">Loading...</td>
                  </tr>
                ) : dealers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500">No dealers found</td>
                  </tr>
                ) : (
                  dealers.map(dealer => (
                    <tr key={dealer.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm text-slate-700 font-semibold">{dealer.dealer_code}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{dealer.dealer_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{dealer.contact_number}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${dealer.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {dealer.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openEditModal(dealer)}
                          className="text-slate-600 hover:text-slate-900 text-sm font-medium cursor-pointer"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-fit">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Map Dealer to Company</h2>
          <form onSubmit={handleCreateMapping} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Dealer</label>
              <select
                name="dealer"
                value={mappingForm.dealer}
                onChange={handleMappingChange}
                required
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="">-- Select Dealer --</option>
                {dealers.map(dealer => (
                  <option key={dealer.id} value={dealer.id}>{dealer.dealer_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Company</label>
              <select
                name="company"
                value={mappingForm.company}
                onChange={handleMappingChange}
                required
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="">-- Select Company --</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>{company.company_name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center space-x-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="is_active"
                checked={mappingForm.is_active}
                onChange={handleMappingChange}
              />
              <span>Active Mapping</span>
            </label>
            <button
              type="submit"
              className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg cursor-pointer"
            >
              Create Mapping
            </button>
          </form>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Existing Mappings</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {mappings.map(mapping => (
                <div key={mapping.id} className="text-xs text-slate-600 border border-slate-200 rounded-lg p-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-700">{getDealerName(mapping.dealer)}</div>
                    <div>{getCompanyName(mapping.company)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleMapping(mapping)}
                    className={`px-2 py-1 rounded-full text-[11px] font-medium cursor-pointer ${mapping.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {mapping.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              ))}
              {mappings.length === 0 && (
                <p className="text-xs text-slate-500">No mappings found</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={modalMode === 'edit' ? 'Edit Dealer' : 'Create Dealer'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Dealer Code</label>
              <input
                type="text"
                name="dealer_code"
                value={formData.dealer_code}
                onChange={handleInputChange}
                required
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Dealer Name</label>
              <input
                type="text"
                name="dealer_name"
                value={formData.dealer_name}
                onChange={handleInputChange}
                required
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Contact Person</label>
              <input
                type="text"
                name="contact_person"
                value={formData.contact_person}
                onChange={handleInputChange}
                required
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Contact Number</label>
              <input
                type="text"
                name="contact_number"
                value={formData.contact_number}
                onChange={handleInputChange}
                required
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">GST Number</label>
              <input
                type="text"
                name="gst_number"
                value={formData.gst_number}
                onChange={handleInputChange}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Address</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                required
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                required
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">State</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleInputChange}
                required
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Zip Code</label>
              <input
                type="text"
                name="zip_code"
                value={formData.zip_code}
                onChange={handleInputChange}
                required
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleInputChange}
              />
              <label className="text-sm text-slate-700">Active</label>
            </div>
          </div>

          {modalMode === 'create' && (
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Dealer User Account</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Username</label>
                  <input
                    type="text"
                    name="user_username"
                    value={formData.user_username}
                    onChange={handleInputChange}
                    required
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">User Email</label>
                  <input
                    type="email"
                    name="user_email"
                    value={formData.user_email}
                    onChange={handleInputChange}
                    required
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Password</label>
                  <input
                    type="password"
                    name="user_password"
                    value={formData.user_password}
                    onChange={handleInputChange}
                    required
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg cursor-pointer"
          >
            {submitting ? 'Saving...' : 'Save Dealer'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

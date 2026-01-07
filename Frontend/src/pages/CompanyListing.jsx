import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import api, { BASE_URL } from '../assets/js/axiosConfig';

export default function CompanyListing() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Modal Mode Management
  const [modalMode, setModalMode] = useState('create'); // 'create', 'view', 'edit'
  const [editingCompany, setEditingCompany] = useState(null);

  // License State
  const [registeringLicense, setRegisteringLicense] = useState({});

  // Form State
  const [formData, setFormData] = useState({
    company_name: '',
    company_email: '',
    gst_number: '',
    contact_person: '',
    contact_number: '',
    address: '',
    address_2: '',
    city: '',
    state: '',
    zip_code: '',
    number_of_licence: 1
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const response = await api.get(`${BASE_URL}/customer-data/`);
      const companyData = response.data?.data || [];
      setCompanies(companyData);
    } catch (err) {
      console.error("Error fetching companies:", err);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetFormData = () => {
    setFormData({
      company_name: '',
      company_email: '',
      gst_number: '',
      contact_person: '',
      contact_number: '',
      address: '',
      address_2: '',
      city: '',
      state: '',
      zip_code: '',
      number_of_licence: 1
    });
  };

  const populateFormData = (company) => {
    setFormData({
      company_name: company.company_name || '',
      company_email: company.company_email || '',
      gst_number: company.gst_number || '',
      contact_person: company.contact_person || '',
      contact_number: company.contact_number || '',
      address: company.address || '',
      address_2: company.address_2 || '',
      city: company.city || '',
      state: company.state || '',
      zip_code: company.zip_code || '',
      number_of_licence: company.number_of_licence || 1
    });
  };

  // ==================== MODAL HANDLERS ====================
  
  const openCreateModal = () => {
    setModalMode('create');
    setEditingCompany(null);
    resetFormData();
    setIsModalOpen(true);
  };

  const openViewModal = (company) => {
    setModalMode('view');
    setEditingCompany(company);
    populateFormData(company);
    setIsModalOpen(true);
  };

  const openEditModal = (company) => {
    setModalMode('edit');
    setEditingCompany(company);
    populateFormData(company);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCompany(null);
    setModalMode('create');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let response;
      if (modalMode === 'edit') {
        response = await api.put(`${BASE_URL}/update-company-details/${editingCompany.id}/`, formData);
      } else if (modalMode === 'create') {
        response = await api.post(`${BASE_URL}/create-company/`, formData);
      }

      if (response?.status === 200 || response?.status === 201) {
        // You might want to use a toast notification here instead of alert
        window.alert(response.data.message || 'Operation successful!');
        setIsModalOpen(false);
        resetFormData();
        fetchCompanies();
      }
    } catch (err) {
      if (!err.response) {
        window.alert('Server unreachable. Please try again later.');
        return;
      }
      const { status, data } = err.response;
      if (status === 400 && data.errors) {
        const firstError = Object.values(data.errors)[0]?.[0];
        window.alert(firstError || data.message);
      } else {
        window.alert(data?.message || 'Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== LICENSE HANDLERS ====================
  
  const handleRegisterLicense = async (companyId) => {
    setRegisteringLicense(prev => ({ ...prev, [companyId]: true }));
    try {
      const response = await api.post(`${BASE_URL}/register-company-license/${companyId}/`);
      if (response.status === 200) {
        window.alert(response.data.message || 'Company registered successfully!');
        fetchCompanies();
      }
    } catch (err) {
      console.error("License registration error:", err);
      const { data } = err.response || {};
      window.alert(data?.message || data?.error || 'License registration failed');
    } finally {
      setRegisteringLicense(prev => ({ ...prev, [companyId]: false }));
    }
  };
 
  const handleValidateLicense = async (companyId) => {
    try {
      const response = await api.post(`${BASE_URL}/validate-company-license/${companyId}/`);
      if (response.status === 200) {
        window.alert(response.data.message || 'License validation started!');
        fetchCompanies();
      }
    } catch (err) {
      console.error("License validation error:", err);
      const { data } = err.response || {};
      window.alert(data?.message || data?.error || 'License validation failed');
    }
  };

  const getModalTitle = () => {
    if (modalMode === 'view') return 'Company Details';
    if (modalMode === 'edit') return 'Edit Company';
    return 'Register Company';
  };

  // Helper for Status Badge Styling
  const getStatusStyle = (status) => {
    switch (status) {
      case 'Approve':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Pending':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Validating':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Expired':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'Block':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const isReadOnly = modalMode === 'view';

  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50 animate-fade-in">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className='page-header'>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Company Management</h1>
          <p className="text-slate-500 mt-1">Manage client companies and license statuses</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="font-medium">Register New Company</span>
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">License Action</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-500">
                    <div className="flex justify-center items-center space-x-2">
                      <svg className="animate-spin h-5 w-5 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Loading data...</span>
                    </div>
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-500">No companies found.</td></tr>
              ) : (
                companies.map((company) => {
                  const isPending = company.authentication_status === 'Pending';
                  const isValidating = company.authentication_status === 'Validating';
                  const hasCompanyId = company.company_id !== null && company.company_id !== undefined;
                  const isRegistering = registeringLicense[company.id];
                  
                  return (
                    <tr key={company.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-500 font-mono">#{company.id}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800">{company.company_name}</span>
                          <span className="text-xs text-slate-500">{company.company_email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{company.contact_person}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(company.authentication_status)}`}>
                          {company.authentication_status || 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {!hasCompanyId ? (
                          <button 
                            onClick={() => handleRegisterLicense(company.id)}
                            disabled={isRegistering}
                            className="text-xs font-medium bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition disabled:opacity-50"
                          >
                            {isRegistering ? 'Registering...' : 'Register Company'}
                          </button>
                        ) : isPending ? (
                          <button 
                            onClick={() => handleValidateLicense(company.id)}
                            className="text-xs font-medium bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition"
                          >
                            Validate License
                          </button>
                        ) : isValidating ? (
                          <span className="text-xs flex items-center text-blue-600 font-medium animate-pulse">
                             Validating...
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">Synced</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end items-center space-x-2">
                          <button style={{cursor:"pointer"}}
                            onClick={() => openViewModal(company)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                            title="View"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button style={{cursor:"pointer"}}
                            onClick={() => openEditModal(company)}
                            disabled={isValidating}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-30"
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Content - Styled with Tailwind */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={getModalTitle()}>
        <form className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Company Name<span style={{color:"red"}}> *</span></label>
              <input 
                type="text" 
                name="company_name" 
                value={formData.company_name} 
                onChange={handleInputChange} 
                required 
                readOnly={isReadOnly}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all disabled:bg-slate-50 read-only:bg-slate-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Email<span style={{color:"red"}}> *</span></label>
              <input 
                type="email" 
                name="company_email" 
                value={formData.company_email} 
                onChange={handleInputChange} 
                required 
                readOnly={isReadOnly}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">GST Number</label>
              <input 
                type="text" 
                name="gst_number" 
                value={formData.gst_number} 
                onChange={handleInputChange} 
                readOnly={isReadOnly}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">No. of Licenses<span style={{color:"red"}}> *</span></label>
              <input 
                type="number" 
                name="number_of_licence" 
                value={formData.number_of_licence} 
                onChange={handleInputChange} 
                min="1" 
                required 
                readOnly={isReadOnly}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Contact Person<span style={{color:"red"}}> *</span></label>
              <input 
                type="text" 
                name="contact_person" 
                value={formData.contact_person} 
                onChange={handleInputChange} 
                required 
                readOnly={isReadOnly}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Contact Number<span style={{color:"red"}}> *</span></label>
              <input 
                type="text" 
                name="contact_number" 
                value={formData.contact_number} 
                onChange={handleInputChange} 
                required 
                readOnly={isReadOnly}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Address<span style={{color:"red"}}> *</span></label>
            <textarea 
              name="address" 
              value={formData.address} 
              onChange={handleInputChange} 
              required 
              rows="3"
              readOnly={isReadOnly}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50"
            ></textarea>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Address 2 (Optional)</label>
            <textarea 
              name="address_2" 
              value={formData.address_2} 
              onChange={handleInputChange} 
              rows="2"
              readOnly={isReadOnly}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50"
            ></textarea>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">City<span style={{color:"red"}}> *</span></label>
              <input 
                type="text" 
                name="city" 
                value={formData.city} 
                onChange={handleInputChange} 
                required 
                readOnly={isReadOnly}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">State<span style={{color:"red"}}> *</span></label>
              <input 
                type="text" 
                name="state" 
                value={formData.state} 
                onChange={handleInputChange} 
                required 
                readOnly={isReadOnly}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Zip Code<span style={{color:"red"}}> *</span></label>
              <input 
                type="text" 
                name="zip_code" 
                value={formData.zip_code} 
                onChange={handleInputChange} 
                required 
                readOnly={isReadOnly}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-100 mt-6">
            <button 
              type="button" 
              onClick={closeModal}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"
            >
              {modalMode === 'view' ? 'Close' : 'Cancel'}
            </button>
            {modalMode !== 'view' && (
              <button 
                type="button" 
                onClick={handleSubmit} 
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-800 border border-transparent rounded-lg hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 shadow-md transition-all flex items-center"
              >
                {submitting && (
                   <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                )}
                {submitting ? 'Saving...' : modalMode === 'edit' ? 'Update Company' : 'Save Company'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
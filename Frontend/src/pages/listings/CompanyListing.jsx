import { useState, useEffect } from 'react';
import Modal from '../../components/Modal';
import TableSkeleton from '../../components/TableSkeleton';
import api, { BASE_URL } from '../../assets/js/axiosConfig';

export default function CompanyListing() {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentRole = currentUser?.role;
  const isDealerAdmin = currentRole === 'dealer_admin';

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Modal Mode: 'create' | 'view' | 'edit' | 'import'
  const [modalMode, setModalMode] = useState('create');
  const [editingCompany, setEditingCompany] = useState(null);

  // License action state
  const [registeringLicense, setRegisteringLicense] = useState({});
  const [validatingLicense, setValidatingLicense] = useState({});

  // Import-existing flow state (superadmin only)
  const [importStep, setImportStep] = useState('search'); // 'search' | 'confirm'
  const [importCompanyId, setImportCompanyId] = useState('');
  const [importFetching, setImportFetching] = useState(false);
  const [importFetchError, setImportFetchError] = useState('');
  // License validity info shown in the confirm step (display only — not sent on submit)
  const [importLicenseData, setImportLicenseData] = useState(null);

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
    number_of_licence: 1,
    // dealer_admin sets these to allocate from their licence pool
    device_count: 0,
    mobile_device_count: 0,
  });

  useEffect(() => { fetchCompanies(); }, []);

  // Auto-refresh every 5s while any company is Validating
  useEffect(() => {
    const hasValidating = companies.some(c => c.authentication_status === 'Validating');
    if (!hasValidating) return;
    const interval = setInterval(fetchCompanies, 5000);
    return () => clearInterval(interval);
  }, [companies]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const response = await api.get(`${BASE_URL}/customer-data`);
      setCompanies(response.data?.data || []);
    } catch (err) {
      console.error('Error fetching companies:', err);
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
      number_of_licence: 1,
      device_count: 0,
      mobile_device_count: 0,
    });
  };

  const populateFormData = (company) => {
    setFormData({
      company_name:      company.company_name      || '',
      company_email:     company.company_email     || '',
      gst_number:        company.gst_number        || '',
      contact_person:    company.contact_person    || '',
      contact_number:    company.contact_number    || '',
      address:           company.address           || '',
      address_2:         company.address_2         || '',
      city:              company.city              || '',
      state:             company.state             || '',
      zip_code:          company.zip_code          || '',
      number_of_licence: company.number_of_licence || 1,
    });
  };

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openCreateModal = () => {
    setModalMode('create');
    setEditingCompany(null);
    resetFormData();
    resetImportState();
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
    resetImportState();
  };

  const resetImportState = () => {
    setImportStep('search');
    setImportCompanyId('');
    setImportFetchError('');
    setImportLicenseData(null);
  };

  // Switch toggle inside modal between 'create' and 'import'
  const switchModalTab = (tab) => {
    setModalMode(tab);
    resetFormData();
    resetImportState();
  };

  // ── Import existing company ────────────────────────────────────────────────

  const handleFetchExisting = async () => {
    const trimmedId = importCompanyId.trim();
    if (!trimmedId) {
      setImportFetchError('Please enter a Company ID.');
      return;
    }

    // ── Duplicate check: block if company_id already exists in our DB ──
    const duplicate = companies.find(
      c => String(c.company_id).toLowerCase() === trimmedId.toLowerCase()
    );
    if (duplicate) {
      setImportFetchError(
        `"${duplicate.company_name}" is already registered in this system with that Company ID.`
      );
      return;
    }

    setImportFetching(true);
    setImportFetchError('');
    try {
      const response = await api.get(`${BASE_URL}/get-company-by-company-id/${trimmedId}`);
      const data = response.data?.data;
      if (!data) {
        setImportFetchError('No company found with that ID.');
        return;
      }

      // License server doesn't return company details — form stays empty for user to fill.
      // Pre-fill only number_of_licence since the server is authoritative on that.
      if (data.number_of_licence) {
        setFormData(prev => ({ ...prev, number_of_licence: data.number_of_licence }));
      }

      // Store license info for the confirm step banner (display only)
      setImportLicenseData({
        product_from_date:     data.product_from_date     || null,
        product_to_date:       data.product_to_date       || null,
        authentication_status: data.authentication_status || null,
        is_expired:            data.is_expired            || false,
      });

      setImportStep('confirm');
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to fetch company data.';
      setImportFetchError(msg);
    } finally {
      setImportFetching(false);
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let response;
      if (modalMode === 'edit') {
        response = await api.put(`${BASE_URL}/update-company-details/${editingCompany.id}`, formData);
      } else if (modalMode === 'import') {
        // Backend re-fetches license data atomically and merges with form fields.
        // company_id identifies the license server record;
        // form fields supply company details the license server doesn't return.
        response = await api.post(`${BASE_URL}/import-company`, {
          company_id: importCompanyId,
          ...formData,
        });
      } else {
        response = await api.post(`${BASE_URL}/create-company`, formData);
      }

      if (response?.status === 200 || response?.status === 201) {
        window.alert(response.data.message || 'Operation successful!');
        closeModal();
        fetchCompanies();
      }
    } catch (err) {
      if (!err.response) { window.alert('Server unreachable. Please try again later.'); return; }
      const { status, data } = err.response;
      if (status === 400 && data.errors) {
        window.alert(Object.values(data.errors)[0]?.[0] || data.message);
      } else {
        window.alert(data?.message || 'Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── License actions ────────────────────────────────────────────────────────

  const handleRegisterLicense = async (companyId) => {
    setRegisteringLicense(prev => ({ ...prev, [companyId]: true }));
    try {
      const response = await api.post(`${BASE_URL}/register-company-license/${companyId}`);
      if (response.status === 200) {
        window.alert(response.data.message || 'Company registered successfully!');
        fetchCompanies();
      }
    } catch (err) {
      const { data } = err.response || {};
      window.alert(data?.message || data?.error || 'License registration failed');
    } finally {
      setRegisteringLicense(prev => ({ ...prev, [companyId]: false }));
    }
  };

  const handleValidateLicense = async (companyId) => {
    setValidatingLicense(prev => ({ ...prev, [companyId]: true }));
    try {
      const response = await api.post(`${BASE_URL}/validate-company-license/${companyId}`);
      if (response.status === 200) {
        window.alert(response.data.message || 'License validation started!');
        fetchCompanies();
      }
    } catch (err) {
      const { data } = err.response || {};
      window.alert(data?.message || data?.error || 'License validation failed');
    } finally {
      setValidatingLicense(prev => ({ ...prev, [companyId]: false }));
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const isLicenseExpired = (company) => {
    if (!company.product_to_date) return false;
    return new Date() > new Date(company.product_to_date);
  };

  const getModalTitle = () => {
    if (modalMode === 'view') return 'Company Details';
    if (modalMode === 'edit') return 'Edit Company';
    return 'Register Company';
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Approve':    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Pending':    return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Validating': return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'Expired':    return 'bg-red-100 text-red-700 border-red-200';
      case 'Block':      return 'bg-slate-100 text-slate-700 border-slate-200';
      default:           return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const isReadOnly = modalMode === 'view';

  // ── Shared form fields ─────────────────────────────────────────────────────

  const FormFields = () => (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Company Name <span className="text-red-500">*</span></label>
          <input type="text" name="company_name" value={formData.company_name} onChange={handleInputChange}
            required readOnly={isReadOnly}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Email <span className="text-red-500">*</span></label>
          <input type="email" name="company_email" value={formData.company_email} onChange={handleInputChange}
            required readOnly={isReadOnly}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">GST Number</label>
          <input type="text" name="gst_number" value={formData.gst_number} onChange={handleInputChange}
            readOnly={isReadOnly}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">No. of Licenses <span className="text-red-500">*</span></label>
          <input type="number" name="number_of_licence" value={formData.number_of_licence} onChange={handleInputChange}
            min="1" required readOnly={isReadOnly}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Contact Person <span className="text-red-500">*</span></label>
          <input type="text" name="contact_person" value={formData.contact_person} onChange={handleInputChange}
            required readOnly={isReadOnly}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Contact Number <span className="text-red-500">*</span></label>
          <input type="text" name="contact_number" value={formData.contact_number} onChange={handleInputChange}
            required readOnly={isReadOnly}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50" />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Address <span className="text-red-500">*</span></label>
        <textarea name="address" value={formData.address} onChange={handleInputChange}
          required rows="2" readOnly={isReadOnly}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Address 2 (Optional)</label>
        <textarea name="address_2" value={formData.address_2} onChange={handleInputChange}
          rows="2" readOnly={isReadOnly}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">City <span className="text-red-500">*</span></label>
          <input type="text" name="city" value={formData.city} onChange={handleInputChange}
            required readOnly={isReadOnly}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">State <span className="text-red-500">*</span></label>
          <input type="text" name="state" value={formData.state} onChange={handleInputChange}
            required readOnly={isReadOnly}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Zip Code <span className="text-red-500">*</span></label>
          <input type="text" name="zip_code" value={formData.zip_code} onChange={handleInputChange}
            required readOnly={isReadOnly}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50" />
        </div>
      </div>

      {/* Dealer licence allocation — only shown to dealer_admin on create */}
      {isDealerAdmin && (modalMode === 'create') && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Licence Allocation from your pool</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Total Licences <span className="text-red-500">*</span></label>
              <input type="number" name="number_of_licence" value={formData.number_of_licence} onChange={handleInputChange}
                min="0" required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">ETM Devices <span className="text-red-500">*</span></label>
              <input type="number" name="device_count" value={formData.device_count} onChange={handleInputChange}
                min="0" required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Android Devices <span className="text-red-500">*</span></label>
              <input type="number" name="mobile_device_count" value={formData.mobile_device_count} onChange={handleInputChange}
                min="0" required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all bg-white" />
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-100 mt-4">
        <button type="button" onClick={closeModal}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
          {isReadOnly ? 'Close' : 'Cancel'}
        </button>
        {!isReadOnly && (
          <button type="submit" disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-700 disabled:opacity-50 shadow-sm transition-all flex items-center gap-2">
            {submitting && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {submitting ? 'Saving...' : modalMode === 'edit' ? 'Update Company' : 'Save Company'}
          </button>
        )}
      </div>
    </form>
  );

  // ── License status banner for import confirm step ──────────────────────────
  const ImportLicenseBanner = () => {
    if (!importLicenseData) return null;
    const { product_to_date, authentication_status, is_expired: expired } = importLicenseData;
    const formattedDate = product_to_date
      ? new Date(product_to_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : null;

    if (expired) {
      return (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-medium text-amber-800">License expired{formattedDate ? ` on ${formattedDate}` : ''}</p>
            <p className="text-amber-600 text-xs mt-0.5">After saving, use the Validate License action in the table to renew.</p>
          </div>
        </div>
      );
    }

    if (authentication_status === 'Approve' && formattedDate) {
      return (
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 text-sm">
          <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-emerald-700">License active — valid till <strong>{formattedDate}</strong></p>
        </div>
      );
    }

    return null;
  };

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Company Management</h1>
          <p className="text-slate-500 mt-1">Manage client companies and license statuses</p>
        </div>
        <button onClick={openCreateModal}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 text-sm font-medium">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Register Company
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Licenses</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">License Action</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <TableSkeleton columns={['w-8', 'w-36', 'w-24', 'w-16', 'w-20', 'w-24', 'w-16']} />
              ) : companies.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-500">No companies found.</td></tr>
              ) : companies.map((company) => {
                const isPending       = company.authentication_status === 'Pending';
                const isValidating    = company.authentication_status === 'Validating';
                const hasCompanyId    = company.company_id !== null && company.company_id !== undefined;
                const isRegistering   = registeringLicense[company.id];
                const isValidatingReq = validatingLicense[company.id];
                const licenseExpired  = isLicenseExpired(company);

                return (
                  <tr key={company.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-500 font-mono">#{company.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{company.company_name}</span>
                        <span className="text-xs text-slate-500">{company.company_email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-base text-slate-600">{company.contact_person}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {company.number_of_licence || 0} {company.number_of_licence === 1 ? 'License' : 'Licenses'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${getStatusStyle(company.authentication_status)}`}>
                        {company.authentication_status || 'Pending'}
                      </span>
                      {company.authentication_status === 'Approve' && company.product_to_date && (
                        <div className={`text-xs mt-1 ${licenseExpired ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                          {licenseExpired ? 'Expired: ' : 'Valid till: '}
                          {new Date(company.product_to_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {!hasCompanyId ? (
                        <button onClick={() => handleRegisterLicense(company.id)} disabled={isRegistering}
                          className="text-xs font-medium bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition disabled:opacity-50">
                          {isRegistering ? 'Registering...' : 'Register Company'}
                        </button>
                      ) : isPending || licenseExpired ? (
                        <button onClick={() => handleValidateLicense(company.id)} disabled={isValidatingReq}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50 ${
                            licenseExpired
                              ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                              : 'bg-slate-900 hover:bg-slate-700 text-white'
                          }`}>
                          {isValidatingReq ? 'Starting...' : licenseExpired ? 'License Expired — Revalidate' : 'Validate License'}
                        </button>
                      ) : isValidating ? (
                        <span className="text-xs text-slate-500 font-medium animate-pulse">Validating...</span>
                      ) : (
                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center space-x-2">
                        <button onClick={() => openViewModal(company)}
                          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors" title="View">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button onClick={() => openEditModal(company)} disabled={isValidating}
                          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-30" title="Edit">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal ───────────────────────────────────────────────────────────── */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={getModalTitle()}>

        {/* Split toggle — only for create/import, not view/edit; import hidden for dealer_admin */}
        {(modalMode === 'create' || modalMode === 'import') && !isDealerAdmin && (
          <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 mb-5">
            <button type="button" onClick={() => switchModalTab('create')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                modalMode === 'create'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}>
              New Company
            </button>
            <button type="button" onClick={() => switchModalTab('import')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                modalMode === 'import'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}>
              Add Existing
            </button>
          </div>
        )}

        {/* ── New Company ── */}
        {modalMode === 'create' && <FormFields />}

        {/* ── View / Edit ── */}
        {(modalMode === 'view' || modalMode === 'edit') && <FormFields />}

        {/* ── Add Existing: Step 1 — Search ── */}
        {modalMode === 'import' && importStep === 'search' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Enter the <strong>Company ID</strong> from the license server. The company's details will be fetched and pre-filled for you to review before saving.
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Company ID <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={importCompanyId}
                  onChange={e => { setImportCompanyId(e.target.value); setImportFetchError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleFetchExisting(); }}
                  placeholder="e.g. COMP-001"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
                  autoFocus
                />
                <button type="button" onClick={handleFetchExisting} disabled={importFetching}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                  {importFetching ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Fetching...
                    </>
                  ) : 'Fetch'}
                </button>
              </div>
              {importFetchError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-1">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-700">{importFetchError}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button type="button" onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Add Existing: Step 2 — Confirm ── */}
        {modalMode === 'import' && importStep === 'confirm' && (
          <div className="space-y-4">
            {/* License status banner */}
            <ImportLicenseBanner />

            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Fetched for ID <strong className="text-slate-700">{importCompanyId}</strong> — review details below, then save.
              </p>
              <button type="button" onClick={() => { setImportStep('search'); resetFormData(); setImportLicenseData(null); }}
                className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2">
                ← Different ID
              </button>
            </div>

            <FormFields />
          </div>
        )}

      </Modal>
    </div>
  );
}

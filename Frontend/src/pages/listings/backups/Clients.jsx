import { useState, useEffect, useCallback } from 'react';
import Modal from '../../components/Modal';
import TableSkeleton from '../../components/TableSkeleton';
import api, { BASE_URL } from '../../assets/js/axiosConfig';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY_COMPANIES = 'clients_companies_cache';
const CACHE_KEY_DEALERS   = 'clients_dealers_cache';

function getCached(key) {
  try {
    const ts   = localStorage.getItem(`${key}_ts`);
    const data = localStorage.getItem(key);
    if (!ts || !data) return null;
    if (Date.now() - parseInt(ts) > CACHE_TTL) return null;
    return JSON.parse(data);
  } catch { return null; }
}
function setCache(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
  localStorage.setItem(`${key}_ts`, Date.now().toString());
}
function clearCache(key) {
  localStorage.removeItem(key);
  localStorage.removeItem(`${key}_ts`);
}

const EMPTY_FORM = {
  entity_name: '',
  entity_email: '',
  contact_person: '',
  contact_number: '',
  gst_number: '',
  address: '',
  address_2: '',
  city: '',
  state: '',
  zip_code: '',
  dealer_code: '',
  is_active: true,
  user_username: '',
  user_email: '',
  user_password: '',
};

export default function Clients() {
  const [activeTab, setActiveTab] = useState('companies');

  const [companies, setCompanies]           = useState([]);
  const [dealers, setDealers]               = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingDealers, setLoadingDealers]     = useState(true);

  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [modalMode, setModalMode]       = useState('create'); // 'create' | 'import' | 'view' | 'edit'
  const [clientType, setClientType]     = useState('company'); // 'company' | 'dealer'
  const [editingItem, setEditingItem]   = useState(null);
  const [submitting, setSubmitting]     = useState(false);

  // Import flow
  const [importStep, setImportStep]             = useState('search');
  const [importClientId, setImportClientId]     = useState('');
  const [importFetching, setImportFetching]     = useState(false);
  const [importFetchError, setImportFetchError] = useState('');
  const [importLicenseData, setImportLicenseData] = useState(null);

  // License action state (companies only)
  const [registeringLicense, setRegisteringLicense] = useState({});
  const [validatingLicense, setValidatingLicense]   = useState({});

  const [formData, setFormData] = useState(EMPTY_FORM);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchCompanies = useCallback(async (force = false) => {
    if (!force) {
      const cached = getCached(CACHE_KEY_COMPANIES);
      if (cached) { setCompanies(cached); setLoadingCompanies(false); return; }
    }
    setLoadingCompanies(true);
    try {
      const res = await api.get(`${BASE_URL}/customer-data`);
      const data = res.data?.data || [];
      setCompanies(data);
      setCache(CACHE_KEY_COMPANIES, data);
    } catch (err) {
      console.error('Error fetching companies:', err);
      setCompanies([]);
    } finally {
      setLoadingCompanies(false);
    }
  }, []);

  const fetchDealers = useCallback(async (force = false) => {
    if (!force) {
      const cached = getCached(CACHE_KEY_DEALERS);
      if (cached) { setDealers(cached); setLoadingDealers(false); return; }
    }
    setLoadingDealers(true);
    try {
      const res = await api.get(`${BASE_URL}/dealers`);
      const data = res.data?.data || [];
      setDealers(data);
      setCache(CACHE_KEY_DEALERS, data);
    } catch (err) {
      console.error('Error fetching dealers:', err);
      setDealers([]);
    } finally {
      setLoadingDealers(false);
    }
  }, []);

  useEffect(() => { fetchCompanies(); fetchDealers(); }, [fetchCompanies, fetchDealers]);

  // Auto-refresh every 5s while any company is Validating
  useEffect(() => {
    const hasValidating = companies.some(c => c.authentication_status === 'Validating');
    if (!hasValidating) return;
    const interval = setInterval(() => fetchCompanies(true), 5000);
    return () => clearInterval(interval);
  }, [companies, fetchCompanies]);

  const handleRefresh = () => {
    clearCache(CACHE_KEY_COMPANIES);
    clearCache(CACHE_KEY_DEALERS);
    fetchCompanies(true);
    fetchDealers(true);
  };

  const refreshAfterAction = () => {
    clearCache(CACHE_KEY_COMPANIES);
    clearCache(CACHE_KEY_DEALERS);
    fetchCompanies(true);
    fetchDealers(true);
  };

  // ── Form helpers ──────────────────────────────────────────────────────────

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const resetForm = () => setFormData(EMPTY_FORM);

  const populateFromCompany = (company) => {
    setFormData({
      ...EMPTY_FORM,
      entity_name:    company.company_name    || '',
      entity_email:   company.company_email   || '',
      contact_person: company.contact_person  || '',
      contact_number: company.contact_number  || '',
      gst_number:     company.gst_number      || '',
      address:        company.address         || '',
      address_2:      company.address_2       || '',
      city:           company.city            || '',
      state:          company.state           || '',
      zip_code:       company.zip_code        || '',
    });
  };

  const populateFromDealer = (dealer) => {
    setFormData({
      ...EMPTY_FORM,
      entity_name:    dealer.dealer_name    || '',
      entity_email:   dealer.email          || '',
      contact_person: dealer.contact_person || '',
      contact_number: dealer.contact_number || '',
      gst_number:     dealer.gst_number     || '',
      address:        dealer.address        || '',
      city:           dealer.city           || '',
      state:          dealer.state          || '',
      zip_code:       dealer.zip_code       || '',
      dealer_code:    dealer.dealer_code    || '',
      is_active:      dealer.is_active      ?? true,
    });
  };

  // ── Modal helpers ─────────────────────────────────────────────────────────

  const resetImportState = () => {
    setImportStep('search');
    setImportClientId('');
    setImportFetchError('');
    setImportLicenseData(null);
  };

  const openCreateModal = (type) => {
    setModalMode('create');
    setClientType(type);
    setEditingItem(null);
    resetForm();
    resetImportState();
    setIsModalOpen(true);
  };

  const openViewModal = (item, type) => {
    setModalMode('view');
    setClientType(type);
    setEditingItem(item);
    if (type === 'company') populateFromCompany(item);
    else populateFromDealer(item);
    setIsModalOpen(true);
  };

  const openEditModal = (item, type) => {
    setModalMode('edit');
    setClientType(type);
    setEditingItem(item);
    if (type === 'company') populateFromCompany(item);
    else populateFromDealer(item);
    setIsModalOpen(true);
  };

  const switchModalTab = (tab) => {
    setModalMode(tab);
    resetForm();
    resetImportState();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setModalMode('create');
    resetForm();
    resetImportState();
  };

  // ── Import flow ───────────────────────────────────────────────────────────

  const handleFetchExisting = async () => {
    const trimmedId = importClientId.trim();
    if (!trimmedId) { setImportFetchError('Please enter a Client ID.'); return; }

    const duplicate = companies.find(c => String(c.company_id).toLowerCase() === trimmedId.toLowerCase());
    if (duplicate) {
      setImportFetchError(`"${duplicate.company_name}" is already registered with that ID.`);
      return;
    }

    setImportFetching(true);
    setImportFetchError('');
    try {
      const res = await api.get(`${BASE_URL}/get-company-by-company-id/${trimmedId}`);
      const data = res.data?.data;
      if (!data) { setImportFetchError('No client found with that ID.'); return; }

      setImportLicenseData({
        product_from_date:     data.product_from_date     || null,
        product_to_date:       data.product_to_date       || null,
        authentication_status: data.authentication_status || null,
        is_expired:            data.is_expired            || false,
      });
      setImportStep('confirm');
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to fetch client data.';
      setImportFetchError(msg);
    } finally {
      setImportFetching(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const buildCompanyPayload = () => ({
    company_name:      formData.entity_name,
    company_email:     formData.entity_email,
    contact_person:    formData.contact_person,
    contact_number:    formData.contact_number,
    gst_number:        formData.gst_number,
    address:           formData.address,
    address_2:         formData.address_2,
    city:              formData.city,
    state:             formData.state,
    zip_code:          formData.zip_code,
    number_of_licence: 0,
    user_username:     formData.user_username,
    user_email:        formData.user_email,
    user_password:     formData.user_password,
  });

  const buildDealerPayload = () => ({
    dealer_name:    formData.entity_name,
    email:          formData.entity_email,
    dealer_code:    formData.dealer_code,
    contact_person: formData.contact_person,
    contact_number: formData.contact_number,
    gst_number:     formData.gst_number,
    address:        formData.address,
    city:           formData.city,
    state:          formData.state,
    zip_code:       formData.zip_code,
    is_active:      formData.is_active,
    user_username:  formData.user_username,
    user_email:     formData.user_email,
    user_password:  formData.user_password,
  });

  const buildDealerUpdatePayload = () => ({
    dealer_name:    formData.entity_name,
    email:          formData.entity_email,
    dealer_code:    formData.dealer_code,
    contact_person: formData.contact_person,
    contact_number: formData.contact_number,
    gst_number:     formData.gst_number,
    address:        formData.address,
    city:           formData.city,
    state:          formData.state,
    zip_code:       formData.zip_code,
    is_active:      formData.is_active,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let response;

      if (modalMode === 'edit') {
        if (clientType === 'company') {
          response = await api.put(`${BASE_URL}/update-company-details/${editingItem.id}`, {
            company_name:   formData.entity_name,
            company_email:  formData.entity_email,
            contact_person: formData.contact_person,
            contact_number: formData.contact_number,
            gst_number:     formData.gst_number,
            address:        formData.address,
            address_2:      formData.address_2,
            city:           formData.city,
            state:          formData.state,
            zip_code:       formData.zip_code,
          });
        } else {
          response = await api.put(`${BASE_URL}/update-dealer-details/${editingItem.id}`, buildDealerUpdatePayload());
        }
      } else if (modalMode === 'import') {
        if (clientType === 'dealer') {
          response = await api.post(`${BASE_URL}/create-dealer`, buildDealerPayload());
        } else {
          response = await api.post(`${BASE_URL}/import-company`, {
            company_id:     importClientId,
            company_name:   formData.entity_name,
            company_email:  formData.entity_email,
            contact_person: formData.contact_person,
            contact_number: formData.contact_number,
            gst_number:     formData.gst_number,
            address:        formData.address,
            address_2:      formData.address_2,
            city:           formData.city,
            state:          formData.state,
            zip_code:       formData.zip_code,
            user_username:  formData.user_username,
            user_email:     formData.user_email,
            user_password:  formData.user_password,
          });
        }
      } else {
        if (clientType === 'company') {
          response = await api.post(`${BASE_URL}/create-company`, buildCompanyPayload());
        } else {
          response = await api.post(`${BASE_URL}/create-dealer`, buildDealerPayload());
        }
      }

      if (response?.status === 200 || response?.status === 201) {
        window.alert(response.data.message || 'Operation successful!');
        closeModal();
        refreshAfterAction();
      }
    } catch (err) {
      if (!err.response) { window.alert('Server unreachable. Please try again later.'); return; }
      const { status, data } = err.response;
      if (status === 400 && data.errors) {
        window.alert(Object.values(data.errors)[0]?.[0] || data.message);
      } else {
        window.alert(data?.message || data?.error || 'Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── License actions ───────────────────────────────────────────────────────

  const handleRegisterLicense = async (companyId) => {
    setRegisteringLicense(prev => ({ ...prev, [companyId]: true }));
    try {
      const res = await api.post(`${BASE_URL}/register-company-license/${companyId}`);
      if (res.status === 200) { window.alert(res.data.message || 'Registered!'); refreshAfterAction(); }
    } catch (err) {
      window.alert(err.response?.data?.message || err.response?.data?.error || 'Registration failed');
    } finally {
      setRegisteringLicense(prev => ({ ...prev, [companyId]: false }));
    }
  };

  const handleValidateLicense = async (companyId) => {
    setValidatingLicense(prev => ({ ...prev, [companyId]: true }));
    try {
      const res = await api.post(`${BASE_URL}/validate-company-license/${companyId}`);
      if (res.status === 200) { window.alert(res.data.message || 'Validation started!'); refreshAfterAction(); }
    } catch (err) {
      window.alert(err.response?.data?.message || err.response?.data?.error || 'Validation failed');
    } finally {
      setValidatingLicense(prev => ({ ...prev, [companyId]: false }));
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const isLicenseExpired = (company) => {
    if (!company.product_to_date) return false;
    return new Date() > new Date(company.product_to_date);
  };

  const getStatusStyle = (s) => {
    switch (s) {
      case 'Approve':    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Pending':    return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Validating': return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'Expired':    return 'bg-red-100 text-red-700 border-red-200';
      case 'Block':      return 'bg-slate-100 text-slate-700 border-slate-200';
      default:           return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const isReadOnly = modalMode === 'view';
  const isCreate   = modalMode === 'create';

  const getModalTitle = () => {
    if (modalMode === 'view')   return clientType === 'dealer' ? 'Dealer Details' : 'Company Details';
    if (modalMode === 'edit')   return clientType === 'dealer' ? 'Edit Dealer'   : 'Edit Company';
    if (modalMode === 'import') return 'Add Existing Client';
    return 'Add Client';
  };

  // ── Shared form fields ────────────────────────────────────────────────────

  const FormFields = () => (
    <div className="space-y-4">
      {/* Type selector — only on create */}
      {isCreate && (
        <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
          {['company', 'dealer'].map(t => (
            <button key={t} type="button" onClick={() => setClientType(t)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all capitalize ${
                clientType === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Name <span className="text-red-500">*</span></label>
          <input type="text" name="entity_name" value={formData.entity_name} onChange={handleInputChange}
            required readOnly={isReadOnly}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Email <span className="text-red-500">*</span></label>
          <input type="email" name="entity_email" value={formData.entity_email} onChange={handleInputChange}
            required readOnly={isReadOnly}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">GST Number</label>
          <input type="text" name="gst_number" value={formData.gst_number} onChange={handleInputChange}
            readOnly={isReadOnly}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50" />
        </div>
        {clientType === 'dealer' && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Dealer Code <span className="text-red-500">*</span></label>
            <input type="text" name="dealer_code" value={formData.dealer_code} onChange={handleInputChange}
              required readOnly={isReadOnly}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50" />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Address <span className="text-red-500">*</span></label>
        <textarea name="address" value={formData.address} onChange={handleInputChange}
          required rows="2" readOnly={isReadOnly}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50" />
      </div>

      {clientType === 'company' && (
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Address 2</label>
          <textarea name="address_2" value={formData.address_2} onChange={handleInputChange}
            rows="2" readOnly={isReadOnly}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50" />
        </div>
      )}

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

      {/* Dealer-specific: active toggle */}
      {clientType === 'dealer' && !isReadOnly && (
        <div className="flex items-center gap-2">
          <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleInputChange} className="rounded" />
          <label className="text-sm text-slate-700">Active</label>
        </div>
      )}

      {/* User account — only on create */}
      {isCreate && (
        <div className="border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">
            {clientType === 'dealer' ? 'Dealer Admin Account' : 'Company Admin Account'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Username <span className="text-red-500">*</span></label>
              <input type="text" name="user_username" value={formData.user_username} onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">User Email <span className="text-red-500">*</span></label>
              <input type="email" name="user_email" value={formData.user_email} onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Password <span className="text-red-500">*</span></label>
              <input type="password" name="user_password" value={formData.user_password} onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500" />
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
        <button type="button" onClick={closeModal}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
          {isReadOnly ? 'Close' : 'Cancel'}
        </button>
        {!isReadOnly && (
          <button type="submit" disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-700 disabled:opacity-50 shadow-sm flex items-center gap-2">
            {submitting && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {submitting ? 'Saving...' : modalMode === 'edit' ? 'Update' : 'Save'}
          </button>
        )}
      </div>
    </div>
  );

  // ── License banner (import confirm step) ─────────────────────────────────

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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-medium text-amber-800">License expired{formattedDate ? ` on ${formattedDate}` : ''}</p>
            <p className="text-amber-600 text-xs mt-0.5">After saving, use the Validate License action to renew.</p>
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

  // ── Tables ────────────────────────────────────────────────────────────────

  const CompaniesTable = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Company</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Devices</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">License</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loadingCompanies ? (
              <TableSkeleton columns={['w-8', 'w-36', 'w-24', 'w-20', 'w-20', 'w-24', 'w-16']} />
            ) : companies.length === 0 ? (
              <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-500">No companies found.</td></tr>
            ) : companies.map(company => {
              const isPending      = company.authentication_status === 'Pending';
              const isValidating   = company.authentication_status === 'Validating';
              const hasCompanyId   = company.company_id != null;
              const licenseExpired = isLicenseExpired(company);

              return (
                <tr key={company.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-500 font-mono">#{company.id}</td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800 text-sm">{company.company_name}</div>
                    <div className="text-xs text-slate-500">{company.company_email}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{company.contact_person}</td>
                  <td className="px-6 py-4 text-xs text-slate-600 space-y-0.5">
                    <div>ETM: <span className="font-semibold">{company.device_count ?? 0}</span></div>
                    <div>Android: <span className="font-semibold">{company.mobile_device_count ?? 0}</span></div>
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
                      <button onClick={() => handleRegisterLicense(company.id)} disabled={registeringLicense[company.id]}
                        className="text-xs font-medium bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition disabled:opacity-50">
                        {registeringLicense[company.id] ? 'Registering...' : 'Register'}
                      </button>
                    ) : isPending || licenseExpired ? (
                      <button onClick={() => handleValidateLicense(company.id)} disabled={validatingLicense[company.id]}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50 ${
                          licenseExpired ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' : 'bg-slate-900 hover:bg-slate-700 text-white'
                        }`}>
                        {validatingLicense[company.id] ? 'Starting...' : licenseExpired ? 'Revalidate' : 'Validate'}
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
                    <div className="flex justify-end items-center gap-2">
                      <button onClick={() => openViewModal(company, 'company')}
                        className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors" title="View">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button onClick={() => openEditModal(company, 'company')} disabled={isValidating}
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
  );

  const DealersTable = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dealer</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Licences</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loadingDealers ? (
              <TableSkeleton columns={['w-16', 'w-32', 'w-24', 'w-36', 'w-16', 'w-16']} />
            ) : dealers.length === 0 ? (
              <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">No dealers found.</td></tr>
            ) : dealers.map(dealer => (
              <tr key={dealer.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm text-slate-700 font-semibold">{dealer.dealer_code}</td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-slate-800">{dealer.dealer_name}</div>
                  <div className="text-xs text-slate-500">{dealer.email}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{dealer.contact_number}</td>
                <td className="px-6 py-4 text-sm text-slate-700 font-semibold">
                  {dealer.number_of_licence ?? 0}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${dealer.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {dealer.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => openEditModal(dealer, 'dealer')}
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors" title="Edit">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Clients</h1>
          <p className="text-slate-500 mt-1">Manage companies and dealers</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button onClick={() => openCreateModal(activeTab === 'dealers' ? 'dealer' : 'company')}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg text-sm font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Client
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b border-slate-200">
        {[
          { key: 'companies', label: 'Companies' },
          { key: 'dealers',   label: 'Dealers'   },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'companies' && <CompaniesTable />}
      {activeTab === 'dealers'   && <DealersTable />}

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={getModalTitle()}>

        {/* New / Existing toggle — only for create/import */}
        {(modalMode === 'create' || modalMode === 'import') && (
          <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 mb-5">
            <button type="button" onClick={() => switchModalTab('create')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                modalMode === 'create' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              New Client
            </button>
            <button type="button" onClick={() => switchModalTab('import')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                modalMode === 'import' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              Existing Client
            </button>
          </div>
        )}

        {/* Create / View / Edit */}
        {(modalMode === 'create' || modalMode === 'view' || modalMode === 'edit') && (
          <form onSubmit={handleSubmit}>
            <FormFields />
          </form>
        )}

        {/* Import step 1 — Search */}
        {modalMode === 'import' && importStep === 'search' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Enter the <strong>Client ID</strong> from the license server to fetch and pre-fill the details.
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Client ID <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input type="text" value={importClientId}
                  onChange={e => { setImportClientId(e.target.value); setImportFetchError(''); }}
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

        {/* Import step 2 — Confirm */}
        {modalMode === 'import' && importStep === 'confirm' && (
          <div className="space-y-4">
            <ImportLicenseBanner />
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Fetched for ID <strong className="text-slate-700">{importClientId}</strong> — fill details below, then save.
              </p>
              <button type="button"
                onClick={() => { setImportStep('search'); resetForm(); setImportLicenseData(null); }}
                className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2">
                ← Different ID
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <FormFields />
            </form>
          </div>
        )}

      </Modal>
    </div>
  );
}

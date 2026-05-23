import { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from '../../components/Modal';
import TableSkeleton from '../../components/TableSkeleton';
import api, { BASE_URL } from '../../assets/js/axiosConfig';
import statesDistricts from '../../assets/json/indiaStatesDistricts.json';
import {
  Building2, CheckCircle2, CircleDot, Search,
  Phone, MapPin, IdCard, ArrowLeft, AlertCircle,
  Download, Plus, Mail, KeyRound, User, Sparkles,
  Eye, Edit, X,
} from 'lucide-react';

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionCard({ step, active = true, complete, title, subtitle, children }) {
  return (
    <div className={`rounded-2xl border mb-4 transition-all duration-200 ${
      complete ? 'border-emerald-200 bg-white' :
      active ? 'border-slate-200 bg-white shadow-sm' :
      'border-slate-200 bg-slate-50/60'
    }`}>
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          complete ? 'bg-emerald-500 text-white' :
          active ? 'bg-slate-900 text-white' :
          'bg-slate-200 text-slate-400'
        }`}>
          {complete ? <CheckCircle2 size={14} color="#fff" /> : step}
        </div>
        <div>
          <p className={`font-semibold text-sm ${active || complete ? 'text-slate-900' : 'text-slate-400'}`}>{title}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className={`px-6 py-5 ${!active && !complete ? 'opacity-40 pointer-events-none select-none' : ''}`}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, required, hint, span, children }) {
  return (
    <div className={span === 2 ? 'md:col-span-2' : ''}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        {hint && <span className="ml-1 text-xs text-slate-400 font-normal">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all bg-white placeholder:text-slate-400';

function CompanyPreview({ form, isImport }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Listing Preview</p>
        <p className="text-sm text-slate-600 mt-0.5">How this will appear in the directory</p>
      </div>
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            {form.company_name
              ? <span className="text-base font-bold text-slate-700">{form.company_name.slice(0, 2).toUpperCase()}</span>
              : <Building2 size={18} className="text-slate-300" />}
          </div>
          <div className="min-w-0">
            <p className={`font-semibold truncate ${form.company_name ? 'text-slate-900' : 'text-slate-300 italic'}`}>
              {form.company_name || 'Company name…'}
            </p>
            <p className="text-xs text-slate-500 truncate">{form.company_email || 'email@example.com'}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pending
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <Phone size={11} /><span>{form.contact_number ? `+91 ${form.contact_number}` : '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <IdCard size={11} /><span>{form.contact_person || '—'}</span>
          </div>
          <div className="flex items-start gap-2 text-slate-500">
            <MapPin size={11} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">
              {[form.address, form.city, form.district, form.state, form.zip_code].filter(Boolean).join(', ') || '—'}
            </span>
          </div>
        </div>
        {isImport && (
          <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-100 p-3 flex items-start gap-2">
            <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-emerald-700">License pre-validated by remote server.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChecklistCard({ items }) {
  const done = items.filter(i => i.done).length;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Progress</p>
          <p className="text-sm text-slate-700 font-semibold mt-0.5">{done} of {items.length} complete</p>
        </div>
        <div className="relative h-10 w-10">
          <svg className="absolute inset-0" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#e2e8f0" strokeWidth="3" />
            <circle cx="18" cy="18" r="15" fill="none" stroke="#0f172a" strokeWidth="3"
              strokeDasharray={`${(done / items.length) * 94.2} 94.2`}
              strokeDashoffset="0" transform="rotate(-90 18 18)" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700">
            {Math.round((done / items.length) * 100)}%
          </div>
        </div>
      </div>
      <ul className="px-5 py-4 space-y-2">
        {items.map(item => (
          <li key={item.label} className={`flex items-center gap-2 text-sm ${item.done ? 'text-slate-700' : 'text-slate-400'}`}>
            {item.done
              ? <CheckCircle2 size={14} className="text-emerald-500" />
              : <CircleDot size={14} className="text-slate-300" />}
            <span className={item.done ? 'line-through decoration-slate-300' : ''}>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TipCard() {
  return (
    <div className="rounded-2xl bg-slate-900 text-white p-5 relative overflow-hidden">
      <div className="absolute -right-4 -top-4 opacity-10">
        <Sparkles size={80} color="#fff" />
      </div>
      <p className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Tip</p>
      <p className="text-sm mt-1.5 leading-relaxed text-white/90">
        After saving, use <span className="text-white font-semibold">License Action</span> in the directory to register with the license server.
      </p>
    </div>
  );
}

function ModalWrapper({ open, onClose, title, icon: Icon, width = 'max-w-2xl', children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${width} max-h-[88vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2 text-slate-800">
            {Icon && <Icon size={16} className="text-slate-600" />}
            <h3 className="font-semibold text-slate-900">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── EMPTY form ─────────────────────────────────────────────────────────────────
const EMPTY = {
  company_name: '', company_email: '', gst_number: '',
  contact_person: '', contact_number: '',
  address: '', address_2: '', city: '', state: '', district: '', zip_code: '',
  is_active: true,
  user_username: '', user_email: '', user_password: '',
};

// ── Helper ─────────────────────────────────────────────────────────────────────
function getStatusStyle(s) {
  switch (s) {
    case 'Approve':    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'Pending':    return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'Validating': return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'Expired':    return 'bg-red-100 text-red-700 border-red-200';
    default:           return 'bg-slate-50 text-slate-600 border-slate-200';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
export default function CompanyListing() {
  // ── List state ───────────────────────────────────────────────────────────
  const [companies, setCompanies]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [registeringLicense, setRegisteringLicense] = useState({});
  const [validatingLicense,  setValidatingLicense]  = useState({});
  const [search, setSearch]           = useState('');

  // ── Page view: 'list' | 'create' ────────────────────────────────────────
  const [pageView, setPageView] = useState('list');

  // ── Create form state ────────────────────────────────────────────────────
  const [createMode,    setCreateMode]    = useState('new');  // 'new' | 'import'
  const [importStep,    setImportStep]    = useState('search');
  const [importId,      setImportId]      = useState('');
  const [importFetching,setImportFetching]= useState(false);
  const [importError,   setImportError]   = useState('');
  const [importLicense, setImportLicense] = useState(null);
  const [form,          setForm]          = useState(EMPTY);
  const [submitting,    setSubmitting]    = useState(false);

  // ── Modal state (view / edit) ────────────────────────────────────────────
  const [modal,         setModal]         = useState(null);  // null | 'view' | 'edit'
  const [editingItem,   setEditingItem]   = useState(null);
  const [modalForm,     setModalForm]     = useState(EMPTY);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`${BASE_URL}/customer-data`);
      setCompanies(res.data?.data || []);
    } catch { setCompanies([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  useEffect(() => {
    const hasValidating = companies.some(c => c.authentication_status === 'Validating');
    if (!hasValidating) return;
    const id = setInterval(fetchCompanies, 5000);
    return () => clearInterval(id);
  }, [companies, fetchCompanies]);

  // ── Form helpers ─────────────────────────────────────────────────────────
  const set = (k, v) => setForm(f => k === 'state' ? { ...f, state: v, district: '' } : { ...f, [k]: v });

  const resetCreate = () => {
    setForm(EMPTY);
    setCreateMode('new');
    setImportStep('search');
    setImportId('');
    setImportError('');
    setImportLicense(null);
  };

  // ── Create form completeness ──────────────────────────────────────────────
  const sec1 = !!(form.company_name && form.company_email && form.contact_person && form.contact_number);
  const sec2 = !!(form.address && form.state && form.district && form.city && form.zip_code);
  const sec3 = !!(form.user_username && form.user_email && form.user_password);
  const canSubmit = sec1 && sec2 && sec3;

  // ── Import fetch ─────────────────────────────────────────────────────────
  const handleFetchImport = async () => {
    const id = importId.trim();
    if (!id) { setImportError('Please enter a Company ID.'); return; }
    const dup = companies.find(c => String(c.company_id).toLowerCase() === id.toLowerCase());
    if (dup) { setImportError(`"${dup.company_name}" is already registered with that ID.`); return; }
    setImportFetching(true);
    setImportError('');
    try {
      const res = await api.get(`${BASE_URL}/get-company-by-company-id/${id}`);
      const data = res.data?.data;
      if (!data) { setImportError('No company found with that ID.'); return; }
      setImportLicense({
        product_to_date:       data.product_to_date       || null,
        authentication_status: data.authentication_status || null,
        is_expired:            data.is_expired            || false,
      });
      setImportStep('confirm');
    } catch (err) {
      setImportError(err.response?.data?.message || err.response?.data?.error || 'Failed to fetch company data.');
    } finally { setImportFetching(false); }
  };

  // ── Create submit ────────────────────────────────────────────────────────
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    const payload = {
      company_name: form.company_name, company_email: form.company_email,
      contact_person: form.contact_person, contact_number: form.contact_number,
      gst_number: form.gst_number, address: form.address, address_2: form.address_2,
      city: form.city, state: form.state, district: form.district, zip_code: form.zip_code,
      user_username: form.user_username, user_email: form.user_email, user_password: form.user_password,
    };
    try {
      let res;
      if (createMode === 'import') {
        res = await api.post(`${BASE_URL}/import-company`, { company_id: importId, ...payload });
      } else {
        res = await api.post(`${BASE_URL}/create-company`, payload);
      }
      if (res?.status === 200 || res?.status === 201) {
        window.alert(res.data.message || 'Company registered successfully!');
        setPageView('list');
        resetCreate();
        fetchCompanies();
      }
    } catch (err) {
      const { status, data } = err.response || {};
      if (status === 400 && data?.errors) {
        window.alert(Object.values(data.errors)[0]?.[0] || data.message);
      } else {
        window.alert(data?.message || 'Something went wrong.');
      }
    } finally { setSubmitting(false); }
  };

  // ── License actions ──────────────────────────────────────────────────────
  const handleRegisterLicense = async (companyId) => {
    setRegisteringLicense(p => ({ ...p, [companyId]: true }));
    try {
      const res = await api.post(`${BASE_URL}/register-company-license/${companyId}`);
      if (res.status === 200) { window.alert(res.data.message || 'Registered!'); fetchCompanies(); }
    } catch (err) {
      window.alert(err.response?.data?.message || err.response?.data?.error || 'Registration failed.');
    } finally { setRegisteringLicense(p => ({ ...p, [companyId]: false })); }
  };

  const handleValidateLicense = async (companyId) => {
    setValidatingLicense(p => ({ ...p, [companyId]: true }));
    try {
      const res = await api.post(`${BASE_URL}/validate-company-license/${companyId}`);
      if (res.status === 200) { window.alert(res.data.message || 'Validation started!'); fetchCompanies(); }
    } catch (err) {
      window.alert(err.response?.data?.message || err.response?.data?.error || 'Validation failed.');
    } finally { setValidatingLicense(p => ({ ...p, [companyId]: false })); }
  };

  // ── Edit / View modal ────────────────────────────────────────────────────
  const openView = (company) => {
    setModalForm({
      company_name: company.company_name || '', company_email: company.company_email || '',
      gst_number: company.gst_number || '', contact_person: company.contact_person || '',
      contact_number: company.contact_number || '', address: company.address || '',
      address_2: company.address_2 || '', city: company.city || '',
      state: company.state || '', district: company.district || '',
      zip_code: company.zip_code || '', is_active: company.is_active ?? true,
    });
    setEditingItem(company);
    setModal('view');
  };

  const openEdit = (company) => {
    openView(company);
    setModal('edit');
  };

  const handleModalInputChange = (e) => {
    const { name, value } = e.target;
    setModalForm(f => name === 'state' ? { ...f, state: value, district: '' } : { ...f, [name]: value });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setModalSubmitting(true);
    try {
      const res = await api.put(`${BASE_URL}/update-company-details/${editingItem.id}`, {
        company_name: modalForm.company_name, company_email: modalForm.company_email,
        contact_person: modalForm.contact_person, contact_number: modalForm.contact_number,
        gst_number: modalForm.gst_number, address: modalForm.address, address_2: modalForm.address_2,
        city: modalForm.city, state: modalForm.state, district: modalForm.district, zip_code: modalForm.zip_code,
        is_active: modalForm.is_active,
      });
      if (res?.status === 200 || res?.status === 201) {
        window.alert(res.data.message || 'Company updated!');
        setModal(null);
        fetchCompanies();
      }
    } catch (err) {
      const { status, data } = err.response || {};
      if (status === 400 && data?.errors) {
        window.alert(Object.values(data.errors)[0]?.[0] || data.message);
      } else {
        window.alert(data?.message || 'Something went wrong.');
      }
    } finally { setModalSubmitting(false); }
  };

  const isExpired = (c) => c.product_to_date && new Date() > new Date(c.product_to_date);

  const filteredCompanies = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.toLowerCase();
    return companies.filter(c =>
      c.company_name?.toLowerCase().includes(q) ||
      c.company_email?.toLowerCase().includes(q) ||
      c.contact_person?.toLowerCase().includes(q)
    );
  }, [companies, search]);

  // ══════════════════════════════════════════════════════════════════════════
  // ── LIST VIEW ──────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (pageView === 'list') {
    return (
      <div className="p-6 md:p-8 min-h-screen bg-slate-50">

        {/* Header */}
        <div className="mb-6">
          <p className="text-xs text-slate-400 mb-3">Administration <span className="mx-1">›</span> <span className="text-slate-600 font-medium">Companies</span></p>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-md">
                <Building2 size={18} color="#fff" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Companies</h1>
                <p className="text-sm text-slate-500 mt-0.5">{companies.length} companies registered</p>
              </div>
            </div>
            <button
              onClick={() => { resetCreate(); setPageView('create'); }}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-sm rounded-lg font-medium bg-slate-900 hover:bg-slate-700 text-white cursor-pointer transition-colors shadow-sm"
            >
              <Plus size={14} /> Register Company
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm max-w-sm w-full">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search companies…"
              className="flex-1 text-sm bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
            />
          </div>
          <span className="text-xs text-slate-400 tabular-nums shrink-0">
            {filteredCompanies.length} result{filteredCompanies.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Company</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Licenses</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">License Action</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <TableSkeleton columns={['w-40', 'w-28', 'w-16', 'w-20', 'w-24', 'w-16']} />
                ) : filteredCompanies.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-10 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Building2 size={20} className="text-slate-300" />
                        <p className="text-sm text-slate-400">{search ? 'No companies match your search' : 'No companies found'}</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredCompanies.map(company => {
                  const isPending    = company.authentication_status === 'Pending';
                  const isValidating = company.authentication_status === 'Validating';
                  const hasCompanyId = company.company_id != null;
                  const registering  = registeringLicense[company.id];
                  const validating   = validatingLicense[company.id];
                  const expired      = isExpired(company);
                  const initials     = (company.company_name || '??').slice(0, 2).toUpperCase();

                  return (
                    <tr key={company.id} className="group hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <span className="text-[11px] font-bold text-slate-600">{initials}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{company.company_name}</p>
                            <p className="text-xs text-slate-500 truncate leading-tight">{company.company_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <IdCard size={12} className="text-slate-400 shrink-0" />
                          <span className="text-sm text-slate-600 truncate">{company.contact_person}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {company.number_of_licence || 0} {company.number_of_licence === 1 ? 'seat' : 'seats'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border w-fit ${
                            company.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${company.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {company.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border w-fit ${getStatusStyle(company.authentication_status)}`}>
                            {company.authentication_status || 'Pending'}
                          </span>
                          {company.authentication_status === 'Approve' && company.product_to_date && (
                            <p className={`text-[10px] ${expired ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                              {expired ? 'Expired ' : 'Valid till '}
                              {new Date(company.product_to_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {!hasCompanyId ? (
                          <button onClick={() => handleRegisterLicense(company.id)} disabled={registering}
                            className="text-[11px] font-medium bg-slate-900 text-white px-2.5 py-1 rounded-md hover:bg-slate-700 transition disabled:opacity-50 cursor-pointer">
                            {registering ? 'Registering…' : 'Register'}
                          </button>
                        ) : isPending || expired ? (
                          <button onClick={() => handleValidateLicense(company.id)} disabled={validating}
                            className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition disabled:opacity-50 cursor-pointer ${
                              expired ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-900 hover:bg-slate-700 text-white'
                            }`}>
                            {validating ? 'Starting…' : expired ? 'Revalidate' : 'Validate'}
                          </button>
                        ) : isValidating ? (
                          <span className="text-[11px] text-slate-400 animate-pulse">Validating…</span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                            <CheckCircle2 size={12} /> Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openView(company)} title="View"
                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors">
                            <Eye size={14} />
                          </button>
                          <button onClick={() => openEdit(company)} disabled={isValidating} title="Edit"
                            className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors disabled:opacity-30">
                            <Edit size={14} />
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

        {/* View Modal */}
        <ModalWrapper open={modal === 'view'} onClose={() => setModal(null)} title="Company Details" icon={Building2}>
          {editingItem && (() => {
            const c = editingItem;
            const initials = (c.company_name || '??').slice(0, 2).toUpperCase();
            const expired = isExpired(c);
            return (
              <div className="space-y-5">
                {/* Identity card */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="h-14 w-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                    <span className="text-xl font-bold text-slate-700">{initials}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-lg font-bold text-slate-900">{c.company_name}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${
                        c.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${getStatusStyle(c.authentication_status)}`}>
                        {c.authentication_status || 'Pending'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{c.company_email}</p>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Contact Person', value: c.contact_person },
                    { label: 'Contact Number', value: c.contact_number ? `+91 ${c.contact_number}` : '—' },
                    { label: 'GST Number',      value: c.gst_number || '—' },
                    { label: 'Licenses',         value: `${c.number_of_licence || 0} seats` },
                    { label: 'Valid Till',        value: c.product_to_date ? new Date(c.product_to_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
                    { label: 'Company ID',        value: c.company_id ? `#${c.company_id}` : 'Not registered' },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
                      <p className="text-sm font-medium mt-0.5 text-slate-800 break-all">{value ?? '—'}</p>
                    </div>
                  ))}
                </div>

                {/* Address */}
                {(c.address || c.city || c.state) && (
                  <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Address</p>
                    <div className="flex items-start gap-1.5 text-sm text-slate-700">
                      <MapPin size={13} className="text-slate-400 mt-0.5 shrink-0" />
                      <span>{[c.address, c.address_2, c.city, c.district, c.state, c.zip_code].filter(Boolean).join(', ')}</span>
                    </div>
                  </div>
                )}

                {expired && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-xs text-red-700">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    License expired on {new Date(c.product_to_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button onClick={() => { setModal(null); setTimeout(() => openEdit(c), 100); }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm rounded-lg font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
                    <Edit size={14} /> Edit
                  </button>
                  <button onClick={() => setModal(null)}
                    className="flex-1 inline-flex items-center justify-center h-9 px-4 text-sm rounded-lg font-medium bg-slate-900 text-white hover:bg-slate-700 cursor-pointer transition-colors">
                    Close
                  </button>
                </div>
              </div>
            );
          })()}
        </ModalWrapper>

        {/* Edit Modal */}
        <ModalWrapper open={modal === 'edit'} onClose={() => setModal(null)} title="Edit Company" icon={Edit}>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Company Name',   name: 'company_name',   required: true },
                { label: 'Email',          name: 'company_email',  type: 'email', required: true },
                { label: 'Contact Person', name: 'contact_person', required: true },
                { label: 'Contact Number', name: 'contact_number', required: true },
                { label: 'GST Number',     name: 'gst_number' },
              ].map(f => (
                <div key={f.name} className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  <input type={f.type || 'text'} name={f.name} value={modalForm[f.name] || ''} onChange={handleModalInputChange}
                    required={f.required}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white" />
                </div>
              ))}
            </div>

            {[{ label: 'Address Line 1', name: 'address', required: true }, { label: 'Address Line 2', name: 'address_2', hint: 'Optional' }].map(f => (
              <div key={f.name} className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                  {f.hint && <span className="ml-1 text-xs text-slate-400 font-normal">— {f.hint}</span>}
                </label>
                <textarea name={f.name} value={modalForm[f.name] || ''} onChange={handleModalInputChange}
                  rows={2} required={f.required}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white" />
              </div>
            ))}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">State <span className="text-red-500">*</span></label>
                <select name="state" value={modalForm.state} onChange={handleModalInputChange} required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white">
                  <option value="">Select state…</option>
                  {Object.keys(statesDistricts).sort().map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">District <span className="text-red-500">*</span></label>
                <select name="district" value={modalForm.district} onChange={handleModalInputChange} required
                  disabled={!modalForm.state}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white disabled:bg-slate-50">
                  <option value="">Select district…</option>
                  {(statesDistricts[modalForm.state] || []).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              {[{ label: 'City', name: 'city', required: true }, { label: 'Zip Code', name: 'zip_code', required: true }].map(f => (
                <div key={f.name} className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{f.label}<span className="text-red-500 ml-0.5">*</span></label>
                  <input type="text" name={f.name} value={modalForm[f.name] || ''} onChange={handleModalInputChange} required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white" />
                </div>
              ))}
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <div onClick={() => setModalForm(f => ({ ...f, is_active: !f.is_active }))}
                className={`relative w-10 h-[22px] rounded-full transition-colors cursor-pointer ${modalForm.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${modalForm.is_active ? 'translate-x-[18px]' : ''}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Company Status</p>
                <p className="text-xs text-slate-500">{modalForm.is_active ? 'Active — users can log in' : 'Inactive — all company users blocked'}</p>
              </div>
            </label>

            <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
              <button type="button" onClick={() => setModal(null)}
                className="flex-1 inline-flex items-center justify-center h-9 px-4 text-sm rounded-lg font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={modalSubmitting}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm rounded-lg font-medium bg-slate-900 hover:bg-slate-700 text-white cursor-pointer transition-colors shadow-sm disabled:opacity-50">
                {modalSubmitting
                  ? <><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Saving…</>
                  : 'Update Company'}
              </button>
            </div>
          </form>
        </ModalWrapper>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── CREATE VIEW ────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-6 md:p-8 min-h-screen bg-slate-50">

      {/* Header */}
      <div className="mb-6">
        <p className="text-xs text-slate-400 mb-3">Administration <span className="mx-1">›</span> Companies <span className="mx-1">›</span> <span className="text-slate-600 font-medium">Register Company</span></p>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-md">
              <Building2 size={18} color="#fff" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Register Company</h1>
              <p className="text-sm text-slate-500 mt-0.5">Create a new client company or import one from the license server</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => { setPageView('list'); resetCreate(); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors">
              <ArrowLeft size={14} /> Cancel
            </button>
            <button onClick={handleCreateSubmit} disabled={!canSubmit || submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-xl hover:bg-slate-700 disabled:opacity-40 transition-all shadow-sm">
              {submitting
                ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Saving…</>
                : <>Save Company</>}
            </button>
          </div>
        </div>
      </div>

      {/* Mode switch */}
      <div className="mb-6 inline-flex rounded-xl border border-slate-200 p-1 bg-white shadow-sm">
        <button onClick={() => { setCreateMode('new'); setImportStep('search'); setImportId(''); setImportError(''); setImportLicense(null); }}
          className={`px-5 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer flex items-center gap-2 ${createMode === 'new' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
          <Plus size={13} /> Register New
        </button>
        <button onClick={() => setCreateMode('import')}
          className={`px-5 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer flex items-center gap-2 ${createMode === 'import' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
          <Download size={13} /> Import Existing
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Form ─────────────────────────────────────────────── */}
        <div className="lg:col-span-2">

          {/* Import search step */}
          {createMode === 'import' && importStep === 'search' && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm mb-4">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center">
                  <Search size={14} color="#fff" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-900">Find on License Server</p>
                  <p className="text-xs text-slate-500 mt-0.5">Enter the Company ID to fetch license details before saving</p>
                </div>
              </div>
              <div className="px-6 py-5 space-y-3">
                <Field label="Company ID" required>
                  <div className="flex gap-2">
                    <input value={importId} onChange={e => { setImportId(e.target.value); setImportError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleFetchImport()}
                      placeholder="e.g. COMP-001" className={inputCls} autoFocus />
                    <button type="button" onClick={handleFetchImport} disabled={importFetching}
                      className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center gap-2 whitespace-nowrap">
                      {importFetching
                        ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Fetching…</>
                        : <><Search size={13} /> Fetch</>}
                    </button>
                  </div>
                </Field>
                {importError && (
                  <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                    <AlertCircle size={14} className="text-rose-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-rose-700">{importError}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Import confirm banner */}
          {createMode === 'import' && importStep === 'confirm' && importLicense && (
            <div className="rounded-2xl border border-emerald-200 bg-white mb-4 overflow-hidden">
              <div className="p-4 bg-emerald-50 flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 size={16} color="#fff" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-emerald-800">License found for <span className="font-mono">{importId}</span></p>
                  {importLicense.product_to_date && (
                    <p className="text-xs text-emerald-700 mt-0.5">
                      {importLicense.is_expired ? 'Expired on ' : 'Valid until '}
                      <strong>{new Date(importLicense.product_to_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                    </p>
                  )}
                </div>
                <button onClick={() => { setImportStep('search'); setImportLicense(null); }}
                  className="text-xs text-emerald-700 hover:text-emerald-900 underline underline-offset-2 cursor-pointer whitespace-nowrap">
                  ← Different ID
                </button>
              </div>
            </div>
          )}

          {/* Form steps — shown for 'new' mode OR after import confirm */}
          {(createMode === 'new' || (createMode === 'import' && importStep === 'confirm')) && (
            <form onSubmit={handleCreateSubmit}>
              {/* Step 1: Company Identity */}
              <SectionCard step={1} active complete={sec1} title="Company Identity" subtitle="Core details used to identify and contact this client.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Company Name" required>
                    <input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Acme Transport Pvt Ltd" className={inputCls} />
                  </Field>
                  <Field label="Company Email" required>
                    <input type="email" value={form.company_email} onChange={e => set('company_email', e.target.value)} placeholder="ops@acme.in" className={inputCls} />
                  </Field>
                  <Field label="Contact Person" required>
                    <input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Jane Doe" className={inputCls} />
                  </Field>
                  <Field label="Contact Number" required hint="10-digit mobile">
                    <div className="flex gap-0">
                      <span className="inline-flex items-center px-3 text-sm text-slate-500 bg-slate-50 border border-r-0 border-slate-300 rounded-l-lg">+91</span>
                      <input value={form.contact_number} onChange={e => set('contact_number', e.target.value)} placeholder="98XXXXXX21"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white" />
                    </div>
                  </Field>
                  <Field label="GST Number" hint="Optional" span={2}>
                    <input value={form.gst_number} onChange={e => set('gst_number', e.target.value)} placeholder="29ABCDE1234F1Z5" className={inputCls} />
                  </Field>
                </div>
              </SectionCard>

              {/* Step 2: Registered Address */}
              <SectionCard step={2} active={sec1} complete={sec2} title="Registered Address" subtitle="Primary location — used for license certificate and invoices.">
                <div className="space-y-4">
                  <Field label="Address Line 1" required>
                    <textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2} placeholder="Street, area, landmark…"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white" />
                  </Field>
                  <Field label="Address Line 2" hint="Optional">
                    <textarea value={form.address_2} onChange={e => set('address_2', e.target.value)} rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white" />
                  </Field>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="State" required>
                      <select value={form.state} onChange={e => set('state', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white">
                        <option value="">Select state…</option>
                        {Object.keys(statesDistricts).sort().map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </Field>
                    <Field label="District" required>
                      <select value={form.district} onChange={e => set('district', e.target.value)} disabled={!form.state}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white disabled:bg-slate-50">
                        <option value="">Select district…</option>
                        {(statesDistricts[form.state] || []).map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </Field>
                    <Field label="City" required>
                      <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" className={inputCls} />
                    </Field>
                    <Field label="Zip Code" required>
                      <input value={form.zip_code} onChange={e => set('zip_code', e.target.value)} placeholder="515001" className={inputCls} />
                    </Field>
                  </div>
                </div>
              </SectionCard>

              {/* Step 3: User Account */}
              <SectionCard step={3} active={sec2} complete={sec3} title="Admin User Account" subtitle="Login credentials for the company admin.">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Username" required>
                    <div className="flex gap-0">
                      <span className="inline-flex items-center px-3 text-sm text-slate-500 bg-slate-50 border border-r-0 border-slate-300 rounded-l-lg"><User size={13} /></span>
                      <input value={form.user_username} onChange={e => set('user_username', e.target.value.toLowerCase())} placeholder="acme-admin"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white" />
                    </div>
                  </Field>
                  <Field label="Login Email" required>
                    <div className="flex gap-0">
                      <span className="inline-flex items-center px-3 text-sm text-slate-500 bg-slate-50 border border-r-0 border-slate-300 rounded-l-lg"><Mail size={13} /></span>
                      <input type="email" value={form.user_email} onChange={e => set('user_email', e.target.value)} placeholder="admin@acme.in"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white" />
                    </div>
                  </Field>
                  <Field label="Temporary Password" required hint="Min 8 chars">
                    <div className="flex gap-0">
                      <span className="inline-flex items-center px-3 text-sm text-slate-500 bg-slate-50 border border-r-0 border-slate-300 rounded-l-lg"><KeyRound size={13} /></span>
                      <input type="text" value={form.user_password} onChange={e => set('user_password', e.target.value)} placeholder="—"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white" />
                    </div>
                  </Field>
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 text-xs text-blue-700">
                  <AlertCircle size={13} className="mt-0.5 shrink-0 text-blue-500" />
                  <span>An invite email will be sent to <strong>{form.user_email || 'the admin'}</strong> on save.</span>
                </div>
              </SectionCard>

              {/* Bottom actions */}
              <div className="flex items-center justify-between mt-2">
                <button type="button" onClick={() => { setPageView('list'); resetCreate(); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors">
                  <ArrowLeft size={14} /> Cancel
                </button>
                <button type="submit" disabled={!canSubmit || submitting}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-xl hover:bg-slate-700 disabled:opacity-40 transition-all shadow-sm">
                  {submitting ? 'Saving…' : 'Save Company'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ── Right: Preview + Checklist ───────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            <CompanyPreview form={form} isImport={createMode === 'import'} />
            <ChecklistCard items={[
              { label: 'Company identity', done: sec1 },
              { label: 'Registered address', done: sec2 },
              { label: 'Admin user account', done: sec3 },
            ]} />
            <TipCard />
          </div>
        </div>
      </div>
    </div>
  );
}

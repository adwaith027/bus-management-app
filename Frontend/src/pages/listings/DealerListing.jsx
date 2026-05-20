import { useState, useEffect, useCallback } from 'react';
import Modal from '../../components/Modal';
import TableSkeleton from '../../components/TableSkeleton';
import api, { BASE_URL } from '../../assets/js/axiosConfig';
import statesDistricts from '../../assets/json/indiaStatesDistricts.json';
import {
  Handshake, CheckCircle2, CircleDot,
  Phone, MapPin, IdCard, ArrowLeft, AlertCircle,
  Plus, Mail, KeyRound, User, Hash,
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

function DealerPreview({ form }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Listing Preview</p>
        <p className="text-sm text-slate-600 mt-0.5">How this dealer will appear</p>
      </div>
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
            {form.dealer_code
              ? <span className="text-xs font-bold text-white">{form.dealer_code.split('-').slice(0, 2).join('-')}</span>
              : <Handshake size={18} color="#fff" />}
          </div>
          <div className="min-w-0">
            <p className={`font-semibold truncate ${form.dealer_name ? 'text-slate-900' : 'text-slate-300 italic'}`}>
              {form.dealer_name || 'Dealer name…'}
            </p>
            <p className="text-xs text-slate-500 truncate font-mono">{form.dealer_code || 'DEALER-CODE'}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                form.is_active
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${form.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {form.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <IdCard size={11} /><span>{form.contact_person || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <Mail size={11} /><span>{form.email || '—'}</span>
          </div>
          <div className="flex items-start gap-2 text-slate-500">
            <MapPin size={11} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">{[form.city, form.district, form.state].filter(Boolean).join(', ') || '—'}</span>
          </div>
          {form.contact_number && (
            <div className="flex items-center gap-2 text-slate-500">
              <Phone size={11} /><span>+91 {form.contact_number}</span>
            </div>
          )}
        </div>
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

function InfoCard() {
  return (
    <div className="rounded-2xl bg-slate-900 text-white p-5 relative overflow-hidden">
      <div className="absolute -right-4 -top-4 opacity-10">
        <Handshake size={80} color="#fff" />
      </div>
      <p className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Note</p>
      <p className="text-sm mt-1.5 leading-relaxed text-white/90">
        The dealer admin can sign in immediately and begin onboarding companies in their territory.
      </p>
    </div>
  );
}

// ── EMPTY form ─────────────────────────────────────────────────────────────────
const EMPTY = {
  dealer_code: '', dealer_name: '', contact_person: '', contact_number: '',
  email: '', gst_number: '', is_active: true,
  address: '', city: '', state: '', district: '', zip_code: '',
  user_username: '', user_email: '', user_password: '',
};

// ══════════════════════════════════════════════════════════════════════════════
export default function DealerListing() {
  // ── List state ───────────────────────────────────────────────────────────
  const [dealers, setDealers]   = useState([]);
  const [loading, setLoading]   = useState(true);

  // ── Page view: 'list' | 'create' ────────────────────────────────────────
  const [pageView, setPageView] = useState('list');

  // ── Create form state ────────────────────────────────────────────────────
  const [form, setForm]         = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  // ── Modal state (view / edit) ────────────────────────────────────────────
  const [modal,           setModal]           = useState(null);
  const [editingItem,     setEditingItem]     = useState(null);
  const [modalForm,       setModalForm]       = useState(EMPTY);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchDealers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`${BASE_URL}/dealers`);
      setDealers(res.data?.data || []);
    } catch { setDealers([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDealers(); }, [fetchDealers]);

  // ── Form helpers ─────────────────────────────────────────────────────────
  const set = (k, v) => setForm(f => k === 'state' ? { ...f, state: v, district: '' } : { ...f, [k]: v });

  const resetCreate = () => setForm(EMPTY);

  // ── Create form completeness ──────────────────────────────────────────────
  const sec1 = !!(form.dealer_code && form.dealer_name && form.contact_person && form.contact_number && form.email);
  const sec2 = !!(form.address && form.state && form.district && form.city && form.zip_code);
  const sec3 = !!(form.user_username && form.user_email && form.user_password);
  const canSubmit = sec1 && sec2 && sec3;

  // ── Create submit ────────────────────────────────────────────────────────
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await api.post(`${BASE_URL}/create-dealer`, {
        dealer_name: form.dealer_name, email: form.email, dealer_code: form.dealer_code,
        contact_person: form.contact_person, contact_number: form.contact_number,
        gst_number: form.gst_number, address: form.address, city: form.city,
        state: form.state, district: form.district, zip_code: form.zip_code,
        is_active: form.is_active,
        user_username: form.user_username, user_email: form.user_email, user_password: form.user_password,
      });
      if (res?.status === 200 || res?.status === 201) {
        window.alert(res.data.message || 'Dealer created successfully!');
        setPageView('list');
        resetCreate();
        fetchDealers();
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

  // ── Edit / View modal ────────────────────────────────────────────────────
  const populateModal = (dealer) => ({
    dealer_code: dealer.dealer_code || '', dealer_name: dealer.dealer_name || '',
    contact_person: dealer.contact_person || '', contact_number: dealer.contact_number || '',
    email: dealer.email || '', gst_number: dealer.gst_number || '',
    is_active: dealer.is_active ?? true, address: dealer.address || '',
    city: dealer.city || '', state: dealer.state || '',
    district: dealer.district || '', zip_code: dealer.zip_code || '',
    user_username: '', user_email: '', user_password: '',
  });

  const openView = (dealer) => { setModalForm(populateModal(dealer)); setEditingItem(dealer); setModal('view'); };
  const openEdit = (dealer) => { setModalForm(populateModal(dealer)); setEditingItem(dealer); setModal('edit'); };

  const handleModalInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setModalForm(f =>
      name === 'state' ? { ...f, state: value, district: '' } :
      type === 'checkbox' ? { ...f, [name]: checked } :
      { ...f, [name]: value }
    );
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setModalSubmitting(true);
    try {
      const res = await api.put(`${BASE_URL}/update-dealer-details/${editingItem.id}`, {
        dealer_name: modalForm.dealer_name, email: modalForm.email,
        dealer_code: modalForm.dealer_code, contact_person: modalForm.contact_person,
        contact_number: modalForm.contact_number, gst_number: modalForm.gst_number,
        address: modalForm.address, city: modalForm.city,
        state: modalForm.state, district: modalForm.district,
        zip_code: modalForm.zip_code, is_active: modalForm.is_active,
      });
      if (res?.status === 200 || res?.status === 201) {
        window.alert(res.data.message || 'Dealer updated!');
        setModal(null);
        fetchDealers();
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

  // ══════════════════════════════════════════════════════════════════════════
  // ── LIST VIEW ──────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (pageView === 'list') {
    return (
      <div className="p-6 md:p-10 min-h-screen bg-slate-50">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Dealers</h1>
            <p className="text-slate-500 mt-1">Manage partner dealers and their territories</p>
          </div>
          <button
            onClick={() => { resetCreate(); setPageView('create'); }}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-sm text-sm font-medium"
          >
            <Plus size={15} /> Create Dealer
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dealer</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <TableSkeleton columns={['w-16', 'w-36', 'w-24', 'w-32', 'w-16', 'w-16']} />
                ) : dealers.length === 0 ? (
                  <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-400">No dealers found.</td></tr>
                ) : dealers.map(dealer => (
                  <tr key={dealer.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono font-semibold text-slate-700">{dealer.dealer_code || '—'}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{dealer.dealer_name}</div>
                      <div className="text-xs text-slate-500">{dealer.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-700">{dealer.contact_person}</div>
                      <div className="text-xs text-slate-500">{dealer.contact_number}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {[dealer.district, dealer.state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium border ${
                        dealer.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dealer.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {dealer.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openView(dealer)}
                          className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors" title="View">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                        <button onClick={() => openEdit(dealer)}
                          className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* View / Edit Modal */}
        <Modal isOpen={modal !== null} onClose={() => setModal(null)} title={modal === 'view' ? 'Dealer Details' : 'Edit Dealer'}>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Dealer Code', name: 'dealer_code', required: true },
                { label: 'Dealer Name', name: 'dealer_name', required: true },
                { label: 'Contact Person', name: 'contact_person', required: true },
                { label: 'Contact Number', name: 'contact_number', required: true },
                { label: 'Email', name: 'email', type: 'email', required: true },
                { label: 'GST Number', name: 'gst_number' },
              ].map(f => (
                <div key={f.name} className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">{f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}</label>
                  <input type={f.type || 'text'} name={f.name} value={modalForm[f.name] || ''} onChange={handleModalInputChange}
                    required={f.required} readOnly={modal === 'view'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 read-only:bg-slate-50" />
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Address <span className="text-red-500">*</span></label>
              <textarea name="address" value={modalForm.address || ''} onChange={handleModalInputChange}
                rows={2} required readOnly={modal === 'view'}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 read-only:bg-slate-50" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">State <span className="text-red-500">*</span></label>
                {modal === 'view' ? (
                  <input type="text" value={modalForm.state} readOnly className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50" />
                ) : (
                  <select name="state" value={modalForm.state} onChange={handleModalInputChange} required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white">
                    <option value="">Select State</option>
                    {Object.keys(statesDistricts).sort().map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">District <span className="text-red-500">*</span></label>
                {modal === 'view' ? (
                  <input type="text" value={modalForm.district} readOnly className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50" />
                ) : (
                  <select name="district" value={modalForm.district} onChange={handleModalInputChange} required
                    disabled={!modalForm.state}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white disabled:bg-slate-50">
                    <option value="">Select District</option>
                    {(statesDistricts[modalForm.state] || []).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}
              </div>
              {[{ label: 'City', name: 'city', required: true }, { label: 'Zip Code', name: 'zip_code', required: true }].map(f => (
                <div key={f.name} className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">{f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}</label>
                  <input type="text" name={f.name} value={modalForm[f.name] || ''} onChange={handleModalInputChange}
                    required={f.required} readOnly={modal === 'view'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 read-only:bg-slate-50" />
                </div>
              ))}
            </div>

            {modal !== 'view' && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" name="is_active" checked={modalForm.is_active} onChange={handleModalInputChange} className="sr-only" />
                <div onClick={() => setModalForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`relative w-10 h-[22px] rounded-full transition-colors cursor-pointer ${modalForm.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${modalForm.is_active ? 'translate-x-[18px]' : ''}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Dealer Status</p>
                  <p className="text-xs text-slate-500">{modalForm.is_active ? 'Active' : 'Inactive — sign-in disabled'}</p>
                </div>
              </label>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" onClick={() => setModal(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                {modal === 'view' ? 'Close' : 'Cancel'}
              </button>
              {modal === 'edit' && (
                <button type="submit" disabled={modalSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all">
                  {modalSubmitting ? 'Saving…' : 'Update Dealer'}
                </button>
              )}
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── CREATE VIEW ────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Dealers</span><span>/</span><span className="text-slate-700 font-medium">Create Dealer</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Create Dealer</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Onboard a partner who can register and manage companies in their territory</p>
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
              : <>Save Dealer</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Form ─────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <form onSubmit={handleCreateSubmit}>

            {/* Step 1: Dealer Identity */}
            <SectionCard step={1} active complete={sec1} title="Dealer Identity" subtitle="Business details and primary point of contact.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Dealer Code" required hint="Short unique reference">
                  <div className="flex gap-0">
                    <span className="inline-flex items-center px-3 text-sm text-slate-500 bg-slate-50 border border-r-0 border-slate-300 rounded-l-lg"><Hash size={13} /></span>
                    <input value={form.dealer_code} onChange={e => set('dealer_code', e.target.value.toUpperCase())} placeholder="AP-NTC-01"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white uppercase" />
                  </div>
                </Field>
                <Field label="Dealer Name" required>
                  <input value={form.dealer_name} onChange={e => set('dealer_name', e.target.value)} placeholder="Andhra Bus Tech LLP" className={inputCls} />
                </Field>
                <Field label="Contact Person" required>
                  <input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Owner / manager" className={inputCls} />
                </Field>
                <Field label="Contact Number" required>
                  <div className="flex gap-0">
                    <span className="inline-flex items-center px-3 text-sm text-slate-500 bg-slate-50 border border-r-0 border-slate-300 rounded-l-lg">+91</span>
                    <input value={form.contact_number} onChange={e => set('contact_number', e.target.value)} placeholder="98XXXXXX21"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white" />
                  </div>
                </Field>
                <Field label="Email" required>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="dealer@company.in" className={inputCls} />
                </Field>
                <Field label="GST Number" hint="Optional">
                  <input value={form.gst_number} onChange={e => set('gst_number', e.target.value)} placeholder="29ABCDE1234F1Z5" className={inputCls} />
                </Field>

                <div className="md:col-span-2 mt-1">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div onClick={() => set('is_active', !form.is_active)}
                      className={`relative w-10 h-[22px] rounded-full transition-colors cursor-pointer ${form.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-[18px]' : ''}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">Dealer Status</p>
                      <p className="text-xs text-slate-500">{form.is_active ? 'Active — dealer can sign in and onboard companies' : 'Inactive — sign-in disabled'}</p>
                    </div>
                  </label>
                </div>
              </div>
            </SectionCard>

            {/* Step 2: Registered Address */}
            <SectionCard step={2} active={sec1} complete={sec2} title="Registered Address" subtitle="Used on invoices, contracts, and the dealer's certificate.">
              <div className="space-y-4">
                <Field label="Address" required>
                  <textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2} placeholder="Street, area, landmark…"
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
            <SectionCard step={3} active={sec2} complete={sec3} title="Dealer User Account" subtitle="Login credentials for the dealer admin.">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Username" required>
                  <div className="flex gap-0">
                    <span className="inline-flex items-center px-3 text-sm text-slate-500 bg-slate-50 border border-r-0 border-slate-300 rounded-l-lg"><User size={13} /></span>
                    <input value={form.user_username} onChange={e => set('user_username', e.target.value.toLowerCase())} placeholder="ap-ntc-01"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white" />
                  </div>
                </Field>
                <Field label="Login Email" required>
                  <div className="flex gap-0">
                    <span className="inline-flex items-center px-3 text-sm text-slate-500 bg-slate-50 border border-r-0 border-slate-300 rounded-l-lg"><Mail size={13} /></span>
                    <input type="email" value={form.user_email} onChange={e => set('user_email', e.target.value)} placeholder="login@dealer.in"
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
                <span>An invite email with these credentials will be sent to <strong>{form.user_email || 'the dealer'}</strong> on save.</span>
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
                {submitting ? 'Saving…' : 'Save Dealer'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Right: Preview + Checklist ───────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            <DealerPreview form={form} />
            <ChecklistCard items={[
              { label: 'Dealer identity', done: sec1 },
              { label: 'Registered address', done: sec2 },
              { label: 'User account', done: sec3 },
            ]} />
            <InfoCard />
          </div>
        </div>
      </div>
    </div>
  );
}

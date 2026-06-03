import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Settings, Smartphone, Ticket, BadgeDollarSign,
  ToggleRight, Save, CheckCircle2, ChevronDown, Building2,
  BookMarked, Plus, Trash2, Pencil, X,
} from 'lucide-react';
import api, { BASE_URL } from '../../assets/js/axiosConfig';
import { PageHeader, SectionCard, SettToggle } from '@/components/design';

// ── Reusable Field Components ─────────────────────────────────────────────────

const TextField = ({ label, name, value, onChange, placeholder = '', maxLength, loading = false }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-semibold text-slate-700">{label}</label>
    {loading ? (
      <div className="w-full h-10 bg-slate-100 rounded-xl animate-pulse" />
    ) : (
      <input
        type="text" name={name} value={value ?? ''} onChange={onChange}
        placeholder={placeholder} maxLength={maxLength}
        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm transition-all"
      />
    )}
  </div>
);

const ConstrainedField = ({ label, name, value, onChange, maxLen, allowDecimal = false, loading = false }) => {
  const handleKey = (e) => {
    const key = e.key;
    if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(key)) return;
    const allowed = allowDecimal ? /[0-9.]/ : /[0-9]/;
    if (!allowed.test(key)) { e.preventDefault(); return; }
    if (allowDecimal && key === '.' && e.target.value.includes('.')) e.preventDefault();
  };
  const handleChange = (e) => {
    let v = e.target.value;
    if (allowDecimal) {
      v = v.replace(/[^0-9.]/g, '');
      const parts = v.split('.');
      if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
    } else {
      v = v.replace(/[^0-9]/g, '');
    }
    if (v.length > maxLen) v = v.slice(0, maxLen);
    onChange({ target: { name, value: v } });
  };
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      {loading ? (
        <div className="w-full h-10 bg-slate-100 rounded-xl animate-pulse" />
      ) : (
        <input
          type="text" inputMode={allowDecimal ? 'decimal' : 'numeric'}
          name={name} value={value ?? ''} onChange={handleChange} onKeyDown={handleKey}
          maxLength={maxLen}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm transition-all"
        />
      )}
    </div>
  );
};

function DevicePalmtecSelect({ label, value, onChange }) {
  const [devices, setDevices]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = useState(false);
  const ref                     = useRef(null);

  useEffect(() => {
    api.get(`${BASE_URL}/etm-devices`)
      .then(res => setDevices(res.data?.data ?? []))
      .catch(() => setDevices([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (palmtecId) => {
    onChange({ target: { name: 'palmtec_id', value: palmtecId } });
    setOpen(false);
  };

  const assignedDevices = devices.filter(d => d.palmtec_id);
  const displayValue   = value ? String(value) : null;

  return (
    <div className="space-y-1.5" ref={ref}>
      <label className="text-sm font-semibold text-slate-700">{label} <span className="text-red-500">*</span></label>
      {loading ? (
        <div className="w-full h-10 bg-slate-100 rounded-xl animate-pulse" />
      ) : (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(p => !p)}
            className="w-full flex items-center justify-between px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 text-sm bg-white transition-all text-left"
          >
            <span className={displayValue ? 'text-slate-800 font-mono' : 'text-slate-400'}>
              {displayValue ?? '— Select device —'}
            </span>
            <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
              <div
                className="px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-50 cursor-pointer"
                onClick={() => select('')}
              >
                — Select device —
              </div>
              {assignedDevices.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-400 italic">No devices with Palmtec ID assigned</div>
              ) : assignedDevices.map(d => (
                <div
                  key={d.id}
                  onClick={() => select(String(d.palmtec_id))}
                  className={`px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between hover:bg-slate-50 ${String(d.palmtec_id) === displayValue ? 'bg-slate-100 font-medium' : ''}`}
                >
                  <span className="text-slate-500 font-mono text-xs">{d.serial_number}</span>
                  <span className="font-mono text-slate-800 text-xs font-semibold">{d.palmtec_id}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const SelectField = ({ label, name, value, onChange, options, loading = false }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-semibold text-slate-700">{label}</label>
    {loading ? (
      <div className="w-full h-10 bg-slate-100 rounded-xl animate-pulse" />
    ) : (
      <div className="relative">
        <select
          name={name} value={value ?? ''} onChange={onChange}
          className="w-full appearance-none px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm transition-all bg-white pr-10"
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    )}
  </div>
);

// Toggle and Section replaced by shared design components (SettToggle, SectionCard)

// ── Save Button ───────────────────────────────────────────────────────────────

function SaveButton({ onSave, saving, loading, disabled, bottom = false }) {
  const [saved, setSaved] = useState(false);

  const handleClick = async () => {
    const ok = await onSave();
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  };

  return (
    <button
      type="button" onClick={handleClick} disabled={saving || loading || disabled}
      className={`flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-700 rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${bottom ? 'w-full sm:w-auto' : ''}`}
    >
      {saving ? (
        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
      ) : saved ? (
        <><CheckCircle2 size={16} />Saved!</>
      ) : (
        <><Save size={16} />Save Settings</>
      )}
    </button>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LANGUAGE_OPTIONS = [{ value: 0, label: 'Malayalam' }, { value: 1, label: 'Tamil' }];
const FONT_OPTIONS     = [{ value: 0, label: 'Normal' },    { value: 1, label: 'Condensed' }];

const EMPTY_DEVICE_FORM = {
  palmtec_id: '',
  user_pwd: '', master_pwd: '',
  half_per: '', con_per: '', phy_per: '', round_amt: '', luggage_unit_rate: '',
  main_display: '', main_display2: '',
  header1: '', header2: '', header3: '', footer1: '', footer2: '',
  language_option: 0, report_font: 0,
  st_fare_edit: false, st_max_amt: '', st_ratio: '', st_min_amt: '',
  st_roundoff_enable: false, st_roundoff_amt: '',
  roundoff: false, round_up: false, remove_ticket_flag: false,
  stage_font_flag: false, next_fare_flag: false, odometer_entry: false,
  ticket_no_big_font: false, crew_check: false, tripsend_enable: false,
  schedulesend_enable: false, inspect_rpt: false, multiple_pass: false,
  simple_report: false, inspector_sms: false, auto_shut_down: false,
  userpswd_enable: false, exp_enable: false,
  stage_updation_msg: 0, default_stage: 0,
};

const EMPTY_COMPANY_FORM = {
  ...EMPTY_DEVICE_FORM,
  st_max_amt: '', st_min_con: '',
  // remove device-only ST fields
  st_ratio: undefined, st_min_amt: undefined, exp_enable: undefined,
};

// ── Shared Settings Form Sections ─────────────────────────────────────────────
// Used by CompanySettingsTab and profile editor.

function SettingsFormFields({ formData, onChange, loading = false, isDevice = true }) {
  // Helper to adapt SettToggle (no-arg callback) to the standard event-based onChange
  const tog = (name) => () =>
    onChange({ target: { name, type: 'checkbox', checked: !formData[name] } });

  return (
    <div className="space-y-4">

      <SectionCard title="Passwords" icon={Smartphone}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField label="User Password"   name="user_pwd"   value={formData.user_pwd}   onChange={onChange} loading={loading} />
          <TextField label="Master Password" name="master_pwd" value={formData.master_pwd} onChange={onChange} loading={loading} />
        </div>
      </SectionCard>

      <SectionCard title="Fare Percentages & Amounts" icon={BadgeDollarSign}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ConstrainedField label="Half Fare (%)"      name="half_per"          value={formData.half_per}          onChange={onChange} maxLen={5} allowDecimal loading={loading} />
          <ConstrainedField label="Concession (%)"     name="con_per"           value={formData.con_per}           onChange={onChange} maxLen={5} allowDecimal loading={loading} />
          <ConstrainedField label="PH Concession (%)"  name="phy_per"           value={formData.phy_per}           onChange={onChange} maxLen={5} allowDecimal loading={loading} />
          <ConstrainedField label="Rounding Amount"    name="round_amt"         value={formData.round_amt}         onChange={onChange} maxLen={6} allowDecimal loading={loading} />
          <ConstrainedField label="Luggage Unit Rate"  name="luggage_unit_rate" value={formData.luggage_unit_rate} onChange={onChange} maxLen={7} allowDecimal loading={loading} />
        </div>
      </SectionCard>

      <SectionCard title="Ticket Display — Headers & Footers" icon={Ticket}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField label="Main Display Line 1" name="main_display"  value={formData.main_display}  onChange={onChange} loading={loading} />
          <TextField label="Main Display Line 2" name="main_display2" value={formData.main_display2} onChange={onChange} loading={loading} />
          <TextField label="Header Line 1"       name="header1"       value={formData.header1}       onChange={onChange} loading={loading} />
          <TextField label="Header Line 2"       name="header2"       value={formData.header2}       onChange={onChange} loading={loading} />
          <TextField label="Header Line 3"       name="header3"       value={formData.header3}       onChange={onChange} loading={loading} />
          <TextField label="Footer Line 1"       name="footer1"       value={formData.footer1}       onChange={onChange} loading={loading} />
          <TextField label="Footer Line 2"       name="footer2"       value={formData.footer2}       onChange={onChange} loading={loading} />
        </div>
      </SectionCard>

      <SectionCard title="Language & Font" icon={Settings}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField label="Language"    name="language_option" value={formData.language_option} onChange={onChange} options={LANGUAGE_OPTIONS} loading={loading} />
          <SelectField label="Report Font" name="report_font"     value={formData.report_font}     onChange={onChange} options={FONT_OPTIONS}     loading={loading} />
        </div>
      </SectionCard>

      <SectionCard title="Student Fare & Roundoff" icon={BadgeDollarSign}>
        <div className="space-y-4">
          <SettToggle label="ST Fare Edit" checked={!!formData.st_fare_edit} onChange={tog('st_fare_edit')} />
          {!formData.st_fare_edit && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-1 pt-1 border-l-2 border-slate-200">
              <ConstrainedField label="ST Max Amount" name="st_max_amt" value={formData.st_max_amt} onChange={onChange} maxLen={isDevice ? 5 : 10} allowDecimal loading={loading} />
              {isDevice ? (
                <>
                  <ConstrainedField label="ST Ratio"      name="st_ratio"   value={formData.st_ratio}   onChange={onChange} maxLen={2} loading={loading} />
                  <ConstrainedField label="ST Min Amount" name="st_min_amt" value={formData.st_min_amt} onChange={onChange} maxLen={6} allowDecimal loading={loading} />
                </>
              ) : (
                <ConstrainedField label="ST Min Concession" name="st_min_con" value={formData.st_min_con} onChange={onChange} maxLen={10} allowDecimal loading={loading} />
              )}
            </div>
          )}
          <SettToggle label="ST Roundoff" checked={!!formData.st_roundoff_enable} onChange={tog('st_roundoff_enable')} />
          {formData.st_roundoff_enable && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-1 pt-1 border-l-2 border-slate-200">
              <ConstrainedField label="Roundoff Amount (paise)" name="st_roundoff_amt" value={formData.st_roundoff_amt} onChange={onChange} maxLen={3} allowDecimal loading={loading} />
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Feature Toggles" icon={ToggleRight}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <SettToggle label="Round Off"            checked={!!formData.roundoff}            onChange={tog('roundoff')} />
          <SettToggle label="Round Up"             checked={!!formData.round_up}            onChange={tog('round_up')} />
          <SettToggle label="Remove Ticket Flag"   checked={!!formData.remove_ticket_flag}  onChange={tog('remove_ticket_flag')} />
          <SettToggle label="Stage Font Flag"      checked={!!formData.stage_font_flag}     onChange={tog('stage_font_flag')} />
          <SettToggle label="Next Fare Flag"       checked={!!formData.next_fare_flag}      onChange={tog('next_fare_flag')} />
          <SettToggle label="Odometer Entry"       checked={!!formData.odometer_entry}      onChange={tog('odometer_entry')} />
          <SettToggle label="Ticket No Big Font"   checked={!!formData.ticket_no_big_font}  onChange={tog('ticket_no_big_font')} />
          <SettToggle label="Crew Check"           checked={!!formData.crew_check}          onChange={tog('crew_check')} />
          <SettToggle label="Trip Send"            checked={!!formData.tripsend_enable}     onChange={tog('tripsend_enable')} />
          <SettToggle label="Schedule Send"        checked={!!formData.schedulesend_enable} onChange={tog('schedulesend_enable')} />
          <SettToggle label="Inspector Report"     checked={!!formData.inspect_rpt}         onChange={tog('inspect_rpt')} />
          <SettToggle label="Multiple Pass"        checked={!!formData.multiple_pass}       onChange={tog('multiple_pass')} />
          <SettToggle label="Simple Report"        checked={!!formData.simple_report}       onChange={tog('simple_report')} />
          <SettToggle label="Inspector SMS"        checked={!!formData.inspector_sms}       onChange={tog('inspector_sms')} />
          <SettToggle label="Auto Shutdown"        checked={!!formData.auto_shut_down}      onChange={tog('auto_shut_down')} />
          <SettToggle label="User Password Enable" checked={!!formData.userpswd_enable}     onChange={tog('userpswd_enable')} />
          {isDevice && <SettToggle label="Expense Enable" checked={!!formData.exp_enable} onChange={tog('exp_enable')} />}
        </div>
      </SectionCard>

      <SectionCard title="Other Settings" icon={Settings}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ConstrainedField label="Stage Updation Msg" name="stage_updation_msg" value={formData.stage_updation_msg} onChange={onChange} maxLen={3} loading={loading} />
          <ConstrainedField label="Default Stage"      name="default_stage"      value={formData.default_stage}      onChange={onChange} maxLen={4} loading={loading} />
        </div>
      </SectionCard>

    </div>
  );
}

// ── Company Settings Tab ──────────────────────────────────────────────────────

function CompanySettingsTab({ setHeaderAction }) {
  const [formData, setFormData] = useState(EMPTY_COMPANY_FORM);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    api.get(`${BASE_URL}/masterdata/settings`)
      .then(res => setFormData(res.data?.data ? { ...EMPTY_COMPANY_FORM, ...res.data.data } : { ...EMPTY_COMPANY_FORM }))
      .catch(err => console.error('Error fetching company settings:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await api.put(`${BASE_URL}/masterdata/settings`, formData);
      if (res?.status === 200) {
        setFormData(prev => ({ ...EMPTY_COMPANY_FORM, ...res.data?.data, ...prev, ...res.data?.data }));
        return true;
      }
    } catch (err) {
      if (!err.response) { window.alert('Server unreachable. Try later.'); return false; }
      const { data } = err.response;
      window.alert((data.errors ? Object.values(data.errors)[0][0] : data.message) || 'Save failed');
    } finally { setSaving(false); }
    return false;
  }, [formData]);

  useEffect(() => {
    setHeaderAction(
      <SaveButton onSave={handleSave} saving={saving} loading={loading} disabled={false} />
    );
  }, [handleSave, saving, loading, setHeaderAction]);

  useEffect(() => () => setHeaderAction(null), [setHeaderAction]);

  return (
    <div className="space-y-6">
      <SettingsFormFields formData={formData} onChange={handleChange} loading={loading} isDevice={false} />
      <div className="flex justify-end pt-2">
        <SaveButton onSave={handleSave} saving={saving} loading={loading} disabled={false} bottom />
      </div>
    </div>
  );
}

// ── Profiles Tab ──────────────────────────────────────────────────────────────

function ProfilesTab({ setHeaderAction }) {
  const [profiles, setProfiles]       = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [editingId, setEditingId]     = useState(null);  // null = closed, 'new' = create, <id> = edit
  const [formData, setFormData]       = useState({ ...EMPTY_DEVICE_FORM, name: '' });
  const [saving, setSaving]           = useState(false);
  const [deleting, setDeleting]       = useState(null);

  const fetchProfiles = () => {
    setLoadingList(true);
    api.get(`${BASE_URL}/masterdata/settings-profiles`)
      .then(res => setProfiles(res.data?.data || []))
      .catch(err => console.error('Error fetching profiles:', err))
      .finally(() => setLoadingList(false));
  };

  useEffect(() => { fetchProfiles(); }, []);

  const openNew = useCallback(async () => {
    setFormData({ ...EMPTY_DEVICE_FORM, name: '' });
    setEditingId('new');
    try {
      const res = await api.get(`${BASE_URL}/masterdata/settings`);
      if (res.data?.data) {
        setFormData(prev => ({ ...EMPTY_DEVICE_FORM, ...res.data.data, name: prev.name }));
      }
    } catch { /* fall back to empty form */ }
  }, []);

  useEffect(() => {
    if (editingId === null) {
      setHeaderAction(
        <button
          type="button" onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-700 rounded-xl shadow-sm transition-colors"
        >
          <Plus size={15} /> New Profile
        </button>
      );
    } else {
      setHeaderAction(null);
    }
  }, [editingId, openNew, setHeaderAction]);

  useEffect(() => () => setHeaderAction(null), [setHeaderAction]);

  const openEdit = (profile) => {
    setFormData({ ...EMPTY_DEVICE_FORM, ...profile });
    setEditingId(profile.id);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) { window.alert('Profile name is required.'); return false; }
    if (!formData.palmtec_id)   { window.alert('Palmtec ID is required. Select a device.'); return false; }
    setSaving(true);
    try {
      let res;
      if (editingId === 'new') {
        res = await api.post(`${BASE_URL}/masterdata/settings-profiles/create`, formData);
      } else {
        res = await api.put(`${BASE_URL}/masterdata/settings-profiles/${editingId}`, formData);
      }
      if (res?.status === 200 || res?.status === 201) {
        fetchProfiles();
        setEditingId(null);
        return true;
      }
    } catch (err) {
      if (!err.response) { window.alert('Server unreachable. Try later.'); return false; }
      const { data } = err.response;
      window.alert((data.errors ? Object.values(data.errors)[0][0] : data.message) || 'Save failed');
    } finally { setSaving(false); }
    return false;
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete profile "${name}"?`)) return;
    setDeleting(id);
    try {
      await api.delete(`${BASE_URL}/masterdata/settings-profiles/${id}`);
      setProfiles(prev => prev.filter(p => p.id !== id));
      if (editingId === id) setEditingId(null);
    } catch (err) {
      window.alert('Delete failed.');
    } finally { setDeleting(null); }
  };

  // Profile editor panel (create or edit)
  if (editingId !== null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">
            {editingId === 'new' ? 'New Profile' : `Edit: ${formData.name}`}
          </h2>
          <button
            type="button" onClick={() => setEditingId(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
          >
            <X size={14} /> Cancel
          </button>
        </div>

        {/* Profile name + palmtec id */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            label="Profile Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. City Route Default"
          />
          <DevicePalmtecSelect
            label="Palmtec ID"
            value={formData.palmtec_id}
            onChange={handleChange}
          />
        </div>

        <SettingsFormFields formData={formData} onChange={handleChange} isDevice />

        <div className="flex justify-end pt-2 gap-3">
          <button
            type="button" onClick={() => setEditingId(null)}
            className="px-5 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <SaveButton onSave={handleSave} saving={saving} loading={false} disabled={false} bottom />
        </div>
      </div>
    );
  }

  // Profile list
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        {loadingList ? 'Loading…' : `${profiles.length} profile${profiles.length !== 1 ? 's' : ''}`}
      </p>

      {loadingList ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : profiles.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <BookMarked size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">No profiles yet. Create one to reuse settings across devices.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map(p => (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-slate-100 shrink-0">
                  <BookMarked size={16} className="text-slate-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-800 truncate">{p.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Half fare {p.half_per}% · Lang {p.language_option === 0 ? 'Malayalam' : 'Tamil'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button" onClick={() => openEdit(p)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  type="button" onClick={() => handleDelete(p.id, p.name)}
                  disabled={deleting === p.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-all disabled:opacity-50"
                >
                  <Trash2 size={13} /> {deleting === p.id ? '…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab]     = useState('company');
  const [headerAction, setHeaderAction] = useState(null);

  const tabs = [
    { id: 'company',  label: 'Company Settings', icon: Building2  },
    { id: 'profiles', label: 'Profiles',          icon: BookMarked },
  ];

  return (
    <div className="p-5 lg:p-6 min-h-full bg-slate-50">

      <PageHeader
        icon={Settings}
        title="Settings"
        subtitle="Manage company defaults, profiles, and per-device ETM settings"
      />

      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
        {headerAction}
      </div>

      {activeTab === 'company'  && <CompanySettingsTab  setHeaderAction={setHeaderAction} />}
      {activeTab === 'profiles' && <ProfilesTab         setHeaderAction={setHeaderAction} />}
    </div>
  );
}

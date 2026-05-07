import { useState, useEffect } from 'react';
import {
  Settings, Smartphone, Ticket, BadgeDollarSign,
  ToggleRight, Save, CheckCircle2, ChevronDown, Building2,
  BookMarked, Plus, Trash2, Pencil, X,
} from 'lucide-react';
import api, { BASE_URL } from '../../assets/js/axiosConfig';

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

const Toggle = ({ label, name, value, onChange, loading = false }) => (
  <label className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all duration-150 ${
    loading
      ? 'border-slate-200 bg-slate-50 animate-pulse cursor-not-allowed'
      : 'border-slate-200 cursor-pointer hover:border-slate-300 hover:bg-slate-50'
  }`}>
    <span className="text-sm text-slate-700 font-medium">{label}</span>
    {loading ? (
      <div className="w-10 h-5 bg-slate-200 rounded-full" />
    ) : (
      <div className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-slate-800' : 'bg-slate-300'}`}>
        <input type="checkbox" name={name} checked={!!value} onChange={onChange} className="sr-only" />
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${value ? 'translate-x-5' : ''}`} />
      </div>
    )}
  </label>
);

const Section = ({ title, icon: Icon, children, loading = false }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
    <h2 className="text-base font-bold text-slate-800 mb-5 pb-3 border-b border-slate-100 flex items-center gap-2">
      {loading
        ? <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin shrink-0" />
        : Icon && <Icon size={16} className="text-slate-600 shrink-0" />
      }
      {title}
    </h2>
    {children}
  </div>
);

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
// Used by CompanySettingsTab, DeviceSettingsTab form, and profile editor.

function SettingsFormFields({ formData, onChange, loading = false, isDevice = true }) {
  return (
    <div className="space-y-6">
      <Section title="Passwords" icon={Smartphone} loading={loading}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField label="User Password"   name="user_pwd"   value={formData.user_pwd}   onChange={onChange} loading={loading} />
          <TextField label="Master Password" name="master_pwd" value={formData.master_pwd} onChange={onChange} loading={loading} />
        </div>
      </Section>

      <Section title="Fare Percentages & Amounts" icon={BadgeDollarSign} loading={loading}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ConstrainedField label="Half Fare (%)"     name="half_per"          value={formData.half_per}          onChange={onChange} maxLen={5} allowDecimal loading={loading} />
          <ConstrainedField label="Concession (%)"    name="con_per"           value={formData.con_per}           onChange={onChange} maxLen={5} allowDecimal loading={loading} />
          <ConstrainedField label="PH Concession (%)" name="phy_per"           value={formData.phy_per}           onChange={onChange} maxLen={5} allowDecimal loading={loading} />
          <ConstrainedField label="Rounding Amount"   name="round_amt"         value={formData.round_amt}         onChange={onChange} maxLen={6} allowDecimal loading={loading} />
          <ConstrainedField label="Luggage Unit Rate"  name="luggage_unit_rate" value={formData.luggage_unit_rate} onChange={onChange} maxLen={7} allowDecimal loading={loading} />
        </div>
      </Section>

      <Section title="Ticket Display — Headers & Footers" icon={Ticket} loading={loading}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField label="Main Display Line 1" name="main_display"  value={formData.main_display}  onChange={onChange} loading={loading} />
          <TextField label="Main Display Line 2" name="main_display2" value={formData.main_display2} onChange={onChange} loading={loading} />
          <TextField label="Header Line 1"       name="header1"       value={formData.header1}       onChange={onChange} loading={loading} />
          <TextField label="Header Line 2"       name="header2"       value={formData.header2}       onChange={onChange} loading={loading} />
          <TextField label="Header Line 3"       name="header3"       value={formData.header3}       onChange={onChange} loading={loading} />
          <TextField label="Footer Line 1"       name="footer1"       value={formData.footer1}       onChange={onChange} loading={loading} />
          <TextField label="Footer Line 2"       name="footer2"       value={formData.footer2}       onChange={onChange} loading={loading} />
        </div>
      </Section>

      <Section title="Language & Font" icon={Settings} loading={loading}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField label="Language"    name="language_option" value={formData.language_option} onChange={onChange} options={LANGUAGE_OPTIONS} loading={loading} />
          <SelectField label="Report Font" name="report_font"     value={formData.report_font}     onChange={onChange} options={FONT_OPTIONS}     loading={loading} />
        </div>
      </Section>

      <Section title="Student Fare & Roundoff" icon={BadgeDollarSign} loading={loading}>
        <div className="space-y-4">
          <Toggle label="ST Fare Edit" name="st_fare_edit" value={formData.st_fare_edit} onChange={onChange} loading={loading} />
          {!formData.st_fare_edit && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-1 pt-1 border-l-2 border-slate-200">
              <ConstrainedField label="ST Max Amount" name="st_max_amt" value={formData.st_max_amt} onChange={onChange} maxLen={isDevice ? 5 : 10} allowDecimal loading={loading} />
              {isDevice ? (
                <>
                  <ConstrainedField label="ST Ratio"      name="st_ratio"  value={formData.st_ratio}  onChange={onChange} maxLen={2} loading={loading} />
                  <ConstrainedField label="ST Min Amount" name="st_min_amt" value={formData.st_min_amt} onChange={onChange} maxLen={6} allowDecimal loading={loading} />
                </>
              ) : (
                <ConstrainedField label="ST Min Concession" name="st_min_con" value={formData.st_min_con} onChange={onChange} maxLen={10} allowDecimal loading={loading} />
              )}
            </div>
          )}
          <Toggle label="ST Roundoff" name="st_roundoff_enable" value={formData.st_roundoff_enable} onChange={onChange} loading={loading} />
          {formData.st_roundoff_enable && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-1 pt-1 border-l-2 border-slate-200">
              <ConstrainedField label="Roundoff Amount (paise)" name="st_roundoff_amt" value={formData.st_roundoff_amt} onChange={onChange} maxLen={3} allowDecimal loading={loading} />
            </div>
          )}
        </div>
      </Section>

      <Section title="Feature Toggles" icon={ToggleRight} loading={loading}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Toggle label="Round Off"            name="roundoff"           value={formData.roundoff}           onChange={onChange} loading={loading} />
          <Toggle label="Round Up"             name="round_up"           value={formData.round_up}           onChange={onChange} loading={loading} />
          <Toggle label="Remove Ticket Flag"   name="remove_ticket_flag" value={formData.remove_ticket_flag} onChange={onChange} loading={loading} />
          <Toggle label="Stage Font Flag"      name="stage_font_flag"    value={formData.stage_font_flag}    onChange={onChange} loading={loading} />
          <Toggle label="Next Fare Flag"       name="next_fare_flag"     value={formData.next_fare_flag}     onChange={onChange} loading={loading} />
          <Toggle label="Odometer Entry"       name="odometer_entry"     value={formData.odometer_entry}     onChange={onChange} loading={loading} />
          <Toggle label="Ticket No Big Font"   name="ticket_no_big_font" value={formData.ticket_no_big_font} onChange={onChange} loading={loading} />
          <Toggle label="Crew Check"           name="crew_check"         value={formData.crew_check}         onChange={onChange} loading={loading} />
          <Toggle label="Trip Send"            name="tripsend_enable"    value={formData.tripsend_enable}    onChange={onChange} loading={loading} />
          <Toggle label="Schedule Send"        name="schedulesend_enable" value={formData.schedulesend_enable} onChange={onChange} loading={loading} />
          <Toggle label="Inspector Report"     name="inspect_rpt"        value={formData.inspect_rpt}        onChange={onChange} loading={loading} />
          <Toggle label="Multiple Pass"        name="multiple_pass"      value={formData.multiple_pass}      onChange={onChange} loading={loading} />
          <Toggle label="Simple Report"        name="simple_report"      value={formData.simple_report}      onChange={onChange} loading={loading} />
          <Toggle label="Inspector SMS"        name="inspector_sms"      value={formData.inspector_sms}      onChange={onChange} loading={loading} />
          <Toggle label="Auto Shutdown"        name="auto_shut_down"     value={formData.auto_shut_down}     onChange={onChange} loading={loading} />
          <Toggle label="User Password Enable" name="userpswd_enable"    value={formData.userpswd_enable}    onChange={onChange} loading={loading} />
          {isDevice && <Toggle label="Expense Enable" name="exp_enable" value={formData.exp_enable} onChange={onChange} loading={loading} />}
        </div>
      </Section>

      <Section title="Other Settings" icon={Settings} loading={loading}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ConstrainedField label="Stage Updation Msg" name="stage_updation_msg" value={formData.stage_updation_msg} onChange={onChange} maxLen={3} loading={loading} />
          <ConstrainedField label="Default Stage"      name="default_stage"      value={formData.default_stage}      onChange={onChange} maxLen={4} loading={loading} />
        </div>
      </Section>
    </div>
  );
}

// ── Company Settings Tab ──────────────────────────────────────────────────────

function CompanySettingsTab() {
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

  const handleSave = async () => {
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
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <SaveButton onSave={handleSave} saving={saving} loading={loading} disabled={false} />
      </div>
      <SettingsFormFields formData={formData} onChange={handleChange} loading={loading} isDevice={false} />
      <div className="flex justify-end pt-2">
        <SaveButton onSave={handleSave} saving={saving} loading={loading} disabled={false} bottom />
      </div>
    </div>
  );
}

// ── Profiles Tab ──────────────────────────────────────────────────────────────

function ProfilesTab() {
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

  const openNew = async () => {
    setFormData({ ...EMPTY_DEVICE_FORM, name: '' });
    setEditingId('new');
    try {
      const res = await api.get(`${BASE_URL}/masterdata/settings`);
      if (res.data?.data) {
        setFormData(prev => ({ ...EMPTY_DEVICE_FORM, ...res.data.data, name: prev.name }));
      }
    } catch { /* fall back to empty form */ }
  };

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
          <ConstrainedField
            label="Palmtec ID"
            name="palmtec_id"
            value={formData.palmtec_id}
            onChange={handleChange}
            maxLen={6}
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loadingList ? 'Loading…' : `${profiles.length} profile${profiles.length !== 1 ? 's' : ''}`}
        </p>
        <button
          type="button" onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-700 rounded-xl shadow-sm transition-colors"
        >
          <Plus size={15} /> New Profile
        </button>
      </div>

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

// ── Device Settings Tab ───────────────────────────────────────────────────────

function DeviceSettingsTab() {
  const [devices, setDevices]               = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState(null);

  const [profiles, setProfiles]             = useState([]);
  const [applyingProfile, setApplyingProfile] = useState(false);

  const [formData, setFormData] = useState(EMPTY_DEVICE_FORM);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    api.get(`${BASE_URL}/masterdata/device-settings/devices`)
      .then(res => setDevices(res.data?.data || []))
      .catch(err => console.error('Error fetching devices:', err))
      .finally(() => setDevicesLoading(false));
    api.get(`${BASE_URL}/masterdata/settings-profiles`)
      .then(res => setProfiles(res.data?.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedDevice) return;
    setLoading(true);
    api.get(`${BASE_URL}/masterdata/device-settings/${selectedDevice.id}`)
      .then(res => setFormData(res.data?.data ? { ...EMPTY_DEVICE_FORM, ...res.data.data } : { ...EMPTY_DEVICE_FORM }))
      .catch(() => setFormData({ ...EMPTY_DEVICE_FORM }))
      .finally(() => setLoading(false));
  }, [selectedDevice]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    if (!selectedDevice) return false;
    setSaving(true);
    try {
      const res = await api.put(`${BASE_URL}/masterdata/device-settings/${selectedDevice.id}`, formData);
      if (res?.status === 200) {
        setFormData(prev => ({ ...EMPTY_DEVICE_FORM, ...res.data?.data, ...prev, ...res.data?.data }));
        return true;
      }
    } catch (err) {
      if (!err.response) { window.alert('Server unreachable. Try later.'); return false; }
      const { data } = err.response;
      window.alert((data.errors ? Object.values(data.errors)[0][0] : data.message) || 'Save failed');
    } finally { setSaving(false); }
    return false;
  };

  const applyProfile = async (profileId) => {
    if (!selectedDevice) return;
    setApplyingProfile(true);
    try {
      const res = await api.post(
        `${BASE_URL}/masterdata/settings-profiles/${profileId}/apply/${selectedDevice.id}`
      );
      if (res?.status === 200) {
        setFormData(prev => ({ ...EMPTY_DEVICE_FORM, ...res.data?.data, ...prev, ...res.data?.data }));
      }
    } catch (err) {
      window.alert('Failed to apply profile.');
    } finally { setApplyingProfile(false); }
  };

  return (
    <div className="space-y-6">

      {/* Device Picker */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-base font-bold text-slate-800 mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
          <Smartphone size={16} className="text-slate-600" /> Select Device
        </h2>

        {devicesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : devices.length === 0 ? (
          <p className="text-slate-500 text-sm">No devices registered to your company.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {devices.map(device => (
              <button
                key={device.id} type="button" onClick={() => setSelectedDevice(device)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  selectedDevice?.id === device.id ? 'border-slate-800 bg-slate-50' : 'border-slate-200 hover:border-slate-400'
                }`}
              >
                <div className="font-semibold text-sm text-slate-800">{device.display_name}</div>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                  <span>{device.serial_number}</span>
                  {device.has_settings && (
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">configured</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedDevice && (
        <>
          {/* Apply Profile bar */}
          {profiles.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-5 py-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <BookMarked size={15} className="text-slate-500" />
                Apply profile:
              </div>
              {profiles.map(p => (
                <button
                  key={p.id} type="button" disabled={applyingProfile}
                  onClick={() => applyProfile(p.id)}
                  className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:border-slate-500 hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  {applyingProfile ? '…' : p.name}
                </button>
              ))}
              <span className="text-xs text-slate-400">Settings will load into the form — review and save.</span>
            </div>
          )}

          <div className="flex justify-end">
            <SaveButton onSave={handleSave} saving={saving} loading={loading} disabled={!selectedDevice} />
          </div>

          <SettingsFormFields formData={formData} onChange={handleChange} loading={loading} isDevice />

          <div className="flex justify-end pt-2">
            <SaveButton onSave={handleSave} saving={saving} loading={loading} disabled={!selectedDevice} bottom />
          </div>
        </>
      )}

      {!selectedDevice && !devicesLoading && devices.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <Smartphone size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">Select a device above to view and edit its settings.</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('company');

  const tabs = [
    { id: 'company',  label: 'Company Settings', icon: Building2  },
    { id: 'profiles', label: 'Profiles',          icon: BookMarked },
    { id: 'device',   label: 'Device Settings',   icon: Smartphone },
  ];

  return (
    <div className="p-3 sm:p-5 lg:p-7 min-h-screen bg-slate-50">

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-slate-900">
          <Settings size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Settings</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage company defaults, profiles, and per-device ETM settings</p>
        </div>
      </div>

      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-6 w-fit">
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

      {activeTab === 'company'  && <CompanySettingsTab />}
      {activeTab === 'profiles' && <ProfilesTab />}
      {activeTab === 'device'   && <DeviceSettingsTab />}
    </div>
  );
}

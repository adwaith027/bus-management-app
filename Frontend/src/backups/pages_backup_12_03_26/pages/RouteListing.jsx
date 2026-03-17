import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import SearchBar from '../components/SearchBar';
import { useFilteredList } from '../assets/js/useFilteredList';
import api, { BASE_URL } from '../assets/js/axiosConfig';

const ROUTE_FLAGS = [
  { name: 'half',       label: 'Half Fare'           },
  { name: 'luggage',    label: 'Luggage'              },
  { name: 'student',    label: 'Student Concession'   },
  { name: 'adjust',     label: 'Fare Adjustment'      },
  { name: 'conc',       label: 'General Concession'   },
  { name: 'ph',         label: 'PH Concession'        },
  { name: 'pass_allow', label: 'Pass Holders'         },
  { name: 'use_stop',   label: 'Stop-based Fare'      },
];

export default function RouteListing() {

  // ── Section 1: State ────────────────────────────────────────────────────
  const [routes, setRoutes]           = useState([]);
  const [busTypes, setBusTypes]       = useState([]);
  const [stages, setStages]           = useState([]);  // NEW: for dropdown
  const [loading, setLoading]         = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode]     = useState('create');
  const [submitting, setSubmitting]   = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const emptyForm = {
    route_code: '', route_name: '', min_fare: '', fare_type: '',
    bus_type: '', start_from: 0, is_deleted: false,
    half: false, luggage: false, student: false, adjust: false,
    conc: false, ph: false, pass_allow: false, use_stop: false,
    route_stages: [],  // NEW: nested stages
  };
  const [formData, setFormData] = useState(emptyForm);

  // ── Section 2a: Search & Filter Logic ────────────────────────────────────────────
  const { filteredItems, searchTerm, setSearchTerm, resetSearch } = useFilteredList(
    routes,
    ['route_code', 'route_name']
  );

  // ── Section 2b: Fetch on mount ────────────────────────────────────────────
  useEffect(() => { fetchBusTypes(); fetchStages(); }, []);
  useEffect(() => { fetchRoutes(); }, [showDeleted]);

  // ── Section 3: API calls ─────────────────────────────────────────────────
  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const res = await api.get(`${BASE_URL}/masterdata/routes`, {
        params: { show_deleted: showDeleted }
      });
      setRoutes(res.data?.data || []);
    } catch (err) {
      console.error('Error fetching routes:', err);
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBusTypes = async () => {
    try {
      const res = await api.get(`${BASE_URL}/masterdata/dropdowns/bus-types`);
      setBusTypes(res.data?.data || []);
    } catch (err) {
      console.error('Error fetching bus types:', err);
    }
  };

  // NEW: Fetch stages for dropdown
  const fetchStages = async () => {
    try {
      const res = await api.get(`${BASE_URL}/masterdata/dropdowns/stages`);
      setStages(res.data?.data || []);
    } catch (err) {
      console.error('Error fetching stages:', err);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let response;
      if (modalMode === 'edit') {
        response = await api.put(`${BASE_URL}/masterdata/routes/update/${editingItem.id}`, formData);
      } else {
        response = await api.post(`${BASE_URL}/masterdata/routes/create`, formData);
      }
      if (response?.status === 200 || response?.status === 201) {
        window.alert(response.data.message || 'Success');
        setIsModalOpen(false);
        setFormData(emptyForm);
        fetchRoutes();
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

  // ── Section 4: Modal helpers ──────────────────────────────────────────────
  const openCreateModal = () => {
    setFormData(emptyForm);
    setEditingItem(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const openViewModal = (item) => {
    setFormData({
      ...emptyForm,
      ...item,
      bus_type: item.bus_type,
      route_stages: item.route_stages || [],
    });
    setEditingItem(item);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setFormData({
      ...emptyForm,
      ...item,
      bus_type: item.bus_type,
      route_stages: item.route_stages || [],
    });
    setEditingItem(item);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // ── Section 5: RouteStage helpers ────────────────────────────────────────
  const addStage = () => {
    setFormData(prev => ({
      ...prev,
      route_stages: [
        ...prev.route_stages,
        {
          stage: '',
          sequence_no: prev.route_stages.length + 1,
          distance: '',
          stage_local_lang: '',
        }
      ]
    }));
  };

  const updateStage = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.route_stages];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, route_stages: updated };
    });
  };

  const removeStage = (index) => {
    setFormData(prev => {
      const updated = prev.route_stages.filter((_, i) => i !== index);
      // Re-sequence
      updated.forEach((s, i) => s.sequence_no = i + 1);
      return { ...prev, route_stages: updated };
    });
  };

  const moveStage = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === formData.route_stages.length - 1) return;
    
    setFormData(prev => {
      const updated = [...prev.route_stages];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
      // Re-sequence
      updated.forEach((s, i) => s.sequence_no = i + 1);
      return { ...prev, route_stages: updated };
    });
  };

  const isReadOnly    = modalMode === 'view';
  const getModalTitle = () => ({ view: 'Route Details', edit: 'Edit Route', create: 'Create Route' }[modalMode]);

  // ── Section 6: Render ─────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Routes</h1>
          <p className="text-slate-500 mt-1">Manage bus routes for your company</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={showDeleted} onChange={() => setShowDeleted(p => !p)} className="w-4 h-4 rounded border-slate-300" />
            Show deleted
          </label>
          <button onClick={openCreateModal} className="flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
            <span className="font-medium">+ Create Route</span>
          </button>
        </div>
      </div>
      {/* Search Bar */}
      <SearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onReset={resetSearch}
        placeholder="Search by code or name..."
      />
      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bus Type</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stops</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Min Fare</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="8" className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan="8" className="px-6 py-8 text-center text-slate-500">No routes found.</td></tr>
              ) : filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-500 font-mono">#{item.id}</td>
                  <td className="px-6 py-4 text-sm text-slate-800 font-medium">{item.route_code}</td>
                  <td className="px-6 py-4 text-sm text-slate-800">{item.route_name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{item.bus_type_name || '—'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{item.route_stages?.length || 0} stops</td>
                  <td className="px-6 py-4 text-sm text-slate-600">₹{item.min_fare}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${item.is_deleted ? 'bg-red-100 text-red-700 border-red-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                      {item.is_deleted ? 'Deleted' : 'Active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center space-x-2">
                      <button onClick={() => openViewModal(item)} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors">View</button>
                      <button onClick={() => openEditModal(item)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={getModalTitle()}>
        <div className="space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Basic info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Route Code *</label>
              <input type="text" name="route_code" value={formData.route_code} onChange={handleInputChange} readOnly={isReadOnly}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-slate-500 read-only:bg-slate-50" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Route Name *</label>
              <input type="text" name="route_name" value={formData.route_name} onChange={handleInputChange} readOnly={isReadOnly}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-slate-500 read-only:bg-slate-50" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Min Fare (₹) *</label>
              <input type="number" name="min_fare" value={formData.min_fare} onChange={handleInputChange} readOnly={isReadOnly} min="0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-slate-500 read-only:bg-slate-50" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Fare Type *</label>
              <input type="number" name="fare_type" value={formData.fare_type} onChange={handleInputChange} readOnly={isReadOnly}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-slate-500 read-only:bg-slate-50" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Start From (Stage)</label>
              <input type="number" name="start_from" value={formData.start_from} onChange={handleInputChange} readOnly={isReadOnly} min="0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-slate-500 read-only:bg-slate-50" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Bus Type *</label>
            {isReadOnly ? (
              <input type="text" value={formData.bus_type_name || '—'} readOnly className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50" />
            ) : (
              <select name="bus_type" value={formData.bus_type} onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-slate-500 bg-white">
                <option value="">-- Select Bus Type --</option>
                {busTypes.map(bt => (
                  <option key={bt.id} value={bt.id}>{bt.name} ({bt.bustype_code})</option>
                ))}
              </select>
            )}
          </div>

          {/* Boolean flags */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">Allowed Options</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {ROUTE_FLAGS.map(flag => (
                <label key={flag.name} className={`flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg border ${formData[flag.name] ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>
                  <input
                    type="checkbox" name={flag.name}
                    checked={formData[flag.name] || false}
                    onChange={handleInputChange}
                    disabled={isReadOnly}
                    className="sr-only"
                  />
                  {flag.label}
                </label>
              ))}
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* ROUTE STAGES INLINE EDITOR                                     */}
          {/* ═════════════════════════════════════════════════════════════ */}
          <div className="border-t border-slate-200 pt-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Route Stops</h3>
                <p className="text-xs text-slate-500">Define the sequence of stops on this route</p>
              </div>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={addStage}
                  className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors font-medium"
                >
                  + Add Stop
                </button>
              )}
            </div>

            {formData.route_stages.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No stops added yet</p>
            ) : (
              <div className="space-y-2">
                {formData.route_stages.map((stop, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    {/* Sequence number */}
                    <div className="w-10 h-10 flex items-center justify-center bg-slate-800 text-white rounded-lg font-semibold text-sm">
                      {stop.sequence_no}
                    </div>

                    {/* Stage dropdown */}
                    <div className="flex-1">
                      {isReadOnly ? (
                        <input
                          type="text"
                          value={stop.stage_name || '—'}
                          readOnly
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
                        />
                      ) : (
                        <select
                          value={stop.stage}
                          onChange={(e) => updateStage(idx, 'stage', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
                        >
                          <option value="">-- Select Stage --</option>
                          {stages.map(s => (
                            <option key={s.id} value={s.id}>{s.stage_name} ({s.stage_code})</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Distance */}
                    <div className="w-28">
                      <input
                        type="number"
                        placeholder="Dist (km)"
                        value={stop.distance}
                        onChange={(e) => updateStage(idx, 'distance', e.target.value)}
                        readOnly={isReadOnly}
                        step="0.1"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm read-only:bg-white"
                      />
                    </div>

                    {/* Reorder buttons */}
                    {!isReadOnly && (
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => moveStage(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <i className="fas fa-chevron-up text-xs"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStage(idx, 'down')}
                          disabled={idx === formData.route_stages.length - 1}
                          className="p-1 text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <i className="fas fa-chevron-down text-xs"></i>
                        </button>
                      </div>
                    )}

                    {/* Remove button */}
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => removeStage(idx)}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <i className="fas fa-trash text-sm"></i>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Soft delete — edit only */}
          {modalMode === 'edit' && (
            <div className="flex items-center space-x-3 p-3 bg-red-50 rounded-lg border border-red-100">
              <input type="checkbox" name="is_deleted" id="route_is_deleted" checked={formData.is_deleted || false} onChange={handleInputChange} className="w-4 h-4 rounded border-slate-300" />
              <label htmlFor="route_is_deleted" className="text-sm font-medium text-red-700">Mark as deleted</label>
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-100 mt-6">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
              {isReadOnly ? 'Close' : 'Cancel'}
            </button>
            {!isReadOnly && (
              <button type="button" onClick={handleSubmit} disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 shadow-md disabled:opacity-50">
                {submitting ? 'Saving...' : modalMode === 'edit' ? 'Update' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </Modal>

    </div>
  );
}
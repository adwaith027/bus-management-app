import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import SearchBar from '../components/SearchBar';
import { useFilteredList } from '../assets/js/useFilteredList';
import { usePagination }   from '../assets/js/usePagination';
import { useModalForm }    from '../assets/js/useModalForm';
import { submitForm }      from '../assets/js/submitForm';
import api, { BASE_URL }   from '../assets/js/axiosConfig';

const emptyForm = { driver: '', conductor: '', cleaner: '', vehicle: '' };

export default function CrewAssignmentListing() {

  // ── Section 1: State ─────────────────────────────────────────────────────────
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(true);

  // Dropdown options loaded when modal opens
  const [drivers, setDrivers]       = useState([]);
  const [conductors, setConductors] = useState([]);
  const [cleaners, setCleaners]     = useState([]);
  const [vehicles, setVehicles]     = useState([]);

  // ── Section 2: Shared Hooks ──────────────────────────────────────────────────
  const { filteredItems, searchTerm, setSearchTerm, resetSearch } = useFilteredList(
    assignments, ['driver_name', 'conductor_name', 'cleaner_name', 'vehicle_reg']
  );

  const {
    currentItems, currentPage, totalPages,
    setCurrentPage, indexOfFirstItem, indexOfLastItem, getPageNumbers,
  } = usePagination(filteredItems);

  // useModalForm gives us state + setters.
  // We override openCreateModal/openViewModal/openEditModal below
  // because CrewAssignment needs custom formData mapping and dropdown fetching.
  const {
    isModalOpen, setIsModalOpen,
    modalMode, setModalMode,
    editingItem, setEditingItem,
    formData, setFormData,
    submitting, setSubmitting,
    handleInputChange,   // no checkbox logic needed here (all dropdowns)
    isReadOnly,
  } = useModalForm(emptyForm);

  // ── Section 3: Data Fetching ─────────────────────────────────────────────────
  useEffect(() => { fetchAssignments(); }, []);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const res = await api.get(`${BASE_URL}/masterdata/crew-assignments`);
      setAssignments(res.data?.data || []);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error fetching crew assignments:', err);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetches all 4 dropdowns at once, excluding already-assigned people/vehicles.
  // assignmentId lets the backend exclude the current assignment from "already taken" checks.
  const fetchDropdowns = async (assignmentId = null) => {
    try {
      const sharedParams = {
        exclude_assigned: 'true',
        ...(assignmentId ? { assignment_id: assignmentId } : {}),
      };
      const [driversRes, conductorsRes, cleanersRes, vehiclesRes] = await Promise.all([
        api.get(`${BASE_URL}/masterdata/dropdowns/employees`, { params: { type: 'DRIVER',    ...sharedParams } }),
        api.get(`${BASE_URL}/masterdata/dropdowns/employees`, { params: { type: 'CONDUCTOR', ...sharedParams } }),
        api.get(`${BASE_URL}/masterdata/dropdowns/employees`, { params: { type: 'CLEANER',   ...sharedParams } }),
        api.get(`${BASE_URL}/masterdata/dropdowns/vehicles`,  { params: sharedParams }),
      ]);
      setDrivers(driversRes.data?.data     || []);
      setConductors(conductorsRes.data?.data || []);
      setCleaners(cleanersRes.data?.data   || []);
      setVehicles(vehiclesRes.data?.data   || []);
    } catch (err) {
      console.error('Error fetching dropdowns:', err);
    }
  };

  // ── Section 4: Custom Modal Openers ─────────────────────────────────────────
  // These override the standard openCreateModal/openViewModal/openEditModal
  // from useModalForm because CrewAssignment:
  //   - Needs to explicitly map FK id fields (item.driver, not the whole item)
  //   - Needs to call fetchDropdowns() when opening create/edit

  const openCreateModal = () => {
    setFormData(emptyForm);
    setEditingItem(null);
    setModalMode('create');
    setIsModalOpen(true);
    fetchDropdowns();
  };

  const openViewModal = (item) => {
    setFormData({ driver: item.driver || '', conductor: item.conductor || '', cleaner: item.cleaner || '', vehicle: item.vehicle || '' });
    setEditingItem(item);
    setModalMode('view');
    setIsModalOpen(true);
    // No dropdown fetch needed in view mode
  };

  const openEditModal = (item) => {
    setFormData({ driver: item.driver || '', conductor: item.conductor || '', cleaner: item.cleaner || '', vehicle: item.vehicle || '' });
    setEditingItem(item);
    setModalMode('edit');
    setIsModalOpen(true);
    fetchDropdowns(item.id); // Pass item.id so backend excludes this assignment from conflict checks
  };

  // ── Section 5: Submit & Delete ───────────────────────────────────────────────
  const handleSubmit = () => {
    // Front-end validation before hitting the API
    if (!formData.driver)    return window.alert('Driver is required');
    if (!formData.conductor) return window.alert('Conductor is required');
    if (!formData.vehicle)   return window.alert('Vehicle is required');
    if (String(formData.driver) === String(formData.conductor)) {
      return window.alert('Conductor must be different from driver');
    }

    // Strip empty cleaner to avoid sending null/'' — backend expects it absent or a valid ID
    const payload = {
      driver:    formData.driver,
      conductor: formData.conductor,
      vehicle:   formData.vehicle,
      ...(formData.cleaner && { cleaner: formData.cleaner }),
    };

    submitForm({
      modalMode, editingItem, formData,
      createUrl: `${BASE_URL}/masterdata/crew-assignments/create`,
      updateUrl: `${BASE_URL}/masterdata/crew-assignments/update/${editingItem?.id}`,
      setSubmitting,
      payload,   // override formData with the cleaned payload
      onSuccess: () => { setIsModalOpen(false); setFormData(emptyForm); fetchAssignments(); },
    });
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm(`Delete assignment #${item.id}? This will free the selected crew and vehicle.`);
    if (!confirmed) return;
    try {
      const response = await api.delete(`${BASE_URL}/masterdata/crew-assignments/delete/${item.id}`);
      window.alert(response.data?.message || 'Crew assignment deleted successfully');
      fetchAssignments();
    } catch (err) {
      if (!err.response) return window.alert('Server unreachable. Try later.');
      const { data } = err.response;
      const firstError = data.errors ? Object.values(data.errors)[0][0] : (data.error || data.message);
      window.alert(firstError || 'Delete failed');
    }
  };

  // ── Section 6: Helpers ───────────────────────────────────────────────────────
  const getModalTitle = () => ({ view: 'Crew Assignment Details', edit: 'Edit Crew Assignment', create: 'Create Crew Assignment' }[modalMode]);

  // Renders a dropdown (edit/create) or read-only text field (view) for each crew role
  const renderDropdown = (name, label, options, required = false) => (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-slate-700">{label}{required ? ' *' : ' (optional)'}</label>
      {isReadOnly ? (
        <input type="text"
          value={(
            name === 'driver'    ? editingItem?.driver_name :
            name === 'conductor' ? editingItem?.conductor_name :
            name === 'cleaner'   ? editingItem?.cleaner_name :
            name === 'vehicle'   ? editingItem?.vehicle_reg : ''
          ) || '—'}
          readOnly className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-600" />
      ) : (
        <select name={name} value={formData[name]} onChange={handleInputChange}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white transition-all">
          <option value="">-- {required ? 'Select' : 'None'} --</option>
          {options.map(o => (
            <option key={o.id} value={o.id}>
              {o.employee_name ? `${o.employee_name} (${o.employee_code})` : o.bus_reg_num}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  // ── Section 7: Render ────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-10 min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent tracking-tight">
            Crew Assignments
          </h1>
          <p className="text-slate-600 mt-1.5">Assign drivers, conductors and cleaners to vehicles</p>
        </div>
        <button onClick={openCreateModal} className="flex items-center justify-center bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-white px-6 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
          <span className="mr-2 text-lg">+</span>
          <span className="font-medium">Create Assignment</span>
        </button>
      </div>

      {/* Search Bar */}
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} onReset={resetSearch} placeholder="Search by driver, conductor, cleaner, or vehicle..." />

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200/60 overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-200">
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Vehicle</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Driver</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Conductor</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Cleaner</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800"></div>
                    <p className="text-slate-500 mt-3">Loading assignments...</p>
                  </div>
                </td></tr>
              ) : currentItems.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center">
                  <p className="text-slate-500 font-medium">No crew assignments found</p>
                  <p className="text-slate-400 text-sm mt-1">Create your first assignment to get started</p>
                </td></tr>
              ) : currentItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-all duration-150">
                  <td className="px-6 py-4"><span className="text-sm text-slate-500 font-mono">#{item.id}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-slate-800 font-semibold">{item.vehicle_reg || '—'}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-slate-700">{item.driver_name || '—'}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-slate-600">{item.conductor_name || '—'}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-slate-600">{item.cleaner_name || '—'}</span></td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end items-center gap-2">
                      <button onClick={() => openViewModal(item)} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all duration-150">View</button>
                      <button onClick={() => openEditModal(item)} className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all duration-150">Edit</button>
                      <button onClick={() => handleDelete(item)} className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-150">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && assignments.length > 0 && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Showing <span className="font-medium text-slate-900">{indexOfFirstItem + 1}</span> to{' '}
                <span className="font-medium text-slate-900">{Math.min(indexOfLastItem, assignments.length)}</span> of{' '}
                <span className="font-medium text-slate-900">{assignments.length}</span> results
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150">Previous</button>
                <div className="flex items-center gap-1">
                  {getPageNumbers().map(pageNum => (
                    <button key={pageNum} onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[2.5rem] px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 ${currentPage === pageNum ? 'bg-slate-800 text-white shadow-md' : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-50'}`}>
                      {pageNum}
                    </button>
                  ))}
                </div>
                <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150">Next</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={getModalTitle()}>
        <div className="space-y-5">
          {renderDropdown('driver',    'Driver',    drivers,    true)}
          {renderDropdown('conductor', 'Conductor', conductors, true)}
          {renderDropdown('cleaner',   'Cleaner',   cleaners,   false)}
          {renderDropdown('vehicle',   'Vehicle',   vehicles,   true)}

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-all">
              {isReadOnly ? 'Close' : 'Cancel'}
            </button>
            {!isReadOnly && (
              <button type="button" onClick={handleSubmit} disabled={submitting} className="px-5 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-xl hover:bg-slate-700 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {submitting ? 'Saving...' : modalMode === 'edit' ? 'Update' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </Modal>

    </div>
  );
}

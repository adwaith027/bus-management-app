import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import api, { BASE_URL } from '../assets/js/axiosConfig';
import { useNavigate } from 'react-router-dom';

export default function UserListing() {
  // ========== STATE MANAGEMENT ==========
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modal Management
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create', 'view', 'edit'
  const [editingUser, setEditingUser] = useState(null);

  const navigate=useNavigate()

  const handleLogout = async () => {
      try {
        await api.post(`${BASE_URL}/logout/`);
      } catch {}
      finally {
        localStorage.clear();
        navigate("/login");
      }
    };

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    role: 'user',
    company_id: '',
    password: ''
  });

  // ========== DATA FETCHING ==========
  useEffect(() => {
    fetchUsers();
    fetchCompanies();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get(`${BASE_URL}/get_users/`);
      setUsers(response.data.data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await api.get(`${BASE_URL}/customer-data/`);
      setCompanies(response.data?.data || []); 
    } catch (err) {
      console.error("Error fetching companies:", err);
      setCompanies([]);
    }
  };

  // ========== HELPER FUNCTIONS ==========
  const getCompanyNameById = (companyId) => {
    if (!companyId) return 'N/A';
    const company = companies.find(comp => comp.id === companyId);
    return company ? company.company_name : 'N/A';
  };

  const resetFormData = () => {
    setFormData({
      username: '',
      email: '',
      role: 'user',
      company_id: '',
      password: ''
    });
  };

  const populateFormData = (user) => {
    setFormData({
      username: user.username || '',
      email: user.email || '',
      role: user.role || 'user',
      company_id: user.company || '',
      password: '' // Never populate password
    });
  };

  // ========== MODAL HANDLERS ==========
  const openCreateModal = () => {
    setModalMode('create');
    setEditingUser(null);
    resetFormData();
    setIsModalOpen(true);
  };

  const openViewModal = (user) => {
    setModalMode('view');
    setEditingUser(user);
    populateFormData(user);
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setModalMode('edit');
    setEditingUser(user);
    populateFormData(user);
    setIsModalOpen(true);
  };

  const openPasswordModal = (user) => {
    setEditingUser(user);
    setIsPasswordModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setModalMode('create');
    resetFormData();
  };

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setEditingUser(null);
  };

  // ========== FORM HANDLERS ==========
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let response;
      if (modalMode === 'edit') {
        // Update existing user (without password)
        const updateData = {
          username: formData.username,
          email: formData.email,
          role: formData.role,
          company_id: formData.company_id
        };
        response = await api.put(`${BASE_URL}/update_user/${editingUser.id}/`, updateData);
      } else if (modalMode === 'create') {
        // Create new user (with password)
        response = await api.post(`${BASE_URL}/create_user/`, formData);
      }

      if (response?.status === 200 || response?.status === 201) {
        window.alert(response.data.message || 'Operation successful!');
        closeModal();
        fetchUsers();
      }
    } catch (err) {
      console.error("Error:", err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Operation failed';
      window.alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // ========== PASSWORD CHANGE HANDLER ==========
  const handlePasswordChange = async (newPassword) => {
    try {
      const response = await api.post(`${BASE_URL}/change_user_password/${editingUser.id}/`, {
        new_password: newPassword
      });
      
      if (response?.status === 200) {
        window.alert(response.data.message || 'Password changed successfully!');
        closePasswordModal();
        const current_user=JSON.parse(localStorage.getItem('user'))
        if (!current_user) return;

        if(current_user.id==editingUser.id){
          console.log("LOGOUT")
          handleLogout();
        }
      }
    } catch (err) {
      console.error("Password change error:", err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Password change failed';
      throw new Error(errorMessage);
    }
  };

  // ========== HELPER FUNCTIONS FOR STYLING ==========
  const getRoleBadgeStyle = (role) => {
    switch(role) {
      case 'branch_admin': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'super_admin': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const formatRole = (role) => {
    return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getModalTitle = () => {
    if (modalMode === 'view') return 'User Details';
    if (modalMode === 'edit') return 'Edit User';
    return 'Create User Account';
  };

  const isReadOnly = modalMode === 'view';

  // ========== RENDER ==========
  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50 animate-fade-in">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">User Management</h1>
          <p className="text-slate-500 mt-1">Manage system users and access roles</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          <span className="font-medium">Add New User</span>
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Joined Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                    <div className="flex justify-center items-center space-x-2">
                      <svg className="animate-spin h-5 w-5 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Loading users...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">No users found.</td></tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-500 font-mono">#{user.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{user.username}</span>
                        <span className="text-xs text-slate-500">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeStyle(user.role)}`}>
                        {formatRole(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {getCompanyNameById(user.company)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {user.date_joined ? new Date(user.date_joined).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center space-x-2">
                        <button
                          onClick={() => openViewModal(user)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                          title="View"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openPasswordModal(user)}
                          className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                          title="Change Password"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Details/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={getModalTitle()}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Username</label>
            <input 
              type="text" 
              name="username" 
              value={formData.username} 
              onChange={handleInputChange} 
              required 
              readOnly={isReadOnly}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Email Address</label>
            <input 
              type="email" 
              name="email" 
              value={formData.email} 
              onChange={handleInputChange} 
              required 
              readOnly={isReadOnly}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all read-only:bg-slate-50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Role</label>
              <div className="relative">
                <select 
                  name="role" 
                  value={formData.role} 
                  onChange={handleInputChange} 
                  required
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all appearance-none bg-white disabled:bg-slate-50"
                >
                  <option value="user">User</option>
                  <option value="branch_admin">Branch Admin</option>
                </select>
                {!isReadOnly && (
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Assign Company</label>
              <div className="relative">
                <select 
                  name="company_id" 
                  value={formData.company_id} 
                  onChange={handleInputChange} 
                  required
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all appearance-none bg-white disabled:bg-slate-50"
                >
                  <option value="">-- Select Company --</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.company_name}
                    </option>
                  ))}
                </select>
                {!isReadOnly && (
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Password field only shown when creating new user */}
          {modalMode === 'create' && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input 
                type="password" 
                name="password" 
                value={formData.password} 
                onChange={handleInputChange} 
                required 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all"
              />
            </div>
          )}

          {/* Note for editing users */}
          {modalMode === 'edit' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700 flex items-start space-x-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>To change the password, use the "Change Password" button in the actions menu.</span>
              </p>
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-100 mt-6">
            <button 
              type="button" 
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"
              onClick={closeModal}
            >
              {modalMode === 'view' ? 'Close' : 'Cancel'}
            </button>
            {modalMode !== 'view' && (
              <button 
                type="submit" 
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-800 border border-transparent rounded-lg hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 shadow-md transition-all flex items-center"
              >
                {submitting && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {submitting ? 'Saving...' : modalMode === 'edit' ? 'Update User' : 'Create User'}
              </button>
            )}
          </div>
        </form>
      </Modal>

      {/* Password Change Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={closePasswordModal}
        onSubmit={handlePasswordChange}
        userName={editingUser?.username}
      />
    </div>
  );
}
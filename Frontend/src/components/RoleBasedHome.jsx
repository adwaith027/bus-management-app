import AdminHome from '../pages/AdminHome';
import CompanyDashboard from '../pages/CompanyDashboard';
import UserHome from '../pages/UserHome';

export default function RoleBasedHome() {
  const storedUser = localStorage.getItem('user');
  const user = storedUser ? JSON.parse(storedUser) : null;
  const role = user?.role;

  if (role === 'superadmin') return <AdminHome />;
  if (role === 'company_admin') return <CompanyDashboard />;
  if (role === 'user') return <UserHome />;

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold">Unknown Role</h1>
      <p className="text-slate-600">Contact admin.</p>
    </div>
  );
}

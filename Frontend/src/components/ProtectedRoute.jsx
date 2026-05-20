import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api, { BASE_URL } from '../assets/js/axiosConfig';
import { PropagateLoader } from "react-spinners";

export default function ProtectedRoute() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  // Verify authentication on mount
  useEffect(() => {
    verifyAuthFromBackend();
  }, []);

  // Redirect immediately if another tab logs out (clears localStorage)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'user' && e.newValue === null) {
        navigate('/login', { replace: true });
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [navigate]);

  const verifyAuthFromBackend = async () => {
    try {
      // Interceptor handles 401 → refresh → retry transparently.
      // Interceptor handles 403 → clear storage + hard redirect.
      const response = await api.get(`${BASE_URL}/verify-auth`);
      if (response.data.authenticated) {
        setIsAuthenticated(true);
        setUserRole(response.data.user.role);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      } else {
        setIsAuthenticated(false);
        localStorage.removeItem('user');
      }
    } catch (error) {
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        // Interceptor already handled redirect; mark not authenticated
        setIsAuthenticated(false);
        localStorage.removeItem('user');
      } else {
        // Network/server error — keep cached session optimistically
        const cached = localStorage.getItem('user');
        if (cached) {
          try {
            const cachedUser = JSON.parse(cached);
            setIsAuthenticated(true);
            setUserRole(cachedUser.role);
          } catch {
            setIsAuthenticated(false);
            localStorage.removeItem('user');
          }
        } else {
          setIsAuthenticated(false);
        }
      }
    } finally {
      setLoading(false);
    }
  };


  // Check if user is trying to access pages they shouldn't
  useEffect(() => {
    if (!loading && isAuthenticated && userRole) {
      const path = location.pathname;
      const isMasterDataPath = path.includes('/master-data/');
      
      // Superadmin restrictions: cannot access company admin pages
      if (userRole === 'superadmin') {
        if (path.includes('/depots') ||
            path.includes('/ticket-data') ||
            path.includes('/trip-data') ||
            path.includes('/schedule-data') ||
            isMasterDataPath) {
          window.alert('Access Denied: This page is only for Company Admins');
          navigate('/dashboard', { replace: true });
        }
      }
      
      // Company admin restrictions: cannot access superadmin pages
      if (userRole === 'company_admin') {
        if (path.includes('/companies') ||
            path.includes('/users') ||
            path.includes('/device-approvals') ||
            path.includes('/dealers') ||
            path.includes('/executive-dashboard') ||
            path.includes('/dealer-dashboard')) {
          window.alert('Access Denied: This page is only for System Admins');
          navigate('/dashboard', { replace: true });
        }
      }
      
      if (userRole === 'user') {
        if (path.includes('/companies') ||
            path.includes('/users') ||
            path.includes('/device-approvals') ||
            path.includes('/depots') ||
            path.includes('/ticket-data') ||
            path.includes('/trip-data') ||
            path.includes('/schedule-data') ||
            isMasterDataPath ||
            path.includes('/dealers') ||
            path.includes('/dealer-dashboard') ||
            path.includes('/executive-dashboard')) {
          window.alert('Access Denied: This page is only for Administrators');
          navigate('/dashboard', { replace: true });
        }
      }

      if (userRole === 'executive') {
        if (path.includes('/companies') ||
            path.includes('/users') ||
            path.includes('/device-approvals') ||
            path.includes('/depots') ||
            path.includes('/ticket-data') ||
            path.includes('/trip-data') ||
            path.includes('/schedule-data') ||
            isMasterDataPath ||
            path.includes('/dealers') ||
            path.includes('/dealer-dashboard')) {
          window.alert('Access Denied: This page is only for Administrators');
          navigate('/dashboard', { replace: true });
        }
      }

      if (userRole === 'dealer_admin') {
        // dealer_admin CAN access /companies (their mapped companies) and /users
        if (path.includes('/device-approvals') ||
            path.includes('/depots') ||
            path.includes('/ticket-data') ||
            path.includes('/trip-data') ||
            path.includes('/schedule-data') ||
            isMasterDataPath ||
            path.includes('/settlements') ||
            path.includes('/dealers') ||
            path.includes('/executive-dashboard')) {
          window.alert('Access Denied: This page is not available for Dealer Admins');
          navigate('/dashboard', { replace: true });
        }
      }

      if (userRole === 'company_user') {
        const allowed = ['/dashboard/ticket-data', '/dashboard/trip-data', '/dashboard/schedule-data'];
        const isAllowed = path === '/dashboard' || allowed.some(p => path.startsWith(p));
        if (!isAllowed) {
          window.alert('Access Denied: This page is not available for your role');
          navigate('/dashboard', { replace: true });
        }
      }

      if (userRole === 'production') {
        // Production users can only access device-registry
        if (!path.includes('/device-registry')) {
          navigate('/dashboard/device-registry', { replace: true });
        }
      }
    }
  }, [loading, isAuthenticated, userRole, location.pathname, navigate]);

  // Redirect to login if not authenticated
  if (!loading && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If loading but no cached session → show full screen spinner (first login)
  const hasCachedSession = !!localStorage.getItem('user');
  if (loading && !hasCachedSession) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}>
        <PropagateLoader />
      </div>
    );
  }

  // If loading but cached session exists → show page with non-blocking overlay
  return (
    <>
      <Outlet />
      {loading && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          pointerEvents: 'all',
        }} />
      )}
    </>
  );
}

import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api, { BASE_URL, refreshApi } from '../assets/js/axiosConfig';  // imported refreshApi
import {BarLoader,BeatLoader,BounceLoader,CircleLoader,ClimbingBoxLoader,ClipLoader,ClockLoader,DotLoader,FadeLoader,GridLoader,HashLoader,MoonLoader,PacmanLoader,PropagateLoader,PulseLoader,PuffLoader,RingLoader,RiseLoader,RotateLoader,ScaleLoader,SkewLoader,SquareLoader,SyncLoader} from "react-spinners";

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

  const verifyAuthFromBackend = async () => {
    try {
      // Step 1: Refresh token first using refreshApi (no interceptor loops)
      // If this fails, the user's session is truly expired → go to login
      await refreshApi.post(`${BASE_URL}/token/refresh`);

      // Step 2: Now verify auth with a guaranteed fresh token
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
      console.error('Auth verification failed:', error);
      setIsAuthenticated(false);
      localStorage.removeItem('user');
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
            path.includes('/ticket-report') || 
            path.includes('/trip-close-report') ||
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
            path.includes('/ticket-report') || 
            path.includes('/trip-close-report') ||
            isMasterDataPath ||
            path.includes('/dealers') ||
            path.includes('/dealer-dashboard') ||
            path.includes('/executive-dashboard')) {
          window.alert('Access Denied: This page is only for Administrators');
          navigate('/dashboard', { replace: true });
        }
      }

      if (userRole === 'executive_user') {
        if (path.includes('/companies') || 
            path.includes('/users') ||
            path.includes('/device-approvals') ||
            path.includes('/depots') || 
            path.includes('/ticket-report') || 
            path.includes('/trip-close-report') ||
            isMasterDataPath ||
            path.includes('/dealers') ||
            path.includes('/dealer-dashboard')) {
          window.alert('Access Denied: This page is only for Administrators');
          navigate('/dashboard', { replace: true });
        }
      }

      if (userRole === 'dealer_user') {
        if (path.includes('/companies') || 
            path.includes('/users') ||
            path.includes('/device-approvals') ||
            path.includes('/depots') || 
            path.includes('/ticket-report') || 
            path.includes('/trip-close-report') ||
            isMasterDataPath ||
            path.includes('/settlements') ||
            path.includes('/dealers') ||
            path.includes('/executive-dashboard')) {
          window.alert('Access Denied: This page is only for Dealers');
          navigate('/dashboard', { replace: true });
        }
      }
    }
  }, [loading, isAuthenticated, userRole, location.pathname, navigate]);

  // Show loading state
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        <PropagateLoader /> 
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Render protected content
  return <Outlet />;
}

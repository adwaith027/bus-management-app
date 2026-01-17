import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api, { BASE_URL } from '../assets/js/axiosConfig';
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
      const response = await api.get(`${BASE_URL}/verify-auth/`);
      if (response.data.authenticated) {
        setIsAuthenticated(true);
        setUserRole(response.data.user.role);
        // Update localStorage with verified user data
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
      
      // Superadmin restrictions: cannot access branch admin pages
      if (userRole === 'superadmin') {
        if (path.includes('/branches') || 
            path.includes('/ticket-report') || 
            path.includes('/trip-close-report')) {
          window.alert('Access Denied: This page is only for Branch Admins');
          navigate('/dashboard', { replace: true });
        }
      }
      
      // Branch admin restrictions: cannot access superadmin pages
      if (userRole === 'company_admin') {
        if (path.includes('/companies') || 
            path.includes('/users')) {
          window.alert('Access Denied: This page is only for SuperAdmins');
          navigate('/dashboard', { replace: true });
        }
      }
      
      if (userRole === 'user') {
        if (path.includes('/companies') || 
            path.includes('/users') ||
            path.includes('/branches') || 
            path.includes('/ticket-report') || 
            path.includes('/trip-close-report')) {
          window.alert('Access Denied: This page is only for Administrators');
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
        {/* Loading... */}
        {/* <ClimbingBoxLoader /> */}
        {/* <GridLoader /> */}
        {/* <HashLoader /> */}
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
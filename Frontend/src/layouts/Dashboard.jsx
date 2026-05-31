import { useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api, { BASE_URL } from '../assets/js/axiosConfig';

const IDLE_MS = 20 * 60 * 1000; // 20 minutes

export default function Dashboard() {
  const navigate = useNavigate();
  const timerRef = useRef(null);

  // AUTO-LOGOUT DISABLED — ghost session issue, see pending-implementations.txt
  // Re-enable once backend idle check + per-device-type thresholds are implemented.
  // useEffect(() => {
  //   const logout = async () => {
  //     try { await api.post(`${BASE_URL}/logout`, undefined, { timeout: 0 }); } catch {}
  //     localStorage.removeItem('user');
  //     navigate('/login');
  //   };
  //   const reset = () => {
  //     clearTimeout(timerRef.current);
  //     timerRef.current = setTimeout(logout, IDLE_MS);
  //   };
  //   const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
  //   events.forEach(e => window.addEventListener(e, reset, { passive: true }));
  //   reset();
  //   return () => {
  //     events.forEach(e => window.removeEventListener(e, reset));
  //     clearTimeout(timerRef.current);
  //   };
  // }, [navigate]);

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-slate-100 text-slate-900">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto pt-20 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api, { BASE_URL } from '../assets/js/axiosConfig';

const IDLE_MS = 20 * 60 * 1000; // 20 minutes

export default function Dashboard() {
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const location = useLocation();
  const alertsShownRef = useRef(false);
  const [loginAlerts, setLoginAlerts] = useState(() => {
    if (!alertsShownRef.current && location.state?.loginAlerts?.length) {
      alertsShownRef.current = true;
      return location.state.loginAlerts;
    }
    return [];
  });

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

      {loginAlerts.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', width: '100%', maxWidth: 460, padding: '28px 28px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>Login Alerts</p>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{loginAlerts.length} notification{loginAlerts.length > 1 ? 's' : ''} require your attention</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {loginAlerts.map((n, i) => {
                const isError = n.type === 'license_expired' || n.type === 'dealer_license_expired';
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 12px', borderRadius: 10,
                    background: isError ? '#fef2f2' : '#fffbeb',
                    border: `1px solid ${isError ? '#fecaca' : '#fde68a'}`,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isError ? '#dc2626' : '#d97706'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      {isError
                        ? <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>
                        : <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>}
                    </svg>
                    <p style={{ fontSize: 13, color: isError ? '#b91c1c' : '#92400e', margin: 0, lineHeight: 1.4 }}>{n.message}</p>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setLoginAlerts([])}
              style={{ width: '100%', padding: '12px 0', background: '#1e293b', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

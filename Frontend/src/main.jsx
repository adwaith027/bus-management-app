import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'

import './index.css'

import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './layouts/Dashboard'
import RoleBasedHome from './components/RoleBasedHome'
import ProtectedRoute from './components/ProtectedRoute'

import CompanyListing from './pages/CompanyListing'
import UserListing from './pages/UserListing'
import TicketReport from './pages/TicketReport'
import TripcloseReport from './pages/TripcloseReport'
import BranchListing from './pages/BranchListing'
import SettlementPage from './pages/SettlementPage'
import DealerManagement from './pages/DealerManagement'
import DealerDashboard from './pages/DealerDashboard'
import ExecutiveDashboard from './pages/ExecutiveDashboard'
import DeviceApprovals from './pages/DeviceApprovals'
import NotFound from './components/NotFound'

const router = createBrowserRouter([
  {
    path:'*',
    element:<NotFound />
  },
  {
    path: '/',
    element: <Navigate to="/login" replace />
  },
  {
    path: '/signup',
    element: <Signup />
  },
  {
    path: '/login',
    element: <Login />
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/dashboard',
        element: <Dashboard />,
        children: [
          {
            index: true,
            element: <RoleBasedHome />
          },
          {
            path: 'companies',
            element: <CompanyListing />
          },
          {
            path: 'users',
            element: <UserListing />
          },
          {
            path: 'branches',
            element: <BranchListing />
          },
          {
            path: 'ticket-report',
            element: <TicketReport />
          },
          {
            path: 'trip-close-report',
            element: <TripcloseReport />
          },
          {
            path: 'settlements',
            element: <SettlementPage />
          },
          {
            path: 'dealers',
            element: <DealerManagement />
          },
          {
            path: 'device-approvals',
            element: <DeviceApprovals />
          },
          {
            path: 'dealer-dashboard',
            element: <DealerDashboard />
          },
          {
            path: 'executive-dashboard',
            element: <ExecutiveDashboard />
          },
        ]
      }
    ]
  }
]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);

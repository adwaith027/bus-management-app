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

const router = createBrowserRouter([
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
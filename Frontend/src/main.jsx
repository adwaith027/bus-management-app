import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'


import './index.css'

import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import Dashboard from './layouts/Dashboard'
import RoleBasedHome from './components/RoleBasedHome'
import ProtectedRoute from './components/ProtectedRoute'

import CompanyListing from './pages/listings/CompanyListing'
import Clients from './pages/listings/Clients'
import UserListing from './pages/listings/UserListing'
import DepotListing from './pages/listings/DepotListing'
import VehicleCombined from './pages/listings/VehicleCombined'
import CurrencyListing from './pages/listings/CurrencyListing'
import RouteListing from './pages/listings/RouteListing'
import EmployeeCombined from './pages/listings/EmployeeCombined'

import CrewAssignmentListing from './pages/operations/CrewAssignmentListing'
import DealerManagement from './pages/operations/DealerManagement'
import DeviceApprovals from './pages/operations/DeviceApprovals'
import DeviceRegistry from './pages/operations/DeviceRegistry'
import FareEditor from './pages/operations/FareEditor'
import StageEditor from './pages/operations/StageEditor'
import ExpenseMasterPage from './pages/operations/ExpenseMasterPage'

import TicketReport from './pages/reports/TicketReport'
import TripcloseReport from './pages/reports/TripcloseReport'
import SettlementsLayout from './pages/reports/settlements/SettlementsLayout'

import TransactionPosting from './pages/reports/settlements/TransactionPosting'
import PayoutPosting from './pages/reports/settlements/PayoutPosting'

import MdbImport from './pages/tools/MdbImport'
import SettingsPage from './pages/tools/SettingsPage'
import DeviceDownload from './pages/tools/DeviceDownload'

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
            path: 'clients',
            element: <Clients />
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
            path: 'depots',
            element: <DepotListing />
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
            element: <SettlementsLayout />,
            children: [
              { index: true, element: <Navigate to="transactions" replace /> },
              { path: 'transactions', element: <TransactionPosting /> },
              { path: 'payouts', element: <PayoutPosting /> },
            ]
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
            path: 'device-registry',
            element: <DeviceRegistry />
          },
          {
            path: 'data-import',
            element: <MdbImport/>
          },
          {
            path: 'master-data/currencies',
            element: <CurrencyListing />
          },
          {
            path: 'master-data/employees',
            element: <EmployeeCombined />
          },
          {
            path: 'master-data/vehicles',
            element: <VehicleCombined />
          },
          {
            path: 'master-data/routes',
            element: <RouteListing />
          },
          {
            path: 'master-data/fares',
            element: <FareEditor />
          },
          {
            path: 'master-data/stages',
            element: <StageEditor />
          },
          {
            path: 'master-data/expense-master',
            element: <ExpenseMasterPage />
          },
          {
            path: 'master-data/crew-assignments',
            element: <CrewAssignmentListing />
          },
          {
            path: 'master-data/settings',
            element: <SettingsPage />
          },
          {
            path: 'device-download',
            element: <DeviceDownload />
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
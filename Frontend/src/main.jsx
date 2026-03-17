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
import DepotListing from './pages/DepotListing'
import SettlementPage from './pages/SettlementPage'
import DealerManagement from './pages/DealerManagement'
import DeviceApprovals from './pages/DeviceApprovals'
import NotFound from './components/NotFound'
import MdbImport from './pages/MdbImport'
import BusTypeListing from './pages/BusTypeListing'
import EmployeeTypeListing from './pages/EmployeeTypeListing'
import StageListing from './pages/StageListing'
import CurrencyListing from './pages/CurrencyListing'
import EmployeeListing from './pages/EmployeeListing'
import VehicleListing from './pages/VehicleListing'
import RouteListing from './pages/RouteListing'
import CrewAssignmentListing from './pages/CrewAssignmentListing'
import FareEditor from './pages/FareEditor'
import SettingsPage from './pages/SettingsPage'

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
            path: 'data-import',
            element: <MdbImport/>
          },
          {
            path: 'master-data/bus-types',
            element: <BusTypeListing />
          },
          {
            path: 'master-data/employee-types',
            element: <EmployeeTypeListing />
          },
          {
            path: 'master-data/stages',
            element: <StageListing />
          },
          {
            path: 'master-data/currencies',
            element: <CurrencyListing />
          },
          {
            path: 'master-data/employees',
            element: <EmployeeListing />
          },
          {
            path: 'master-data/vehicles',
            element: <VehicleListing />
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
            path: 'master-data/crew-assignments',
            element: <CrewAssignmentListing />
          },
          {
            path: 'master-data/settings',
            element: <SettingsPage />
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
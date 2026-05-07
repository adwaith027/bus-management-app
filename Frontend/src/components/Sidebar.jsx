import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Building2, Users, Handshake,
  SmartphoneNfc, FileInput, Warehouse, Database,
  BarChart2, Receipt, LogOut, Menu,
  AlertTriangle, XCircle, QrCode,
  ChevronDown, ChevronLeft, ChevronRight,
  Coins, Users2,
  Route, Truck, CalendarCog, Settings,
  Ticket, TrendingDown, IndianRupee, Cpu, MonitorDown,
} from "lucide-react";
import api, { BASE_URL } from "../assets/js/axiosConfig";
import cacheManager from "../assets/js/reportCache";

// ─────────────────────────────────────────────────────────────────────────────
// SUB-LINK
// ─────────────────────────────────────────────────────────────────────────────
function SubLink({ to, icon: Icon, label, onClose }) {
  return (
    <NavLink
      to={to}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors duration-150 ${
          isActive
            ? "bg-slate-100 text-slate-900 font-semibold"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        }`
      }
    >
      {Icon && <Icon size={13} className="shrink-0" />}
      <span>{label}</span>
    </NavLink>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV ITEM
// ─────────────────────────────────────────────────────────────────────────────
function NavItem({ to, icon: Icon, label, isCollapsed, onClose, end }) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        onClick={onClose}
        className={({ isActive }) =>
          `flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
            isActive
              ? "bg-slate-100 text-slate-900"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`
        }
      >
        <Icon size={17} className="shrink-0" />

        <span
          className={`ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 ${
            isCollapsed ? "max-w-0 opacity-0" : "max-w-[200px] opacity-100"
          }`}
        >
          {label}
        </span>
      </NavLink>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DROPDOWN SECTION
// ─────────────────────────────────────────────────────────────────────────────
function DropdownSection({ icon: Icon, label, isCollapsed, isOpen, onToggle, children }) {
  return (
    <li>
      <button
        onClick={onToggle}
        style={{ cursor: "pointer" }}
        className="w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      >
        <Icon size={17} className="shrink-0" />

        <span
          className={`ml-3 flex items-center justify-between flex-1 whitespace-nowrap overflow-hidden transition-all duration-300 ${
            isCollapsed ? "max-w-0 opacity-0" : "max-w-[220px] opacity-100"
          }`}
        >
          <span>{label}</span>
          <ChevronDown
            size={14}
            className={`shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180 text-slate-800" : "text-slate-400"}`}
          />
        </span>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ${
          isCollapsed || !isOpen ? "max-h-0 opacity-0" : "max-h-[600px] opacity-100"
        }`}
      >
        <div className="ml-3 pl-5 border-l border-slate-200 mt-1 mb-1 space-y-0.5">
          {children}
        </div>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION LABEL
// ─────────────────────────────────────────────────────────────────────────────
function SectionLabel({ label, isCollapsed }) {
  if (isCollapsed) {
    return (
      <li>
        <div className="border-t border-slate-200 mx-2 my-2" />
      </li>
    );
  }
  return (
    <li className="px-3 pt-4 pb-1">
      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold select-none">
        {label}
      </span>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const [isOpen,         setIsOpen]         = useState(false);
  const [isCollapsed,    setIsCollapsed]    = useState(false);
  const [reportsOpen,    setReportsOpen]    = useState(false);
  const [masterDataOpen, setMasterDataOpen] = useState(false);
  const navigate = useNavigate();

  const user     = JSON.parse(localStorage.getItem("user") || "{}");
  const role     = user?.role;
  const username = user?.username || user?.name || "User";

  const handleLogout = async () => {
    const deviceUid = localStorage.getItem("device_uid");
    const body = deviceUid ? { device_uid: deviceUid } : {};
    try { await api.post(`${BASE_URL}/logout`, body); } catch {}
    finally {
      cacheManager.invalidateAll();
      ["user","authToken","refreshToken","userRole","device_uid"]
        .forEach(k => localStorage.removeItem(k));
      navigate("/login");
    }
  };

  const getLicenseWarning = () => {
    const validTill = user?.valid_till;
    if (!validTill) return null;
    const [day, month, year] = validTill.split("-");
    const days = Math.ceil((new Date(year, month - 1, day) - new Date()) / 86400000);
    if (days < 0)   return { message: "License Expired!",                                       type: "error"   };
    if (days === 0) return { message: "License expires today!",                                  type: "error"   };
    if (days <= 10) return { message: `License expires in ${days} day${days !== 1 ? "s" : ""}`, type: "warning" };
    return null;
  };
  const warning = getLicenseWarning();

  const handleCollapse = () => {
    setIsCollapsed(prev => {
      if (!prev) { setReportsOpen(false); setMasterDataOpen(false); }
      return !prev;
    });
  };

  const close = () => setIsOpen(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-50 p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl shadow-md lg:hidden"
      >
        <Menu size={20} />
      </button>

      {/* Mobile backdrop */}
      <div
        onClick={close}
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity duration-300 lg:hidden ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* ── SIDEBAR PANEL ─────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed top-0 left-0 h-screen z-40 flex flex-col
          bg-white border-r border-slate-200
          transition-all duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
          ${isCollapsed ? "lg:w-[72px]" : "lg:w-64"}
        `}
      >

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="relative h-16 flex items-center border-b border-slate-100 bg-white flex-shrink-0 px-4">

          {/* Logo icon — dark container */}
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
            <QrCode size={15} />
          </div>

          {/* Brand text */}
          <div
            className={`ml-3 overflow-hidden transition-all duration-300 ${
              isCollapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"
            }`}
          >
            <p className="text-[15px] font-black text-black tracking-tight whitespace-nowrap leading-tight">
              Palmtec Amphibia
            </p>
            <p className="text-[10px] text-slate-500 tracking-widest font-semibold whitespace-nowrap">QR</p>
          </div>

          {/* Collapse toggle */}
          <button
            onClick={handleCollapse}
            style={{ cursor: "pointer" }}
            className="hidden lg:flex absolute right-[-12px] top-1/2 -translate-y-1/2
              items-center justify-center w-6 h-6 rounded-full
              bg-white border border-slate-200 shadow-sm
              text-slate-400 hover:text-slate-700 hover:border-slate-300
              transition-colors duration-150 z-10 shrink-0"
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>

          {/* Mobile close */}
          <button
            onClick={close}
            style={{ cursor: "pointer" }}
            className="lg:hidden ml-auto flex items-center justify-center w-8 h-8 rounded-lg
              text-slate-400 hover:text-slate-700 hover:bg-slate-100
              transition-colors duration-150"
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── LICENSE WARNING ──────────────────────────────────────────────── */}
        <div
          className={`overflow-hidden transition-all duration-300 ${
            warning && !isCollapsed ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          {warning && (
            <div className={`mx-3 mt-3 px-3 py-2.5 rounded-lg text-xs flex items-start gap-2 ${
              warning.type === "error"
                ? "bg-red-50 border border-red-300 text-red-700"
                : "bg-orange-50 border border-orange-300 text-orange-700"
            }`}>
              {warning.type === "error"
                ? <XCircle size={13} className="mt-0.5 shrink-0 text-red-600" />
                : <AlertTriangle size={13} className="mt-0.5 shrink-0 text-orange-600" />}
              <div>
                <p className="font-semibold">{warning.message}</p>
                <p className={`text-[10px] mt-0.5 font-medium ${warning.type === "error" ? "text-red-600" : "text-orange-600"}`}>Valid till: {user?.valid_till}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── NAVIGATION ──────────────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 custom-scrollbar">
          <ul className="space-y-0.5">

            {role !== "production" && (
              <NavItem to="/dashboard" end icon={LayoutDashboard} label="Dashboard" isCollapsed={isCollapsed} onClose={close} />
            )}

            {/* Superadmin */}
            {role === "superadmin" && (
              <>
                <SectionLabel label="Administration" isCollapsed={isCollapsed} />
                <NavItem to="/dashboard/clients"          icon={Handshake}     label="Clients"          isCollapsed={isCollapsed} onClose={close} />
                <NavItem to="/dashboard/users"            icon={Users}         label="Users"            isCollapsed={isCollapsed} onClose={close} />
                <NavItem to="/dashboard/device-registry"  icon={Cpu}           label="Device Registry"  isCollapsed={isCollapsed} onClose={close} />
                <NavItem to="/dashboard/device-approvals" icon={SmartphoneNfc} label="Device Approvals" isCollapsed={isCollapsed} onClose={close} />
                <NavItem to="/dashboard/data-import"      icon={FileInput}     label="MDB Data Import"  isCollapsed={isCollapsed} onClose={close} />
              </>
            )}

            {/* Executive */}
            {role === "executive" && (
              <>
                <SectionLabel label="Administration" isCollapsed={isCollapsed} />
                <NavItem to="/dashboard/companies"       icon={Building2}     label="Companies"       isCollapsed={isCollapsed} onClose={close} />
                <NavItem to="/dashboard/users"           icon={Users}         label="Users"           isCollapsed={isCollapsed} onClose={close} />
                <NavItem to="/dashboard/device-registry" icon={Cpu}           label="Device Registry" isCollapsed={isCollapsed} onClose={close} />
              </>
            )}

            {/* Dealer Admin */}
            {role === "dealer_admin" && (
              <>
                <SectionLabel label="My Portfolio" isCollapsed={isCollapsed} />
                <NavItem to="/dashboard/companies"       icon={Building2} label="My Companies"    isCollapsed={isCollapsed} onClose={close} />
                <NavItem to="/dashboard/users"           icon={Users}     label="Users"           isCollapsed={isCollapsed} onClose={close} />
                <NavItem to="/dashboard/device-registry" icon={Cpu}       label="Device Registry" isCollapsed={isCollapsed} onClose={close} />
              </>
            )}

            {/* Production User */}
            {role === "production" && (
              <>
                <SectionLabel label="Production" isCollapsed={isCollapsed} />
                <NavItem to="/dashboard/device-registry" icon={Cpu} label="Device Upload" isCollapsed={isCollapsed} onClose={close} />
              </>
            )}

            {/* Company Admin */}
            {role === "company_admin" && (
              <>
                <SectionLabel label="Operations" isCollapsed={isCollapsed} />
                <NavItem to="/dashboard/depots" icon={Warehouse} label="Depots" isCollapsed={isCollapsed} onClose={close} />

                <DropdownSection
                  icon={Database} label="Master Data"
                  isCollapsed={isCollapsed} isOpen={masterDataOpen}
                  onToggle={() => setMasterDataOpen(p => !p)}
                >
                  <SubLink to="/dashboard/master-data/currencies"       icon={Coins}           label="Currencies"       onClose={close} />
                  <SubLink to="/dashboard/master-data/employees"         icon={Users2}          label="Employee"         onClose={close} />
                  <SubLink to="/dashboard/master-data/vehicles"         icon={Truck}           label="Vehicles"         onClose={close} />
                  <SubLink to="/dashboard/master-data/routes"           icon={Route}           label="Routes"           onClose={close} />
                  <SubLink to="/dashboard/master-data/crew-assignments" icon={CalendarCog} label="Crew Assignments" onClose={close} />
                  <SubLink to="/dashboard/master-data/expense-master"   icon={IndianRupee} label="Expense Master"   onClose={close} />
                  <SubLink to="/dashboard/master-data/settings"         icon={Settings}        label="Settings"         onClose={close} />
                </DropdownSection>

                <NavItem to="/dashboard/device-download"          icon={MonitorDown} label="Device Download" isCollapsed={isCollapsed} onClose={close} />
                <DropdownSection
                  icon={BarChart2} label="Reports"
                  isCollapsed={isCollapsed} isOpen={reportsOpen}
                  onToggle={() => setReportsOpen(p => !p)}
                >
                  <SubLink to="/dashboard/ticket-report"     icon={Ticket}       label="Ticket Report" onClose={close} />
                  <SubLink to="/dashboard/trip-close-report" icon={TrendingDown} label="Trip Close"    onClose={close} />
                </DropdownSection>

                <NavItem to="/dashboard/settlements/transactions" icon={Receipt} label="Settlements" isCollapsed={isCollapsed} onClose={close} />
              </>
            )}

          </ul>
        </nav>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <div className="border-t border-slate-100 px-3 pt-3 pb-4 bg-slate-50/80 flex-shrink-0 space-y-1">

          {/* User chip */}
          <div className="flex items-center rounded-xl px-2 py-2">
            <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {username.charAt(0).toUpperCase()}
            </div>
            <div
              className={`ml-3 overflow-hidden transition-all duration-300 ${
                isCollapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"
              }`}
            >
              <p className="text-[13px] font-semibold text-slate-800 truncate whitespace-nowrap leading-tight">{username}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide whitespace-nowrap">
                {role?.replace(/_/g, " ")}
              </p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            style={{ cursor: "pointer" }}
            className="w-full flex items-center px-3 py-2 rounded-xl text-sm font-medium
              text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors duration-150"
          >
            <LogOut size={16} className="shrink-0" />
            <span
              className={`ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 ${
                isCollapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"
              }`}
            >
              Logout
            </span>
          </button>

          {/* Copyright */}
          <div
            className={`overflow-hidden transition-all duration-300 ${
              isCollapsed ? "max-h-0 opacity-0" : "max-h-10 opacity-100"
            }`}
          >
            <div className="flex flex-col items-center gap-0.5 pt-1">
              <p className="text-[10px] font-semibold text-slate-600 tracking-wide">
                © Softland India Ltd
              </p>
              <p className="text-[9px] text-slate-500 tracking-wider uppercase">
                All Rights Reserved
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Desktop spacer */}
      <div
        className={`hidden lg:block shrink-0 transition-all duration-300 ${
          isCollapsed ? "w-[72px]" : "w-64"
        }`}
      />
    </>
  );
}

import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  // Top-level nav icons
  LayoutDashboard, Building2, Users, Handshake,
  SmartphoneNfc, FileInput, Warehouse, Database,
  BarChart2, Receipt, LogOut, Menu,
  AlertTriangle, XCircle, QrCode,
  ChevronDown, ChevronLeft, ChevronRight,
  // Sub-link icons (Master Data)
  Bus, Coins, UserCog, UserRound, MapPin,
  Route, Truck, CalendarCog, BadgeDollarSign, Settings,
  // Sub-link icons (Reports)
  Ticket, TrendingDown,
} from "lucide-react";
import api, { BASE_URL } from "../assets/js/axiosConfig";
import cacheManager from "../assets/js/reportCache";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — SUB-LINK
// Each dropdown item has a small icon + label.
// The icon is always visible; label collapses with max-w/opacity.
// ─────────────────────────────────────────────────────────────────────────────
function SubLink({ to, icon: Icon, label, onClose }) {
  return (
    <NavLink
      to={to}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors duration-150 ${
          isActive
            ? "text-indigo-600 bg-indigo-50 font-semibold"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        }`
      }
    >
      {Icon && <Icon size={14} className="shrink-0 opacity-70" />}
      <span>{label}</span>
    </NavLink>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — NAV ITEM (top-level link)
//
// KEY RULES for no-jitter:
//   • Icon has fixed left padding (px-4) and is NEVER repositioned.
//   • Label stays in the DOM — only max-w + opacity animate.
//   • No gap/justify toggling (those cause positional jumps).
// ─────────────────────────────────────────────────────────────────────────────
function NavItem({ to, icon: Icon, label, isCollapsed, onClose, end }) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        onClick={onClose}
        className={({ isActive }) =>
          `flex items-center rounded-lg px-4 py-[7px] text-base transition-colors duration-150
          ${
            isActive
              ? "bg-indigo-50 text-indigo-700 font-semibold border-l-4 border-indigo-600"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-l-4 border-transparent"
          }`
        }
      >
        {/* Icon — pinned, never shifts */}
        <Icon size={18} className="shrink-0" />

        {/* Label — fades + slides out, icon position unchanged */}
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
// SECTION 3 — DROPDOWN SECTION
//
// Same icon-pinned pattern.
// Dropdown body stays in DOM (max-h animation) — no mount/unmount jitter.
// ─────────────────────────────────────────────────────────────────────────────
function DropdownSection({ icon: Icon, label, isCollapsed, isOpen, onToggle, children }) {
  return (
    <li>
      <button
        onClick={onToggle}
        style={{ cursor: "pointer" }}
        className="w-full flex items-center px-4 py-[7px] rounded-lg text-base transition-colors duration-150
          text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-l-4 border-transparent"
      >
        {/* Icon — always pinned at same position */}
        <Icon size={18} className="shrink-0" />

        {/* Label + chevron — collapse as one unit */}
        <span
          className={`ml-3 flex items-center justify-between flex-1 whitespace-nowrap overflow-hidden transition-all duration-300 ${
            isCollapsed ? "max-w-0 opacity-0" : "max-w-[220px] opacity-100"
          }`}
        >
          <span className="font-medium">{label}</span>
          <ChevronDown
            size={14}
            className={`shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {/* Dropdown body — always in DOM, height-animated only */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isCollapsed || !isOpen ? "max-h-0 opacity-0" : "max-h-[600px] opacity-100"
        }`}
      >
        <div className="pl-[44px] pr-2 pt-1 pb-2 space-y-0.5">
          {children}
        </div>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — SECTION LABEL
// ─────────────────────────────────────────────────────────────────────────────
function SectionLabel({ label, isCollapsed }) {
  if (isCollapsed) {
    return (
      <li>
        <div className="border-t border-slate-200 mx-3 my-3" />
      </li>
    );
  }
  return (
    <li className="px-4 pt-3 pb-1">
      <span className="text-[10.5px] text-slate-400 uppercase tracking-widest font-bold select-none">
        {label}
      </span>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — MAIN SIDEBAR
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
    if (days <= 0)  return { message: "License Expired!",                                    type: "error"   };
    if (days <= 10) return { message: `License expires in ${days} day${days !== 1 ? "s":""}`, type: "warning" };
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
          bg-slate-50 border-r border-slate-200
          transition-all duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
          ${isCollapsed ? "lg:w-[80px]" : "lg:w-72"}
        `}
      >

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        {/*
          Logo is pinned at left with fixed px-4 padding — never moves.
          Text collapses via max-w + opacity — doesn't affect logo position.

          Collapse button is OUTSIDE the header's flex flow entirely.
          It uses absolute positioning on the sidebar's right edge (top-center).
          This means it never competes with logo/text for space and is
          always at the same visual position regardless of collapsed state.
        */}
        <div className="relative h-20 flex items-center border-b border-slate-200/60 bg-slate-50 flex-shrink-0 px-4">

          {/* Logo icon — always at same x position, never moves */}
          <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
            <QrCode size={17} />
          </div>

          {/* Brand text — fades + collapses right, zero effect on logo */}
          <div
            className={`ml-3 overflow-hidden transition-all duration-300 ${
              isCollapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"
            }`}
          >
            <p className="text-[13.5px] font-black text-slate-800 tracking-tight whitespace-nowrap leading-tight">
              Palmtec Amphibia <span className="text-indigo-600">QR</span>
            </p>
          </div>

          {/*
            Collapse toggle — absolutely positioned, anchored to sidebar's
            right edge vertically centered. Completely removed from flex flow
            so it cannot push or be pushed by any other element.
          */}
          <button
            onClick={handleCollapse}
            style={{ cursor: "pointer" }}
            className="hidden lg:flex absolute right-[-13px] top-1/2 -translate-y-1/2
              items-center justify-center w-6 h-6 rounded-full
              bg-white border border-slate-200 shadow-sm
              text-slate-400 hover:text-indigo-600 hover:border-indigo-300
              transition-colors duration-150 z-10 shrink-0"
          >
            {isCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>

          {/* Mobile close button — only visible on small screens */}
          <button
            onClick={close}
            style={{ cursor: "pointer" }}
            className="lg:hidden ml-auto flex items-center justify-center w-8 h-8 rounded-lg
              text-slate-400 hover:text-slate-700 hover:bg-slate-100
              transition-colors duration-150"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                ? "bg-red-50 border border-red-200 text-red-700"
                : "bg-amber-50 border border-amber-200 text-amber-700"
            }`}>
              {warning.type === "error"
                ? <XCircle size={14} className="mt-0.5 shrink-0" />
                : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
              <div>
                <p className="font-semibold">{warning.message}</p>
                <p className="text-[10px] opacity-70 mt-0.5">Valid till: {user?.valid_till}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── NAVIGATION ──────────────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 custom-scrollbar">
          <ul className="space-y-0.5">

            <NavItem to="/dashboard" end icon={LayoutDashboard} label="Dashboard" isCollapsed={isCollapsed} onClose={close} />

            {/* Superadmin */}
            {role === "superadmin" && (
              <>
                <SectionLabel label="Administration" isCollapsed={isCollapsed} />
                <NavItem to="/dashboard/companies"        icon={Building2}     label="Companies"        isCollapsed={isCollapsed} onClose={close} />
                <NavItem to="/dashboard/users"            icon={Users}         label="Users"            isCollapsed={isCollapsed} onClose={close} />
                <NavItem to="/dashboard/dealers"          icon={Handshake}     label="Dealers"          isCollapsed={isCollapsed} onClose={close} />
                <NavItem to="/dashboard/device-approvals" icon={SmartphoneNfc} label="Device Approvals" isCollapsed={isCollapsed} onClose={close} />
                <NavItem to="/dashboard/data-import"      icon={FileInput}     label="MDB Data Import"  isCollapsed={isCollapsed} onClose={close} />
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
                  <SubLink to="/dashboard/master-data/bus-types"       icon={Bus}             label="Bus Types"        onClose={close} />
                  <SubLink to="/dashboard/master-data/currencies"       icon={Coins}           label="Currencies"       onClose={close} />
                  <SubLink to="/dashboard/master-data/employee-types"   icon={UserCog}         label="Employee Types"   onClose={close} />
                  <SubLink to="/dashboard/master-data/employees"        icon={UserRound}       label="Employees"        onClose={close} />
                  <SubLink to="/dashboard/master-data/stages"           icon={MapPin}          label="Stages"           onClose={close} />
                  <SubLink to="/dashboard/master-data/routes"           icon={Route}           label="Routes"           onClose={close} />
                  <SubLink to="/dashboard/master-data/vehicles"         icon={Truck}           label="Vehicles"         onClose={close} />
                  <SubLink to="/dashboard/master-data/crew-assignments" icon={CalendarCog}     label="Crew Assignments" onClose={close} />
                  <SubLink to="/dashboard/master-data/fares"            icon={BadgeDollarSign} label="Fare"             onClose={close} />
                  <SubLink to="/dashboard/master-data/settings"         icon={Settings}        label="Settings"         onClose={close} />
                </DropdownSection>

                <DropdownSection
                  icon={BarChart2} label="Reports"
                  isCollapsed={isCollapsed} isOpen={reportsOpen}
                  onToggle={() => setReportsOpen(p => !p)}
                >
                  <SubLink to="/dashboard/ticket-report"     icon={Ticket}      label="Ticket Report" onClose={close} />
                  <SubLink to="/dashboard/trip-close-report" icon={TrendingDown} label="Trip Close"   onClose={close} />
                </DropdownSection>

                <NavItem to="/dashboard/settlements" icon={Receipt} label="Settlements" isCollapsed={isCollapsed} onClose={close} />
              </>
            )}

          </ul>
        </nav>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <div className="border-t border-slate-200 px-2 pt-3 pb-4 bg-slate-50 flex-shrink-0 space-y-0.5">

          {/* User chip — avatar pinned left, text collapses */}
          <div className="flex items-center rounded-lg px-2 py-1.5">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {username.charAt(0).toUpperCase()}
            </div>
            <div
              className={`ml-3 overflow-hidden transition-all duration-300 ${
                isCollapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"
              }`}
            >
              <p className="text-[15px] font-semibold text-slate-800 truncate whitespace-nowrap">{username}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide whitespace-nowrap">
                {role?.replace(/_/g, " ")}
              </p>
            </div>
          </div>

          {/* Logout — icon pinned, text collapses */}
          <button
            onClick={handleLogout}
            style={{ cursor: "pointer" }}
            className="w-full flex items-center px-4 py-1.5 rounded-lg text-base
              text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors duration-150"
          >
            <LogOut size={17} className="shrink-0" />
            <span
              className={`ml-3 font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${
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
            <p className="text-center text-[10px] text-slate-400 pt-1 tracking-wide">
              © Softland India Ltd — All Rights Reserved
            </p>
          </div>
        </div>
      </aside>

      {/* Desktop spacer — mirrors sidebar width exactly */}
      <div
        className={`hidden lg:block shrink-0 transition-all duration-300 ${
          isCollapsed ? "w-[80px]" : "w-72"
        }`}
      />
    </>
  );
}

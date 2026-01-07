import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import api, { BASE_URL } from "../assets/js/axiosConfig";

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);         // Mobile open/close
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user?.role;
  const username = user?.username || user?.name || "User";

  const handleLogout = async () => {
    try {
      await api.post(`${BASE_URL}/logout/`);
    } catch {}
    finally {
      localStorage.clear();
      navigate("/login");
    }
  };

  // Used to style nav links
  const linkClass = (isActive) =>
    `
      flex items-center rounded-lg px-3 py-2.5 transition-all duration-200 text-sm
      ${isCollapsed ? "lg:justify-center space-x-0" : "space-x-3 justify-start"}
      ${
        isActive
          ? "bg-indigo-50 text-indigo-700 font-semibold border-l-4 border-indigo-600"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }
    `;

  return (
    <>
      {/* Mobile Hamburger */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-50 p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl shadow-md lg:hidden"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity lg:hidden ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* SIDEBAR */}
      <aside
        className={`
          fixed top-0 left-0 h-screen bg-slate-50 z-40 border-r border-slate-200 flex flex-col
          transition-all duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          ${isCollapsed ? "lg:w-[80px]" : "lg:w-72"}
          lg:translate-x-0
        `}
      >
        {/* Header */}
      <div className="h-20 flex items-center border-b border-slate-200/60 bg-slate-50">
        <div
          className={`
            flex items-center w-full overflow-hidden transition-all duration-300
            ${isCollapsed ? "lg:px-4 lg:justify-center" : "px-5 justify-between"}
          `}
        >
          {/* Logo + Text */}
          <div
            className={`
              flex items-center transition-all duration-300
              ${isCollapsed ? "lg:opacity-0 lg:w-0 lg:overflow-hidden" : "space-x-3 opacity-100"}
            `}
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-md flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth={2.2} strokeLinecap="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="font-bold text-slate-800 text-lg tracking-tight whitespace-nowrap">
              Bus Manager
            </h1>
          </div>

          {/* Collapse Button */}
          <button style={{cursor:"pointer"}}
            onClick={() => {
              setIsCollapsed(!isCollapsed);
              if (!isCollapsed) setReportsOpen(false);
            }}
            className={`
              hidden lg:flex p-1.5 rounded-lg transition
              text-slate-400 hover:text-slate-600 hover:bg-slate-200/50
              flex-shrink-0
              ${isCollapsed ? "lg:absolute lg:right-3" : ""}
            `}
          >
            <svg
              className={`w-5 h-5 transition-transform ${isCollapsed ? "rotate-180" : ""}`}
              stroke="currentColor"
              fill="none"
            >
              <path strokeWidth={2} strokeLinecap="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>


        {/* NAVIGATION */}
        <nav className="flex-1 overflow-y-auto py-5 px-3 custom-scrollbar">
          <ul className="space-y-1">

            {/* Dashboard */}
            <li>
              <NavLink
                to="/dashboard"
                end
                onClick={() => setIsOpen(false)}
                className={({ isActive }) => linkClass(isActive)}
              >
                <i className="fa-solid fa-gauge w-5 text-center shrink-0 text-xl"></i>
                {!isCollapsed && <span>Dashboard</span>}
              </NavLink>
            </li>

            {/* ADMIN SECTION */}
            {!isCollapsed && role === "superadmin" && (
              <li className="px-3 pt-6 pb-2 text-[11px] text-slate-400 uppercase tracking-wide font-bold">
                Administration
              </li>
            )}

            {role === "superadmin" && (
              <>
                <li>
                  <NavLink
                    to="/dashboard/companies"
                    className={({ isActive }) => linkClass(isActive)}
                    onClick={() => setIsOpen(false)}
                  >
                    <i className="fa-solid fa-building w-5 text-center text-xl"></i>
                    {!isCollapsed && <span>Companies</span>}
                  </NavLink>
                </li>

                <li>
                  <NavLink
                    to="/dashboard/users"
                    className={({ isActive }) => linkClass(isActive)}
                    onClick={() => setIsOpen(false)}
                  >
                    <i className="fa-solid fa-users w-5 text-center text-lg"></i>
                    {!isCollapsed && <span>Users</span>}
                  </NavLink>
                </li>
              </>
            )}

            {/* Branch Admin Links */}
            {role === "branch_admin" && (
              <>
                <li>
                  <NavLink
                    to="/dashboard/branches"
                    className={({ isActive }) => linkClass(isActive)}
                    onClick={() => setIsOpen(false)}
                  >
                    <i className="fa-solid fa-code-branch w-5 text-center text-xl"></i>
                    {!isCollapsed && <span>Branches</span>}
                  </NavLink>
                </li>

                {/* Reports Dropdown */}
                <li>
                  <button style={{"cursor":"pointer"}}
                    onClick={() => setReportsOpen(!reportsOpen)}
                    className={`
                      w-full flex items-center justify-between px-3 py-2.5 text-slate-600 rounded-lg transition
                      hover:bg-slate-100 hover:text-slate-900 mb-1
                      ${isCollapsed ? "lg:justify-center" : ""}
                    `}
                  >
                    <div className={`flex items-center ${isCollapsed ? "" : "space-x-3"}`}>
                      <i className="fa-solid fa-chart-pie w-5 text-center text-lg"></i>
                      {!isCollapsed && <span>Reports</span>}
                    </div>
                    {!isCollapsed && (
                      <i
                        className={`fa-solid fa-chevron-down text-xs transition-transform duration-200 ${
                          reportsOpen ? "rotate-180" : ""
                        }`}
                      ></i>
                    )}
                  </button>

                  {/* Dropdown container */}
                  {!isCollapsed && (
                    <div
                      className={`transition-all overflow-hidden ${
                        reportsOpen ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="pl-4 my-1 border-l-2 border-slate-200 space-y-1">
                        <NavLink
                          to="/dashboard/ticket-report"
                          className={({ isActive }) =>
                            `block px-3 py-2 rounded-lg text-sm transition ${
                              isActive
                                ? "text-indigo-600 bg-indigo-50 font-medium"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                            }`
                          }
                          onClick={() => setIsOpen(false)}
                        >
                          Ticket Report
                        </NavLink>
                        <NavLink
                          to="/dashboard/trip-close-report"
                          className={({ isActive }) =>
                            `block px-3 py-2 rounded-lg text-sm transition ${
                              isActive
                                ? "text-indigo-600 bg-indigo-50 font-medium"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                            }`
                          }
                          onClick={() => setIsOpen(false)}
                        >
                          Trip Close
                        </NavLink>
                      </div>
                    </div>
                  )}
                </li>

                <li>
                  <NavLink
                    to="/dashboard/settlements"
                    className={({ isActive }) => linkClass(isActive)}
                    onClick={() => setIsOpen(false)}
                  >
                    <i className="fa-solid fa-receipt w-5 text-center text-lg"></i>
                    {!isCollapsed && <span>Settlements</span>}
                  </NavLink>
                </li>
              </>
            )}
          </ul>
        </nav>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          {/* User chip */}
          <div
            className={`flex items-center rounded-lg p-3 bg-white border border-slate-200 shadow-sm
            transition-all duration-200
            ${isCollapsed ? "lg:justify-center lg:p-2 lg:bg-transparent lg:border-none lg:shadow-none" : "space-x-3"}
          `}
          >
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
              {username.charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <p className="text-sm font-semibold text-slate-800 truncate">{username}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                  {role?.replace("_", " ")}
                </p>
              </div>
            )}
          </div>

          {/* Logout */}
          <button style={{cursor:"pointer"}}
            onClick={handleLogout}
            className={`mt-2 w-full flex items-center px-3 py-2 rounded-lg transition
              text-slate-600 hover:bg-red-50 hover:text-red-600
              ${isCollapsed ? "lg:justify-center space-x-0" : "space-x-3"}
            `}
          >
            <i className="fa-solid fa-power-off w-5 text-center"></i>
            {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
          </button>

          {!isCollapsed && (
            <p className="pt-2 text-center text-[12px] text-slate-400">
              © Softland India Ltd — All Rights Reserved
            </p>
          )}
        </div>
      </aside>

      {/* SPACER (to prevent content shifting) */}
      <div
        className={`hidden lg:block transition-all duration-300 ${
          isCollapsed ? "lg:w-[80px]" : "lg:w-72"
        }`}
      />
    </>
  );
}

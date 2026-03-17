import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';


export default function Dashboard() {
  return (
    <div className="flex min-h-screen overflow-x-hidden bg-slate-100 text-slate-900">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto pt-20 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}

/**
 * USAGE NOTES:
 * 
 * 1. All dashboard pages will automatically have:
 *    - Sidebar navigation
 *    - Slate-50 background
 *    - Proper padding
 * 
 * 2. Create page content cards like this:
 *    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
 *      Your content
 *    </div>
 * 
 * 3. For page headers:
 *    <h1 className="text-2xl font-bold text-slate-800 mb-6">
 *      Page Title
 *    </h1>
 * 
 * 4. For responsive grids:
 *    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 *      Cards here
 *    </div>
 */

import React, { useState, useEffect } from 'react';
// import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import api, { BASE_URL } from '../assets/js/axiosConfig';

export default function TripcloseReport() {
  const [tripData, setTripData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    palmtecId: '',
    routeCode: '',
    tripNo: ''
  });

  useEffect(() => {
    fetchTripData();
  }, []);

  const fetchTripData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`${BASE_URL}/get_all_trip_close_data`);
      if (response.data.message === 'success') {
        setTripData(response.data.data || []);
      } else {
        setTripData(response.data.data || []);
      }
    } catch (err) {
      console.error("Fetch Error:", err);
      setError('Unable to load trip data');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredData = () =>
    tripData.filter(item => {
      if (filters.startDate) {
        if (new Date(item.start_datetime) < new Date(filters.startDate)) return false;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(item.start_datetime) > end) return false;
      }
      if (filters.palmtecId && item.palmtec_id) {
        if (!item.palmtec_id.toLowerCase().includes(filters.palmtecId.toLowerCase())) return false;
      }
      if (filters.routeCode && item.route_code) {
        if (!item.route_code.toLowerCase().includes(filters.routeCode.toLowerCase())) return false;
      }
      if (filters.tripNo && item.trip_no) {
        if (!String(item.trip_no).includes(filters.tripNo)) return false;
      }
      return true;
    });

  const filteredData = getFilteredData();
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const clearFilters = () => {
    setFilters({ startDate: '', endDate: '', palmtecId: '', routeCode: '', tripNo: '' });
    setCurrentPage(1);
  };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('TripClose');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Device ID', key: 'palmtec_id', width: 16 },
      { header: 'Route', key: 'route_code', width: 12 },
      { header: 'Trip No', key: 'trip_no', width: 10 },
      { header: 'Schedule', key: 'schedule', width: 14 },
      { header: 'Direction', key: 'up_down_trip', width: 12 },
      { header: 'Start Date', key: 'start_date', width: 14 },
      { header: 'End Time', key: 'end_time', width: 12 },
      { header: 'Tickets', key: 'total_tickets_issued', width: 12 },
      { header: 'Passengers', key: 'total_passengers', width: 14 },
      { header: 'UPI Amount', key: 'upi_ticket_amount', width: 14 },
      { header: 'Expense Amount', key: 'expense_amount', width: 14 },
      { header: 'Total Collection', key: 'total_collection', width: 16 },
    ];

    filteredData.forEach(item => {
      worksheet.addRow({
        id: item.id,
        palmtec_id: item.palmtec_id,
        route_code: item.route_code,
        trip_no: item.trip_no,
        schedule: item.schedule,
        up_down_trip: item.up_down_trip,
        start_date: new Date(item.start_datetime).toLocaleDateString(),
        end_time: item.end_datetime
          ? new Date(item.end_datetime).toLocaleTimeString()
          : '-',
        total_tickets_issued: item.total_tickets_issued,
        total_passengers: item.total_passengers,
        upi_ticket_amount: item.upi_ticket_amount,
        expense_amount: item.expense_amount,
        total_collection: item.total_collection,
      });
    });

    // Header styling
    worksheet.getRow(1).font = { bold: true };

    // Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `trip_close_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
  };

  if (loading)
    return <div className="flex items-center justify-center h-screen text-slate-500 text-lg">Loading Trip Data...</div>;

  if (error)
    return <div className="flex items-center justify-center h-screen text-red-600 font-medium">{error}</div>;

  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Trip Close Reports</h1>
          <p className="text-slate-500 mt-1">View and manage daily trip closures</p>
        </div>
        <button
          onClick={exportToExcel}
          className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl shadow-lg transition"
        >
          Download Report
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-500">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value })}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-500">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value })}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-500">Device ID</label>
            <input
              type="text"
              placeholder="Search Palmtec ID..."
              value={filters.palmtecId}
              onChange={(e) => setFilters({...filters, palmtecId: e.target.value })}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-500">Route</label>
            <input
              type="text"
              placeholder="Search Route..."
              value={filters.routeCode}
              onChange={(e) => setFilters({...filters, routeCode: e.target.value })}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-500">Trip No</label>
            <input
              type="number"
              value={filters.tripNo}
              onChange={(e) => setFilters({...filters, tripNo: e.target.value })}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500"
            />
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={clearFilters}
            className="border border-slate-300 px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="text-sm text-slate-500 mb-3">
        Showing <span className="font-medium">{currentData.length}</span> of{" "}
        <span className="font-medium">{filteredData.length}</span> records
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Device</th>
                <th className="px-4 py-3 font-semibold">Route</th>
                <th className="px-4 py-3 font-semibold">Trip</th>
                <th className="px-4 py-3 font-semibold">Sched</th>
                <th className="px-4 py-3 font-semibold">Dir</th>
                <th className="px-4 py-3 font-semibold text-right">Pax</th>
                <th className="px-4 py-3 font-semibold text-right">Tickets</th>
                <th className="px-4 py-3 font-semibold text-right">UPI Amt</th>
                <th className="px-4 py-3 font-semibold text-right">Expense</th>
                <th className="px-4 py-3 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentData.length ? (
                currentData.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span>{new Date(item.start_datetime).toLocaleDateString()}</span>
                        <small className="text-slate-500">
                          {new Date(item.start_datetime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                        </small>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-slate-100 text-slate-700 rounded-lg px-2 py-1 text-xs font-medium">
                        {item.palmtec_id}
                      </span>
                    </td>
                    <td className="px-4 py-3">{item.route_code || '-'}</td>
                    <td className="px-4 py-3">{item.trip_no}</td>
                    <td className="px-4 py-3">{item.schedule}</td>
                    <td className="px-4 py-3">{item.up_down_trip}</td>
                    <td className="px-4 py-3 text-right">{item.total_passengers}</td>
                    <td className="px-4 py-3 text-right">{item.total_tickets_issued}</td>
                    <td className="px-4 py-3 text-right">₹{item.upi_ticket_amount}</td>
                    <td className="px-4 py-3 text-right">₹{item.expense_amount}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      ₹{item.total_collection}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="11" className="px-4 py-6 text-center text-slate-500">
                    No trip data found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="px-3 py-1.5 rounded-lg border disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-sm text-slate-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="px-3 py-1.5 rounded-lg border disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

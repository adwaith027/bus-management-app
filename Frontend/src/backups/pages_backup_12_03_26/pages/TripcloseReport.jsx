import React, { useState, useEffect, useRef } from 'react';
import ExcelJS from 'exceljs';
import api, { BASE_URL } from '../assets/js/axiosConfig';
// import cacheManager from '../utils/reportCache';
import cacheManager from '../assets/js/reportCache';


export default function TripcloseReport() {
  // ===== STATE MANAGEMENT =====
  const [tripData, setTripData] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [dateError, setDateError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [lastUpdateDuration, setLastUpdateDuration] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingPaused, setPollingPaused] = useState(false);
  const [newTripIds, setNewTripIds] = useState(new Set());
  const [isPageVisible, setIsPageVisible] = useState(true);
  
  // UI filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    palmtecId: 'ALL',
    routeCode: 'ALL',
    tripNo: '',
    depotCode: 'ALL'
  });
  
  // Applied filters
  const [appliedFilters, setAppliedFilters] = useState({
    startDate: '',
    endDate: ''
  });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);

  // Refs for polling
  const pollingIntervalRef = useRef(null);
  const latestTimestampRef = useRef(null);

  // Check if there are pending date changes
  const hasPendingChanges = 
    appliedFilters.startDate !== filters.startDate || 
    appliedFilters.endDate !== filters.endDate;

  // ===== DATE & API LOGIC =====
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const isDateRangeEnded = () => {
    if (!appliedFilters.endDate) return false;
    const endDate = new Date(appliedFilters.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    return today > endDate;
  };

  // Page visibility tracking
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Initialize with cached date range or today's date, and fetch data
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = user.id;

    // Try to restore previous date range from cache
    const cachedDateRange = cacheManager.getDateRange('tripclose', userId);
    let startDate, endDate;

    if (cachedDateRange) {
      startDate = cachedDateRange.fromDate;
      endDate = cachedDateRange.toDate;
    } else {
      // Default to today if no cached date range
      const today = getTodayDate();
      startDate = today;
      endDate = today;
    }

    // Update filters with restored/default dates
    setFilters(prev => ({
      ...prev,
      startDate,
      endDate
    }));
    setAppliedFilters({
      startDate,
      endDate
    });

    // Try to load from cache first
    const cacheKey = cacheManager.getCacheKey('tripclose', userId, startDate, endDate);
    const cachedData = cacheManager.get(cacheKey);

    if (cachedData) {
      // Load from cache
      setTripData(cachedData);
      if (cachedData.length > 0) {
        latestTimestampRef.current = cachedData[0].created_at;
      }
      setIsPolling(true);
      setLastUpdated(new Date());
    } else {
      // Fetch from API if no cache
      fetchTripData(startDate, endDate);
    }
  }, []);

  // Polling effect
  useEffect(() => {
    if (isPolling && !pollingPaused && isPageVisible && appliedFilters.startDate && appliedFilters.endDate) {
      pollingIntervalRef.current = setInterval(() => {
        pollForNewTrips();
      }, 6000);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
      };
    } else {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    }
  }, [isPolling, pollingPaused, isPageVisible, appliedFilters.startDate, appliedFilters.endDate]);

  // Check if date range ended
  useEffect(() => {
    if (isDateRangeEnded()) {
      setPollingPaused(true);
      setIsPolling(false);
    } else {
      setPollingPaused(false);
    }
  }, [appliedFilters.endDate]);

  const fetchTripData = async (startDate, endDate, sinceTimestamp = null) => {
    try {
      if (!sinceTimestamp) {
        setIsRefreshing(true);
      }
      
      const requestStartTime = Date.now();
      
      let url = `${BASE_URL}/get_all_trip_close_data?from_date=${startDate}&to_date=${endDate}`;
      if (sinceTimestamp) {
        url += `&since=${encodeURIComponent(sinceTimestamp)}`;
      }
      
      const response = await api.get(url);
      
      const requestEndTime = Date.now();
      const requestDuration = requestEndTime - requestStartTime;
      
      if (response.data.message === 'success') {
        if (sinceTimestamp) {
          // Polling update - append new trips only
          const newTrips = response.data.data || [];
          
          if (newTrips.length > 0) {
            setTripData(prev => {
              const existingIds = new Set(prev.map(t => t.id));
              const uniqueNewTrips = newTrips.filter(t => !existingIds.has(t.id));
              
              if (uniqueNewTrips.length === 0) {
                return prev;
              }
              
              const updated = [...uniqueNewTrips, ...prev];
              
              const newIds = new Set(uniqueNewTrips.map(t => t.id));
              setNewTripIds(newIds);
              setTimeout(() => setNewTripIds(new Set()), 2000);
              
              return updated;
            });
            
            latestTimestampRef.current = newTrips[0].created_at;
          }
          
          setLastUpdated(new Date());
          setLastUpdateDuration(requestDuration);
        } else {
          // Initial/filter fetch
          const fetchedData = response.data.data || [];
          setTripData(fetchedData);
          
          // Cache the data and date range
          const user = JSON.parse(localStorage.getItem("user") || "{}");
          const userId = user.id;
          const cacheKey = cacheManager.getCacheKey('tripclose', userId, startDate, endDate);
          cacheManager.set(cacheKey, fetchedData);
          cacheManager.setDateRange('tripclose', userId, startDate, endDate);
          
          if (fetchedData.length > 0) {
            latestTimestampRef.current = fetchedData[0].created_at;
          }
          
          setIsPolling(true);
          setLastUpdated(new Date());
          setLastUpdateDuration(requestDuration);
        }
        
        setError(null);
        setDateError('');
      } else {
        setError('Failed to fetch trip data');
      }
    } catch (err) {
      if (err.response) {
        setError(`Server Error: ${err.response.status} - ${err.response.data?.message || err.response.data?.error}`);
      } else if (err.request) {
        setError('No response from server.');
      } else {
        setError('Error: ' + err.message);
      }
    } finally {
      if (!sinceTimestamp) {
        setIsRefreshing(false);
      }
    }
  };

  const pollForNewTrips = async () => {
    if (!latestTimestampRef.current) return;
    if (isDateRangeEnded()) {
      setPollingPaused(true);
      setIsPolling(false);
      return;
    }

    try {
      await fetchTripData(
        appliedFilters.startDate,
        appliedFilters.endDate,
        latestTimestampRef.current
      );
    } catch (err) {
      console.error('Polling error:', err);
    }
  };

  // ===== DYNAMIC DROPDOWN OPTIONS =====
  const getUniqueOptions = () => {
    const palmtecIds = [...new Set(tripData.map(t => t.palmtec_id).filter(Boolean))].sort();
    const routeCodes = [...new Set(tripData.map(t => t.route_code).filter(Boolean))].sort();
    const depotCodes = [...new Set(tripData.map(t => t.depot_code).filter(Boolean))].sort();
    
    return { palmtecIds, routeCodes, depotCodes };
  };

  const { palmtecIds, routeCodes, depotCodes } = getUniqueOptions();

  // ===== FILTER LOGIC =====
  const getFilteredData = () =>
    tripData.filter(item => {
      if (filters.palmtecId && filters.palmtecId !== 'ALL') {
        if (item.palmtec_id !== filters.palmtecId) return false;
      }

      if (filters.routeCode && filters.routeCode !== 'ALL') {
        if (item.route_code !== filters.routeCode) return false;
      }

      if (filters.depotCode && filters.depotCode !== 'ALL') {
        if (item.depot_code !== filters.depotCode) return false;
      }

      if (filters.tripNo) {
        if (!String(item.trip_no).includes(filters.tripNo)) return false;
      }

      return true;
    });

  const filteredData = getFilteredData();

  // ===== SUMMARY CALCULATIONS =====
  const calculateSummary = (data) => {
    const totalTrips = data.length;
    const totalCollection = data.reduce((sum, t) => sum + parseFloat(t.total_collection || 0), 0);
    const totalUpiAmount = data.reduce((sum, t) => sum + parseFloat(t.upi_ticket_amount || 0), 0);
    const totalPassengers = data.reduce((sum, t) => sum + (t.total_passengers || 0), 0);
    const totalTickets = data.reduce((sum, t) => sum + (t.total_tickets || 0), 0);
    const totalCashAmount = data.reduce((sum, t) => sum + parseFloat(t.total_cash_amount || 0), 0);
    
    return { totalTrips, totalCollection, totalUpiAmount, totalPassengers, totalTickets, totalCashAmount };
  };

  const summary = calculateSummary(filteredData);

  // ===== PAGINATION =====
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const changePage = (p) => setCurrentPage(p);

  // ===== FILTER HANDLERS =====
  const handleApplyFilters = () => {
    if (filters.endDate < filters.startDate) {
      setDateError('End date cannot be before start date');
      return;
    }
    
    setDateError('');
    
    // Invalidate cache for old date range
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = user.id;
    const oldCacheKey = cacheManager.getCacheKey('tripclose', userId, appliedFilters.startDate, appliedFilters.endDate);
    cacheManager.invalidate(oldCacheKey);
    
    setIsPolling(false);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    setAppliedFilters({
      startDate: filters.startDate,
      endDate: filters.endDate
    });
    
    latestTimestampRef.current = null;
    fetchTripData(filters.startDate, filters.endDate);
    setCurrentPage(1);
  };

  const handleClientFilter = (filterType, value) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    const today = getTodayDate();
    
    // Invalidate cache for current date range
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = user.id;
    const oldCacheKey = cacheManager.getCacheKey('tripclose', userId, appliedFilters.startDate, appliedFilters.endDate);
    cacheManager.invalidate(oldCacheKey);
    
    setFilters({
      startDate: today,
      endDate: today,
      palmtecId: 'ALL',
      routeCode: 'ALL',
      tripNo: '',
      depotCode: 'ALL'
    });
    setAppliedFilters({
      startDate: today,
      endDate: today
    });
    setDateError('');
    
    setIsPolling(false);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    latestTimestampRef.current = null;
    
    fetchTripData(today, today);
    setCurrentPage(1);
  };

  // ===== EXPORT LOGIC =====
  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('TripClose');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Device ID', key: 'palmtec_id', width: 16 },
      { header: 'Depot Code', key: 'depot_code', width: 14 },
      { header: 'Route', key: 'route_code', width: 12 },
      { header: 'Trip No', key: 'trip_no', width: 10 },
      { header: 'Schedule', key: 'schedule', width: 14 },
      { header: 'Direction', key: 'up_down_trip', width: 12 },
      { header: 'Start DateTime', key: 'start_datetime', width: 20 },
      { header: 'End DateTime', key: 'end_datetime', width: 20 },
      { header: 'Total Tickets', key: 'total_tickets', width: 14 },
      { header: 'Total Passengers', key: 'total_passengers', width: 14 },
      { header: 'UPI Tickets', key: 'upi_ticket_count', width: 14 },
      { header: 'Cash Tickets', key: 'total_cash_tickets', width: 14 },
      { header: 'UPI Amount', key: 'upi_ticket_amount', width: 14 },
      { header: 'Cash Amount', key: 'total_cash_amount', width: 14 },
      { header: 'Expense Amount', key: 'expense_amount', width: 14 },
      { header: 'Total Collection', key: 'total_collection', width: 16 },
    ];

    filteredData.forEach(item => {
      worksheet.addRow({
        id: item.id,
        palmtec_id: item.palmtec_id,
        depot_code: item.depot_code || '-',
        route_code: item.route_code,
        trip_no: item.trip_no,
        schedule: item.schedule,
        up_down_trip: item.up_down_trip,
        start_datetime: new Date(item.start_datetime).toLocaleString(),
        end_datetime: new Date(item.end_datetime).toLocaleString(),
        total_tickets: item.total_tickets,
        total_passengers: item.total_passengers,
        upi_ticket_count: item.upi_ticket_count,
        total_cash_tickets: item.total_cash_tickets,
        upi_ticket_amount: item.upi_ticket_amount,
        total_cash_amount: item.total_cash_amount,
        expense_amount: item.expense_amount,
        total_collection: item.total_collection,
      });
    });

    worksheet.getRow(1).font = { bold: true };
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

  // ===== MODAL HANDLERS =====
  const openModal = (trip) => {
    setSelectedTrip(trip);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTrip(null);
  };

  // ===== TIME AGO FORMATTER =====
  const getTimeAgo = () => {
    if (!lastUpdated) return '';
    const seconds = Math.floor((new Date() - lastUpdated) / 1000);
    
    if (seconds < 2 && lastUpdateDuration > 0) {
      return `${lastUpdateDuration}ms ago`;
    }
    
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return 'over 1h ago';
  };

  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeAgo(getTimeAgo());
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // ===== LOADING / ERROR STATES =====
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md">
          <div className="text-red-600 font-medium">{error}</div>
          <button 
            onClick={() => {
              setError(null);
              const today = getTodayDate();
              fetchTripData(today, today);
            }} 
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ===== UI RENDER =====
  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Trip Close Reports</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-slate-500">View and manage daily trip closures</p>
            {lastUpdated && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className={`w-2 h-2 rounded-full ${isPolling && !pollingPaused && isPageVisible ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                <span>{isPageVisible ? `Last updated ${timeAgo}` : 'Paused (tab inactive)'}</span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={exportToExcel}
          className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl shadow-lg transition"
        >
          Download Report
        </button>
      </div>

      {/* Polling Paused Warning */}
      {pollingPaused && (
        <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Date range ended - live updates paused
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-medium">Total Trips</div>
          {isRefreshing ? (
            <div className="animate-pulse bg-slate-200 h-8 w-16 rounded mt-1"></div>
          ) : (
            <div className="text-2xl font-bold text-slate-800 mt-1">{summary.totalTrips}</div>
          )}
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-medium">Total Tickets</div>
          {isRefreshing ? (
            <div className="animate-pulse bg-slate-200 h-8 w-20 rounded mt-1"></div>
          ) : (
            <div className="text-2xl font-bold text-slate-800 mt-1">{summary.totalTickets}</div>
          )}
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-medium">Total Passengers</div>
          {isRefreshing ? (
            <div className="animate-pulse bg-slate-200 h-8 w-20 rounded mt-1"></div>
          ) : (
            <div className="text-2xl font-bold text-slate-800 mt-1">{summary.totalPassengers}</div>
          )}
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-medium">Total Collection</div>
          {isRefreshing ? (
            <div className="animate-pulse bg-slate-200 h-8 w-24 rounded mt-1"></div>
          ) : (
            <div className="text-2xl font-bold text-slate-800 mt-1">₹{summary.totalCollection.toFixed(2)}</div>
          )}
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-medium">UPI Amount</div>
          {isRefreshing ? (
            <div className="animate-pulse bg-slate-200 h-8 w-24 rounded mt-1"></div>
          ) : (
            <div className="text-2xl font-bold text-slate-800 mt-1">₹{summary.totalUpiAmount.toFixed(2)}</div>
          )}
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-medium">Cash Amount</div>
          {isRefreshing ? (
            <div className="animate-pulse bg-slate-200 h-8 w-24 rounded mt-1"></div>
          ) : (
            <div className="text-2xl font-bold text-slate-800 mt-1">₹{summary.totalCashAmount.toFixed(2)}</div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 md:p-6 mb-6">
        {dateError && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {dateError}
          </div>
        )}

        {hasPendingChanges && !dateError && (
          <div className="mb-4 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="animate-pulse">●</span>
            Date filters modified - click Apply Filters to refresh data
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-500 mb-1">Start Date</label>
            <input 
              max={getTodayDate()}
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-500 mb-1">End Date</label>
            <input 
              max={getTodayDate()}
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-500 mb-1">Device ID</label>
            <select
              value={filters.palmtecId}
              onChange={(e) => handleClientFilter('palmtecId', e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            >
              <option value="ALL">ALL</option>
              {palmtecIds.map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-500 mb-1">Route Code</label>
            <select
              value={filters.routeCode}
              onChange={(e) => handleClientFilter('routeCode', e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            >
              <option value="ALL">ALL</option>
              {routeCodes.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-500 mb-1">Depot Code</label>
            <select
              value={filters.depotCode}
              onChange={(e) => handleClientFilter('depotCode', e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            >
              <option value="ALL">ALL</option>
              {depotCodes.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-500 mb-1">Trip No</label>
            <input
              type="text"
              placeholder="Search..."
              value={filters.tripNo}
              onChange={(e) => handleClientFilter('tripNo', e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            />
          </div>
        </div>

        <div className="flex justify-end mt-4 gap-3">
          <button
            onClick={clearFilters}
            className="border border-slate-300 px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition"
          >
            Clear Filters
          </button>
          <button
            onClick={handleApplyFilters}
            disabled={!filters.startDate || !filters.endDate}
            className={`px-5 py-2 rounded-lg text-sm text-white transition ${
              hasPendingChanges 
                ? 'bg-blue-600 hover:bg-blue-700 shadow-lg' 
                : 'bg-slate-600 hover:bg-slate-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Apply Filters
          </button>
        </div>
      </div>

      <div className="text-sm text-slate-500 mb-3">
        Showing {currentData.length} of {filteredData.length} trips
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
        {isRefreshing && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
              <div className="text-slate-600 font-medium">Loading data...</div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 font-semibold">Device ID</th>
                <th className="px-4 py-3 font-semibold">Depot</th>
                <th className="px-4 py-3 font-semibold">Schedule</th>
                <th className="px-4 py-3 font-semibold">Trip No</th>
                <th className="px-4 py-3 font-semibold">Route</th>
                <th className="px-4 py-3 font-semibold">Start Time</th>
                <th className="px-4 py-3 font-semibold">End Time</th>
                <th className="px-4 py-3 font-semibold text-right">Tickets</th>
                <th className="px-4 py-3 font-semibold text-right">Total</th>
                <th className="px-4 py-3 font-semibold">Info</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {currentData.length ? (
                currentData.map(item => (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-slate-50 transition ${
                      newTripIds.has(item.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="bg-slate-100 text-slate-700 rounded-lg px-2 py-1 text-xs font-medium">
                        {item.palmtec_id}
                      </span>
                    </td>
                    <td className="px-4 py-3">{item.depot_code || "-"}</td>
                    <td className="px-4 py-3">{item.schedule}</td>
                    <td className="px-4 py-3">{item.trip_no}</td>
                    <td className="px-4 py-3">{item.route_code || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span>{new Date(item.start_datetime).toLocaleDateString()}</span>
                        <small className="text-slate-500">
                          {new Date(item.start_datetime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                        </small>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span>{new Date(item.end_datetime).toLocaleDateString()}</span>
                        <small className="text-slate-500">
                          {new Date(item.end_datetime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                        </small>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{item.total_tickets}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      ₹{parseFloat(item.total_collection).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openModal(item)}
                        className="text-slate-600 hover:text-slate-900 transition"
                        title="View Details"
                        style={{"cursor":"pointer"}}
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    No trip data found for selected filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 mt-6">
          <button
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            Prev
          </button>

          {[...Array(totalPages)].map((_, i) => {
            const n = i + 1;
            return (
              <button
                key={n}
                onClick={() => changePage(n)}
                className={`px-3 py-1.5 rounded-lg border transition ${
                  currentPage === n 
                    ? "bg-slate-800 text-white border-slate-800" 
                    : "border-slate-300 hover:bg-slate-50"
                }`}
              >
                {n}
              </button>
            );
          })}

          <button
            onClick={() => changePage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            Next
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && selectedTrip && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">Trip Details</h2>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Trip Information */}
              <div className="border-b border-slate-200 pb-4">
                <h3 className="font-semibold text-slate-700 mb-3">Trip Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Device ID</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTrip.palmtec_id}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Depot Code</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTrip.depot_code || "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Route Code</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTrip.route_code}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Trip Number</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTrip.trip_no}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Schedule</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTrip.schedule}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Direction</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTrip.up_down_trip}</div>
                  </div>
                </div>
              </div>

              {/* Timing Details */}
              <div className="border-b border-slate-200 pb-4">
                <h3 className="font-semibold text-slate-700 mb-3">Timing</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Start DateTime</div>
                    <div className="text-sm text-slate-800 mt-1">
                      {new Date(selectedTrip.start_datetime).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">End DateTime</div>
                    <div className="text-sm text-slate-800 mt-1">
                      {new Date(selectedTrip.end_datetime).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Start Ticket No</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTrip.start_ticket_no}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">End Ticket No</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTrip.end_ticket_no}</div>
                  </div>
                </div>
              </div>

              {/* Passenger Counts */}
              <div className="border-b border-slate-200 pb-4">
                <h3 className="font-semibold text-slate-700 mb-3">Passenger Breakdown</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Full</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTrip.full_count}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Half</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTrip.half_count}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Student</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTrip.st1_count}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Luggage</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTrip.luggage_count}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Physical</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTrip.physical_count}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Pass</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTrip.pass_count}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Ladies</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTrip.ladies_count}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Senior</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTrip.senior_count}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-4 pt-3 border-t border-slate-100">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Total Passengers</div>
                    <div className="text-sm font-semibold text-slate-800 mt-1">{selectedTrip.total_passengers}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Total Tickets</div>
                    <div className="text-sm font-semibold text-slate-800 mt-1">{selectedTrip.total_tickets}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">UPI Tickets</div>
                    <div className="text-sm font-semibold text-slate-800 mt-1">{selectedTrip.upi_ticket_count}</div>
                  </div>
                </div>
              </div>

              {/* Collection Details */}
              <div className="border-b border-slate-200 pb-4">
                <h3 className="font-semibold text-slate-700 mb-3">Collection Breakdown</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Full Collection</div>
                    <div className="text-sm text-slate-800 mt-1">₹{selectedTrip.full_collection}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Half Collection</div>
                    <div className="text-sm text-slate-800 mt-1">₹{selectedTrip.half_collection}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">ST Collection</div>
                    <div className="text-sm text-slate-800 mt-1">₹{selectedTrip.st_collection}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Luggage Collection</div>
                    <div className="text-sm text-slate-800 mt-1">₹{selectedTrip.luggage_collection}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Physical Collection</div>
                    <div className="text-sm text-slate-800 mt-1">₹{selectedTrip.physical_collection}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Ladies Collection</div>
                    <div className="text-sm text-slate-800 mt-1">₹{selectedTrip.ladies_collection}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Senior Collection</div>
                    <div className="text-sm text-slate-800 mt-1">₹{selectedTrip.senior_collection}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Adjust Collection</div>
                    <div className="text-sm text-slate-800 mt-1">₹{selectedTrip.adjust_collection}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Expense Amount</div>
                    <div className="text-sm text-slate-800 mt-1">₹{selectedTrip.expense_amount}</div>
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              <div>
                <h3 className="font-semibold text-slate-700 mb-3">Financial Summary</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-xs text-blue-600 font-medium">UPI Amount</div>
                    <div className="text-lg font-bold text-blue-800 mt-1">
                      ₹{parseFloat(selectedTrip.upi_ticket_amount).toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs text-green-600 font-medium">Cash Amount</div>
                    <div className="text-lg font-bold text-green-800 mt-1">
                      ₹{parseFloat(selectedTrip.total_cash_amount).toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-600 font-medium">Total Collection</div>
                    <div className="text-lg font-bold text-slate-800 mt-1">
                      ₹{parseFloat(selectedTrip.total_collection).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-4 flex justify-end">
              <button
                onClick={closeModal}
                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
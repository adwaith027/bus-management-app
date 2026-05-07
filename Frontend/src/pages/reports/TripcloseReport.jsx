import React, { useState, useEffect, useRef } from 'react';
import ExcelJS from 'exceljs';
import api, { BASE_URL } from '../../assets/js/axiosConfig';
import cacheManager from '../../assets/js/reportCache';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KpiCard } from '@/components/ui/kpi-card';
import {
  TrendingDown, Ticket, Users, IndianRupee, CreditCard, Banknote,
  Download, RefreshCw, AlertCircle, Eye, FileText,
} from 'lucide-react';


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
      { header: 'Palmtec ID', key: 'palmtec_id', width: 16 },
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

  // ===== PAGINATION RANGE =====
  const getPaginationRange = (current, total, windowSize = 5) => {
    const half = Math.floor(windowSize / 2);
    let start = Math.max(1, current - half);
    let end = Math.min(total, start + windowSize - 1);
    if (end - start < windowSize - 1) start = Math.max(1, end - windowSize + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  // ===== LOADING / ERROR STATES =====
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md">
          <div className="text-red-600 font-medium">{error}</div>
          <Button
            onClick={() => { setError(null); const today = getTodayDate(); fetchTripData(today, today); }}
            className="mt-4 bg-red-600 hover:bg-red-700 text-white"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ===== UI RENDER =====
  return (
    <div className="p-3 sm:p-4 lg:p-6 min-h-screen bg-slate-50">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md">
            <TrendingDown size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Trip Close Report</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-slate-500">Daily trip closures</p>
              {lastUpdated && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className={`w-1.5 h-1.5 rounded-full ${isPolling && !pollingPaused && isPageVisible ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                  {isPageVisible ? `Updated ${timeAgo}` : 'Paused (tab inactive)'}
                </div>
              )}
            </div>
          </div>
        </div>
        <Button onClick={exportToExcel} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white shadow-md">
          <Download size={15} /> Download Report
        </Button>
      </div>

      {/* Polling Paused Warning */}
      {pollingPaused && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertCircle size={15} className="shrink-0" />
          Date range ended — live updates paused
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <KpiCard title="Total Trips"      value={isRefreshing ? '...' : String(summary.totalTrips)}                    icon={TrendingDown}  color="#64748b" loading={isRefreshing} />
        <KpiCard title="Total Tickets"    value={isRefreshing ? '...' : String(summary.totalTickets)}                  icon={Ticket}        color="#6366f1" loading={isRefreshing} />
        <KpiCard title="Passengers"       value={isRefreshing ? '...' : String(summary.totalPassengers)}               icon={Users}         color="#8b5cf6" loading={isRefreshing} />
        <KpiCard title="Total Collection" value={isRefreshing ? '...' : `₹${summary.totalCollection.toFixed(2)}`}     icon={IndianRupee}   color="#10b981" loading={isRefreshing} />
        <KpiCard title="UPI Amount"       value={isRefreshing ? '...' : `₹${summary.totalUpiAmount.toFixed(2)}`}      icon={CreditCard}    color="#3b82f6" loading={isRefreshing} />
        <KpiCard title="Cash Amount"      value={isRefreshing ? '...' : `₹${summary.totalCashAmount.toFixed(2)}`}     icon={Banknote}      color="#f59e0b" loading={isRefreshing} />
      </div>

      {/* Filters */}
      <Card className="mb-6 border-slate-200 shadow-sm rounded-2xl">
        <CardContent className="p-4 md:p-5">
          {dateError && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              <AlertCircle size={14} className="shrink-0" /> {dateError}
            </div>
          )}
          {hasPendingChanges && !dateError && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-600">
              <span className="animate-pulse">●</span>
              Date filters modified — click Apply Filters to refresh data
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Start Date</label>
              <Input type="date" max={getTodayDate()} value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="text-sm h-9" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">End Date</label>
              <Input type="date" max={getTodayDate()} value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="text-sm h-9" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Palmtec ID</label>
              <select value={filters.palmtecId} onChange={(e) => handleClientFilter('palmtecId', e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400">
                <option value="ALL">ALL</option>
                {palmtecIds.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Route Code</label>
              <select value={filters.routeCode} onChange={(e) => handleClientFilter('routeCode', e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400">
                <option value="ALL">ALL</option>
                {routeCodes.map(code => <option key={code} value={code}>{code}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Depot Code</label>
              <select value={filters.depotCode} onChange={(e) => handleClientFilter('depotCode', e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400">
                <option value="ALL">ALL</option>
                {depotCodes.map(code => <option key={code} value={code}>{code}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Trip No</label>
              <Input type="text" placeholder="Search..." value={filters.tripNo}
                onChange={(e) => handleClientFilter('tripNo', e.target.value)}
                className="text-sm h-9" />
            </div>
          </div>

          <div className="flex justify-end mt-4 gap-2">
            <Button variant="outline" onClick={clearFilters} className="text-slate-600 text-sm h-9">
              Clear Filters
            </Button>
            <Button onClick={handleApplyFilters} disabled={!filters.startDate || !filters.endDate}
              className={`text-sm h-9 text-white ${hasPendingChanges ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-700 hover:bg-slate-800'}`}>
              <RefreshCw size={13} className="mr-1.5" /> Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-slate-400 mb-2 px-1">
        Showing {currentData.length} of {filteredData.length} trips
      </div>

      {/* Table */}
      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0 relative">
          {isRefreshing && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
              <div className="flex items-center gap-2 text-slate-600 font-medium text-sm">
                <RefreshCw size={16} className="animate-spin" /> Loading data...
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/60 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 font-semibold">Palmtec ID</th>
                  <th className="px-4 py-3 font-semibold">Depot</th>
                  <th className="px-4 py-3 font-semibold">Schedule</th>
                  <th className="px-4 py-3 font-semibold">Trip No</th>
                  <th className="px-4 py-3 font-semibold">Route</th>
                  <th className="px-4 py-3 font-semibold">Start Time</th>
                  <th className="px-4 py-3 font-semibold">End Time</th>
                  <th className="px-4 py-3 font-semibold text-right">Tickets</th>
                  <th className="px-4 py-3 font-semibold text-right">Total</th>
                  <th className="px-4 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {isRefreshing && !currentData.length ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {[70,60,70,50,60,80,80,50,70,30].map((w, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-3 bg-slate-200 rounded-full animate-pulse" style={{ width: w }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : currentData.length ? (
                  currentData.map(item => (
                    <tr key={item.id}
                      className={`transition-colors hover:bg-slate-50/70 ${newTripIds.has(item.id) ? 'bg-slate-100/60' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.palmtec_id}</td>
                      <td className="px-4 py-3 text-slate-700">{item.depot_code || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{item.schedule}</td>
                      <td className="px-4 py-3 text-slate-700">{item.trip_no}</td>
                      <td className="px-4 py-3 text-slate-700">{item.route_code || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-slate-700 text-sm">{new Date(item.start_datetime).toLocaleDateString()}</span>
                        <span className="text-slate-400 text-xs block">{new Date(item.start_datetime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-700 text-sm">{new Date(item.end_datetime).toLocaleDateString()}</span>
                        <span className="text-slate-400 text-xs block">{new Date(item.end_datetime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{item.total_tickets}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">₹{parseFloat(item.total_collection).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => openModal(item)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                          <Eye size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center">
                      <FileText size={28} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-slate-400 text-sm">No trip data found for selected filters</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-5">
          <Button variant="outline" size="sm" onClick={() => changePage(currentPage - 1)}
            disabled={currentPage === 1} className="h-8 px-3 text-xs">
            Prev
          </Button>
          {getPaginationRange(currentPage, totalPages).map((page) => (
            <Button key={page} size="sm" onClick={() => changePage(page)}
              className={`h-8 w-8 p-0 text-xs ${currentPage === page
                ? 'bg-slate-900 hover:bg-slate-700 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
              {page}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => changePage(currentPage + 1)}
            disabled={currentPage === totalPages} className="h-8 px-3 text-xs">
            Next
          </Button>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-3xl rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <TrendingDown size={16} className="text-slate-600" /> Trip Details
            </DialogTitle>
          </DialogHeader>

          {selectedTrip && (
            <div className="space-y-4 pt-1">
              {/* Trip Info */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Palmtec ID',   val: selectedTrip.palmtec_id },
                  { label: 'Depot Code',  val: selectedTrip.depot_code || '—' },
                  { label: 'Route Code',  val: selectedTrip.route_code },
                  { label: 'Trip Number', val: selectedTrip.trip_no },
                  { label: 'Schedule',    val: selectedTrip.schedule },
                  { label: 'Direction',   val: selectedTrip.up_down_trip },
                ].map(({ label, val }) => (
                  <div key={label} className="rounded-lg bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">{val}</p>
                  </div>
                ))}
              </div>

              {/* Timing */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Timing</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Start DateTime',  val: new Date(selectedTrip.start_datetime).toLocaleString() },
                    { label: 'End DateTime',    val: new Date(selectedTrip.end_datetime).toLocaleString() },
                    { label: 'Start Ticket No', val: selectedTrip.start_ticket_no },
                    { label: 'End Ticket No',   val: selectedTrip.end_ticket_no },
                  ].map(({ label, val }) => (
                    <div key={label} className="rounded-lg bg-slate-50 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
                      <p className="text-sm font-medium text-slate-800 mt-0.5">{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Passenger counts */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Passenger Breakdown</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Full',     val: selectedTrip.full_count },
                    { label: 'Half',     val: selectedTrip.half_count },
                    { label: 'Student',  val: selectedTrip.st1_count },
                    { label: 'Luggage',  val: selectedTrip.luggage_count },
                    { label: 'Physical', val: selectedTrip.physical_count },
                    { label: 'Pass',     val: selectedTrip.pass_count },
                    { label: 'Ladies',   val: selectedTrip.ladies_count },
                    { label: 'Senior',   val: selectedTrip.senior_count },
                  ].map(({ label, val }) => (
                    <div key={label} className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                      <p className="text-[10px] text-slate-400 font-medium">{label}</p>
                      <p className="text-sm font-bold text-slate-800">{val ?? '—'}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[
                    { label: 'Total Passengers', val: selectedTrip.total_passengers },
                    { label: 'Total Tickets',    val: selectedTrip.total_tickets },
                    { label: 'UPI Tickets',      val: selectedTrip.upi_ticket_count },
                  ].map(({ label, val }) => (
                    <div key={label} className="rounded-lg bg-slate-100 px-3 py-2 text-center">
                      <p className="text-[10px] text-slate-500 font-medium">{label}</p>
                      <p className="text-sm font-bold text-slate-800">{val ?? '—'}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Collection Breakdown */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Collection Breakdown</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Full',     val: `₹${selectedTrip.full_collection}` },
                    { label: 'Half',     val: `₹${selectedTrip.half_collection}` },
                    { label: 'ST',       val: `₹${selectedTrip.st_collection}` },
                    { label: 'Luggage',  val: `₹${selectedTrip.luggage_collection}` },
                    { label: 'Physical', val: `₹${selectedTrip.physical_collection}` },
                    { label: 'Ladies',   val: `₹${selectedTrip.ladies_collection}` },
                    { label: 'Senior',   val: `₹${selectedTrip.senior_collection}` },
                    { label: 'Adjust',   val: `₹${selectedTrip.adjust_collection}` },
                    { label: 'Expense',  val: `₹${selectedTrip.expense_amount}` },
                  ].map(({ label, val }) => (
                    <div key={label} className="rounded-lg bg-slate-50 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
                      <p className="text-sm font-medium text-slate-800 mt-0.5">{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-500">UPI Amount</p>
                  <p className="text-base font-bold text-blue-800 mt-1">₹{parseFloat(selectedTrip.upi_ticket_amount).toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500">Cash Amount</p>
                  <p className="text-base font-bold text-emerald-800 mt-1">₹{parseFloat(selectedTrip.total_cash_amount).toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Total Collection</p>
                  <p className="text-base font-bold text-slate-800 mt-1">₹{parseFloat(selectedTrip.total_collection).toFixed(2)}</p>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <Button onClick={closeModal} variant="outline" className="text-slate-600">Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
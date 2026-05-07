import React, { useState, useEffect, useRef } from 'react';
import ExcelJS from 'exceljs';
import api, { BASE_URL } from '../../assets/js/axiosConfig';
import cacheManager from '../../assets/js/reportCache';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KpiCard } from '@/components/ui/kpi-card';
import {
  Ticket, IndianRupee, CreditCard, Banknote,
  Download, RefreshCw, AlertCircle, Eye,
  ArrowUpDown, ArrowUp, ArrowDown, FileText,
} from 'lucide-react';

export default function TicketReport() {
  // ===== STATE MANAGEMENT =====
  const [transactions, setTransactions] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [dateError, setDateError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [lastUpdateDuration, setLastUpdateDuration] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingPaused, setPollingPaused] = useState(false);
  const [newTicketIds, setNewTicketIds] = useState(new Set());

  // ===== SORT STATE =====
  // key: field name to sort by | direction: 'asc' or 'desc' | null = no sort active
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  // UI filters (what user sees/types)
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    deviceId: 'ALL',
    depotCode: 'ALL',
    paymentMode: 'ALL'
  });
  
  // Applied filters (what's actually sent to API)
  const [appliedFilters, setAppliedFilters] = useState({
    startDate: '',
    endDate: ''
  });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

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

  // Initialize with cached date range or today's date, and fetch data
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = user.id;

    // Try to restore previous date range from cache
    const cachedDateRange = cacheManager.getDateRange('ticket', userId);
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
    const cacheKey = cacheManager.getCacheKey('ticket', userId, startDate, endDate);
    const cachedData = cacheManager.get(cacheKey);

    if (cachedData) {
      // Load from cache
      setTransactions(cachedData);
      if (cachedData.length > 0) {
        latestTimestampRef.current = cachedData[0].created_at;
      }
      setIsPolling(true);
      setLastUpdated(new Date());
    } else {
      // Fetch from API if no cache
      fetchTransactions(startDate, endDate);
    }
  }, []);

  // Page visibility tracking
  const [isPageVisible, setIsPageVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Polling effect
  useEffect(() => {
    if (isPolling && !pollingPaused && isPageVisible && appliedFilters.startDate && appliedFilters.endDate) {
      pollingIntervalRef.current = setInterval(() => {
        pollForNewTransactions();
      }, 10000); // 6 second intervals use 6000, 10 use 10000

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
      };
    } else {
      // Clear interval if page is not visible
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

  const fetchTransactions = async (startDate, endDate, sinceTimestamp = null) => {
    try {
      // Only show loading spinner for initial/filter fetch, not for polling
      if (!sinceTimestamp) {
        setIsRefreshing(true);
      }
      
      const requestStartTime = Date.now();
      
      let url = `${BASE_URL}/get_all_transaction_data?from_date=${startDate}&to_date=${endDate}`;
      if (sinceTimestamp) {
        url += `&since=${encodeURIComponent(sinceTimestamp)}`;
      }
      
      const response = await api.get(url);
      
      const requestEndTime = Date.now();
      const requestDuration = requestEndTime - requestStartTime;
      
      if (response.data.message === 'success') {
        if (sinceTimestamp) {
          // Polling update - append new tickets only (no loading spinner)
          const newTickets = response.data.data || [];
          
          if (newTickets.length > 0) {
            // Check for duplicates before adding
            setTransactions(prev => {
              const existingIds = new Set(prev.map(t => t.id));
              const uniqueNewTickets = newTickets.filter(t => !existingIds.has(t.id));
              
              if (uniqueNewTickets.length === 0) {
                return prev; // No new unique tickets
              }
              
              // Prepend unique new tickets — sort will re-order if active
              const updated = [...uniqueNewTickets, ...prev];
              
              // Highlight new tickets
              const newIds = new Set(uniqueNewTickets.map(t => t.id));
              setNewTicketIds(newIds);
              setTimeout(() => setNewTicketIds(new Set()), 2000);
              
              return updated;
            });
            
            // Update latest timestamp to the newest ticket's created_at
            latestTimestampRef.current = newTickets[0].created_at;
          }
          
          // Update last updated time and duration for polling requests
          setLastUpdated(new Date());
          setLastUpdateDuration(requestDuration);
        } else {
          // Initial/filter fetch - replace all data
          const fetchedData = response.data.data || [];
          setTransactions(fetchedData);
          
          // Cache the data and date range
          const user = JSON.parse(localStorage.getItem("user") || "{}");
          const userId = user.id;
          const cacheKey = cacheManager.getCacheKey('ticket', userId, startDate, endDate);
          cacheManager.set(cacheKey, fetchedData);
          cacheManager.setDateRange('ticket', userId, startDate, endDate);
          
          // Set latest timestamp from the newest ticket (first in array since backend returns descending)
          if (fetchedData.length > 0) {
            latestTimestampRef.current = fetchedData[0].created_at;
          }
          
          // Start polling after initial fetch
          setIsPolling(true);
          
          // Update last updated time for initial fetch
          setLastUpdated(new Date());
          setLastUpdateDuration(requestDuration);
        }

        setError(null);
        setDateError('');
      } else {
        setError('Failed to fetch transactions');
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
      // Only hide loading spinner if this was an initial/filter fetch
      if (!sinceTimestamp) {
        setIsRefreshing(false);
      }
    }
  };

  const pollForNewTransactions = async () => {
    if (isDateRangeEnded()) {
      setPollingPaused(true);
      setIsPolling(false);
      return;
    }

    try {
      // If no timestamp yet (empty data on load), poll without 'since' — full date range fetch
      // Once data arrives, latestTimestampRef gets set and subsequent polls use 'since'
      await fetchTransactions(
        appliedFilters.startDate,
        appliedFilters.endDate,
        latestTimestampRef.current || null
      );
    } catch (err) {
      console.error('Polling error:', err);
      // Don't stop polling on error, just log it
    }
  };

  // ===== DYNAMIC DROPDOWN OPTIONS =====
  const getUniqueOptions = () => {
    const deviceIds = [...new Set(transactions.map(t => t.palmtec_id).filter(Boolean))].sort();
    const depotCodes = [...new Set(transactions.map(t => t.depot_code).filter(Boolean))].sort();
    const paymentModes = [...new Set(transactions.map(t => t.payment_mode_display).filter(Boolean))].sort();
    
    return { deviceIds, depotCodes, paymentModes };
  };

  const { deviceIds, depotCodes, paymentModes } = getUniqueOptions();

  // ===== FILTER LOGIC =====
  const getFilteredData = () =>
    transactions.filter(t => {
      if (filters.deviceId && filters.deviceId !== 'ALL') {
        if (t.palmtec_id !== filters.deviceId) return false;
      }

      if (filters.depotCode && filters.depotCode !== 'ALL') {
        if (t.depot_code !== filters.depotCode) return false;
      }

      if (filters.paymentMode && filters.paymentMode !== 'ALL') {
        if (t.payment_mode_display !== filters.paymentMode) return false;
      }

      return true;
    });

  // ===== SORT LOGIC =====
  // Columns that sort as numbers: total_tickets, ticket_amount
  // Columns that sort as strings: trip_number, ticket_number, formatted_ticket_date, ticket_time
  // Date (DD-MM-YYYY) and time (HH:MM:SS) are consistent formats so string compare works correctly
  const getSortedData = (data) => {
    if (!sortConfig.key || !sortConfig.direction) return data;

    const numericKeys = ['total_tickets', 'ticket_amount'];
    const isNumeric = numericKeys.includes(sortConfig.key);

    return [...data].sort((a, b) => {
      const valA = a[sortConfig.key] ?? '';
      const valB = b[sortConfig.key] ?? '';

      let comparison;
      if (isNumeric) {
        comparison = parseFloat(valA) - parseFloat(valB);
      } else {
        comparison = String(valA).localeCompare(String(valB));
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  };

  // Clicking a header cycles: no sort → asc → desc → no sort
  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: null, direction: null };
    });
    setCurrentPage(1); // reset to page 1 on sort change
  };

  // ===== SUMMARY CALCULATIONS =====
  const calculateSummary = (data) => {
    const totalTickets = data.reduce((sum, t) => sum + (t.total_tickets || 0), 0);
    const totalAmount = data.reduce((sum, t) => sum + parseFloat(t.ticket_amount || 0), 0);
    const upiCount = data.filter(t => t.payment_mode_display === 'UPI').length;
    const cashCount = data.filter(t => t.payment_mode_display === 'Cash').length;
    
    return { totalTickets, totalAmount, upiCount, cashCount };
  };

  const filteredData = getFilteredData();
  const sortedData = getSortedData(filteredData);
  const summary = calculateSummary(filteredData);

  // ===== PAGINATION =====
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const currentData = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
    const oldCacheKey = cacheManager.getCacheKey('ticket', userId, appliedFilters.startDate, appliedFilters.endDate);
    cacheManager.invalidate(oldCacheKey);
    
    // Stop current polling
    setIsPolling(false);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Update applied filters
    setAppliedFilters({
      startDate: filters.startDate,
      endDate: filters.endDate
    });
    
    // Reset latest timestamp
    latestTimestampRef.current = null;
    
    // Fetch new data (will restart polling)
    fetchTransactions(filters.startDate, filters.endDate);
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
    const oldCacheKey = cacheManager.getCacheKey('ticket', userId, appliedFilters.startDate, appliedFilters.endDate);
    cacheManager.invalidate(oldCacheKey);
    
    setFilters({
      startDate: today,
      endDate: today,
      deviceId: 'ALL',
      depotCode: 'ALL',
      paymentMode: 'ALL'
    });
    setAppliedFilters({
      startDate: today,
      endDate: today
    });
    setDateError('');
    
    // Stop polling and reset
    setIsPolling(false);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    latestTimestampRef.current = null;
    
    fetchTransactions(today, today);
    setCurrentPage(1);
  };

  // ===== EXPORT LOGIC =====
  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Transactions');

    worksheet.columns = [
      { header: 'Palmtec ID', key: 'palmtec_id', width: 15 },
      { header: 'Trip Number', key: 'trip_number', width: 14 },
      { header: 'Ticket Number', key: 'ticket_number', width: 16 },
      { header: 'Date', key: 'formatted_ticket_date', width: 14 },
      { header: 'Time', key: 'ticket_time', width: 12 },
      { header: 'Depot Code', key: 'depot_code', width: 14 },
      { header: 'Total Tickets', key: 'total_tickets', width: 14 },
      { header: 'Ticket Amount', key: 'ticket_amount', width: 14 },
      { header: 'Payment Mode', key: 'payment_mode_display', width: 14 },
      { header: 'Ticket Type', key: 'ticket_type_display', width: 14 },
      { header: 'From Stage', key: 'from_stage', width: 18 },
      { header: 'To Stage', key: 'to_stage', width: 18 },
      { header: 'Full Count', key: 'full_count', width: 12 },
      { header: 'Half Count', key: 'half_count', width: 12 },
      { header: 'ST Count', key: 'st_count', width: 12 },
      { header: 'Physical Count', key: 'phy_count', width: 14 },
      { header: 'Luggage Count', key: 'lugg_count', width: 14 },
      { header: 'Luggage Amount', key: 'lugg_amount', width: 14 },
      { header: 'Adjust Amount', key: 'adjust_amount', width: 14 },
      { header: 'Warrant Amount', key: 'warrant_amount', width: 14 },
      { header: 'Refund Amount', key: 'refund_amount', width: 14 },
      { header: 'Ladies Count', key: 'ladies_count', width: 14 },
      { header: 'Senior Count', key: 'senior_count', width: 14 },
      { header: 'Transaction ID', key: 'transaction_id', width: 22 },
      { header: 'Reference', key: 'reference_number', width: 20 },
      { header: 'Pass ID', key: 'pass_id', width: 18 },
      { header: 'Refund Status', key: 'refund_status', width: 14 },
    ];

    filteredData.forEach(t => {
      worksheet.addRow({
        palmtec_id: t.palmtec_id,
        trip_number: t.trip_number,
        ticket_number: t.ticket_number || '-',
        formatted_ticket_date: t.formatted_ticket_date,
        ticket_time: t.ticket_time,
        depot_code: t.depot_code,
        total_tickets: t.total_tickets,
        ticket_amount: t.ticket_amount,
        payment_mode_display: t.payment_mode_display,
        ticket_type_display: t.ticket_type_display,
        from_stage: t.from_stage,
        to_stage: t.to_stage,
        full_count: t.full_count,
        half_count: t.half_count,
        st_count: t.st_count,
        phy_count: t.phy_count,
        lugg_count: t.lugg_count,
        lugg_amount: t.lugg_amount,
        adjust_amount: t.adjust_amount,
        warrant_amount: t.warrant_amount,
        refund_amount: t.refund_amount,
        ladies_count: t.ladies_count,
        senior_count: t.senior_count,
        transaction_id: t.transaction_id,
        reference_number: t.reference_number,
        pass_id: t.pass_id,
        refund_status: t.refund_status,
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
    link.download = `ticket_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
  };

  // ===== MODAL HANDLERS =====
  const openModal = (transaction) => {
    setSelectedTransaction(transaction);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTransaction(null);
  };

  // ===== TIME AGO FORMATTER =====
  const getTimeAgo = () => {
    if (!lastUpdated) return '';
    const seconds = Math.floor((new Date() - lastUpdated) / 1000);
    
    // For very recent updates, show the actual request duration
    if (seconds < 2 && lastUpdateDuration > 0) {
      // return `${lastUpdateDuration}ms ago`;
      return `${Math.round(lastUpdateDuration/1000)}s ago`;
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
              fetchTransactions(today, today);
            }} 
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const getPaginationRange = (current, total, windowSize = 5) => {
    const half = Math.floor(windowSize / 2);

    let start = Math.max(1, current - half);
    let end = Math.min(total, start + windowSize - 1);

    // Adjust start if we're near the end
    if (end - start < windowSize - 1) {
      start = Math.max(1, end - windowSize + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  // ===== UI RENDER =====
  return (
    <div className="p-3 sm:p-4 lg:p-6 min-h-screen bg-slate-50 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md">
            <FileText size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ticket Transaction Report</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-slate-500">Daily ticket transactions</p>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total Tickets"  value={isRefreshing ? '...' : String(summary.totalTickets)}  icon={Ticket}      color="#6366f1" loading={isRefreshing} />
        <KpiCard title="Total Amount"   value={isRefreshing ? '...' : `₹${summary.totalAmount.toFixed(2)}`} icon={IndianRupee} color="#10b981" loading={isRefreshing} />
        <KpiCard title="UPI Payments"   value={isRefreshing ? '...' : String(summary.upiCount)}    icon={CreditCard}  color="#3b82f6" loading={isRefreshing} />
        <KpiCard title="Cash Payments"  value={isRefreshing ? '...' : String(summary.cashCount)}   icon={Banknote}    color="#f59e0b" loading={isRefreshing} />
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

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
              <select value={filters.deviceId} onChange={(e) => handleClientFilter('deviceId', e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400">
                <option value="ALL">ALL</option>
                {deviceIds.map(id => <option key={id} value={id}>{id}</option>)}
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
              <label className="text-xs font-medium text-slate-500">Payment Mode</label>
              <select value={filters.paymentMode} onChange={(e) => handleClientFilter('paymentMode', e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400">
                <option value="ALL">ALL</option>
                {paymentModes.map(mode => <option key={mode} value={mode}>{mode}</option>)}
              </select>
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
        Showing {currentData.length} of {sortedData.length} transactions
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
                  {[
                    { label: 'Trip No',    key: 'trip_number' },
                    { label: 'Ticket No',  key: 'ticket_number' },
                    { label: 'Date',       key: 'formatted_ticket_date' },
                    { label: 'Time',       key: 'ticket_time' },
                  ].map(({ label, key }) => (
                    <th key={key} className="px-4 py-3 font-semibold cursor-pointer select-none hover:text-slate-800"
                      onClick={() => handleSort(key)}>
                      <span className="flex items-center gap-1">
                        {label}
                        {sortConfig.key !== key
                          ? <ArrowUpDown size={12} className="text-slate-300" />
                          : sortConfig.direction === 'asc'
                            ? <ArrowUp size={12} className="text-slate-600" />
                            : <ArrowDown size={12} className="text-slate-600" />}
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold">Depot</th>
                  {[
                    { label: 'Total Count', key: 'total_tickets' },
                    { label: 'Amount',      key: 'ticket_amount' },
                  ].map(({ label, key }) => (
                    <th key={key} className="px-4 py-3 font-semibold cursor-pointer select-none hover:text-slate-800"
                      onClick={() => handleSort(key)}>
                      <span className="flex items-center gap-1">
                        {label}
                        {sortConfig.key !== key
                          ? <ArrowUpDown size={12} className="text-slate-300" />
                          : sortConfig.direction === 'asc'
                            ? <ArrowUp size={12} className="text-slate-600" />
                            : <ArrowDown size={12} className="text-slate-600" />}
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold">Payment</th>
                  <th className="px-4 py-3 font-semibold"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {isRefreshing && !currentData.length ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {[70,60,70,80,60,60,60,80,80,40].map((w, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-3 bg-slate-200 rounded-full animate-pulse" style={{ width: w }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : currentData.length ? (
                  currentData.map((t) => (
                    <tr key={t.id}
                      className={`transition-colors hover:bg-slate-50/70 ${newTicketIds.has(t.id) ? 'bg-slate-100/60' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{t.palmtec_id}</td>
                      <td className="px-4 py-3 text-slate-700">{t.trip_number}</td>
                      <td className="px-4 py-3 text-slate-700">{t.ticket_number || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{t.formatted_ticket_date}</td>
                      <td className="px-4 py-3 text-slate-600">{t.ticket_time}</td>
                      <td className="px-4 py-3 text-slate-700">{t.depot_code || '—'}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{t.total_tickets}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">₹{t.ticket_amount}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline"
                          className={t.payment_mode_display === 'UPI'
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>
                          {t.payment_mode_display}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => openModal(t)}
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
                      <p className="text-slate-400 text-sm">No transactions found for selected filters</p>
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

      {/* Transaction Detail Dialog */}
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-3xl rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Ticket size={16} className="text-slate-600" /> Transaction Details
            </DialogTitle>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4 pt-1">
              {/* Route + Type */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Ticket Type',   val: selectedTransaction.ticket_type_display },
                  { label: 'Request Type',  val: selectedTransaction.request_type || '—' },
                  { label: 'From Stage',    val: selectedTransaction.from_stage },
                  { label: 'To Stage',      val: selectedTransaction.to_stage },
                ].map(({ label, val }) => (
                  <div key={label} className="rounded-lg bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">{val}</p>
                  </div>
                ))}
              </div>

              {/* Passenger counts */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Passenger Counts</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Full',     val: selectedTransaction.full_count },
                    { label: 'Half',     val: selectedTransaction.half_count },
                    { label: 'Student',  val: selectedTransaction.st_count },
                    { label: 'Physical', val: selectedTransaction.phy_count },
                    { label: 'Luggage',  val: selectedTransaction.lugg_count },
                    { label: 'Ladies',   val: selectedTransaction.ladies_count },
                    { label: 'Senior',   val: selectedTransaction.senior_count },
                  ].map(({ label, val }) => (
                    <div key={label} className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                      <p className="text-[10px] text-slate-400 font-medium">{label}</p>
                      <p className="text-sm font-bold text-slate-800">{val ?? '—'}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Amounts */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Amount Details</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Luggage Amount',  val: `₹${selectedTransaction.lugg_amount}` },
                    { label: 'Adjust Amount',   val: `₹${selectedTransaction.adjust_amount}` },
                    { label: 'Warrant Amount',  val: `₹${selectedTransaction.warrant_amount}` },
                    { label: 'Refund Amount',   val: `₹${selectedTransaction.refund_amount}` },
                  ].map(({ label, val }) => (
                    <div key={label} className="rounded-lg bg-slate-50 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
                      <p className="text-sm font-medium text-slate-800 mt-0.5">{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reference */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Reference Information</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Transaction ID',   val: selectedTransaction.transaction_id || '—' },
                    { label: 'Reference Number', val: selectedTransaction.reference_number || '—' },
                    { label: 'Pass ID',          val: selectedTransaction.pass_id || '—' },
                    { label: 'Refund Status',    val: selectedTransaction.refund_status || '—' },
                  ].map(({ label, val }) => (
                    <div key={label} className="rounded-lg bg-slate-50 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
                      <p className="text-sm font-medium text-slate-800 mt-0.5 break-all">{val}</p>
                    </div>
                  ))}
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
import React, { useState, useEffect, useRef } from 'react';
import ExcelJS from 'exceljs';
import api, { BASE_URL } from '../assets/js/axiosConfig';

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
  
  // UI filters (what user sees/types)
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    deviceId: 'ALL',
    branchCode: 'ALL',
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

  // Initialize with today's date and fetch data
  useEffect(() => {
    const today = getTodayDate();
    setFilters(prev => ({
      ...prev,
      startDate: today,
      endDate: today
    }));
    setAppliedFilters({
      startDate: today,
      endDate: today
    });
    fetchTransactions(today, today);
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
      }, 6000); // 6 second intervals

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
              
              // Prepend unique new tickets
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
    if (!latestTimestampRef.current) return;
    if (isDateRangeEnded()) {
      setPollingPaused(true);
      setIsPolling(false);
      return;
    }

    try {
      // Use the stored timestamp for polling
      await fetchTransactions(
        appliedFilters.startDate,
        appliedFilters.endDate,
        latestTimestampRef.current
      );
    } catch (err) {
      console.error('Polling error:', err);
      // Don't stop polling on error, just log it
    }
  };

  // ===== DYNAMIC DROPDOWN OPTIONS =====
  const getUniqueOptions = () => {
    const deviceIds = [...new Set(transactions.map(t => t.device_id).filter(Boolean))].sort();
    const branchCodes = [...new Set(transactions.map(t => t.branch_code).filter(Boolean))].sort();
    const paymentModes = [...new Set(transactions.map(t => t.payment_mode_display).filter(Boolean))].sort();
    
    return { deviceIds, branchCodes, paymentModes };
  };

  const { deviceIds, branchCodes, paymentModes } = getUniqueOptions();

  // ===== FILTER LOGIC =====
  const getFilteredData = () =>
    transactions.filter(t => {
      if (filters.deviceId && filters.deviceId !== 'ALL') {
        if (t.device_id !== filters.deviceId) return false;
      }

      if (filters.branchCode && filters.branchCode !== 'ALL') {
        if (t.branch_code !== filters.branchCode) return false;
      }

      if (filters.paymentMode && filters.paymentMode !== 'ALL') {
        if (t.payment_mode_display !== filters.paymentMode) return false;
      }

      return true;
    });

  const filteredData = getFilteredData();

  // ===== SUMMARY CALCULATIONS =====
  const calculateSummary = (data) => {
    const totalTickets = data.reduce((sum, t) => sum + (t.total_tickets || 0), 0);
    const totalAmount = data.reduce((sum, t) => sum + parseFloat(t.ticket_amount || 0), 0);
    const upiCount = data.filter(t => t.payment_mode_display === 'UPI').length;
    const cashCount = data.filter(t => t.payment_mode_display === 'Cash').length;
    
    return { totalTickets, totalAmount, upiCount, cashCount };
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
    setFilters({
      startDate: today,
      endDate: today,
      deviceId: 'ALL',
      branchCode: 'ALL',
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
      { header: 'Device ID', key: 'device_id', width: 15 },
      { header: 'Trip Number', key: 'trip_number', width: 14 },
      { header: 'Ticket Number', key: 'ticket_number', width: 16 },
      { header: 'Date', key: 'formatted_ticket_date', width: 14 },
      { header: 'Time', key: 'ticket_time', width: 12 },
      { header: 'Branch Code', key: 'branch_code', width: 14 },
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
        device_id: t.device_id,
        trip_number: t.trip_number,
        ticket_number: t.ticket_number || '-',
        formatted_ticket_date: t.formatted_ticket_date,
        ticket_time: t.ticket_time,
        branch_code: t.branch_code,
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
    <div className="p-6 md:p-10 min-h-screen bg-slate-50">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Ticket Transaction Reports</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-slate-500">View and manage daily ticket transactions</p>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-medium">Total Tickets</div>
          {isRefreshing ? (
            <div className="animate-pulse bg-slate-200 h-8 w-20 rounded mt-1"></div>
          ) : (
            <div className="text-2xl font-bold text-slate-800 mt-1">{summary.totalTickets}</div>
          )}
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-medium">Total Amount</div>
          {isRefreshing ? (
            <div className="animate-pulse bg-slate-200 h-8 w-24 rounded mt-1"></div>
          ) : (
            <div className="text-2xl font-bold text-slate-800 mt-1">₹{summary.totalAmount.toFixed(2)}</div>
          )}
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-medium">UPI Payments</div>
          {isRefreshing ? (
            <div className="animate-pulse bg-slate-200 h-8 w-16 rounded mt-1"></div>
          ) : (
            <div className="text-2xl font-bold text-slate-800 mt-1">{summary.upiCount}</div>
          )}
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-medium">Cash Payments</div>
          {isRefreshing ? (
            <div className="animate-pulse bg-slate-200 h-8 w-16 rounded mt-1"></div>
          ) : (
            <div className="text-2xl font-bold text-slate-800 mt-1">{summary.cashCount}</div>
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

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              value={filters.deviceId}
              onChange={(e) => handleClientFilter('deviceId', e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            >
              <option value="ALL">ALL</option>
              {deviceIds.map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-500 mb-1">Branch Code</label>
            <select
              value={filters.branchCode}
              onChange={(e) => handleClientFilter('branchCode', e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            >
              <option value="ALL">ALL</option>
              {branchCodes.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-500 mb-1">Payment Mode</label>
            <select
              value={filters.paymentMode}
              onChange={(e) => handleClientFilter('paymentMode', e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            >
              <option value="ALL">ALL</option>
              {paymentModes.map(mode => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </select>
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
        Showing {currentData.length} of {filteredData.length} transactions
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
                <th className="px-4 py-3 font-semibold">Trip No</th>
                <th className="px-4 py-3 font-semibold">Ticket No</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Branch</th>
                <th className="px-4 py-3 font-semibold">Total Tickets</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold">Info</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {currentData.length ? (
                currentData.map((t) => (
                  <tr 
                    key={t.id} 
                    className={`hover:bg-slate-50 transition ${
                      newTicketIds.has(t.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">{t.device_id}</td>
                    <td className="px-4 py-3">{t.trip_number}</td>
                    <td className="px-4 py-3">{t.ticket_number || "-"}</td>
                    <td className="px-4 py-3">{t.formatted_ticket_date}</td>
                    <td className="px-4 py-3">{t.ticket_time}</td>
                    <td className="px-4 py-3">{t.branch_code || "-"}</td>
                    <td className="px-4 py-3">{t.total_tickets}</td>
                    <td className="px-4 py-3">₹{t.ticket_amount}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        t.payment_mode_display === 'UPI' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {t.payment_mode_display}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openModal(t)}
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
                    No transaction data found for selected filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {/* {totalPages > 1 && (
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
      )} */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 mt-6">
          <button
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Prev
          </button>

          {getPaginationRange(currentPage, totalPages).map((page) => (
            <button
              key={page}
              onClick={() => changePage(page)}
              className={`px-3 py-1.5 rounded-lg border transition ${
                currentPage === page
                  ? "bg-slate-800 text-white border-slate-800"
                  : "border-slate-300 hover:bg-slate-50"
              }`}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => changePage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}


      {/* Modal */}
      {showModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">Transaction Details</h2>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500 font-medium">Ticket Type</div>
                  <div className="text-sm text-slate-800 mt-1">{selectedTransaction.ticket_type_display}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">Request Type</div>
                  <div className="text-sm text-slate-800 mt-1">{selectedTransaction.request_type || "-"}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500 font-medium">From Stage</div>
                  <div className="text-sm text-slate-800 mt-1">{selectedTransaction.from_stage}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">To Stage</div>
                  <div className="text-sm text-slate-800 mt-1">{selectedTransaction.to_stage}</div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h3 className="font-semibold text-slate-700 mb-3">Passenger Counts</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Full</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTransaction.full_count}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Half</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTransaction.half_count}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Student</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTransaction.st_count}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Physical</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTransaction.phy_count}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Luggage</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTransaction.lugg_count}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Ladies</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTransaction.ladies_count}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Senior</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTransaction.senior_count}</div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h3 className="font-semibold text-slate-700 mb-3">Amount Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Luggage Amount</div>
                    <div className="text-sm text-slate-800 mt-1">₹{selectedTransaction.lugg_amount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Adjust Amount</div>
                    <div className="text-sm text-slate-800 mt-1">₹{selectedTransaction.adjust_amount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Warrant Amount</div>
                    <div className="text-sm text-slate-800 mt-1">₹{selectedTransaction.warrant_amount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Refund Amount</div>
                    <div className="text-sm text-slate-800 mt-1">₹{selectedTransaction.refund_amount}</div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h3 className="font-semibold text-slate-700 mb-3">Reference Information</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Transaction ID</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTransaction.transaction_id || "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Reference Number</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTransaction.reference_number || "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Pass ID</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTransaction.pass_id || "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Refund Status</div>
                    <div className="text-sm text-slate-800 mt-1">{selectedTransaction.refund_status || "-"}</div>
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
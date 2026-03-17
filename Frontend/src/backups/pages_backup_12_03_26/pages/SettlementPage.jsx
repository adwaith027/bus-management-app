import React, { useState, useEffect, useRef } from 'react';
import api, { BASE_URL } from '../assets/js/axiosConfig';

export default function SettlementPage() {
  // ===== STATE MANAGEMENT =====
  const [settlements, setSettlements] = useState([]);
  const [summary, setSummary] = useState(null);
  
  // Loading States
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Polling State
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const pollingIntervalRef = useRef(null);

  // Modal & Selection
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    verificationStatus: 'UNVERIFIED',
    reconciliationStatus: 'ALL',
    paymentStatus: 'approved',
    merchantId: 'ALL'
  });

  const [appliedFilters, setAppliedFilters] = useState({
    startDate: '',
    endDate: ''
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // ===== HELPER FUNCTIONS =====
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const hasPendingChanges = 
    appliedFilters.startDate !== filters.startDate || 
    appliedFilters.endDate !== filters.endDate;

  // ===== INITIALIZE =====
  useEffect(() => {
    const today = getTodayDate();
    setFilters(prev => ({ ...prev, startDate: today, endDate: today }));
    setAppliedFilters({ startDate: today, endDate: today });
    
    // Initial fetch
    fetchData(today, today, true);

    // Visibility listener for polling
    const handleVisibilityChange = () => setIsPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // ===== POLLING LOGIC =====
  useEffect(() => {
    // Poll every 15 seconds if page is visible and filters are set
    if (isPageVisible && appliedFilters.startDate) {
      pollingIntervalRef.current = setInterval(() => {
        // Pass false to 'triggerLoading' to make it silent
        fetchData(appliedFilters.startDate, appliedFilters.endDate, false);
      }, 15000);
    }

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [isPageVisible, appliedFilters, filters]);

  // ===== FETCH DATA =====
  // triggerLoading: true = show overlay/skeletons, false = silent update
  const fetchData = async (startDate, endDate, triggerLoading = true) => {
    if (triggerLoading) setIsRefreshing(true);
    setError(null);

    try {
      // Build Query URL
      let url = `${BASE_URL}/get_settlement_data?from_date=${startDate}&to_date=${endDate}`;
      if (filters.verificationStatus && filters.verificationStatus !== 'ALL') url += `&verification_status=${filters.verificationStatus}`;
      if (filters.reconciliationStatus && filters.reconciliationStatus !== 'ALL') url += `&reconciliation_status=${filters.reconciliationStatus}`;
      if (filters.paymentStatus && filters.paymentStatus !== 'ALL') url += `&payment_status=${filters.paymentStatus}`;
      if (filters.merchantId && filters.merchantId !== 'ALL') url += `&merchant_id=${filters.merchantId}`;

      // Parallel Fetch (Data + Summary)
      const [settlementsResponse, summaryResponse] = await Promise.all([
        api.get(url),
        api.get(`${BASE_URL}/get_settlement_summary?from_date=${startDate}&to_date=${endDate}`)
      ]);

      if (settlementsResponse.data.message === 'success') {
        setSettlements(settlementsResponse.data.data || []);
      }
      if (summaryResponse.data.message === 'success') {
        setSummary(summaryResponse.data.data);
      }
      
      setLastUpdated(new Date());

    } catch (err) {
      console.error("Fetch error:", err);
      // Only show error message if it's a user-initiated action, otherwise fail silently for polling
      if (triggerLoading) {
        setError('Failed to load data. Please check your connection.');
      }
    } finally {
      if (triggerLoading) setIsRefreshing(false);
    }
  };

  // ===== FILTER HANDLERS =====
  const handleApplyFilters = () => {
    if (filters.endDate < filters.startDate) {
      alert('End date cannot be before start date');
      return;
    }
    setAppliedFilters({ startDate: filters.startDate, endDate: filters.endDate });
    setCurrentPage(1);
    fetchData(filters.startDate, filters.endDate, true);
  };

  const clearFilters = () => {
    const today = getTodayDate();
    const resetFilters = {
      startDate: today,
      endDate: today,
      verificationStatus: 'UNVERIFIED',
      reconciliationStatus: 'ALL',
      paymentStatus: 'approved',
      merchantId: 'ALL'
    };
    setFilters(resetFilters);
    setAppliedFilters({ startDate: today, endDate: today });
    fetchData(today, today, true);
    setCurrentPage(1);
  };

  // ===== VERIFICATION HANDLERS (OPTIMISTIC UPDATE) =====
  const handleVerify = async (status) => {
    if (!selectedTransaction) return;

    if (status === 'VERIFIED' && selectedTransaction.reconciliation_status === 'AMOUNT_MISMATCH' && !verificationNotes) {
        alert("Please add a note explaining why you are verifying a transaction with an Amount Mismatch.");
        return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post(`${BASE_URL}/verify_settlement`, {
        transaction_id: selectedTransaction.id,
        verification_status: status,
        verification_notes: verificationNotes
      });

      if (response.data.message === 'Transaction verified successfully') {
        const updatedTransaction = response.data.data;

        // 1. Optimistic Update
        setSettlements(prev => 
            prev.map(item => item.id === updatedTransaction.id ? updatedTransaction : item)
        );

        // 2. Update Summary Stats (Silent refresh)
        fetchData(appliedFilters.startDate, appliedFilters.endDate, false);

        closeModal();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===== MODAL LOGIC =====
  const openModal = (transaction) => {
    setSelectedTransaction(transaction);
    setVerificationNotes(transaction.verification_notes || '');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTransaction(null);
    setVerificationNotes('');
  };

  // ===== PAGINATION =====
  const totalPages = Math.ceil(settlements.length / itemsPerPage);
  const currentData = settlements.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // ===== STATUS BADGES =====
  const getStatusBadge = (status, type) => {
    const configs = {
      verification: {
        UNVERIFIED: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        VERIFIED: 'bg-green-100 text-green-700 border-green-200',
        REJECTED: 'bg-red-100 text-red-700 border-red-200',
        FLAGGED: 'bg-orange-100 text-orange-700 border-orange-200',
        DISPUTED: 'bg-purple-100 text-purple-700 border-purple-200'
      },
      reconciliation: {
        PENDING: 'bg-gray-100 text-gray-700',
        AUTO_MATCHED: 'bg-green-100 text-green-700',
        AMOUNT_MISMATCH: 'bg-red-100 text-red-700',
        NOT_FOUND: 'bg-orange-100 text-orange-700',
        DUPLICATE: 'bg-purple-100 text-purple-700',
        MANUAL_MATCH: 'bg-blue-100 text-blue-700'
      }
    };
    const colorClass = configs[type]?.[status] || 'bg-gray-100 text-gray-700';
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium border ${colorClass}`}>
        {status ? status.replace(/_/g, ' ') : 'UNKNOWN'}
      </span>
    );
  };

  // ===== TIME AGO FORMATTER =====
  const getTimeAgo = () => {
    if (!lastUpdated) return '';
    const seconds = Math.floor((new Date() - lastUpdated) / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return 'over 1h ago';
  };

  const [timeAgo, setTimeAgo] = useState('');
  useEffect(() => {
    const interval = setInterval(() => setTimeAgo(getTimeAgo()), 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // ===== MAIN RENDER =====
  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50">
      
      {/* HEADER & LAST UPDATED */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Settlement Verification</h1>
          <div className="flex items-center gap-3 mt-1">
             <p className="text-slate-500">Verify and reconcile payment transactions</p>
             {lastUpdated && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <div className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
                    <span>{isPageVisible ? `Last updated ${timeAgo}` : 'Paused (tab inactive)'}</span>
                </div>
             )}
          </div>
        </div>
        
        <div className="flex gap-2">
            <button 
                onClick={() => fetchData(appliedFilters.startDate, appliedFilters.endDate, true)} 
                className="bg-white border border-slate-200 text-slate-600 p-2.5 rounded-xl hover:bg-slate-50 transition shadow-sm" 
                title="Refresh Data"
            >
                <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="text-slate-500 text-sm font-medium">Pending Verification</div>
            {isRefreshing && !summary ? (
                <div className="animate-pulse bg-slate-200 h-8 w-20 rounded mt-1"></div>
            ) : (
                <div className="text-2xl font-bold text-yellow-600 mt-1">
                    {summary?.verification_summary?.unverified || 0}
                </div>
            )}
            <div className="text-xs text-slate-400 mt-1">
                {summary ? `of ${summary.verification_summary.total} total` : '-'}
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="text-slate-500 text-sm font-medium">Auto-Matched</div>
            {isRefreshing && !summary ? (
                <div className="animate-pulse bg-slate-200 h-8 w-20 rounded mt-1"></div>
            ) : (
                <div className="text-2xl font-bold text-green-600 mt-1">
                    {summary?.reconciliation_summary?.auto_matched || 0}
                </div>
            )}
            <div className="text-xs text-slate-400 mt-1">Ready for verification</div>
          </div>
          
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="text-slate-500 text-sm font-medium">Issues Found</div>
            {isRefreshing && !summary ? (
                <div className="animate-pulse bg-slate-200 h-8 w-20 rounded mt-1"></div>
            ) : (
                <div className="text-2xl font-bold text-orange-600 mt-1">
                    {summary ? (summary.reconciliation_summary.amount_mismatch + summary.reconciliation_summary.not_found + summary.reconciliation_summary.duplicate) : 0}
                </div>
            )}
            <div className="text-xs text-slate-400 mt-1">Needs attention</div>
          </div>
          
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="text-slate-500 text-sm font-medium">Total Amount</div>
            {isRefreshing && !summary ? (
                <div className="animate-pulse bg-slate-200 h-8 w-24 rounded mt-1"></div>
            ) : (
                <div className="text-2xl font-bold text-slate-800 mt-1">
                    ₹{summary?.amount_summary?.total_amount?.toFixed(2) || '0.00'}
                </div>
            )}
            <div className="text-xs text-green-600 mt-1">
                {summary ? `₹${summary.amount_summary.verified_amount.toFixed(2)} verified` : '-'}
            </div>
          </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 md:p-6 mb-6">
        
        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
             <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
             {error}
          </div>
        )}

        {hasPendingChanges && (
          <div className="mb-4 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="animate-pulse">●</span> Filters modified - Click Apply to update
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-500 mb-1">Start Date</label>
            <input type="date" max={getTodayDate()} value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 outline-none" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-500 mb-1">End Date</label>
            <input type="date" max={getTodayDate()} value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 outline-none" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-500 mb-1">Verification</label>
            <select value={filters.verificationStatus} onChange={(e) => setFilters({ ...filters, verificationStatus: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 outline-none">
              <option value="ALL">All</option>
              <option value="UNVERIFIED">Unverified</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
              <option value="FLAGGED">Flagged</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-500 mb-1">Reconciliation</label>
            <select value={filters.reconciliationStatus} onChange={(e) => setFilters({ ...filters, reconciliationStatus: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 outline-none">
              <option value="ALL">All</option>
              <option value="AUTO_MATCHED">Auto-Matched</option>
              <option value="AMOUNT_MISMATCH">Amount Mismatch</option>
              <option value="NOT_FOUND">Not Found</option>
              <option value="DUPLICATE">Duplicate</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-500 mb-1">Payment</label>
            <select value={filters.paymentStatus} onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 outline-none">
              <option value="ALL">All</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
            </select>
          </div>
          <div className="flex flex-col justify-end">
            <button onClick={handleApplyFilters} disabled={!filters.startDate || !filters.endDate} className={`px-4 py-2 rounded-lg text-sm text-white transition shadow-sm ${hasPendingChanges ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-700'} disabled:opacity-50`}>
              Apply Filters
            </button>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={clearFilters} className="text-sm text-slate-500 hover:text-slate-800 underline decoration-slate-300 underline-offset-4">
            Reset Filters
          </button>
        </div>
      </div>

      {/* TRANSACTIONS TABLE (Dynamic Loading) */}
      <div className="text-sm text-slate-500 mb-3">
        Showing {currentData.length} of {settlements.length} transactions
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative min-h-100">
        
        {/* Loading Overlay */}
        {isRefreshing && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
                    <div className="text-slate-600 font-medium">Loading data...</div>
                </div>
            </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 font-semibold">Transaction ID</th>
                <th className="px-4 py-3 font-semibold">Date/Time</th>
                <th className="px-4 py-3 font-semibold">Invoice</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold">Reconciliation</th>
                <th className="px-4 py-3 font-semibold">Verification</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentData.length ? (
                currentData.map((txn) => (
                  <tr key={txn.id} className="hover:bg-slate-50 transition group">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 group-hover:text-slate-800">{txn.transactionID}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-700">{txn.formatted_transaction_date}</div>
                      <div className="text-xs text-slate-400">{txn.transaction_time}</div>
                    </td>
                    <td className="px-4 py-3">{txn.invoiceNumber || '-'}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">₹{txn.transactionAmount}</td>
                    <td className="px-4 py-3">
                      {getStatusBadge(txn.payment_status_display === 'Approved' ? 'APPROVED' : 'DECLINED', 'verification')}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(txn.reconciliation_status, 'reconciliation')}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(txn.verification_status, 'verification')}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openModal(txn)} className="text-blue-600 hover:text-blue-800 font-medium hover:bg-blue-50 px-3 py-1 rounded transition">
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                        {isRefreshing ? null : (
                          <>
                            <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span>No settlements found for selected filters</span>
                          </>
                        )}
                    </div>
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
          <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-sm">Prev</button>
          {[...Array(totalPages)].map((_, i) => {
            const n = i + 1;
            // Simple pagination logic to show max 5 pages
            if (n !== 1 && n !== totalPages && (n < currentPage - 1 || n > currentPage + 1)) return null;
            if (n === currentPage - 2 || n === currentPage + 2) return <span key={n} className="px-1 text-slate-400">...</span>;
            
            return (
              <button key={n} onClick={() => setCurrentPage(n)} className={`px-3 py-1.5 rounded-lg border text-sm transition ${currentPage === n ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-300 hover:bg-slate-50'}`}>
                {n}
              </button>
            );
          })}
          <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-sm">Next</button>
        </div>
      )}

      {/* VERIFICATION MODAL */}
      {showModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto transform transition-all scale-100">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-20">
              <h2 className="text-xl font-bold text-slate-800">Settlement Verification</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition p-1 hover:bg-slate-100 rounded-full">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. Payment Details (Left) */}
                <div className="border border-blue-200 rounded-lg p-5 bg-blue-50/30">
                  <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2 pb-2 border-b border-blue-100">
                    <span className="p-1 bg-blue-100 rounded text-blue-600"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg></span>
                    Payment (Mosambee)
                  </h3>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Transaction ID</div>
                            <div className="text-sm font-mono mt-1 text-slate-800 break-all">{selectedTransaction.transactionID}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Invoice</div>
                            <div className="text-sm mt-1 font-semibold text-blue-700">{selectedTransaction.invoiceNumber || 'N/A'}</div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
                      <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Paid Amount</div>
                      <div className="text-2xl font-bold text-slate-800 mt-1">₹{selectedTransaction.transactionAmount}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Date</div>
                            <div className="text-sm mt-1">{selectedTransaction.formatted_transaction_date}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Time</div>
                            <div className="text-sm mt-1">{selectedTransaction.transaction_time}</div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 pt-2">
                        {selectedTransaction.is_checksum_valid ? (
                           <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full border border-green-200 flex items-center gap-1">
                               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Secure
                           </span>
                        ) : (
                           <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full border border-red-200 flex items-center gap-1">
                               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> Tampered
                           </span>
                        )}
                        <span className="text-xs text-slate-400">|</span>
                        <span className="text-xs text-slate-500">{selectedTransaction.cardType} •••• {selectedTransaction.transactionCardNumber.slice(-4)}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Ticket Details (Right) */}
                <div className="border border-green-200 rounded-lg p-5 bg-green-50/30">
                  <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2 pb-2 border-b border-green-100">
                    <span className="p-1 bg-green-100 rounded text-green-600"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V8z" clipRule="evenodd" /></svg></span>
                    Bus Ticket (System)
                  </h3>

                  {selectedTransaction.related_ticket_number ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Ticket No</div>
                            <div className="text-sm font-mono mt-1 font-semibold text-green-700">{selectedTransaction.related_ticket_number}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Match Status</div>
                            <div className="mt-1">{getStatusBadge(selectedTransaction.reconciliation_status, 'reconciliation')}</div>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-lg border border-green-100 shadow-sm">
                        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Ticket Amount</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">₹{selectedTransaction.related_ticket_amount}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Ticket Date</div>
                            <div className="text-sm mt-1">{selectedTransaction.related_ticket_date}</div>
                         </div>
                      </div>

                      {/* Comparison Logic */}
                      <div className={`mt-4 p-3 rounded-lg border flex items-center gap-3 ${parseFloat(selectedTransaction.transactionAmount) === parseFloat(selectedTransaction.related_ticket_amount) ? 'bg-green-100 border-green-200 text-green-800' : 'bg-red-100 border-red-200 text-red-800'}`}>
                         {parseFloat(selectedTransaction.transactionAmount) === parseFloat(selectedTransaction.related_ticket_amount) ? (
                            <>
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                <span className="font-semibold text-sm">Perfect Match</span>
                            </>
                         ) : (
                            <>
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                <div>
                                    <span className="font-bold text-sm block">Amount Mismatch</span>
                                    <span className="text-xs opacity-75">Diff: ₹{(parseFloat(selectedTransaction.transactionAmount) - parseFloat(selectedTransaction.related_ticket_amount)).toFixed(2)}</span>
                                </div>
                            </>
                         )}
                      </div>

                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                      <span className="text-sm">No ticket matched yet</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Manager Notes */}
              <div className="mt-6 border-t border-slate-200 pt-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Manager Notes</label>
                <textarea
                    className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-slate-500 outline-none transition shadow-sm"
                    rows="2"
                    placeholder="Required for Rejection/Flagging..."
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                ></textarea>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center rounded-b-xl">
              <div className="text-xs text-slate-500">
                {selectedTransaction.verification_status !== 'UNVERIFIED' && (
                    <span className="bg-white border px-2 py-1 rounded">
                        Marked <strong>{selectedTransaction.verification_status}</strong> by {selectedTransaction.verified_by_username || 'Admin'}
                    </span>
                )}
              </div>
              
              <div className="flex gap-3">
                <button onClick={() => handleVerify('FLAGGED')} disabled={isSubmitting} className="px-4 py-2 bg-white border border-orange-200 text-orange-700 font-medium rounded-lg hover:bg-orange-50 transition disabled:opacity-50 text-sm">
                  Flag
                </button>
                <button onClick={() => handleVerify('REJECTED')} disabled={isSubmitting} className="px-4 py-2 bg-white border border-red-200 text-red-700 font-medium rounded-lg hover:bg-red-50 transition disabled:opacity-50 text-sm">
                  Reject
                </button>
                <button onClick={() => handleVerify('VERIFIED')} disabled={isSubmitting} className="px-6 py-2 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 transition shadow-lg shadow-slate-200 disabled:opacity-50 flex items-center gap-2 text-sm">
                  {isSubmitting ? <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></div> : 'Verify Settlement'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import Toast from '@/components/Toast';

interface Transaction {
  id: number;
  user_id: number;
  amount: number;
  transaction_type: string;
  description: string | null;
  admin_id: number | null;
  created_at: string;
  user_name: string | null;
  user_id_number: string | null;
  user_email: string | null;
  user_nickname: string | null;
  admin_name: string | null;
}

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function TransactionsPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    fetchTransactions();
  }, [router]);


  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 500 };
      
      if (searchQuery.trim()) {
        const query = searchQuery.trim();
        // Smart detection: 
        // - If it's a number and length <= 3 digits, likely a User ID (e.g., 1, 10, 100)
        // - If it contains @, it's an email
        // - Otherwise (longer numbers or text), treat as ID Number (e.g., 1234567890)
        const numValue = parseInt(query);
        if (query.includes('@')) {
          // Contains @ = email
          params.email = query;
        } else if (!isNaN(numValue) && query.length <= 3 && numValue > 0 && numValue < 10000) {
          // Short number (1-3 digits) = likely User ID
          params.userId = numValue;
        } else {
          // Longer number or text = ID Number (most common case)
          params.idNumber = query;
        }
      }
      
      const queryString = new URLSearchParams(params).toString();
      const response = await api.get(`/users/transactions/all?${queryString}`);
      setTransactions(response.data.transactions || []);
    } catch (err: any) {
      console.error('Failed to fetch transactions:', err);
      showToast(err.response?.data?.error || 'Failed to load transactions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchTransactions();
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    fetchTransactions();
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'ADDED':
        return 'bg-green-100 text-green-800';
      case 'DEDUCTED':
        return 'bg-red-100 text-red-800';
      case 'REFUNDED':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'ADDED':
        return '➕';
      case 'DEDUCTED':
        return '➖';
      case 'REFUNDED':
        return '↩️';
      default:
        return '💎';
    }
  };

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      {/* Main Content */}
      <div className={`lg:pl-64 transition-all duration-300 ${sidebarOpen ? 'lg:ml-0' : ''}`}>
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <h1 className="text-2xl font-bold text-gray-800">Transaction History</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchTransactions}
                  disabled={loading}
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <svg
                    className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 sm:px-6 lg:px-8 py-8">
          {/* Search Section */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Search Transactions</h2>
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter ID Number or User ID"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-base"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Enter ID Number (e.g., 1234567890) or User ID (1-4 digits, e.g., 1, 2, 10...)
                </p>
              </div>
              <div className="flex items-start gap-2">
                <button
                  onClick={handleSearch}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold transition flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search
                </button>
                <button
                  onClick={handleClearSearch}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Transactions</p>
                  <p className="text-3xl font-bold text-gray-800 mt-2">{transactions.length}</p>
                </div>
                <div className="text-4xl">📊</div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Added</p>
                  <p className="text-3xl font-bold text-gray-800 mt-2">
                    {transactions.filter(t => t.transaction_type === 'ADDED').length}
                  </p>
                </div>
                <div className="text-4xl">➕</div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Deducted</p>
                  <p className="text-3xl font-bold text-gray-800 mt-2">
                    {transactions.filter(t => t.transaction_type === 'DEDUCTED').length}
                  </p>
                </div>
                <div className="text-4xl">➖</div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Refunded</p>
                  <p className="text-3xl font-bold text-gray-800 mt-2">
                    {transactions.filter(t => t.transaction_type === 'REFUNDED').length}
                  </p>
                </div>
                <div className="text-4xl">↩️</div>
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                Recent Transactions {searchQuery ? `(Filtered)` : ''}
              </h2>
            </div>
            <div className="overflow-x-auto">
              {transactions.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-500 text-lg">
                    {searchQuery 
                      ? 'No transactions found for this search' 
                      : 'No transactions found'}
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Admin
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Receipt
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transactions.map((transaction, index) => {
                      // Calculate display amount with decimals
                      let displayAmount = 0;
                      
                      // For Weekly Sale Reward transactions, calculate incremental from description
                      // because database stores amount as INT (rounded), not DECIMAL
                      if (
                        transaction.transaction_type === 'ADDED' &&
                        transaction.description &&
                        transaction.description.includes('Weekly Sale Reward')
                      ) {
                        // Extract total reward from current transaction description
                        const currentRewardMatch =
                          transaction.description.match(/Reward:\s*([\d.]+)/);
                        const currentTotalReward = currentRewardMatch
                          ? parseFloat(currentRewardMatch[1])
                          : 0;

                        if (currentTotalReward > 0) {
                          // Find the previous Weekly Sale Reward transaction for this user
                          let previousTotalReward = 0;
                          for (let i = index + 1; i < transactions.length; i++) {
                            const prevTransaction = transactions[i];
                            if (
                              prevTransaction.user_id === transaction.user_id &&
                              prevTransaction.transaction_type === 'ADDED' &&
                              prevTransaction.description &&
                              prevTransaction.description.includes('Weekly Sale Reward')
                            ) {
                              const prevRewardMatch =
                                prevTransaction.description.match(/Reward:\s*([\d.]+)/);
                              if (prevRewardMatch) {
                                previousTotalReward = parseFloat(prevRewardMatch[1]);
                                break;
                              }
                            }
                          }

                          // Calculate incremental amount (difference between current and previous total)
                          displayAmount = currentTotalReward - previousTotalReward;
                          // Round to 2 decimal places
                          displayAmount = Math.round(displayAmount * 100) / 100;
                        }
                      } else {
                        // For other transactions, use the stored amount
                        displayAmount = typeof transaction.amount === 'number'
                          ? transaction.amount
                          : parseFloat(String(transaction.amount || 0)) || 0;
                        // Round to 2 decimal places
                        displayAmount = Math.round(displayAmount * 100) / 100;
                      }

                      return (
                        <tr key={transaction.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(transaction.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div>
                                <Link
                                  href={`/users/${transaction.user_id}`}
                                  className="text-sm font-semibold text-primary-600 hover:text-primary-700"
                                >
                                  {transaction.user_nickname || transaction.user_name || `User #${transaction.user_id}`}
                                </Link>
                                {transaction.user_id_number && (
                                  <p className="text-xs text-gray-500">ID: {transaction.user_id_number}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTransactionTypeColor(transaction.transaction_type)}`}>
                              <span className="mr-1">{getTransactionIcon(transaction.transaction_type)}</span>
                              {transaction.transaction_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-bold ${
                              transaction.transaction_type === 'ADDED' || transaction.transaction_type === 'REFUNDED'
                                ? 'text-green-600'
                                : 'text-red-600'
                            }`}>
                              {transaction.transaction_type === 'ADDED' || transaction.transaction_type === 'REFUNDED' ? '+' : '-'}
                              {displayAmount.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 max-w-md">
                            <p className="truncate" title={transaction.description || 'No description'}>
                              {transaction.description || '-'}
                            </p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {transaction.admin_name || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <button
                              onClick={() => {
                                setSelectedTransaction(transaction);
                                setShowReceiptModal(true);
                              }}
                              disabled={transaction.transaction_type !== 'ADDED'}
                              title={
                                transaction.transaction_type === 'ADDED'
                                  ? 'View receipt'
                                  : 'Receipt available for ADDED only'
                              }
                              className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition ${
                                transaction.transaction_type === 'ADDED'
                                  ? 'bg-white text-primary-600 border-primary-200 hover:bg-primary-50'
                                  : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                              }`}
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Receipt Modal */}
      {showReceiptModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Receipt</h3>
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  setSelectedTransaction(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center mb-3">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Success</h2>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Receiver</p>
                <p className="text-base font-semibold text-gray-800">
                  {selectedTransaction.user_nickname ||
                    selectedTransaction.user_name ||
                    `User #${selectedTransaction.user_id}`}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Time</p>
                <p className="text-base font-semibold text-gray-800">
                  {formatDateTime(selectedTransaction.created_at)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Diamond Amount</p>
                <div className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 text-black"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path d="M3.1.7a.5.5 0 0 1 .4-.2h9a.5.5 0 0 1 .4.2l2.976 3.974c.149.185.156.45.01.644L8.4 15.3a.5.5 0 0 1-.8 0L.1 5.3a.5.5 0 0 1 0-.6zm11.386 3.785-1.806-2.41-.776 2.413zm-3.633.004.961-2.989H4.186l.963 2.995zM5.47 5.495 8 13.366l2.532-7.876zm-1.371-.999-.78-2.422-1.818 2.425zM1.499 5.5l5.113 6.817-2.192-6.82zm7.889 6.817 5.123-6.83-2.928.002z" />
                  </svg>
                  <p className="text-base font-semibold text-gray-800">
                    {Math.round(selectedTransaction.amount * 100) / 100}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Status</p>
                <p className="text-base font-semibold text-green-700">SUCCESS</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Description</p>
                <p className="text-base font-semibold text-gray-800">
                  {selectedTransaction.description || '-'}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  setSelectedTransaction(null);
                }}
                className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 active:bg-primary-800 transition"
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

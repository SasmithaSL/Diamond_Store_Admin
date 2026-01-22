"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";

interface WeeklySummary {
  total_users: number;
  total_orders: number;
  total_sales: number;
  total_rewards: number;
}

interface UserBreakdown {
  user_id: number;
  name: string;
  nickname: string | null;
  id_number: string;
  email: string | null;
  order_count: number;
  user_sales: number;
  user_reward: number;
}

interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  summary: WeeklySummary;
  userBreakdown: UserBreakdown[];
  availableWeeks: Array<{ week_start: string }>;
}

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

export default function ReportsPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [userSearch, setUserSearch] = useState("");
  const [filteredUsers, setFilteredUsers] = useState<UserBreakdown[]>([]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    fetchReport();
  }, [router, selectedWeek]);

  useEffect(() => {
    if (report && report.userBreakdown) {
      if (!userSearch.trim()) {
        setFilteredUsers(report.userBreakdown);
      } else {
        const search = userSearch.toLowerCase().trim();
        const filtered = report.userBreakdown.filter(
          (user) =>
            user.name?.toLowerCase().includes(search) ||
            user.nickname?.toLowerCase().includes(search) ||
            user.id_number?.toLowerCase().includes(search) ||
            (user.email && user.email.toLowerCase().includes(search)) ||
            user.user_id.toString().includes(search)
        );
        setFilteredUsers(filtered);
      }
    }
  }, [userSearch, report]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedWeek) {
        params.weekStart = selectedWeek;
      }
      const queryString = new URLSearchParams(params).toString();
      const response = await api.get(`/users/reports/weekly?${queryString}`);
      setReport(response.data);
      setFilteredUsers(response.data.userBreakdown || []);
    } catch (err: any) {
      console.error("Failed to fetch report:", err);
      setToast({
        message: err.response?.data?.error || "Failed to fetch weekly report",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    // Parse the date string - week_start comes as "YYYY-MM-DD" (date only)
    // We need to display it as Thursday 21:30 (9:30 PM) in local timezone
    let date: Date;

    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // It's just a date (YYYY-MM-DD), create date with 21:30:00 in local timezone
      // Use Date constructor with local timezone parameters (not UTC)
      const [year, month, day] = dateStr.split("-").map(Number);
      date = new Date(year, month - 1, day, 21, 30, 0);
      // Verify the date was created correctly
      if (isNaN(date.getTime())) {
        console.error("Invalid date:", dateStr);
        return dateStr;
      }
    } else if (dateStr.includes(" ")) {
      // It has time component "YYYY-MM-DD HH:mm:ss"
      const [datePart, timePart] = dateStr.split(" ");
      const [year, month, day] = datePart.split("-").map(Number);
      const timeParts = timePart.split(":");
      const hour = parseInt(timeParts[0], 10);
      const minute = parseInt(timeParts[1] || "0", 10);
      // Use Date constructor with local timezone
      date = new Date(year, month - 1, day, hour, minute, 0);
    } else {
      // Fallback: parse as-is (might have timezone issues)
      date = new Date(dateStr);
    }

    // Format with 12-hour time - this should show 09:30 PM for 21:30
    const formatted = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    return formatted;
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition"
                >
                  <svg
                    className="w-6 h-6 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </button>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                    Weekly Reports
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    Sales and rewards summary by week
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Week Selector */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Week
                </label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                >
                  <option value="">Current Week</option>
                  {report?.availableWeeks.map((week) => {
                    // week.week_start is "YYYY-MM-DD", format it as "Jan 8, 2026, 09:30 PM"
                    const [year, month, day] = week.week_start
                      .split("-")
                      .map(Number);
                    const date = new Date(year, month - 1, day, 21, 30, 0);
                    const formatted = date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    });
                    return (
                      <option key={week.week_start} value={week.week_start}>
                        {formatted}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* User Search */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Search User
                </label>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name, ID number, or user ID..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                />
              </div>
            </div>

            {/* Week Period Display */}
            {report && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Period:</span>{" "}
                  {formatDate(report.weekStart)} - {formatDate(report.weekEnd)}
                </p>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : report ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 mb-1">
                        Total Users
                      </p>
                      <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                        {report.summary.total_users}
                      </p>
                    </div>
                    <div className="text-3xl sm:text-4xl">👥</div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 mb-1">
                        Total Orders
                      </p>
                      <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                        {report.summary.total_orders}
                      </p>
                    </div>
                    <div className="text-3xl sm:text-4xl">📦</div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 mb-1">
                        Total Sales
                      </p>
                      <p className="text-2xl sm:text-3xl font-bold text-primary-600">
                        {formatCurrency(report.summary.total_sales)}
                      </p>
                    </div>
                    <div className="text-3xl sm:text-4xl">💰</div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 mb-1">
                        Total Rewards
                      </p>
                      <p className="text-2xl sm:text-3xl font-bold text-green-600">
                        {formatCurrency(report.summary.total_rewards)}
                      </p>
                    </div>
                    <div className="text-3xl sm:text-4xl">🎁</div>
                  </div>
                </div>
              </div>

              {/* User Breakdown */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                    User Breakdown
                    {userSearch && (
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        ({filteredUsers.length} results)
                      </span>
                    )}
                  </h2>
                </div>

                {filteredUsers.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <p>No users found for this week.</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile Card Layout */}
                    <div className="md:hidden divide-y divide-gray-200">
                      {filteredUsers.map((user) => (
                        <div
                          key={user.user_id}
                          className="p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <Link
                                href={`/users/${user.user_id}`}
                                className="text-base font-semibold text-gray-900 hover:text-primary-600 transition block truncate"
                              >
                                {user.nickname || user.name}
                              </Link>
                              <p className="text-xs text-gray-500 mt-1">
                                ID: {user.id_number}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-gray-600">Orders</p>
                              <p className="font-semibold text-gray-900">
                                {user.order_count}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Sales</p>
                              <p className="font-semibold text-primary-600">
                                {formatCurrency(user.user_sales)}
                              </p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-gray-600">Reward</p>
                              <p className="font-semibold text-green-600">
                                {formatCurrency(user.user_reward)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table Layout */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              User
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              ID Number
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Orders
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Sales
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Reward
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredUsers.map((user) => (
                            <tr
                              key={user.user_id}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Link
                                  href={`/users/${user.user_id}`}
                                  className="text-sm font-semibold text-gray-900 hover:text-primary-600 transition"
                                >
                                  {user.nickname || user.name}
                                </Link>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-600 font-mono">
                                  {user.id_number}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <span className="text-sm font-semibold text-gray-900">
                                  {user.order_count}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <span className="text-sm font-semibold text-primary-600">
                                  {formatCurrency(user.user_sales)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <span className="text-sm font-semibold text-green-600">
                                  {formatCurrency(user.user_reward)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
              <p>No report data available.</p>
            </div>
          )}
        </main>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

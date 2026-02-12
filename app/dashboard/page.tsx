"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { removeToken, isAuthenticated } from "@/lib/auth";
import { getImageUrl, handleImageError } from "@/lib/imageUtils";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";
import ThemeToggle from "@/components/ThemeToggle";

interface PendingUser {
  id: number;
  name: string;
  nickname: string | null;
  email: string | null;
  id_number: string;
  face_image: string | null;
  status: string;
  created_at: string;
}

interface ApprovedUser {
  id: number;
  name: string;
  nickname: string | null;
  email: string | null;
  id_number: string;
  points_balance: number;
  status: string;
  created_at: string;
}

interface Order {
  id: number;
  order_number: string;
  user_id: number;
  parent_user_name: string;
  parent_user_id_number: string;
  parent_user_email: string | null;
  customer_name: string | null;
  client_imo_id: string | null;
  client_profile_photo: string | null;
  diamond_amount: number;
  quantity: number;
  points_used: number;
  status: string;
  created_at: string;
}

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}


export default function AdminDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<ApprovedUser[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [rejectedOrders, setRejectedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "pending" | "users" | "orders" | "rejected"
  >("orders");
  const [showAddPoints, setShowAddPoints] = useState<number | null>(null);
  const [pointsAmount, setPointsAmount] = useState("");
  const [pointsDescription, setPointsDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [stats, setStats] = useState({
    pendingUsers: 0,
    approvedUsers: 0,
    pendingOrders: 0,
    rejectedOrders: 0,
    pointRequests: 0,
    totalDiamondBalance: 0,
  });
  const lastOrderIdsRef = useRef<Set<number>>(new Set());
  const hasLoadedOrdersRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }

    // Get active tab from URL
    const tab = searchParams.get("tab") as
      | "pending"
      | "users"
      | "orders"
      | "rejected"
      | null;
    if (tab && ["pending", "users", "orders", "rejected"].includes(tab)) {
      setActiveTab(tab);
    } else {
      // Default to orders if no tab specified
      setActiveTab("orders");
    }

    fetchData();
  }, [router, searchParams]);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    setToast({ message, type });
  };


  const getOrderStatus = (order: Order) =>
    (order.status || "").toUpperCase().trim();

  const playNotificationSound = async () => {
    if (typeof window === "undefined") return;
    try {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const audioContext = audioContextRef.current;
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.2,
        audioContext.currentTime + 0.02,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + 0.2,
      );

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.22);
    } catch (err) {
      console.warn("Notification sound failed:", err);
    }
  };

  const showSystemNotification = async (newCount: number) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if (Notification.permission !== "granted") return;
      const title =
        newCount === 1 ? "New order received" : "New orders received";
      const body =
        newCount === 1
          ? "A new order is waiting for approval."
          : `${newCount} new orders are waiting for approval.`;
      new Notification(title, { body });
    } catch (err) {
      console.warn("System notification failed:", err);
    }
  };

  const applyPendingOrders = (orders: Order[], notify: boolean) => {
    setPendingOrders(orders);
    setStats((prev) => ({ ...prev, pendingOrders: orders.length }));

    const currentIds = new Set(orders.map((order) => order.id));
    if (!hasLoadedOrdersRef.current) {
      lastOrderIdsRef.current = currentIds;
      hasLoadedOrdersRef.current = true;
      return;
    }

    if (notify) {
      let newCount = 0;
      currentIds.forEach((id) => {
        if (!lastOrderIdsRef.current.has(id)) {
          newCount += 1;
        }
      });

      if (newCount > 0) {
        showToast(
          newCount === 1
            ? "New order received"
            : `New orders received (${newCount})`,
          "info",
        );
        playNotificationSound();
        showSystemNotification(newCount);
      }
    }

    lastOrderIdsRef.current = currentIds;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pendingRes, approvedRes, ordersRes, rejectedRes] =
        await Promise.all([
          api.get("/users/pending"),
          api.get("/users/approved"),
          api.get("/orders/pending"),
          api.get("/orders/rejected"),
        ]);
      setPendingUsers(pendingRes.data.users || []);
      const approvedUsersData = approvedRes.data.users || [];
      setApprovedUsers(approvedUsersData);
      applyPendingOrders(ordersRes.data.orders || [], false);
      const rejectedOnly = (rejectedRes.data.orders || []).filter(
        (order: Order) => getOrderStatus(order) === "REJECTED",
      );
      setRejectedOrders(rejectedOnly);

      // Calculate total diamond balance from all approved users
      const totalDiamondBalance = Math.round(
        approvedUsersData.reduce(
          (sum: number, user: ApprovedUser) => {
            const balance = typeof user.points_balance === 'number' 
              ? user.points_balance 
              : parseFloat(String(user.points_balance || 0)) || 0;
            return sum + balance;
          },
          0
        ) * 100
      ) / 100; // Round to 2 decimal places

      setStats({
        pendingUsers: pendingRes.data.users?.length || 0,
        approvedUsers: approvedUsersData.length || 0,
        pendingOrders: ordersRes.data.orders?.length || 0,
        rejectedOrders: rejectedRes.data.orders?.length || 0,
        pointRequests: 0,
        totalDiamondBalance: totalDiamondBalance,
      });
    } catch (err: any) {
      console.error("Failed to fetch data:", err);
      showToast("Failed to refresh data. Please reload the page.", "error");
    } finally {
      setLoading(false);
    }
  };


  const handleApproveUser = async (userId: number) => {
    try {
      await api.patch(`/users/${userId}/status`, { status: "APPROVED" });
      showToast("User approved successfully!", "success");
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to approve user", "error");
    }
  };

  const handleRejectUser = async (userId: number) => {
    if (!confirm("Are you sure you want to reject this user?")) return;
    try {
      await api.patch(`/users/${userId}/status`, { status: "REJECTED" });
      showToast("User rejected successfully!", "success");
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to reject user", "error");
    }
  };

  const handleAddPoints = async (userId: number) => {
    const amount = parseInt(pointsAmount);
    if (!pointsAmount || isNaN(amount) || amount <= 0) {
      showToast("Please enter a valid amount", "error");
      return;
    }
    const descriptionValue = pointsDescription || "Quick Store";

    try {
      const response = await api.post(`/users/${userId}/points`, {
        amount: amount,
        description: descriptionValue,
      });

      const updatedBalance = response.data?.user?.points_balance;
      showToast(
        `Points added successfully! New balance: ${updatedBalance}`,
        "success",
      );

      setPointsAmount("");
      setPointsDescription("");

      await fetchData();
    } catch (err: any) {
      console.error("Add points error:", err);
      showToast(err.response?.data?.error || "Failed to add points", "error");
    }
  };

  const handleOrderStatus = async (
    orderId: number,
    status: "COMPLETED" | "REJECTED",
  ) => {
    if (
      status === "REJECTED" &&
      !confirm(
        "Are you sure you want to reject this order? Points will be refunded.",
      )
    ) {
      return;
    }

    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      showToast(`Order ${status.toLowerCase()} successfully!`, "success");
      fetchData();

    } catch (err: any) {
      showToast(
        err.response?.data?.error || "Failed to update order status",
        "error",
      );
    }
  };

  const filteredPendingUsers = pendingUsers.filter(
    (user) =>
      (user.nickname || user.name)
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email &&
        user.email.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const filteredApprovedUsers = approvedUsers.filter(
    (user) =>
      (user.nickname || user.name)
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email &&
        user.email.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const filteredOrders = pendingOrders.filter((order) => {
    if (getOrderStatus(order) !== "PENDING") return false;
    const query = searchQuery.toLowerCase();
    return (
      order.order_number.toLowerCase().includes(query) ||
      (order.parent_user_name &&
        order.parent_user_name.toLowerCase().includes(query)) ||
      (order.parent_user_id_number &&
        order.parent_user_id_number.toLowerCase().includes(query)) ||
      (order.parent_user_email &&
        order.parent_user_email.toLowerCase().includes(query)) ||
      (order.client_imo_id && order.client_imo_id.toLowerCase().includes(query))
    );
  });

  const filteredRejectedOrders = rejectedOrders.filter((order) => {
    if (getOrderStatus(order) !== "REJECTED") return false;
    const query = searchQuery.toLowerCase();
    return (
      order.order_number.toLowerCase().includes(query) ||
      (order.parent_user_name &&
        order.parent_user_name.toLowerCase().includes(query)) ||
      (order.parent_user_id_number &&
        order.parent_user_id_number.toLowerCase().includes(query)) ||
      (order.parent_user_email &&
        order.parent_user_email.toLowerCase().includes(query)) ||
      (order.client_imo_id && order.client_imo_id.toLowerCase().includes(query))
    );
  });

  // Group orders by user_id to identify same user orders
  const ordersByUser = filteredOrders.reduce(
    (acc, order) => {
      const userId = order.user_id;
      if (!acc[userId]) {
        acc[userId] = [];
      }
      acc[userId].push(order);
      return acc;
    },
    {} as Record<number, Order[]>,
  );

  const rejectedOrdersByUser = filteredRejectedOrders.reduce(
    (acc, order) => {
      const userId = order.user_id;
      if (!acc[userId]) {
        acc[userId] = [];
      }
      acc[userId].push(order);
      return acc;
    },
    {} as Record<number, Order[]>,
  );

  if (loading && pendingUsers.length === 0) {
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
      <div
        className={`lg:pl-64 transition-all duration-300 ${
          sidebarOpen ? "lg:ml-0" : ""
        }`}
      >
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b sticky top-0 z-30">
          <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex justify-between items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 flex-shrink-0"
                >
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6"
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
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 truncate">
                  Admin Dashboard
                </h1>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <ThemeToggle />
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="px-3 py-2 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 sm:gap-2"
                >
                  <svg
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                      loading ? "animate-spin" : ""
                    }`}
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
                  <span className="hidden xs:inline">Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border-l-4 border-yellow-500">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600">
                    Pending Users
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-800 mt-1 sm:mt-2">
                    {stats.pendingUsers}
                  </p>
                </div>
                <div className="text-3xl sm:text-4xl flex-shrink-0 ml-2">
                  ⏳
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600">
                    Approved Users
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-800 mt-1 sm:mt-2">
                    {stats.approvedUsers}
                  </p>
                </div>
                <div className="text-3xl sm:text-4xl flex-shrink-0 ml-2">
                  👥
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600">
                    Pending Orders
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-800 mt-1 sm:mt-2">
                    {stats.pendingOrders}
                  </p>
                </div>
                <div className="text-3xl sm:text-4xl flex-shrink-0 ml-2">
                  📦
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600">
                    Total Diamond Balance
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-800 mt-1 sm:mt-2">
                    {stats.totalDiamondBalance.toLocaleString()}
                  </p>
                </div>
                <div className="text-3xl sm:text-4xl flex-shrink-0 ml-2">
                  💎
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-md mb-4 sm:mb-6 overflow-hidden">
            <div className="flex border-b overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setActiveTab("orders")}
                className={`flex-1 min-w-[100px] sm:min-w-[120px] px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold transition text-xs sm:text-sm whitespace-nowrap touch-manipulation ${
                  activeTab === "orders"
                    ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50 active:bg-gray-100"
                }`}
              >
                <span className="block sm:inline">Orders</span>
                <span className="hidden sm:inline">
                  {" "}
                  ({stats.pendingOrders})
                </span>
                <span className="block sm:hidden text-xs font-normal">
                  ({stats.pendingOrders})
                </span>
              </button>
              <button
                onClick={() => setActiveTab("rejected")}
                className={`flex-1 min-w-[100px] sm:min-w-[120px] px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold transition text-xs sm:text-sm whitespace-nowrap touch-manipulation ${
                  activeTab === "rejected"
                    ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50 active:bg-gray-100"
                }`}
              >
                <span className="block sm:inline">Rejected</span>
                <span className="hidden sm:inline">
                  {" "}
                  ({stats.rejectedOrders})
                </span>
                <span className="block sm:hidden text-xs font-normal">
                  ({stats.rejectedOrders})
                </span>
              </button>
              <button
                onClick={() => setActiveTab("users")}
                className={`flex-1 min-w-[100px] sm:min-w-[120px] px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold transition text-xs sm:text-sm whitespace-nowrap touch-manipulation ${
                  activeTab === "users"
                    ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50 active:bg-gray-100"
                }`}
              >
                <span className="block sm:inline">Approved</span>
                <span className="hidden sm:inline"> Users</span>
                <span className="block sm:inline">
                  {" "}
                  ({stats.approvedUsers})
                </span>
              </button>
              <button
                onClick={() => setActiveTab("pending")}
                className={`flex-1 min-w-[100px] sm:min-w-[120px] px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold transition text-xs sm:text-sm whitespace-nowrap touch-manipulation ${
                  activeTab === "pending"
                    ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50 active:bg-gray-100"
                }`}
              >
                <span className="block sm:inline">Pending</span>
                <span className="hidden sm:inline"> Approvals</span>
                <span className="block sm:inline"> ({stats.pendingUsers})</span>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-4 sm:mb-6">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Pending Users Tab */}
          {activeTab === "pending" && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {filteredPendingUsers.length === 0 ? (
                <div className="p-8 sm:p-12 text-center">
                  <svg
                    className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-400 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-gray-500 text-base sm:text-lg font-medium">
                    {searchQuery
                      ? "No users found matching your search"
                      : "No pending users"}
                  </p>
                </div>
              ) : (
                <>
                  {/* Table Header - Desktop */}
                  <div className="hidden md:grid md:grid-cols-12 gap-4 bg-gray-50 border-b border-gray-200 px-4 lg:px-6 py-3 lg:py-4">
                    <div className="col-span-4">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        User Information
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Email
                      </span>
                    </div>
                    <div className="col-span-3">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Registered
                      </span>
                    </div>
                    <div className="col-span-3 text-right">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </span>
                    </div>
                  </div>

                  {/* Table Rows */}
                  <div className="divide-y divide-gray-200">
                    {filteredPendingUsers.map((user) => (
                      <div
                        key={user.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        {/* Mobile Card Layout */}
                        <div className="md:hidden p-4 space-y-3">
                          <div className="flex items-center gap-3">
                            {user.face_image ? (
                              <Link
                                href={`/users/${user.id}`}
                                className="flex-shrink-0"
                              >
                                <img
                                  src={getImageUrl(user.face_image) || ""}
                                  alt={user.nickname || user.name}
                                  className="w-12 h-12 object-cover rounded-lg border-2 border-gray-200"
                                  onError={(e) =>
                                    handleImageError(e, user.face_image)
                                  }
                                />
                              </Link>
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                                {(user.nickname ||
                                  user.name ||
                                  "U")[0].toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/users/${user.id}`}
                                  className="hover:text-primary-600 transition"
                                >
                                  <h3 className="text-base font-semibold text-gray-900 truncate">
                                    {user.nickname || user.name}
                                  </h3>
                                </Link>
                                <Link
                                  href={`/users/${user.id}`}
                                  className="text-primary-600 hover:text-primary-700 transition flex-shrink-0"
                                  title="View details"
                                >
                                  <svg
                                    className="w-4 h-4"
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
                                </Link>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 break-all">
                                Email: {user.email || "N/A"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <svg
                              className="w-4 h-4 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                            <span>
                              {new Date(user.created_at).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </span>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => handleRejectUser(user.id)}
                              className="flex-1 px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 active:bg-red-200 font-semibold text-sm transition flex items-center justify-center gap-1.5 border border-red-200"
                            >
                              <svg
                                className="w-4 h-4"
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
                              Reject
                            </button>
                            <button
                              onClick={() => handleApproveUser(user.id)}
                              className="flex-1 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 active:bg-green-200 font-semibold text-sm transition flex items-center justify-center gap-1.5 border border-green-200"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              Approve
                            </button>
                          </div>
                        </div>

                        {/* Desktop Table Layout */}
                        <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 lg:px-6 py-4 lg:py-5 items-center">
                          {/* User Information */}
                          <div className="col-span-1 md:col-span-4">
                            <div className="flex items-center gap-4">
                              {user.face_image ? (
                                <Link
                                  href={`/users/${user.id}`}
                                  className="flex-shrink-0"
                                >
                                  <img
                                    src={getImageUrl(user.face_image) || ""}
                                    alt={user.nickname || user.name}
                                    className="w-12 h-12 object-cover rounded-lg border-2 border-gray-200 hover:border-primary-500 transition cursor-pointer"
                                    onError={(e) =>
                                      handleImageError(e, user.face_image)
                                    }
                                  />
                                </Link>
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                                  {(user.nickname ||
                                    user.name ||
                                    "U")[0].toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/users/${user.id}`}
                                    className="hover:text-primary-600 transition"
                                  >
                                    <h3 className="text-base font-semibold text-gray-900 truncate">
                                      {user.nickname || user.name}
                                    </h3>
                                  </Link>
                                  <Link
                                    href={`/users/${user.id}`}
                                    className="text-primary-600 hover:text-primary-700 transition flex-shrink-0"
                                    title="View full details"
                                  >
                                    <svg
                                      className="w-4 h-4"
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
                                  </Link>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  User ID: {user.id}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Email */}
                          <div className="col-span-1 md:col-span-2">
                            <div className="flex items-center gap-2">
                              <svg
                                className="w-4 h-4 text-gray-400 flex-shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                              </svg>
                              <span className="text-sm text-gray-700 break-all">
                                {user.email || "N/A"}
                              </span>
                            </div>
                          </div>

                          {/* Registered Date */}
                          <div className="col-span-1 md:col-span-3">
                            <div className="flex items-center gap-2">
                              <svg
                                className="w-4 h-4 text-gray-400 flex-shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                              <span className="text-sm text-gray-600">
                                {new Date(user.created_at).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="col-span-1 md:col-span-3 flex flex-col sm:flex-row gap-2 justify-end">
                            <button
                              onClick={() => handleRejectUser(user.id)}
                              className="px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 active:bg-red-200 font-semibold text-sm transition flex items-center justify-center gap-2 border border-red-200 touch-manipulation"
                            >
                              <svg
                                className="w-4 h-4"
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
                              Reject
                            </button>
                            <button
                              onClick={() => handleApproveUser(user.id)}
                              className="px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 active:bg-green-200 font-semibold text-sm transition flex items-center justify-center gap-2 border border-green-200 touch-manipulation"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              Approve
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Approved Users Tab */}
          {activeTab === "users" && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {filteredApprovedUsers.length === 0 ? (
                <div className="p-8 sm:p-12 text-center">
                  <svg
                    className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-400 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <p className="text-gray-500 text-base sm:text-lg font-medium">
                    {searchQuery
                      ? "No users found matching your search"
                      : "No approved users"}
                  </p>
                </div>
              ) : (
                <>
                  {/* Table Header - Desktop */}
                  <div className="hidden md:grid md:grid-cols-12 gap-4 bg-gray-50 border-b border-gray-200 px-4 lg:px-6 py-3 lg:py-4">
                    <div className="col-span-3">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        User Information
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Email
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Balance
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </span>
                    </div>
                    <div className="col-span-3 text-right">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </span>
                    </div>
                  </div>

                  {/* Table Rows */}
                  <div className="divide-y divide-gray-200">
                    {filteredApprovedUsers.map((user) => (
                      <div
                        key={user.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <>
                          {/* Mobile Card Layout */}
                          <div className="md:hidden p-4 space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                                {(user.name || "U")[0].toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-base font-semibold text-gray-900 truncate">
                                    {user.name}
                                  </h3>
                                  <Link
                                    href={`/users/${user.id}`}
                                    className="text-primary-600 hover:text-primary-700 transition flex-shrink-0"
                                    title="View details"
                                  >
                                    <svg
                                      className="w-4 h-4"
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
                                  </Link>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Email: {user.email || "N/A"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                              <div className="flex items-center gap-2">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="w-4 h-4 text-primary-600"
                                  fill="currentColor"
                                  viewBox="0 0 16 16"
                                >
                                  <path d="M3.1.7a.5.5 0 0 1 .4-.2h9a.5.5 0 0 1 .4.2l2.976 3.974c.149.185.156.45.01.644L8.4 15.3a.5.5 0 0 1-.8 0L.1 5.3a.5.5 0 0 1 0-.6zm11.386 3.785-1.806-2.41-.776 2.413zm-3.633.004.961-2.989H4.186l.963 2.995zM5.47 5.495 8 13.366l2.532-7.876zm-1.371-.999-.78-2.422-1.818 2.425zM1.499 5.5l5.113 6.817-2.192-6.82zm7.889 6.817 5.123-6.83-2.928.002z" />
                                </svg>
                                <span className="text-base font-bold text-primary-600">
                                  {user.points_balance.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                <svg
                                  className="w-3 h-3 mr-1"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                Approved
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                setShowAddPoints(user.id);
                              }}
                              className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:bg-primary-800 font-semibold text-sm transition flex items-center justify-center gap-2 shadow-sm"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 4v16m8-8H4"
                                />
                              </svg>
                              Add Points
                            </button>
                          </div>

                          {/* Add Points Form - Mobile */}
                          {showAddPoints === user.id && (
                            <div className="md:hidden p-4 bg-blue-50 dark:bg-slate-900/70 border-l-4 border-blue-500 dark:border-blue-400 mt-3 rounded-lg">
                              <div className="grid grid-cols-1 gap-4 mb-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Amount
                                  </label>
                                  <input
                                    type="number"
                                    value={pointsAmount}
                                    onChange={(e) =>
                                      setPointsAmount(e.target.value)
                                    }
                                    placeholder="Enter amount"
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Description (Optional)
                                  </label>
                                  <input
                                    type="text"
                                    value={pointsDescription}
                                    onChange={(e) =>
                                      setPointsDescription(e.target.value)
                                    }
                                    placeholder="Quick Store"
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                  />
                                </div>
                              </div>
                              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                <button
                                  onClick={() => handleAddPoints(user.id)}
                                  className="flex-1 sm:flex-initial px-4 sm:px-6 py-2 sm:py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:bg-primary-800 font-semibold text-sm sm:text-base transition flex items-center justify-center gap-2 touch-manipulation"
                                >
                                  <svg
                                    className="w-4 h-4 sm:w-5 sm:h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 4v16m8-8H4"
                                    />
                                  </svg>
                                  Add Points
                                </button>
                                <button
                                  onClick={() => {
                                    setShowAddPoints(null);
                                    setPointsAmount("");
                                    setPointsDescription("");
                                  }}
                                  className="flex-1 sm:flex-initial px-4 sm:px-6 py-2 sm:py-2.5 bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 rounded-lg font-semibold text-sm sm:text-base transition touch-manipulation"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Desktop Table Layout */}
                          <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 lg:px-6 py-4 lg:py-5 items-center">
                            {/* User Information */}
                            <div className="col-span-1 md:col-span-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                                  {(user.name || "U")[0].toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-base font-semibold text-gray-900 truncate">
                                      {user.name}
                                    </h3>
                                    <Link
                                      href={`/users/${user.id}`}
                                      className="text-primary-600 hover:text-primary-700 transition flex-shrink-0"
                                      title="View full details"
                                    >
                                      <svg
                                        className="w-4 h-4"
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
                                    </Link>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    User ID: {user.id}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Email */}
                            <div className="col-span-1 md:col-span-2">
                              <div className="flex items-center gap-2">
                                <svg
                                  className="w-4 h-4 text-gray-400 flex-shrink-0"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                  />
                                </svg>
                                <span className="text-sm text-gray-700 break-all">
                                  {user.email || "N/A"}
                                </span>
                              </div>
                            </div>

                            {/* Balance */}
                            <div className="col-span-1 md:col-span-2">
                              <div className="flex items-center gap-2">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="w-4 h-4 text-primary-600 flex-shrink-0"
                                  fill="currentColor"
                                  viewBox="0 0 16 16"
                                >
                                  <path d="M3.1.7a.5.5 0 0 1 .4-.2h9a.5.5 0 0 1 .4.2l2.976 3.974c.149.185.156.45.01.644L8.4 15.3a.5.5 0 0 1-.8 0L.1 5.3a.5.5 0 0 1 0-.6zm11.386 3.785-1.806-2.41-.776 2.413zm-3.633.004.961-2.989H4.186l.963 2.995zM5.47 5.495 8 13.366l2.532-7.876zm-1.371-.999-.78-2.422-1.818 2.425zM1.499 5.5l5.113 6.817-2.192-6.82zm7.889 6.817 5.123-6.83-2.928.002z" />
                                </svg>
                                <span className="text-base font-bold text-primary-600">
                                  {user.points_balance.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                            </div>

                            {/* Status */}
                            <div className="col-span-1 md:col-span-2">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                <svg
                                  className="w-3 h-3 mr-1.5"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                Approved
                              </span>
                            </div>

                            {/* Actions */}
                            <div className="col-span-1 md:col-span-3 flex justify-end">
                              <button
                                onClick={() => {
                                  setShowAddPoints(user.id);
                                }}
                                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:bg-primary-800 font-semibold text-sm transition flex items-center gap-2 shadow-sm hover:shadow-md"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 4v16m8-8H4"
                                  />
                                </svg>
                                Add Points
                              </button>
                            </div>
                          </div>

                          {/* Add Points Form - Desktop */}
                          {showAddPoints === user.id && (
                            <div className="hidden md:block col-span-12 px-4 lg:px-6 py-4 bg-blue-50 dark:bg-slate-900/70 border-l-4 border-blue-500 dark:border-blue-400 rounded-lg mt-2">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Amount
                                  </label>
                                  <input
                                    type="number"
                                    value={pointsAmount}
                                    onChange={(e) =>
                                      setPointsAmount(e.target.value)
                                    }
                                    placeholder="Enter amount"
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Description (Optional)
                                  </label>
                                  <input
                                    type="text"
                                    value={pointsDescription}
                                    onChange={(e) =>
                                      setPointsDescription(e.target.value)
                                    }
                                    placeholder="Quick Store"
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                  />
                                </div>
                              </div>
                              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                <button
                                  onClick={() => handleAddPoints(user.id)}
                                  className="flex-1 sm:flex-initial px-4 sm:px-6 py-2 sm:py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:bg-primary-800 font-semibold text-sm sm:text-base transition flex items-center justify-center gap-2 touch-manipulation"
                                >
                                  <svg
                                    className="w-4 h-4 sm:w-5 sm:h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 4v16m8-8H4"
                                    />
                                  </svg>
                                  Add Points
                                </button>
                                <button
                                  onClick={() => {
                                    setShowAddPoints(null);
                                    setPointsAmount("");
                                    setPointsDescription("");
                                  }}
                                  className="flex-1 sm:flex-initial px-4 sm:px-6 py-2 sm:py-2.5 bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 rounded-lg font-semibold text-sm sm:text-base transition touch-manipulation"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Diamond Orders Tab */}
          {activeTab === "orders" && (
            <div className="space-y-4 sm:space-y-6">
              {filteredOrders.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-8 sm:p-12 text-center">
                  <svg
                    className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-400 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                  <p className="text-gray-500 text-base sm:text-lg font-medium">
                    {searchQuery
                      ? "No orders found matching your search"
                      : "No pending orders"}
                  </p>
                </div>
              ) : (
                Object.entries(ordersByUser).map(([userId, userOrders]) => {
                  const isMultipleOrders = userOrders.length > 1;
                  return (
                    <div key={userId} className="space-y-3 sm:space-y-4">
                      {isMultipleOrders && (
                        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-3 sm:p-4 mb-2">
                          <div className="flex items-center gap-2">
                            <svg
                              className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                              />
                            </svg>
                            <p className="text-xs sm:text-sm font-semibold text-blue-800">
                              {userOrders.length}{" "}
                              {userOrders.length === 1 ? "Order" : "Orders"}{" "}
                              from{" "}
                              {userOrders[0].parent_user_name ||
                                `User ID: ${userId}`}{" "}
                              {userOrders[0].parent_user_id_number &&
                                `(${userOrders[0].parent_user_id_number})`}
                            </p>
                          </div>
                        </div>
                      )}
                      {userOrders.map((order) => (
                        <div
                          key={order.id}
                          className={`bg-white rounded-lg shadow-md p-4 sm:p-6 hover:shadow-lg transition ${
                            isMultipleOrders ? "border-l-4 border-blue-400" : ""
                          }`}
                        >
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base sm:text-lg font-semibold text-gray-800 break-words">
                                Order #{order.order_number}
                              </h3>
                              <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">
                                <strong>Requester:</strong>{" "}
                                {order.parent_user_name ||
                                  `User ID: ${order.user_id}`}{" "}
                                {order.parent_user_id_number &&
                                  `(${order.parent_user_id_number})`}
                              </p>
                              {order.customer_name && (
                                <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">
                                  <strong>Customer:</strong>{" "}
                                  {order.customer_name}
                                </p>
                              )}
                              {order.client_profile_photo && (
                                <div className="mt-2">
                                  <p className="text-xs sm:text-sm text-gray-600 mb-1">
                                    <strong>Profile Photo:</strong>
                                  </p>
                                  <img
                                    src={
                                      getImageUrl(order.client_profile_photo) ||
                                      ""
                                    }
                                    alt="IMO Profile Photo"
                                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover border border-gray-300"
                                    onError={(e) =>
                                      handleImageError(
                                        e,
                                        order.client_profile_photo,
                                      )
                                    }
                                  />
                                </div>
                              )}
                              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                                <strong>Total Diamonds:</strong>{" "}
                                <span className="ml-1 inline-flex items-center rounded-md bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-800 border border-yellow-200">
                                  {order.quantity * order.diamond_amount}
                                </span>
                              </p>
                              {order.client_imo_id && (
                                <div className="text-xs sm:text-sm text-gray-600 mt-1 flex flex-wrap items-center gap-2">
                                  <strong>IMO ID:</strong>
                                  <span className="font-mono break-all">
                                    {order.client_imo_id}
                                  </span>
                                  <button
                                    onClick={async () => {
                                      try {
                                        // For mobile, ensure we have proper permissions
                                        if (
                                          navigator.clipboard &&
                                          navigator.clipboard.writeText
                                        ) {
                                          await navigator.clipboard.writeText(
                                            order.client_imo_id || "",
                                          );
                                          showToast(
                                            "Client IMO ID copied to clipboard!",
                                            "success",
                                          );
                                        } else {
                                          throw new Error(
                                            "Clipboard API not available",
                                          );
                                        }
                                      } catch (err) {
                                        // Enhanced fallback for mobile browsers
                                        try {
                                          const textArea =
                                            document.createElement("textarea");
                                          textArea.value =
                                            order.client_imo_id || "";
                                          textArea.style.position = "fixed";
                                          textArea.style.top = "0";
                                          textArea.style.left = "0";
                                          textArea.style.width = "2em";
                                          textArea.style.height = "2em";
                                          textArea.style.padding = "0";
                                          textArea.style.border = "none";
                                          textArea.style.outline = "none";
                                          textArea.style.boxShadow = "none";
                                          textArea.style.background =
                                            "transparent";
                                          textArea.setAttribute("readonly", "");
                                          textArea.setAttribute(
                                            "aria-hidden",
                                            "true",
                                          );
                                          document.body.appendChild(textArea);

                                          // For iOS
                                          if (
                                            navigator.userAgent.match(
                                              /ipad|iphone/i,
                                            )
                                          ) {
                                            const range =
                                              document.createRange();
                                            range.selectNodeContents(textArea);
                                            const selection =
                                              window.getSelection();
                                            if (selection) {
                                              selection.removeAllRanges();
                                              selection.addRange(range);
                                            }
                                            textArea.setSelectionRange(
                                              0,
                                              999999,
                                            );
                                          } else {
                                            textArea.select();
                                          }

                                          const successful =
                                            document.execCommand("copy");
                                          document.body.removeChild(textArea);

                                          if (successful) {
                                            showToast(
                                              "Client IMO ID copied to clipboard!",
                                              "success",
                                            );
                                          } else {
                                            throw new Error(
                                              "Copy command failed",
                                            );
                                          }
                                        } catch (fallbackErr) {
                                          showToast(
                                            "Failed to copy. Please select and copy manually.",
                                            "error",
                                          );
                                        }
                                      }
                                    }}
                                    className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 rounded transition flex items-center gap-1 flex-shrink-0 touch-manipulation"
                                    title="Copy IMO ID"
                                  >
                                    <svg
                                      className="w-3 h-3"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                      />
                                    </svg>
                                    Copy
                                  </button>
                                </div>
                              )}
                              <p className="text-xs text-gray-500 mt-2">
                                {new Date(order.created_at).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                              <button
                                onClick={() =>
                                  handleOrderStatus(order.id, "REJECTED")
                                }
                                className="flex-1 sm:flex-initial px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 active:bg-red-200 font-semibold text-sm transition flex items-center justify-center gap-2 border border-red-200 touch-manipulation"
                              >
                                <svg
                                  className="w-4 h-4"
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
                                Reject
                              </button>
                              <button
                                onClick={() =>
                                  handleOrderStatus(order.id, "COMPLETED")
                                }
                                className="flex-1 sm:flex-initial px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 active:bg-green-200 font-semibold text-sm transition flex items-center justify-center gap-2 border border-green-200 touch-manipulation"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                                Complete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Rejected Orders Tab */}
          {activeTab === "rejected" && (
            <div className="space-y-4 sm:space-y-6">
              {filteredRejectedOrders.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-8 sm:p-12 text-center">
                  <svg
                    className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-400 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                  <p className="text-gray-500 text-base sm:text-lg font-medium">
                    {searchQuery
                      ? "No orders found matching your search"
                      : "No rejected orders"}
                  </p>
                </div>
              ) : (
                Object.entries(rejectedOrdersByUser).map(
                  ([userId, userOrders]) => {
                    const isMultipleOrders = userOrders.length > 1;
                    return (
                      <div key={userId} className="space-y-3 sm:space-y-4">
                        {isMultipleOrders && (
                          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-3 sm:p-4 mb-2">
                            <div className="flex items-center gap-2">
                              <svg
                                className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                              </svg>
                              <p className="text-xs sm:text-sm font-semibold text-red-800">
                                {userOrders.length}{" "}
                                {userOrders.length === 1 ? "Order" : "Orders"}{" "}
                                from{" "}
                                {userOrders[0].parent_user_name ||
                                  `User ID: ${userId}`}{" "}
                                {userOrders[0].parent_user_id_number &&
                                  `(${userOrders[0].parent_user_id_number})`}
                              </p>
                            </div>
                          </div>
                        )}
                        {userOrders.map((order) => (
                          <div
                            key={order.id}
                            className={`bg-white rounded-lg shadow-md p-4 sm:p-6 hover:shadow-lg transition ${
                              isMultipleOrders
                                ? "border-l-4 border-red-400"
                                : ""
                            }`}
                          >
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-base sm:text-lg font-semibold text-gray-800 break-words">
                                  Order #{order.order_number}
                                </h3>
                                <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">
                                  <strong>Requester:</strong>{" "}
                                  {order.parent_user_name ||
                                    `User ID: ${order.user_id}`}{" "}
                                  {order.parent_user_id_number &&
                                    `(${order.parent_user_id_number})`}
                                </p>
                                {order.customer_name && (
                                  <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">
                                    <strong>Customer:</strong>{" "}
                                    {order.customer_name}
                                  </p>
                                )}
                                {order.client_profile_photo && (
                                  <div className="mt-2">
                                    <p className="text-xs sm:text-sm text-gray-600 mb-1">
                                      <strong>Profile Photo:</strong>
                                    </p>
                                    <img
                                      src={
                                        getImageUrl(
                                          order.client_profile_photo,
                                        ) || ""
                                      }
                                      alt="IMO Profile Photo"
                                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover border border-gray-300"
                                      onError={(e) =>
                                        handleImageError(
                                          e,
                                          order.client_profile_photo,
                                        )
                                      }
                                    />
                                  </div>
                                )}
                                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                                  <strong>Total Diamonds:</strong>{" "}
                                  <span className="ml-1 inline-flex items-center rounded-md bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-800 border border-yellow-200">
                                    {order.quantity * order.diamond_amount}
                                  </span>
                                </p>
                                {order.client_imo_id && (
                                  <div className="text-xs sm:text-sm text-gray-600 mt-1 flex flex-wrap items-center gap-2">
                                    <strong>IMO ID:</strong>
                                    <span className="font-mono break-all">
                                      {order.client_imo_id}
                                    </span>
                                  </div>
                                )}
                                <p className="text-xs text-gray-500 mt-2">
                                  {new Date(
                                    order.created_at,
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                              <div className="flex items-center w-full md:w-auto">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                                  Rejected
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  },
                )
              )}
            </div>
          )}
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
    </div>
  );
}

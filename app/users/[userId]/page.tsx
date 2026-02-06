"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { getImageUrl, handleImageError } from "@/lib/imageUtils";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";

interface UserDetails {
  id: number;
  name: string;
  nickname: string | null;
  phone_number: string | null;
  email: string | null;
  id_number: string;
  face_image: string | null;
  id_card_front: string | null;
  id_card_back: string | null;
  points_balance: number;
  status: string;
  role: string;
  created_at: string;
  updated_at: string | null;
}

interface Transaction {
  id: number;
  user_id: number;
  amount: number;
  transaction_type: string;
  description: string | null;
  admin_id: number | null;
  created_at: string;
  admin_name: string | null;
}

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

interface AddPointsReceipt {
  id: number;
  user_id: number;
  receiver_name: string;
  amount: number;
  description: string | null;
  status: string;
  created_at: string;
  admin_name: string | null;
}

export default function UserDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.userId as string;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<UserDetails | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [addPointsReceipt, setAddPointsReceipt] =
    useState<AddPointsReceipt | null>(null);
  const [viewingImage, setViewingImage] = useState<{
    url: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    if (userId) {
      fetchUserDetails();
    }
  }, [userId, router]);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    setToast({ message, type });
  };

  const formatReceiptTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const renderAddPointsReceipt = () => {
    if (!addPointsReceipt) return null;

    return (
      <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-green-700">Receipt</span>
          <span className="text-xs font-medium text-green-600">
            Status: {addPointsReceipt.status}
          </span>
        </div>
        <div className="text-sm text-gray-700 grid grid-cols-1 gap-2">
          <div>
            <span className="font-medium">Receiver:</span>{" "}
            {addPointsReceipt.receiver_name}
          </div>
          <div>
            <span className="font-medium">Time:</span>{" "}
            {formatReceiptTime(addPointsReceipt.created_at)}
          </div>
          <div>
            <span className="font-medium">Diamond Amount:</span>{" "}
            {addPointsReceipt.amount}
          </div>
          <div>
            <span className="font-medium">Receipt ID:</span>{" "}
            {addPointsReceipt.id}
          </div>
          <div>
            <span className="font-medium">Description:</span>{" "}
            {addPointsReceipt.description || "—"}
          </div>
          {addPointsReceipt.admin_name && (
            <div>
              <span className="font-medium">Admin:</span>{" "}
              {addPointsReceipt.admin_name}
            </div>
          )}
        </div>
      </div>
    );
  };

  const viewImage = (imagePath: string | null, title: string) => {
    if (!imagePath) return;
    const imageUrl = getImageUrl(imagePath);
    if (imageUrl) {
      setViewingImage({ url: imageUrl, title });
    }
  };

  const downloadImage = async (imagePath: string | null, filename: string) => {
    if (!imagePath) return;

    try {
      const imageUrl = getImageUrl(imagePath);
      if (!imageUrl) {
        showToast("Image URL not found", "error");
        return;
      }

      // Fetch the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch image");
      }

      // Get the blob
      const blob = await response.blob();

      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showToast("Document downloaded successfully!", "success");
    } catch (error) {
      console.error("Download error:", error);
      showToast("Failed to download document", "error");
    }
  };

  // Close modal on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && viewingImage) {
        setViewingImage(null);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [viewingImage]);

  const fetchUserDetails = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/users/${userId}`);
      setUser(response.data.user);
      // Fetch user transactions
      fetchUserTransactions();
    } catch (err: any) {
      console.error("Failed to fetch user details:", err);
      showToast(
        err.response?.data?.error || "Failed to load user details",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchUserTransactions = async () => {
    if (!userId) return;
    setLoadingTransactions(true);
    try {
      const response = await api.get(
        `/users/transactions/all?userId=${userId}&limit=50`,
      );
      setTransactions(response.data.transactions || []);
    } catch (err: any) {
      console.error("Failed to fetch transactions:", err);
      // Don't show error toast for transactions, just log it
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleAddPoints = async () => {
    const amount = prompt("Enter points amount:");
    if (!amount || isNaN(parseInt(amount)) || parseInt(amount) <= 0) {
      showToast("Please enter a valid amount", "error");
      return;
    }

    const descriptionValue =
      prompt("Enter description (optional):") || "Admin added points";

    try {
      const response = await api.post(`/users/${userId}/points`, {
        amount: parseInt(amount),
        description: descriptionValue,
      });

      const updatedBalance = response.data?.user?.points_balance;
      const receipt = response.data?.receipt as AddPointsReceipt | undefined;
      showToast(
        `Points added successfully! New balance: ${updatedBalance}`,
        "success",
      );
      if (receipt) {
        setAddPointsReceipt(receipt);
      } else {
        setAddPointsReceipt({
          id: 0,
          user_id: user?.id || 0,
          receiver_name: user?.name || "User",
          amount: parseInt(amount),
          description: descriptionValue,
          status: "SUCCESS",
          created_at: new Date().toISOString(),
          admin_name: null,
        });
      }
      fetchUserDetails();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to add points", "error");
    }
  };

  const handleStatusChange = async (newStatus: "APPROVED" | "REJECTED") => {
    if (
      !confirm(`Are you sure you want to ${newStatus.toLowerCase()} this user?`)
    )
      return;

    try {
      await api.patch(`/users/${userId}/status`, { status: newStatus });
      showToast(`User ${newStatus.toLowerCase()} successfully!`, "success");
      fetchUserDetails();
    } catch (err: any) {
      showToast(
        err.response?.data?.error ||
          `Failed to ${newStatus.toLowerCase()} user`,
        "error",
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
        <div
          className={`lg:pl-64 transition-all duration-300 ${sidebarOpen ? "lg:ml-0" : ""}`}
        >
          <div className="px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-500 text-lg">User not found</p>
              <Link
                href="/dashboard?tab=users"
                className="mt-4 inline-block text-primary-600 hover:text-primary-700"
              >
                ← Back to Users
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main Content */}
      <div
        className={`lg:pl-64 transition-all duration-300 ${sidebarOpen ? "lg:ml-0" : ""}`}
      >
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
                >
                  <svg
                    className="w-6 h-6"
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
                <div className="flex items-center gap-3">
                  <Link
                    href="/dashboard?tab=users"
                    className="text-gray-500 hover:text-gray-700"
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
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </Link>
                  <h1 className="text-2xl font-bold text-gray-800">
                    User Details
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchUserDetails}
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Profile Card */}
              <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">
                      Profile Information
                    </h2>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        user.status === "APPROVED"
                          ? "bg-green-100 text-green-800"
                          : user.status === "PENDING"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {user.status}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {user.nickname && (
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">
                          Nickname
                        </label>
                        <p className="text-lg font-semibold text-gray-900 mt-1">
                          {user.nickname}
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">
                        NIC/Passport num
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-lg font-semibold text-gray-900 font-mono break-all">
                          {user.id_number}
                        </p>
                        <button
                          onClick={async () => {
                            try {
                              // For mobile, ensure we have proper permissions
                              if (
                                navigator.clipboard &&
                                navigator.clipboard.writeText
                              ) {
                                await navigator.clipboard.writeText(
                                  user.id_number,
                                );
                                showToast(
                                  "NIC/Passport num copied to clipboard!",
                                  "success",
                                );
                              } else {
                                throw new Error("Clipboard API not available");
                              }
                            } catch (err) {
                              // Enhanced fallback for mobile browsers
                              try {
                                const textArea =
                                  document.createElement("textarea");
                                textArea.value = user.id_number;
                                textArea.style.position = "fixed";
                                textArea.style.top = "0";
                                textArea.style.left = "0";
                                textArea.style.width = "2em";
                                textArea.style.height = "2em";
                                textArea.style.padding = "0";
                                textArea.style.border = "none";
                                textArea.style.outline = "none";
                                textArea.style.boxShadow = "none";
                                textArea.style.background = "transparent";
                                textArea.setAttribute("readonly", "");
                                textArea.setAttribute("aria-hidden", "true");
                                document.body.appendChild(textArea);

                                // For iOS
                                if (navigator.userAgent.match(/ipad|iphone/i)) {
                                  const range = document.createRange();
                                  range.selectNodeContents(textArea);
                                  const selection = window.getSelection();
                                  if (selection) {
                                    selection.removeAllRanges();
                                    selection.addRange(range);
                                  }
                                  textArea.setSelectionRange(0, 999999);
                                } else {
                                  textArea.select();
                                }

                                const successful = document.execCommand("copy");
                                document.body.removeChild(textArea);

                                if (successful) {
                                  showToast(
                                    "NIC/Passport num copied to clipboard!",
                                    "success",
                                  );
                                } else {
                                  throw new Error("Copy command failed");
                                }
                              } catch (fallbackErr) {
                                showToast(
                                  "Failed to copy. Please select and copy manually.",
                                  "error",
                                );
                              }
                            }
                          }}
                          className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 rounded transition flex-shrink-0 touch-manipulation"
                          title="Copy NIC/Passport num"
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
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">
                        Phone Number
                      </label>
                      <p className="text-lg font-semibold text-gray-900 mt-1">
                        {user.phone_number || user.name || "N/A"}
                      </p>
                    </div>
                    {user.email && (
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">
                          Email
                        </label>
                        <p className="text-lg font-semibold text-gray-900 mt-1">
                          {user.email}
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">
                        User ID
                      </label>
                      <p className="text-lg font-semibold text-gray-900 mt-1">
                        #{user.id}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">
                        Role
                      </label>
                      <p className="text-lg font-semibold text-gray-900 mt-1">
                        {user.role}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">
                        Diamond Balance
                      </label>
                      <p className="text-2xl font-bold text-primary-600 mt-1">
                        {user.points_balance.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">
                        Registered
                      </label>
                      <p className="text-sm text-gray-600 mt-1">
                        {new Date(user.created_at).toLocaleString()}
                      </p>
                    </div>
                    {user.updated_at && (
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">
                          Last Updated
                        </label>
                        <p className="text-sm text-gray-600 mt-1">
                          {new Date(user.updated_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ID Cards Section */}
              {(user.id_card_front || user.id_card_back) && (
                <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">
                      NIC / Passport Documents
                    </h2>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {user.id_card_front && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-gray-500 uppercase">
                              NIC / Passport Front
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  viewImage(
                                    user.id_card_front,
                                    "NIC / Passport Front",
                                  )
                                }
                                className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-sm"
                                title="View ID Card Front"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
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
                                View
                              </button>
                              <button
                                onClick={() =>
                                  downloadImage(
                                    user.id_card_front,
                                    `ID_Card_Front_${user.id_number}_${user.id}.jpg`,
                                  )
                                }
                                className="px-3 py-1.5 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-sm"
                                title="Download ID Card Front"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                  />
                                </svg>
                                Download
                              </button>
                            </div>
                          </div>
                          <div className="relative group">
                            <img
                              src={getImageUrl(user.id_card_front) || ""}
                              alt="ID Card Front"
                              className="w-full h-48 rounded-lg object-cover border-2 border-gray-200 shadow-sm cursor-pointer hover:border-primary-500 transition"
                              onError={(e) =>
                                handleImageError(e, user.id_card_front)
                              }
                              onClick={() =>
                                viewImage(user.id_card_front, "ID Card Front")
                              }
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition rounded-lg flex items-center justify-center">
                              <svg
                                className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
                                />
                              </svg>
                            </div>
                          </div>
                        </div>
                      )}
                      {user.id_card_back && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-gray-500 uppercase">
                              NIC / Passport Back
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  viewImage(
                                    user.id_card_back,
                                    "NIC / Passport Back",
                                  )
                                }
                                className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-sm"
                                title="View ID Card Back"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
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
                                View
                              </button>
                              <button
                                onClick={() =>
                                  downloadImage(
                                    user.id_card_back,
                                    `ID_Card_Back_${user.id_number}_${user.id}.jpg`,
                                  )
                                }
                                className="px-3 py-1.5 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-sm"
                                title="Download ID Card Back"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                  />
                                </svg>
                                Download
                              </button>
                            </div>
                          </div>
                          <div className="relative group">
                            <img
                              src={getImageUrl(user.id_card_back) || ""}
                              alt="ID Card Back"
                              className="w-full h-48 rounded-lg object-cover border-2 border-gray-200 shadow-sm cursor-pointer hover:border-primary-500 transition"
                              onError={(e) =>
                                handleImageError(e, user.id_card_back)
                              }
                              onClick={() =>
                                viewImage(user.id_card_back, "ID Card Back")
                              }
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition rounded-lg flex items-center justify-center">
                              <svg
                                className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
                                />
                              </svg>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* User Transactions Section */}
              <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">
                      Transaction History
                    </h2>
                    <button
                      onClick={fetchUserTransactions}
                      disabled={loadingTransactions}
                      className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <svg
                        className={`w-3.5 h-3.5 ${loadingTransactions ? "animate-spin" : ""}`}
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
                <div className="p-6">
                  {loadingTransactions ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600 mx-auto"></div>
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">
                        No transactions found for this user
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {transactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:bg-gray-100 transition"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                    transaction.transaction_type === "ADDED" ||
                                    transaction.transaction_type === "REFUNDED"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {transaction.transaction_type === "ADDED"
                                    ? "➕"
                                    : transaction.transaction_type ===
                                        "DEDUCTED"
                                      ? "➖"
                                      : "↩️"}{" "}
                                  {transaction.transaction_type}
                                </span>
                                <span
                                  className={`text-lg font-bold ${
                                    transaction.transaction_type === "ADDED" ||
                                    transaction.transaction_type === "REFUNDED"
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {transaction.transaction_type === "ADDED" ||
                                  transaction.transaction_type === "REFUNDED"
                                    ? "+"
                                    : "-"}
                                  {transaction.amount.toLocaleString()}
                                </span>
                              </div>
                              {transaction.description && (
                                <p className="text-sm text-gray-600 mb-1">
                                  {transaction.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span>
                                  {new Date(
                                    transaction.created_at,
                                  ).toLocaleString()}
                                </span>
                                {transaction.admin_name && (
                                  <span>Admin: {transaction.admin_name}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Photo & Actions */}
            <div className="space-y-6">
              {/* Profile Photo */}
              <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">
                      Profile Photo
                    </h2>
                    {user.face_image && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            viewImage(user.face_image, "Profile Photo")
                          }
                          className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-sm"
                          title="View Profile Photo"
                        >
                          <svg
                            className="w-3.5 h-3.5"
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
                          View
                        </button>
                        <button
                          onClick={() =>
                            downloadImage(
                              user.face_image,
                              `Profile_Photo_${user.id_number}_${user.id}.jpg`,
                            )
                          }
                          className="px-3 py-1.5 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-sm"
                          title="Download Profile Photo"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                          Download
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-6">
                  {user.face_image ? (
                    <div className="relative group">
                      <img
                        src={getImageUrl(user.face_image) || ""}
                        alt={user.name}
                        className="w-48 h-48 mx-auto rounded-lg object-cover border-2 border-gray-200 shadow-sm cursor-pointer hover:border-primary-500 transition"
                        onError={(e) => handleImageError(e, user.face_image)}
                        onClick={() =>
                          viewImage(user.face_image, "Profile Photo")
                        }
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition rounded-lg flex items-center justify-center max-w-48 max-h-48 mx-auto">
                        <svg
                          className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
                          />
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <div className="w-48 h-48 mx-auto rounded-lg bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
                      <svg
                        className="w-16 h-16 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900">Actions</h2>
                </div>
                <div className="p-6 space-y-3">
                  {user.status !== "PENDING" && (
                    <button
                      onClick={handleAddPoints}
                      className="w-full px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:from-primary-600 hover:to-primary-700 font-semibold transition shadow-md hover:shadow-lg flex items-center justify-center gap-2"
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
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Add Points
                    </button>
                  )}
                  {renderAddPointsReceipt()}
                  {user.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => handleStatusChange("APPROVED")}
                        className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 font-semibold transition shadow-md hover:shadow-lg flex items-center justify-center gap-2"
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
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Approve User
                      </button>
                      <button
                        onClick={() => handleStatusChange("REJECTED")}
                        className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 font-semibold transition shadow-md hover:shadow-lg flex items-center justify-center gap-2"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                        Reject User
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Image View Modal */}
      {viewingImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setViewingImage(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={() => setViewingImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition z-10"
              title="Close (ESC)"
            >
              <svg
                className="w-8 h-8"
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
            <div
              className="bg-white rounded-lg p-2 max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-2 px-2">
                {viewingImage.title}
              </h3>
              <img
                src={viewingImage.url}
                alt={viewingImage.title}
                className="max-w-full max-h-[85vh] object-contain rounded"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.src =
                    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23ddd" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3EImage not found%3C/text%3E%3C/svg%3E';
                }}
              />
            </div>
          </div>
        </div>
      )}

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

"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { removeToken } from "@/lib/auth";

interface SidebarProps {
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}

export default function Sidebar({
  isOpen: externalIsOpen,
  setIsOpen: externalSetIsOpen,
}: SidebarProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalSetIsOpen || setInternalIsOpen;
  const pathname = usePathname();
  const router = useRouter();

  // Auto-open sidebar on desktop, closed on mobile
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.innerWidth >= 1024) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    }
  }, []);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && window.innerWidth < 1024) {
        const target = e.target as HTMLElement;
        if (!target.closest("aside")) {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const menuItems = [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/dashboard?tab=pending", label: "Pending Users", icon: "⏳" },
    { href: "/dashboard?tab=users", label: "All Users", icon: "👥" },
    { href: "/dashboard?tab=orders", label: "Orders", icon: "📦" },
    { href: "/transactions", label: "Transactions", icon: "💎" },
    { href: "/reports", label: "Weekly Reports", icon: "📈" },
  ];

  const handleLogout = () => {
    removeToken();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (typeof window === "undefined") return false;
    if (href === "/dashboard") {
      return pathname === "/dashboard" && !window.location.search;
    }
    const tab = href.split("=")[1];
    return (
      pathname === "/dashboard" && window.location.search.includes(`tab=${tab}`)
    );
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-gray-900 to-gray-800 shadow-xl border-r border-gray-700 z-40 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xl font-bold">A</span>
              </div>
              <div>
                <h1 className="text-white font-bold text-lg">Admin Panel</h1>
                <p className="text-gray-400 text-xs">Top-Up System</p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 overflow-y-auto py-4">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-6 py-3 mx-2 mb-1 rounded-lg transition text-sm ${
                  isActive(item.href)
                    ? "bg-primary-600 text-white font-semibold shadow-lg"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-gray-700">
            <button
              onClick={handleLogout}
              className="w-full px-6 py-3 text-sm text-red-400 hover:bg-red-900 hover:text-red-300 rounded-lg transition font-medium flex items-center gap-2 justify-center"
            >
              <span>🚪</span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

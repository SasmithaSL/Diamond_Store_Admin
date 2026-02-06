import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: 'Admin Panel - Quick Smart',
  description: 'Admin Dashboard for Digital Top-Up System',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        {children}
      </body>
    </html>
  );
}





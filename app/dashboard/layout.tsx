import React from "react";
import { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { ToastProvider } from "@/contexts/ToastContext";
import DashboardLayoutClient from "@/components/layout/DashboardLayoutClient";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <ToastProvider>
          <DashboardLayoutClient>{children}</DashboardLayoutClient>
        </ToastProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}

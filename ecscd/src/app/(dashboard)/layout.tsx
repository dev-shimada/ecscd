"use client";

import { ApplicationDashboard } from "@/components/application-dashboard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ApplicationDashboard />
      {children}
    </>
  );
}

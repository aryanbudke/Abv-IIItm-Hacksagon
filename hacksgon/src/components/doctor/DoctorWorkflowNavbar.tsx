"use client";

import Link from "next/link";
import { Activity, ArrowLeft, GitBranch, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DoctorWorkflowNavbarProps {
  title?: string;
  showBackToWorkflows?: boolean;
}

export function DoctorWorkflowNavbar({
  title = "Doctor Workflows",
  showBackToWorkflows = false,
}: DoctorWorkflowNavbarProps) {
  return (
    <header className="h-14 border-b border-border bg-card/90 backdrop-blur-xl sticky top-0 z-40">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Activity size={18} className="text-primary shrink-0" />
          <p className="text-sm font-bold text-foreground truncate">{title}</p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button asChild variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
            <Link href="/doctor">
              <LayoutDashboard size={13} />
              Dashboard
            </Link>
          </Button>

          <Button asChild variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
            <Link href="/doctor/workflows">
              <GitBranch size={13} />
              Workflows
            </Link>
          </Button>

          {showBackToWorkflows && (
            <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border">
              <Link href="/doctor/workflows">
                <ArrowLeft size={13} />
                Back
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

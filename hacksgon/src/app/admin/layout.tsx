"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Logo } from "@/components/Logo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard, Building2, Stethoscope, Users, Calendar,
  GitBranch, Activity, Zap, Loader2, History
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const NAV_MAIN = [
  { label: "Overview",     href: "/admin",              icon: LayoutDashboard, exact: true },
  { label: "Hospitals",    href: "/admin/hospitals",    icon: Building2 },
  { label: "Doctors",      href: "/admin/doctors",      icon: Stethoscope },
  { label: "Users",        href: "/admin/users",        icon: Users },
  { label: "Appointments", href: "/admin/appointments", icon: Calendar },
  { label: "Workflows",    href: "/admin/workflows",    icon: GitBranch },
  { label: "Analytics",    href: "/admin/analytics",    icon: Activity },
  { label: "History",      href: "/admin/history",      icon: History },
];


function AdminSidebar({ pathname }: { pathname: string }) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const isActive = (item: typeof NAV_MAIN[0]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="transition-all duration-300 overflow-hidden">
        <SidebarMenu className={isCollapsed ? "opacity-0 invisible h-0" : "opacity-100 visible h-14"}>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin" className="no-underline flex items-center">
                <div className="flex-1">
                  <Logo height={28} />
                  <span className="truncate text-[9px] text-sidebar-foreground/40 uppercase tracking-widest block mt-0.5 ml-0.5">Admin Console</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase tracking-wider text-[10px]">
            Management
          </SidebarGroupLabel>
          <SidebarMenu>
            {NAV_MAIN.map(item => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={isActive(item)} tooltip={item.label}>
                  <Link href={item.href} className="no-underline">
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 px-1 py-1">
          <span className="w-2 h-2 rounded-full bg-sidebar-primary animate-pulse shrink-0" />
          <span className="text-[10px] font-semibold text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
            Live — Real-time sync
          </span>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AdminSidebar pathname={pathname} />

        <main className="flex flex-1 flex-col overflow-hidden min-w-0">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />
            <div className="flex flex-1 items-center gap-2">
              <Zap size={14} className="text-primary" />
              <span className="text-sm font-semibold text-muted-foreground">Admin Console</span>
            </div>
            <div className="flex items-center gap-3">
              <UserButton />
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </main>
      </SidebarProvider>
    </TooltipProvider>
  );
}

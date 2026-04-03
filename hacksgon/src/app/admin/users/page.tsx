"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Shield, Stethoscope, User, AlertTriangle,
  ChevronLeft, ChevronRight, Loader2, RefreshCw, ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ClerkUser {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  role: "patient" | "doctor" | "admin";
  createdAt: number;
}

const ROLE_META = {
  admin:   { label: "Admin",   variant: "default" as const,    icon: Shield },
  doctor:  { label: "Doctor",  variant: "secondary" as const,  icon: Stethoscope },
  patient: { label: "Patient", variant: "outline" as const,    icon: User },
} as const;

const ALL_ROLES: Array<"patient" | "doctor" | "admin"> = ["patient", "doctor", "admin"];

export default function AdminUsersPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  const [users, setUsers] = useState<ClerkUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [demotedDoctors, setDemotedDoctors] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push("/sign-in"); return; }
    if ((user?.publicMetadata?.role as string) !== "admin") router.push("/");
  }, [isLoaded, isSignedIn, user, router]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    if (isLoaded && isSignedIn && (user?.publicMetadata?.role as string) === "admin") {
      fetchUsers();
    }
  }, [fetchUsers, isLoaded, isSignedIn, user]);

  const changeRole = async (targetUser: ClerkUser, newRole: "patient" | "doctor" | "admin") => {
    if (targetUser.role === newRole) return;
    setChangingRole(targetUser.id);

    try {
      const res = await fetch("/api/set-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetUser.email, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update role");

      const wasDemotion = targetUser.role === "doctor" && newRole !== "doctor";

      setUsers(prev =>
        prev.map(u => u.id === targetUser.id ? { ...u, role: newRole } : u)
      );

      if (wasDemotion) {
        setDemotedDoctors(prev => new Set(prev).add(targetUser.email));
      }

      if (newRole === "doctor") {
        toast.success(`${targetUser.name} is now a doctor. Redirecting to registration...`);
        setTimeout(() => {
          router.push(
            `/admin/doctors?email=${encodeURIComponent(targetUser.email)}&name=${encodeURIComponent(targetUser.name)}`
          );
        }, 1200);
      } else {
        toast.success(data.message || `${targetUser.name} is now a ${newRole}.`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setChangingRole(null);
    }
  };

  const stats = {
    total,
    admins:   users.filter(u => u.role === "admin").length,
    doctors:  users.filter(u => u.role === "doctor").length,
    patients: users.filter(u => u.role === "patient").length,
  };

  if (!isLoaded || !isSignedIn || (user?.publicMetadata?.role as string) !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} users on the platform</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading} className="gap-2">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Users",  value: total },
          { label: "Admins",       value: stats.admins },
          { label: "Doctors",      value: stats.doctors },
          { label: "Patients",     value: stats.patients },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <Card>
              <CardContent className="p-5">
                <p className="text-3xl font-bold text-foreground">{s.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Demoted doctor warning */}
      <AnimatePresence>
        {demotedDoctors.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertTriangle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <span className="font-semibold">Note:</span> The following users were demoted from Doctor but their doctor records in the database were NOT deleted. Remove them from{" "}
              <Link href="/admin/doctors" className="underline font-semibold hover:text-amber-900">
                Manage Doctors
              </Link>{" "}
              if needed:{" "}
              <span className="font-mono">{[...demotedDoctors].join(", ")}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User list */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">All Users</CardTitle>
          <CardDescription>Manage roles and permissions for platform users</CardDescription>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <User size={40} className="mb-3 opacity-30" />
              <p className="font-medium">No users found</p>
              {debouncedSearch && <p className="text-sm mt-1">Try a different search term</p>}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {users.map((u, i) => {
                const meta = ROLE_META[u.role] ?? ROLE_META.patient;
                const RoleIcon = meta.icon;
                const isChanging = changingRole === u.id;
                const isMe = u.id === user?.id;

                return (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors"
                  >
                    {/* Avatar */}
                    <img
                      src={u.imageUrl}
                      alt={u.name}
                      className="h-10 w-10 rounded-full object-cover ring-2 ring-border flex-shrink-0"
                    />

                    {/* Name + email */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                        {isMe && (
                          <Badge variant="secondary" className="text-xs">You</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>

                    {/* Joined date */}
                    <p className="text-xs text-muted-foreground hidden md:block flex-shrink-0">
                      {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>

                    {/* Role badge */}
                    <Badge variant={meta.variant} className="gap-1.5 flex-shrink-0">
                      <RoleIcon size={11} />
                      {meta.label}
                    </Badge>

                    {/* Role change dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isChanging}
                          className="gap-1.5 text-xs h-8 px-3 flex-shrink-0"
                        >
                          {isChanging
                            ? <Loader2 size={13} className="animate-spin" />
                            : <>Change Role <ChevronDown size={12} /></>
                          }
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {ALL_ROLES.map((role, idx) => {
                          const rm = ROLE_META[role];
                          const RIcon = rm.icon;
                          const isCurrent = u.role === role;
                          return (
                            <div key={role}>
                              {idx > 0 && <DropdownMenuSeparator />}
                              <DropdownMenuItem
                                disabled={isCurrent}
                                onClick={() => changeRole(u, role)}
                                className="gap-2"
                              >
                                <RIcon size={14} />
                                {isCurrent ? `${rm.label} (current)` : `Make ${rm.label}`}
                              </DropdownMenuItem>
                            </div>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {total} users
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)} className="gap-1">
              <ChevronLeft size={14} /> Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)} className="gap-1">
              Next <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

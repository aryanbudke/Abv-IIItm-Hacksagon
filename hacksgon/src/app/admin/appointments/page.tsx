"use client";

import { useEffect, useState } from "react";
import {
  Calendar, Search, Filter, Clock, User, Building2,
  CheckCircle2, XCircle, AlertCircle, ChevronLeft, ChevronRight
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion } from "framer-motion";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  confirmed:  { label: "Confirmed",  color: "text-[#16A34A]", bg: "bg-[#DCFCE7]", border: "border-[#16A34A]/30", icon: CheckCircle2 },
  pending:    { label: "Pending",    color: "text-[#D97706]", bg: "bg-[#FEF3C7]", border: "border-[#D97706]/30", icon: AlertCircle },
  completed:  { label: "Completed",  color: "text-[#0097a7]", bg: "bg-[#e0f7fa]", border: "border-[#0097a7]/30", icon: CheckCircle2 },
  cancelled:  { label: "Cancelled",  color: "text-[#DC2626]", bg: "bg-[#FEE2E2]", border: "border-[#DC2626]/30", icon: XCircle },
  no_show:    { label: "No Show",    color: "text-[#4A5568]", bg: "bg-[#EEF2F8]", border: "border-[#4A5568]/20", icon: XCircle },
};

const PAGE_SIZE = 15;

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchAppointments();
  }, [page, statusFilter]);

  const updateApptStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
      fetchAppointments();
    } catch (error) { console.error(error); }
  };

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("appointments")
        .select("*, doctors(name, specialization), hospitals(name)", { count: "exact" })
        .order("date", { ascending: false })
        .order("time_slot", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (statusFilter !== "all") query = query.eq("status", statusFilter);

      const { data, count } = await query;
      setAppointments(data || []);
      setTotal(count || 0);
    } finally {
      setLoading(false);
    }
  };

  const filtered = appointments.filter(a =>
    !search ||
    a.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.doctors?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const stats = {
    total,
    today: appointments.filter(a => a.date === new Date().toISOString().split("T")[0]).length,
    confirmed: appointments.filter(a => a.status === "confirmed").length,
    pending: appointments.filter(a => a.status === "pending").length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Appointments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All scheduled and past appointments</p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          {total} total
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total",     value: stats.total,     icon: Calendar },
          { label: "Today",     value: stats.today,     icon: Clock },
          { label: "Confirmed", value: stats.confirmed, icon: CheckCircle2 },
          { label: "Pending",   value: stats.pending,   icon: AlertCircle },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10">
                <s.icon size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{s.label}</p>
                <p className="text-xl font-black text-foreground">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patients, doctors..."
            className="pl-9 h-9 w-64 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-40 text-sm">
            <Filter size={13} className="mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="no_show">No Show</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Patient</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Date &amp; Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground text-sm">
                  No appointments found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((appt, i) => {
                const cfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
                const Icon = cfg.icon;
                return (
                  <motion.tr
                    key={appt.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-border hover:bg-muted/30 transition-colors group"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User size={13} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{appt.patient_name}</p>
                          {appt.patient_phone && (
                            <p className="text-xs text-muted-foreground">{appt.patient_phone}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">{appt.doctors?.name || "—"}</p>
                      {appt.doctors?.specialization && (
                        <p className="text-xs text-muted-foreground">{appt.doctors.specialization}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">{appt.date}</p>
                      <p className="text-xs text-muted-foreground">{appt.time_slot}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${cfg.bg} ${cfg.color} ${cfg.border} text-[11px] font-bold gap-1`}>
                        <Icon size={11} />
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {appt.status === 'pending' && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => updateApptStatus(appt.id, 'confirmed')}>
                            <CheckCircle2 size={13} />
                          </Button>
                        )}
                        {['pending', 'confirmed'].includes(appt.status) && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => updateApptStatus(appt.id, 'cancelled')}>
                            <XCircle size={13} />
                          </Button>
                        )}
                        {appt.status === 'confirmed' && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:text-primary/90 hover:bg-primary/5" onClick={() => updateApptStatus(appt.id, 'completed')}>
                            <CheckCircle2 size={13} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </motion.tr>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {total} total
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="h-8 w-8 p-0">
              <ChevronLeft size={14} />
            </Button>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="h-8 w-8 p-0">
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

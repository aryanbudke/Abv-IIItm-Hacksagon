"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Hospital, Activity, Settings,
  Bell, X, Stethoscope, Building2, ShieldAlert,
  Users, TrendingUp, Clock, CalendarCheck
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const QUEUE_OVERLOAD_THRESHOLD = 10;

export default function AdminDashboardPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  const [resources, setResources] = useState({ hospitals: 0, doctors: 0, counters: 0, departments: 0 });
  const [analytics, setAnalytics] = useState({ avgWaitTime: 0, patientsServed: 0, peakTraffic: "2-4 PM", appointmentRate: 0 });
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiAlerts, setAiAlerts] = useState<string[]>([]);
  const [counterModal, setCounterModal] = useState<{ open: boolean; hospital: any | null }>({ open: false, hospital: null });

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push("/sign-in"); return; }
    if ((user?.publicMetadata?.role as string) !== "admin") router.push("/");
  }, [isLoaded, isSignedIn, user, router]);

  useEffect(() => {
    if (isLoaded && isSignedIn && (user?.publicMetadata?.role as string) === "admin") {
      fetchAll();
      const sub = supabase.channel("admin-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, () => fetchAll())
        .on("postgres_changes", { event: "*", schema: "public", table: "doctors" }, () => fetchAll())
        .subscribe();
      return () => { sub.unsubscribe(); };
    }
  }, [isLoaded, isSignedIn]);

  const fetchAll = async () => {
    try {
      const [hospRes, allDoctorsRes, ctrRes, deptRes, waitingRes, inTreatmentRes, apptRes] = await Promise.all([
        supabase.from("hospitals").select("*").order("name"),
        supabase.from("doctors").select("id, name, specialization, hospital_id, department_id, is_on_leave"),
        supabase.from("counters").select("id, counter_number, hospital_id, department_id, doctor_id, is_active, departments(name)"),
        supabase.from("departments").select("*", { count: "exact", head: true }),
        supabase.from("queue").select("id, hospital_id, department_id, doctor_id, counter_id, counter_number, estimated_wait_time, status").eq("status", "waiting"),
        supabase.from("queue").select("id, hospital_id, department_id, doctor_id, counter_id, counter_number, status").eq("status", "in-treatment"),
        supabase.from("appointments").select("*", { count: "exact", head: true }).gte("date", new Date().toISOString().split("T")[0]),
      ]);

      const allDoctors: any[] = allDoctorsRes.data || [];
      const allCounters: any[] = ctrRes.data || [];
      const waitingQueue: any[] = waitingRes.data || [];
      const inTreatmentQueue: any[] = inTreatmentRes.data || [];

      const doctorById = new Map<string, string>();
      allDoctors.forEach(d => doctorById.set(d.id, d.name));

      const availDocsByDept: Record<string, string[]> = {};
      allDoctors.filter(d => !d.is_on_leave && d.department_id).forEach(d => {
        if (!availDocsByDept[d.department_id]) availDocsByDept[d.department_id] = [];
        availDocsByDept[d.department_id].push(d.name);
      });

      const waitingDocsByDept: Record<string, string[]> = {};
      waitingQueue.filter(q => q.doctor_id && q.department_id).forEach(q => {
        const name = doctorById.get(q.doctor_id);
        if (name) {
          if (!waitingDocsByDept[q.department_id]) waitingDocsByDept[q.department_id] = [];
          if (!waitingDocsByDept[q.department_id].includes(name)) waitingDocsByDept[q.department_id].push(name);
        }
      });

      const activeDoctorCount = allDoctors.filter(d => !d.is_on_leave).length;
      setResources({ hospitals: hospRes.data?.length || 0, doctors: activeDoctorCount, counters: allCounters.length, departments: deptRes.count || 0 });

      const avgWait = waitingQueue.length > 0 ? Math.round(waitingQueue.reduce((s, q) => s + (q.estimated_wait_time || 0), 0) / waitingQueue.length) : 0;
      setAnalytics({ avgWaitTime: avgWait, patientsServed: apptRes.count || 0, peakTraffic: "2-4 PM", appointmentRate: apptRes.count || 0 });

      const alerts: string[] = [];
      (hospRes.data || []).forEach((h: any) => {
        const count = waitingQueue.filter(q => q.hospital_id === h.id).length;
        if (count >= QUEUE_OVERLOAD_THRESHOLD) alerts.push(`Queue overload at ${h.name} — ${count} patients waiting. Consider opening an additional counter.`);
      });
      setAiAlerts(alerts);

      const hospitalsWithData = await Promise.all(
        (hospRes.data || []).map(async (hospital: any) => {
          const hospitalCounters = allCounters.filter(c => c.hospital_id === hospital.id);
          const queueCount = waitingQueue.filter(q => q.hospital_id === hospital.id).length;

          const remainingWaitingDocs: Record<string, string[]> = {};
          const remainingAvailDocs: Record<string, string[]> = {};

          const counters = hospitalCounters.map(c => {
            const activeEntry = inTreatmentQueue.find(q => String(q.counter_id) === String(c.id) || q.counter_number === c.counter_number);
            const inTreatmentDoctor = activeEntry?.doctor_id ? (doctorById.get(activeEntry.doctor_id) || null) : null;
            const assignedDoctor = c.doctor_id ? (doctorById.get(c.doctor_id) || null) : null;

            if (c.department_id) {
              if (!remainingWaitingDocs[c.department_id]) remainingWaitingDocs[c.department_id] = [...(waitingDocsByDept[c.department_id] || [])];
              if (!remainingAvailDocs[c.department_id]) remainingAvailDocs[c.department_id] = [...(availDocsByDept[c.department_id] || [])];
            }

            const activeDoctorName = inTreatmentDoctor || assignedDoctor ||
              (c.department_id && remainingWaitingDocs[c.department_id]?.length > 0 ? remainingWaitingDocs[c.department_id].shift() : null) ||
              (c.department_id && remainingAvailDocs[c.department_id]?.length > 0 ? remainingAvailDocs[c.department_id].shift() : null) || null;

            return { ...c, activeDoctorName };
          });

          const [depts, docs] = await Promise.all([
            supabase.from("departments").select("*").eq("hospital_id", hospital.id),
            supabase.from("doctors").select("*", { count: "exact", head: true }).eq("hospital_id", hospital.id),
          ]);

          return { ...hospital, counters, queueCount, departmentList: depts.data || [], doctorCount: docs.count || 0 };
        })
      );
      setHospitals(hospitalsWithData);
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || !isSignedIn || (user?.publicMetadata?.role as string) !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="spinner" />
      </div>
    );
  }

  const statCards = [
    { label: "Hospitals", value: resources.hospitals, icon: Building2, color: "text-primary", bg: "bg-primary/10", trend: "+2 this month" },
    { label: "Active Doctors", value: resources.doctors, icon: Stethoscope, color: "text-green-600", bg: "bg-green-50", trend: "On shift now" },
    { label: "Counters", value: resources.counters, icon: Activity, color: "text-primary", bg: "bg-primary/15", trend: `${resources.counters} total` },
    { label: "Departments", value: resources.departments, icon: Settings, color: "text-amber-600", bg: "bg-amber-50", trend: "Across all sites" },
    { label: "Avg Wait Time", value: `${analytics.avgWaitTime}m`, icon: Clock, color: "text-primary", bg: "bg-primary/10", trend: "Live average" },
    { label: "Today's Appts", value: analytics.appointmentRate, icon: CalendarCheck, color: "text-primary", bg: "bg-primary/10", trend: "Confirmed" },
    { label: "Peak Traffic", value: analytics.peakTraffic, icon: TrendingUp, color: "text-destructive", bg: "bg-destructive/10", trend: "Busiest window" },
    { label: "Patients Served", value: analytics.patientsServed, icon: Users, color: "text-green-600", bg: "bg-green-50", trend: "Today total" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Real-time operational status across your facility network</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-semibold text-xs gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Live
          </Badge>
          <Button asChild size="sm">
            <Link href="/admin/hospitals">Manage Hospitals</Link>
          </Button>
        </div>
      </div>

      {/* AI Alerts */}
      <AnimatePresence>
        {aiAlerts.map((alert, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-300/50 rounded-xl">
              <Bell size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm font-medium text-amber-900 flex-1">{alert}</p>
              <button onClick={() => setAiAlerts(a => a.filter((_, j) => j !== i))} className="text-amber-900/60 hover:text-amber-900 transition-colors">
                <X size={14} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                    <div className={`text-2xl font-black tracking-tight mt-1 ${stat.color}`}>
                      {loading ? <Skeleton className="h-7 w-12 mt-1" /> : stat.value}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 font-medium">{stat.trend}</p>
                  </div>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${stat.bg}`}>
                    <stat.icon size={18} className={stat.color} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick nav cards */}
      <div>
        <h2 className="text-base font-bold text-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: "/admin/hospitals", title: "Manage Hospitals", desc: "Add, edit & configure facilities", icon: Building2, color: "text-primary", bg: "bg-primary/10" },
            { href: "/admin/doctors", title: "Manage Doctors", desc: "Staff directory & assignments", icon: Stethoscope, color: "text-primary", bg: "bg-primary/15" },
            { href: "/admin/workflows", title: "Workflows", desc: "Automate patient calls & queue actions with ElevenLabs", icon: ShieldAlert, color: "text-primary", bg: "bg-primary/10" },
          ].map(action => (
            <Link key={action.href} href={action.href} className="no-underline">
              <Card className="border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all group cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${action.bg}`}>
                    <action.icon size={18} className={action.color} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{action.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{action.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Separator />

      {/* Facility Network */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Facility Network</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Live queue status across all hospitals</p>
          </div>
          <Badge className="bg-foreground text-background font-bold text-xs">{hospitals.length} facilities</Badge>
        </div>

        {loading ? (
          <div className="grid lg:grid-cols-2 gap-4">
            {[1, 2].map(i => (
              <Card key={i} className="border-border">
                <CardHeader className="pb-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-56 mt-1" />
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[1, 2, 3].map(j => <Skeleton key={j} className="h-14 rounded-xl" />)}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2, 3, 4].map(j => <Skeleton key={j} className="h-16 rounded-xl" />)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {hospitals.map((hospital, i) => (
              <motion.div key={hospital.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all overflow-hidden">
                  <CardHeader className="pb-3 bg-muted/50 border-b border-border">
                    <div className="flex items-start justify-between">
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shrink-0">
                          <Hospital size={18} className="text-foreground" />
                        </div>
                        <div>
                          <CardTitle className="text-[15px] font-bold text-foreground leading-tight">{hospital.name}</CardTitle>
                          <CardDescription className="text-xs mt-0.5 truncate max-w-[200px]">{hospital.address}, {hospital.city}</CardDescription>
                        </div>
                      </div>
                      <Badge variant={hospital.queueCount >= QUEUE_OVERLOAD_THRESHOLD ? "destructive" : "outline"}
                        className={hospital.queueCount >= QUEUE_OVERLOAD_THRESHOLD
                          ? "bg-destructive/10 text-destructive border-destructive/30 font-bold"
                          : "bg-primary/10 text-primary border-primary/20 font-bold"
                        }>
                        {hospital.queueCount} waiting
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4">
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[
                        { label: "Counters", val: hospital.counters.length },
                        { label: "Doctors", val: hospital.doctorCount },
                        { label: "Departments", val: hospital.departmentList.length },
                      ].map(s => (
                        <div key={s.label} className="text-center bg-muted rounded-xl py-2.5 border border-border">
                          <p className="text-lg font-black text-foreground">{s.val}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Counter grid */}
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Active Counters</p>
                      <button
                        onClick={() => setCounterModal({ open: true, hospital })}
                        className="text-[11px] font-bold text-primary hover:text-primary/80 bg-transparent border-none cursor-pointer transition-colors"
                      >
                        View all ({hospital.counters.length})
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {hospital.counters.slice(0, 4).map((c: any) => (
                        <div key={c.id} className="bg-card p-3 border border-border rounded-xl">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="w-6 h-6 flex items-center justify-center bg-primary/10 rounded-md text-[11px] font-black text-primary">
                              {c.counter_number}
                            </span>
                            <span className={`w-2 h-2 rounded-full ${c.is_active ? "bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" : "bg-border"}`} />
                          </div>
                          <p className="text-[12px] font-bold text-foreground truncate">{c.departments?.name || "General"}</p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{c.activeDoctorName || "Unassigned"}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Counter detail dialog */}
      <Dialog
        open={counterModal.open && !!counterModal.hospital}
        onOpenChange={(open) => { if (!open) setCounterModal({ open: false, hospital: null }); }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{counterModal.hospital?.name}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">All service counters — real-time status</p>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 -mx-6 px-6">
            {counterModal.hospital?.counters.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Activity size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-semibold">No counters found for this facility</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {counterModal.hospital?.counters.map((c: any) => (
                  <div key={c.id} className="p-4 border border-border rounded-xl bg-card hover:border-primary/30 hover:shadow-sm transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-black text-primary">{c.counter_number}</span>
                        </div>
                        <span className="font-bold text-foreground text-sm">Counter {c.counter_number}</span>
                      </div>
                      <Badge className={c.is_active
                        ? "bg-green-50 text-green-600 border-green-200 text-[10px]"
                        : "bg-muted text-muted-foreground border-border text-[10px]"
                      }>
                        {c.is_active ? "Live" : "Idle"}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Settings size={12} className="text-muted-foreground shrink-0" />
                        <span className="text-foreground font-medium truncate">{c.departments?.name || "General"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Stethoscope size={12} className={c.activeDoctorName ? "text-primary" : "text-muted-foreground"} />
                        <span className={`truncate font-medium ${c.activeDoctorName ? "text-foreground" : "text-muted-foreground italic"}`}>
                          {c.activeDoctorName || "Unassigned"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

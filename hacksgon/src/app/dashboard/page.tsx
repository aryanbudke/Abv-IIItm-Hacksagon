"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Logo } from "@/components/Logo";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users, Calendar, Activity, ArrowRight, Zap, CheckCircle,
  XCircle, RefreshCw, Search, Clock, HeartPulse, ShieldAlert, Phone, X, Ticket,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { AppUserButton } from "@/components/AppUserButton";
import { PatientNotification } from "@/components/PatientNotification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";

interface ActivityItem {
  id: string;
  type: "queue_active" | "queue_completed" | "queue_cancelled" | "appointment_booked" | "appointment_rescheduled" | "appointment_cancelled";
  label: string;
  detail: string;
  time: string;
  raw_time: string;
}

interface AppointmentItem {
  id: string;
  date: string;
  time_slot: string;
  status: string;
  patient_name?: string;
  hospital_id?: string;
  department_id?: string;
  doctor_id?: string;
  hospitalName?: string;
  departmentName?: string;
  doctorName?: string;
  bookedViaCall?: boolean;
}

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.45, delay: i * 0.07, ease: EASE },
  }),
};

/** Formats a date string (YYYY-MM-DD or ISO) into a human-friendly label. */
function formatDate(raw: string): string {
  if (!raw) return "—";
  // Normalise: treat YYYY-MM-DD as local midnight, ISO strings as-is
  const date = raw.includes("T") ? new Date(raw) : new Date(raw + "T00:00:00");
  if (isNaN(date.getTime())) return raw;
  const today    = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const d        = new Date(date); d.setHours(0,0,0,0);
  if (d.getTime() === today.getTime())    return "Today";
  if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Formats a timestamp to a compact, readable relative or clock string. */
function formatTime(raw: string): string {
  if (!raw) return "";
  const date = new Date(raw);
  if (isNaN(date.getTime())) return raw;
  const now  = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " + date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Converts "02:00 PM" (12h) to "14:00" (24h) for HTML time inputs. */
function timeTo24h(time12h: string): string {
  if (!time12h) return "";
  if (time12h.includes(":")) {
    const [time, modifier] = time12h.split(" ");
    let [hours, minutes] = time.split(":");
    if (hours === "12") hours = "00";
    if (modifier === "PM") hours = (parseInt(hours, 10) + 12).toString();
    return `${hours.padStart(2, "0")}:${minutes}`;
  }
  return time12h;
}

/** Converts "14:00" (24h) to "02:00 PM" (12h) for the database/AI. */
function timeTo12h(time24h: string): string {
  if (!time24h) return "";
  let [hours, minutes] = time24h.split(":");
  let hrs = parseInt(hours, 10);
  const modifier = hrs >= 12 ? "PM" : "AM";
  hrs = hrs % 12 || 12;
  return `${hrs.toString().padStart(2, "0")}:${minutes} ${modifier}`;
}

export default function DashboardPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  const [stats, setStats] = useState({ activeQueues: 0, upcomingAppointments: 0, completedVisits: 0 });
  const [activeTokenId, setActiveTokenId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profilePromptOpen, setProfilePromptOpen] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activityFilter, setActivityFilter] = useState<"all" | "queue" | "appointment" | "completed" | "cancelled">("all");
  const [appointmentFilter, setAppointmentFilter] = useState<"all" | "pending" | "confirmed" | "rescheduled">("all");
  const [rescheduleModal, setRescheduleModal] = useState<{ open: boolean; appointmentId: string; newDate: string; newTime: string }>({ open: false, appointmentId: "", newDate: "", newTime: "" });
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [idToConfirmCancel, setIdToConfirmCancel] = useState<string | null>(null);

  const sq = searchQuery.toLowerCase();

  const filteredActivity = activity.filter(item => {
    const matchesSearch = !sq || item.label.toLowerCase().includes(sq) || item.detail.toLowerCase().includes(sq);
    if (!matchesSearch) return false;
    if (activityFilter === "all") return true;
    if (activityFilter === "queue") return item.type.startsWith("queue_");
    if (activityFilter === "appointment") return item.type.startsWith("appointment_");
    if (activityFilter === "completed") return item.type === "queue_completed";
    if (activityFilter === "cancelled") return item.type === "queue_cancelled" || item.type === "appointment_cancelled";
    return true;
  });

  const filteredAppointments = appointments.filter(appt => {
    const matchesSearch = !sq || appt.doctorName?.toLowerCase().includes(sq) || appt.hospitalName?.toLowerCase().includes(sq) || appt.departmentName?.toLowerCase().includes(sq) || appt.date.includes(sq);
    if (!matchesSearch) return false;
    if (appointmentFilter === "all") return true;
    return appt.status === appointmentFilter;
  });

  useEffect(() => { if (isLoaded && !isSignedIn) router.push("/sign-in"); }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      fetchAll();
      fetchProfileCompleteness();
      const qSub = supabase.channel("dashboard-queue").on("postgres_changes", { event: "*", schema: "public", table: "queue" }, () => fetchAll()).subscribe();
      const aSub = supabase.channel("dashboard-appt").on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => fetchAll()).subscribe();
      const cSub = supabase.channel("dashboard-call").on("postgres_changes", { event: "*", schema: "public", table: "patient_call_requests" }, () => fetchAll()).subscribe();
      return () => { 
        qSub.unsubscribe(); 
        aSub.unsubscribe();
        cSub.unsubscribe();
      };
    }
  }, [isLoaded, isSignedIn, user]);

  const fetchProfileCompleteness = async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load profile");

      const incomplete = !data.completeness?.isComplete;
      setProfileIncomplete(incomplete);

      const dismissed = sessionStorage.getItem(`profile-prompt-dismissed:${user.id}`) === "1";
      if (incomplete && !dismissed) {
        setProfilePromptOpen(true);
      }
    } catch (err) {
      console.error("Error fetching profile completeness:", err);
    }
  };

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const [queueRes, apptRes] = await Promise.all([
        supabase.from("queue").select("*").eq("patient_id", user.id).order("created_at", { ascending: false }),
        supabase.from("appointments").select("*").eq("patient_id", user.id).order("created_at", { ascending: false }),
        supabase.from("appointments").select("*, doctors(name), hospitals(name), departments(name)").eq("patient_id", user.id).order("created_at", { ascending: false }),
      ]);
      const queueData = queueRes.data || [];
      const apptData = apptRes.data || [];

      const activeEntry = queueData.find(q => q.status === "waiting" || q.status === "in-treatment");
      setActiveTokenId(activeEntry?.id ?? null);

      setStats({
        activeQueues: queueData.filter(q => q.status === "waiting" || q.status === "in-treatment").length,
        upcomingAppointments: apptData.filter(a => (a.status === "confirmed" || a.status === "pending") && a.date >= today).length,
        completedVisits: queueData.filter(q => q.status === "completed").length,
      });

      const appointments = apptData.map((a: any) => ({
        id: a.id,
        doctorName: a.doctors?.name || "Doctor",
        hospitalName: a.hospitals?.name || "Hospital",
        departmentName: a.departments?.name || "Department",
        date: a.date,
        time_slot: a.time_slot,
        status: a.status,
        bookedViaCall: a.booked_via_call || false
      }));
      setAppointments(appointments);

      // Fetch active call requests (ignore ones older than 10 mins as failure fallback)
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: callRequests } = await supabase
        .from('patient_call_requests')
        .select('*')
        .eq('patient_id', user.id)
        .in('status', ['pending', 'calling'])
        .gt('created_at', tenMinsAgo)
        .order('created_at', { ascending: false });

      setActiveCall((callRequests || []).length > 0 ? callRequests![0] : null);

      const actItems: ActivityItem[] = [];
      
      // 1. Add Call Requests to activity
      (callRequests || []).forEach((c: any) => {
        actItems.push({
          id: c.id,
          type: "appointment_booked", // Reusing booked style for simplicity or add specific
          label: "Booking Call Requested",
          detail: `AI is calling ${c.phone_used}`,
          time: formatTime(c.created_at),
          raw_time: c.created_at
        });
      });

      // 2. Add Queues to activity
      queueData.forEach(q => {
        let type: ActivityItem["type"] = "queue_active";
        let label = "Joined Queue";
        if (q.status === "completed") { type = "queue_completed"; label = "Visit Completed"; }
        else if (q.status === "cancelled") { type = "queue_cancelled"; label = "Queue Cancelled"; }
        actItems.push({ 
          id: q.id, 
          type, 
          label, 
          detail: `Token #${q.token_number} — ${q.treatment_type || "Consultation"}`, 
          time: formatTime(q.created_at), 
          raw_time: q.created_at 
        });
      });

      // 3. Add Appointments to activity
      apptData.forEach(a => {
        let type: ActivityItem["type"] = "appointment_booked";
        let label = "Appointment Booked";
        if (a.status === "cancelled") { type = "appointment_cancelled"; label = "Appointment Cancelled"; }
        else if (a.status === "rescheduled") { type = "appointment_rescheduled"; label = "Appointment Rescheduled"; }
        
        // Use a.doctors?.name etc if available from join
        const docLabel = a.doctors?.name ? `with ${a.doctors.name}` : "Confirmed";
        actItems.push({ 
          id: a.id, 
          type, 
          label, 
          detail: `${formatDate(a.date)} at ${a.time_slot} ${docLabel}`, 
          time: formatTime(a.created_at), 
          raw_time: a.created_at 
        });
      });

      actItems.sort((a, b) => new Date(b.raw_time).getTime() - new Date(a.raw_time).getTime());
      setActivity(actItems.slice(0, 15));
    } catch (err) { console.error("Error fetching dashboard data:", err); }
    finally { setLoading(false); }
  };

  const dismissCall = async (callId: string) => {
    if (!user) return;
    try {
      await supabase
        .from('patient_call_requests')
        .update({ status: 'cancelled', notes: 'Manually dismissed from dashboard.' })
        .eq('id', callId);
      
      setActiveCall(null);
      toast.success("Call status cleared.");
      fetchAll();
    } catch (err) {
      toast.error("Failed to clear call status.");
    }
  };

  const cancelAppointment = async (appointmentId: string) => {
    if (!user) return;
    try {
      const res = await fetch("/api/appointments/cancel", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ appointmentId, userId: user.id }) 
      });
      if (res.ok) {
        toast.success("Appointment cancelled successfully.");
        fetchAll();
      } else {
        toast.error("Failed to cancel appointment.");
      }
    } catch (err) {
      toast.error("An error occurred while cancelling.");
    }
  };

  const rescheduleAppointment = async () => {
    if (!rescheduleModal.newDate || !rescheduleModal.newTime) { 
        toast.error("Please select a new date and time."); 
        return; 
    }
    try {
      const res = await fetch("/api/appointments/reschedule", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ 
          appointmentId: rescheduleModal.appointmentId, 
          newDate: rescheduleModal.newDate, 
          newTimeSlot: timeTo12h(rescheduleModal.newTime),
          userId: user?.id 
        }) 
      });
      if (res.ok) { 
        setRescheduleModal({ open: false, appointmentId: "", newDate: "", newTime: "" }); 
        toast.success("Appointment rescheduled successfully.");
        fetchAll(); 
      } else {
        toast.error("Failed to reschedule appointment.");
      }
    } catch (err) {
      toast.error("An error occurred while rescheduling.");
    }
  };

  const activityMeta = (type: ActivityItem["type"]) => {
    const map: Record<string, { icon: React.ReactNode; colorClass: string }> = {
      queue_active:           { icon: <Activity size={14} />,    colorClass: "bg-primary/10 text-primary" },
      queue_completed:        { icon: <CheckCircle size={14} />, colorClass: "bg-green-100 text-green-600" },
      queue_cancelled:        { icon: <XCircle size={14} />,     colorClass: "bg-destructive/10 text-destructive" },
      appointment_booked:     { icon: <Calendar size={14} />,    colorClass: "bg-primary/10 text-primary" },
      appointment_rescheduled:{ icon: <RefreshCw size={14} />,   colorClass: "bg-amber-100 text-amber-600" },
      appointment_cancelled:  { icon: <XCircle size={14} />,     colorClass: "bg-destructive/10 text-destructive" },
    };
    return map[type] || map.queue_active;
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex h-14 items-center justify-between">
          <Link href="/dashboard" className="no-underline">
             <Logo height={28} />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: "/join-queue", label: "Join Queue" },
              { href: "/book-appointment", label: "Book Appointment" },
              { href: "/medical-records", label: "Records" },
              { href: "/digital-waiting-room", label: "Waiting Room" },
            ].map(link => (
              <Button key={link.href} variant="ghost" size="sm" asChild>
                <Link href={link.href}>{link.label}</Link>
              </Button>
            ))}
            {activeTokenId && (
              <Button variant="default" size="sm" asChild className="gap-1.5 ml-1">
                <Link href={`/my-token/${activeTokenId}`}>
                  <Ticket size={13} /> My Token
                </Link>
              </Button>
            )}
          </nav>
          <AppUserButton />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16 space-y-8">
        {/* Welcome */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
          <h1 className="text-2xl font-black tracking-tight text-foreground mb-1">
            Welcome back, {user?.firstName || user?.fullName}!
          </h1>
          <p className="text-sm text-muted-foreground">Here&apos;s your queue &amp; appointment overview</p>
        </motion.div>

        {profileIncomplete && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0.5}>
            <Card className="border-amber-200 bg-amber-50/70">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <ShieldAlert size={18} className="text-amber-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Complete your patient profile</p>
                    <p className="text-sm text-amber-800 mt-1">
                      Add your mobile number and address details so hospitals can contact you correctly.
                    </p>
                  </div>
                </div>
                <Button asChild className="sm:shrink-0">
                  <Link href="/profile?onboarding=1">Complete Now</Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Search */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search activity, appointments, doctors…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </motion.div>

        {/* Active Call Status */}
        {activeCall && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
            <div className="p-4 rounded-2xl border-2 border-primary/20 bg-primary/5 flex items-center justify-between group relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                  <div className="relative bg-primary text-white p-2 rounded-full">
                    <Phone size={18} />
                  </div>
                </div>
                <div>
                  <p className="font-bold text-sm">AI Booking Call in Progress</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-none">
                    Our assistant is on the line with you...
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="animate-pulse hidden sm:inline-flex">Active</Badge>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 rounded-full hover:bg-primary/10 text-primary"
                  onClick={() => dismissCall(activeCall.id)}
                  title="Dismiss if call has ended"
                >
                  <X size={16} />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Active Queues",          value: stats.activeQueues,          icon: Users,       colorClass: "text-primary bg-primary/10" },
            { label: "Upcoming Appointments",  value: stats.upcomingAppointments,  icon: Calendar,    colorClass: "text-primary bg-primary/10" },
            { label: "Completed Visits",       value: stats.completedVisits,       icon: CheckCircle, colorClass: "text-green-600 bg-green-100" },
          ].map((s, i) => (
            <motion.div key={s.label} variants={fadeUp} initial="hidden" animate="visible" custom={i + 2}>
              <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.colorClass}`}>
                      <s.icon size={20} />
                    </div>
                    <span className="text-4xl font-black tracking-tight text-foreground">{s.value}</span>
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions + Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap size={15} className="text-primary" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { href: "/join-queue",            label: "Join a New Queue",       icon: Users },
                  { href: "/book-appointment",       label: "Book Appointment",       icon: Calendar },
                  { href: "/medical-records",        label: "My Medical Records",     icon: Activity },
                  { href: "/digital-waiting-room",   label: "Digital Waiting Room",   icon: Clock },
                ].map(({ href, label, icon: Icon }) => (
                  <Button key={href} variant="ghost" className="w-full justify-between h-auto py-3" asChild>
                    <Link href={href}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Icon size={15} className="text-primary" />
                        </div>
                        <span className="text-sm font-semibold text-foreground">{label}</span>
                      </div>
                      <ArrowRight size={14} className="text-muted-foreground" />
                    </Link>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Activity */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6}>
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity size={15} className="text-primary" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {/* Filters */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(["all", "queue", "appointment", "completed", "cancelled"] as const).map(f => (
                    <Button
                      key={f}
                      size="sm"
                      variant={activityFilter === f ? "default" : "outline"}
                      onClick={() => setActivityFilter(f)}
                      className="h-7 px-3 text-xs rounded-full"
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto max-h-64">
                  {loading ? (
                    <div className="flex items-center justify-center h-24">
                      <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
                    </div>
                  ) : filteredActivity.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock size={32} className="mx-auto mb-2 opacity-20" />
                      <p className="text-sm">{searchQuery || activityFilter !== "all" ? "No matching activity" : "No activity yet"}</p>
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {filteredActivity.map((item, i) => {
                        const meta = activityMeta(item.type);
                        return (
                          <motion.div
                            key={item.id + item.type}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="flex items-start gap-3 py-3 border-b border-border last:border-b-0"
                          >
                            <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${meta.colorClass}`}>
                              {meta.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground">{item.label}</p>
                              <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                            </div>
                            <p className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</p>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <Separator />

        {/* Appointments */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={7}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar size={15} className="text-primary" />
                  My Appointments
                </CardTitle>
                <div className="flex flex-wrap gap-1.5">
                  {(["all", "pending", "confirmed", "rescheduled"] as const).map(f => (
                    <Button
                      key={f}
                      size="sm"
                      variant={appointmentFilter === f ? "default" : "outline"}
                      onClick={() => setAppointmentFilter(f)}
                      className="h-7 px-3 text-xs rounded-full"
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
                </div>
              ) : filteredAppointments.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Calendar size={36} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">{searchQuery || appointmentFilter !== "all" ? "No matching appointments" : "No appointments yet"}</p>
                  {!searchQuery && appointmentFilter === "all" && (
                    <Button asChild className="mt-4">
                      <Link href="/book-appointment">Book an Appointment</Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAppointments.map((appt, i) => (
                    <motion.div
                      key={appt.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-muted/30 rounded-xl border border-border"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-foreground">{appt.doctorName || "Doctor"}</p>
                          {appt.bookedViaCall && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-emerald-500/30 bg-emerald-500/5 text-emerald-500 font-medium">
                              <Phone size={8} className="mr-1" />
                              Booked via AI
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{appt.hospitalName} · {appt.departmentName}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar size={11} /> {formatDate(appt.date)} at {appt.time_slot}
                        </p>
                        <Badge
                          className={`mt-2 text-[10px] uppercase tracking-wide ${
                            appt.status === "confirmed"
                              ? "bg-green-100 text-green-700 border-green-200"
                              : appt.status === "pending"
                                ? "bg-amber-100 text-amber-700 border-amber-200"
                                : "bg-muted text-muted-foreground border-border"
                          }`}
                          variant="outline"
                        >
                          {appt.status}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50"
                          onClick={() => setRescheduleModal({ 
                            open: true, 
                            appointmentId: appt.id, 
                            newDate: appt.date, 
                            newTime: timeTo24h(appt.time_slot) 
                          })}
                        >
                          <RefreshCw size={12} /> Reschedule
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-destructive border-destructive/20 hover:bg-destructive/5"
                          onClick={() => { 
                            setIdToConfirmCancel(appt.id);
                            setShowCancelConfirm(true);
                          }}
                        >
                          <XCircle size={12} /> Cancel
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleModal.open} onOpenChange={open => !open && setRescheduleModal({ open: false, appointmentId: "", newDate: "", newTime: "" })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw size={16} className="text-amber-500" />
              Reschedule Appointment
            </DialogTitle>
            <DialogDescription>
              Choose a new date and time for your appointment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="r-date">New Date</Label>
              <Input
                id="r-date"
                type="date"
                value={rescheduleModal.newDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={e => setRescheduleModal(m => ({ ...m, newDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-time">New Time</Label>
              <Input
                id="r-time"
                type="time"
                value={rescheduleModal.newTime}
                onChange={e => setRescheduleModal(m => ({ ...m, newTime: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRescheduleModal({ open: false, appointmentId: "", newDate: "", newTime: "" })}>
              Cancel
            </Button>
            <Button onClick={rescheduleAppointment} className="bg-amber-500 hover:bg-amber-600 text-white">
              Confirm Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isSignedIn && user && <PatientNotification patientId={user.id} />}

      <Dialog open={profilePromptOpen} onOpenChange={setProfilePromptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Your Patient Profile</DialogTitle>
            <DialogDescription>
              Please provide the following details to ensure the best medical experience.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Please add your mobile number and address details. This helps hospitals reach you for appointments, queue updates, and workflow calls.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (user) sessionStorage.setItem(`profile-prompt-dismissed:${user.id}`, "1");
                setProfilePromptOpen(false);
              }}
            >
              Later
            </Button>
            <Button asChild>
              <Link href="/profile?onboarding=1">Complete Now</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ══ CONFIRM CANCEL MODAL ══════════════════════ */}
      <ConfirmDialog
        open={showCancelConfirm}
        title="Cancel Appointment"
        description="Are you sure you want to cancel this appointment? This action cannot be undone."
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={() => idToConfirmCancel && cancelAppointment(idToConfirmCancel)}
        confirmText="Yes, Cancel"
        confirmVariant="destructive"
      />
    </div>
  );
}

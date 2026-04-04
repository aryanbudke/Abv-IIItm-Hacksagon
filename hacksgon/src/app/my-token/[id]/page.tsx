"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/Logo";
import { supabase } from "@/lib/supabase/client";
import { queueService } from "@/lib/services/queueService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  Bell,
  BellOff,
  Activity,
  Stethoscope,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";

interface QueueEntryData {
  id: string;
  token_number: number;
  patient_name: string;
  status: string;
  position: number;
  estimated_wait_time: number;
  qr_code: string;
  department_id: string;
  hospital_id: string;
  created_at: string;
  chief_complaint?: string;
}

interface DeptHospitalInfo {
  hospitalName: string;
  departmentName: string;
}

const STATUS_CONFIG = {
  waiting: { label: "Waiting", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock },
  "in-treatment": { label: "In Treatment", color: "bg-green-100 text-green-700 border-green-200", icon: Stethoscope },
  completed: { label: "Completed", color: "bg-gray-100 text-gray-600 border-gray-200", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-600 border-red-200", icon: AlertCircle },
};

export default function MyTokenPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [entry, setEntry] = useState<QueueEntryData | null>(null);
  const [info, setInfo] = useState<DeptHospitalInfo | null>(null);
  const [livePosition, setLivePosition] = useState<number>(0);
  const [liveWaitTime, setLiveWaitTime] = useState<number>(0);
  const [totalWaiting, setTotalWaiting] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [notifEnabled, setNotifEnabled] = useState(false);
  const prevPositionRef = useRef<number>(0);
  const notifEnabledRef = useRef(false);

  const playChime = useCallback((urgent: boolean) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = urgent ? [880, 1100] : [660, 880];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
        gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + i * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.5);
        osc.start(ctx.currentTime + i * 0.18);
        osc.stop(ctx.currentTime + i * 0.18 + 0.5);
      });
    } catch {}
  }, []);

  // Keep ref in sync
  useEffect(() => { notifEnabledRef.current = notifEnabled; }, [notifEnabled]);

  // Check notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
      if (Notification.permission === "granted") setNotifEnabled(true);
    }
  }, []);

  const fetchInfo = useCallback(async (hospitalId: string, departmentId: string) => {
    const [{ data: h }, { data: d }] = await Promise.all([
      supabase.from("hospitals").select("name").eq("id", hospitalId).single(),
      supabase.from("departments").select("name").eq("id", departmentId).single(),
    ]);
    setInfo({ hospitalName: h?.name || "Hospital", departmentName: d?.name || "Department" });
  }, []);

  const fetchLivePosition = useCallback(async (hospitalId: string, departmentId: string, createdAt: string) => {
    const [{ count }, { count: total }, { data: doctors }] = await Promise.all([
      supabase
        .from("queue")
        .select("*", { count: "exact", head: true })
        .eq("hospital_id", hospitalId)
        .eq("department_id", departmentId)
        .eq("status", "waiting")
        .lt("created_at", createdAt),
      supabase
        .from("queue")
        .select("*", { count: "exact", head: true })
        .eq("hospital_id", hospitalId)
        .eq("department_id", departmentId)
        .eq("status", "waiting"),
      supabase
        .from("doctors")
        .select("average_treatment_time")
        .eq("department_id", departmentId),
    ]);

    const pos = (count || 0) + 1;
    const avgTime = doctors && doctors.length > 0
      ? doctors.reduce((s, d) => s + (d.average_treatment_time || 15), 0) / doctors.length
      : 15;
    const waitTime = Math.round(pos * avgTime);

    setLivePosition(pos);
    setTotalWaiting(total || 0);
    setLiveWaitTime(waitTime);

    // Fire notification + chime if enabled
    if (notifEnabledRef.current) {
      const prev = prevPositionRef.current;
      if (prev > 2 && pos === 2) {
        playChime(false);
        new Notification("MediQueue — Almost your turn!", {
          body: "You are next in line. Please make your way to the counter.",
          icon: "/images/logo.png",
        });
      } else if (prev > 1 && pos === 1) {
        playChime(true);
        new Notification("MediQueue — You're next!", {
          body: "Please proceed to the counter now.",
          icon: "/images/logo.png",
        });
      }
    }
    prevPositionRef.current = pos;
  }, [playChime]);

  const fetchEntry = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("queue")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        toast.error("Queue entry not found.");
        return;
      }

      setEntry(data);
      await fetchInfo(data.hospital_id, data.department_id);
      await fetchLivePosition(data.hospital_id, data.department_id, data.created_at);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, fetchInfo, fetchLivePosition]);

  useEffect(() => {
    fetchEntry();
  }, [fetchEntry]);

  // Real-time subscription
  useEffect(() => {
    if (!entry) return;

    const channel = supabase
      .channel(`my-token-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue", filter: `hospital_id=eq.${entry.hospital_id}` },
        async () => {
          // Re-fetch our entry and live position
          const { data } = await supabase.from("queue").select("*").eq("id", id).single();
          if (data) {
            setEntry(data);
            await fetchLivePosition(data.hospital_id, data.department_id, data.created_at);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [entry, id, fetchLivePosition]);

  const handleLeaveQueue = async () => {
    if (!entry) return;
    if (!confirm("Are you sure you want to leave the queue? This cannot be undone.")) return;
    setLeaving(true);
    try {
      await queueService.deleteQueueEntry(entry.id);
      toast.success("You have left the queue.");
      router.push("/dashboard");
    } catch {
      toast.error("Failed to leave the queue.");
    } finally {
      setLeaving(false);
    }
  };

  const handleEnableNotifications = async () => {
    if (!("Notification" in window)) {
      toast.error("Your browser does not support notifications.");
      return;
    }
    if (Notification.permission === "granted") {
      setNotifEnabled(prev => {
        const next = !prev;
        toast.success(next ? "Notifications enabled." : "Notifications disabled.");
        return next;
      });
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === "granted") {
      setNotifEnabled(true);
      toast.success("Notifications enabled. We'll alert you when you're next!");
    } else {
      toast.error("Notification permission denied.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-semibold">Queue entry not found.</p>
        <Button onClick={() => router.push("/dashboard")} variant="outline">Go to Dashboard</Button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[entry.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.waiting;
  const StatusIcon = statusCfg.icon;
  const isActive = entry.status === "waiting" || entry.status === "in-treatment";
  const progressPct = totalWaiting > 0 ? Math.max(0, Math.min(100, ((totalWaiting - livePosition + 1) / totalWaiting) * 100)) : 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 flex h-14 items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="gap-1.5 text-muted-foreground">
            <ArrowLeft size={16} /> Dashboard
          </Button>
          <Link href="/" className="no-underline"><Logo height={28} /></Link>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-20 space-y-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-5">

          {/* Token Hero Card */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6 sm:p-8 text-center border-b border-border">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Badge className={`${statusCfg.color} border text-xs font-semibold px-3 py-1`}>
                  <StatusIcon size={12} className="mr-1.5" />
                  {statusCfg.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-1">Your Token Number</p>
              <motion.p
                key={entry.token_number}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-7xl font-black text-primary tracking-tight"
              >
                {entry.token_number}
              </motion.p>
              <p className="text-base font-medium text-foreground mt-3">{entry.patient_name}</p>

              {info && (
                <div className="mt-3 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin size={13} />
                  <span>{info.hospitalName} · {info.departmentName}</span>
                </div>
              )}
            </div>

            {/* Live Stats */}
            {isActive && (
              <div className="p-5 sm:p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <Users size={20} className="mx-auto text-blue-600 mb-1" />
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={livePosition}
                        initial={{ y: -10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 10, opacity: 0 }}
                        className="text-3xl font-black text-blue-900"
                      >
                        {entry.status === "in-treatment" ? "—" : livePosition}
                      </motion.p>
                    </AnimatePresence>
                    <p className="text-xs text-blue-600 font-medium mt-0.5">Your Position</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <Clock size={20} className="mx-auto text-green-600 mb-1" />
                    <p className="text-3xl font-black text-green-900">
                      {entry.status === "in-treatment" ? "Now" : `${liveWaitTime || entry.estimated_wait_time || 0}m`}
                    </p>
                    <p className="text-xs text-green-600 font-medium mt-0.5">Est. Wait</p>
                  </div>
                </div>

                {/* Progress bar */}
                {entry.status === "waiting" && totalWaiting > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Queue progress</span>
                      <span>{livePosition} of {totalWaiting} remaining</span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                )}

                {entry.status === "in-treatment" && (
                  <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                    <Activity size={18} className="text-green-600 shrink-0 animate-pulse" />
                    <p className="text-sm font-medium text-green-800">You are currently in treatment. Please follow staff instructions.</p>
                  </div>
                )}

                {/* "Notify me" toggle */}
                {entry.status === "waiting" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEnableNotifications}
                    className={`w-full gap-2 ${notifEnabled ? "border-primary text-primary" : ""}`}
                  >
                    {notifEnabled ? <Bell size={14} /> : <BellOff size={14} />}
                    {notifEnabled ? "Notifications On — click to disable" : "Notify me when I'm next"}
                  </Button>
                )}
              </div>
            )}

            {(entry.status === "completed" || entry.status === "cancelled") && (
              <div className="p-5 sm:p-6 text-center text-muted-foreground text-sm">
                {entry.status === "completed" ? "Your visit is complete. Thank you!" : "This queue entry was cancelled."}
              </div>
            )}
          </Card>

{/* Chief complaint display */}
          {entry.chief_complaint && (
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Chief Complaint</p>
                <p className="text-sm text-foreground">{entry.chief_complaint}</p>
              </CardContent>
            </Card>
          )}

          {/* Leave queue */}
          {isActive && (
            <Button
              variant="outline"
              className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
              onClick={handleLeaveQueue}
              disabled={leaving}
            >
              {leaving ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
              Leave Queue
            </Button>
          )}

        </motion.div>
      </main>
    </div>
  );
}

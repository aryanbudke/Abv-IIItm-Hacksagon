"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Logo } from "@/components/Logo";
import { useUser } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Clock, Activity, AlertTriangle, Monitor, Volume2,
  VolumeX, User as UserIcon, XCircle, HeartPulse, ArrowLeft,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";

interface QueueEntry {
  id: string;
  tokenNumber: number;
  patientName: string;
  patientId: string;
  hospitalName: string;
  departmentName: string;
  doctorName: string;
  estimatedWaitTime: number;
  position: number;
  status: string;
  isEmergency: boolean;
  calledAt?: string;
}

export default function DigitalWaitingRoom() {
  const { user, isSignedIn } = useUser();
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [currentCall, setCurrentCall] = useState<QueueEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [idToCancel, setIdToCancel] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) { setLoading(false); return; }
    fetchQueueData();
    const subscription = supabase
      .channel(`digital-waiting-room-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue", filter: `patient_id=eq.${user.id}` },
        () => { fetchQueueData(); setLastUpdated(new Date()); })
      .subscribe();
    return () => { subscription.unsubscribe(); };
  }, [isSignedIn, user]);

  const fetchQueueData = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("queue")
        .select(`*, hospitals!queue_hospital_id_fkey(name), departments!queue_department_id_fkey(name), doctors!queue_doctor_id_fkey(name)`)
        .eq("patient_id", user.id)
        .in("status", ["waiting", "in-treatment"])
        .order("is_emergency", { ascending: false })
        .order("position", { ascending: true });
      if (error) throw error;
      const formatted = (data || []).map(item => ({
        id: item.id, tokenNumber: item.token_number, patientName: item.patient_name,
        patientId: item.patient_id, hospitalName: item.hospitals?.name || "Unknown Hospital",
        departmentName: item.departments?.name || "Unknown Department",
        doctorName: item.doctors?.name || "Available Doctor",
        estimatedWaitTime: item.estimated_wait_time || 0, position: item.position || 0,
        status: item.status, isEmergency: item.is_emergency || false, calledAt: item.called_at,
      }));
      setQueueEntries(formatted);
      const called = formatted.find(q => q.status === "in-treatment" && q.calledAt);
      setCurrentCall(called || null);
    } catch (error) { console.error("Error fetching queue data:", error); }
    finally { setLoading(false); setLastUpdated(new Date()); }
  };

  useEffect(() => {
    if (currentCall && soundEnabled) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880; osc.type = "sine";
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6);
      } catch { /* audio may not be allowed */ }
    }
  }, [currentCall]);

  const cancelQueue = async (entryId: string) => {
    setIdToCancel(entryId);
    setShowCancelConfirm(true);
  };

  const doCancelQueue = async () => {
    if (!idToCancel) return;
    const entryId = idToCancel;
    setCancellingId(entryId);
    try {
      const entry = queueEntries.find(e => e.id === entryId);
      if (!entry) return;
      await supabase.from("queue").update({ status: "cancelled" }).eq("id", entryId);
      const remaining = queueEntries.filter(e => e.id !== entryId && e.status === "waiting" && e.position > entry.position).sort((a, b) => a.position - b.position);
      for (const p of remaining) {
        await supabase.from("queue").update({ position: p.position - 1, estimated_wait_time: Math.max(0, (p.position - 1) * 15) }).eq("id", p.id);
      }
      fetchQueueData();
    } catch { toast.error("Failed to cancel queue."); }
    finally { setCancellingId(null); setIdToCancel(null); }
  };

  const myEntry = isSignedIn && user ? queueEntries.find(e => e.patientId === user.id && e.status === "waiting") : null;
  const waitingEntries = queueEntries.filter(e => e.status === "waiting");

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="spinner" /></div>;
  }

  if (!isSignedIn || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 text-center px-6">
        <Monitor size={56} className="text-border-strong" />
        <h2 className="text-[22px] font-extrabold text-foreground">Sign In Required</h2>
        <p className="text-[15px] text-muted-foreground max-w-[320px]">Please sign in to view your personal waiting room status.</p>
        <Link href="/sign-in" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white text-sm font-semibold rounded-xl no-underline shadow-[0_2px_8px_rgba(0,102,204,0.25)]">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white/92 backdrop-blur-xl border-b border-border h-16 flex items-center sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex items-center justify-between w-full">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground no-underline hover:text-foreground transition-colors">
            <ArrowLeft size={16} /> Back
          </Link>
          <Link href="/" className="no-underline">
             <Logo height={30} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right text-[11px] text-muted-foreground hidden sm:block">
              <div>Last updated</div>
              <div className="font-semibold text-muted-foreground">{lastUpdated.toLocaleTimeString()}</div>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Mute" : "Unmute"}
              className={`flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg bg-transparent cursor-pointer text-[12px] font-semibold ${soundEnabled ? "text-green-600" : "text-muted-foreground"} hover:bg-muted transition-all`}
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              <span className="hidden sm:inline">{soundEnabled ? "On" : "Off"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* My Queue Banner */}
      <AnimatePresence>
        {myEntry && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-primary text-white overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-6 sm:gap-8">
                  {[
                    { label: "Your Token", val: `#${myEntry.tokenNumber}` },
                    { label: "Ahead of You", val: Math.max(0, myEntry.position - 1) },
                    { label: "Doctor", val: myEntry.doctorName },
                    { label: "Dept", val: myEntry.departmentName },
                  ].map(({ label, val }) => (
                    <div key={label} className="text-center">
                      <div className="text-[10px] font-bold tracking-wider uppercase text-white/70 mb-0.5">{label}</div>
                      <div className="text-lg font-black tracking-tight">{val}</div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => cancelQueue(myEntry.id)}
                  disabled={cancellingId === myEntry.id}
                  className="flex items-center gap-2 px-5 py-2.5 border-[1.5px] border-white/25 bg-white/10 text-white rounded-xl text-[13px] font-bold cursor-pointer hover:bg-white/20 transition-all disabled:opacity-50"
                >
                  <XCircle size={15} />
                  {cancellingId === myEntry.id ? "Cancelling…" : "Leave Queue"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Currently Being Called */}
      <AnimatePresence>
        {currentCall && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gradient-to-r from-accent-dark to-accent text-white overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 text-center">
              <div className="inline-flex items-center gap-2 text-[12px] font-bold tracking-wider uppercase bg-white/15 px-4 py-1.5 rounded-full mb-6">
                <Activity size={13} className="animate-dot-blink" /> Now Calling
              </div>
              <motion.div
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-[clamp(56px,8vw,96px)] font-black tracking-tighter mb-3"
              >
                #{currentCall.tokenNumber}
              </motion.div>
              <div className="text-[22px] font-bold text-white/90 mb-1.5">{currentCall.patientName}</div>
              <div className="text-[16px] text-white/70">{currentCall.doctorName} · {currentCall.departmentName}</div>
              {currentCall.isEmergency && (
                <motion.div
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                  className="inline-flex items-center gap-2 bg-destructive mt-5 px-5 py-2 rounded-full text-[13px] font-extrabold tracking-wider"
                >
                  <AlertTriangle size={14} /> EMERGENCY PRIORITY
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-7 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Queue List */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-[10px] bg-primary/10 flex items-center justify-center">
                    <Users size={18} className="text-primary" />
                  </div>
                  <h2 className="text-[16px] font-bold text-foreground">Current Queue</h2>
                </div>
                <span className="text-[13px] font-semibold text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {waitingEntries.length} waiting
                </span>
              </div>

              <div className="max-h-[640px] overflow-y-auto">
                <AnimatePresence>
                  {queueEntries.map((entry, index) => {
                    const isMe = isSignedIn && user && entry.patientId === user.id;
                    const patientsAhead = waitingEntries.filter(e => e.position < entry.position).length;
                    return (
                      <motion.div
                        layout
                        key={entry.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.25, delay: index * 0.04 }}
                        className={`px-5 py-4 border-b border-border hover:bg-muted/50 transition-colors ${
                          isMe ? "bg-primary/10 border-l-[3px] border-l-brand" : ""
                        } ${entry.isEmergency ? "bg-destructive-light border-l-[3px] border-l-danger" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3.5">
                            {/* Position */}
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-[16px] font-extrabold shrink-0 border-[1.5px] ${
                              entry.isEmergency
                                ? "bg-destructive-light text-destructive border-danger/20"
                                : isMe
                                  ? "bg-primary text-white border-primary"
                                  : "bg-muted text-muted-foreground border-border"
                            }`}>
                              {entry.position}
                            </div>
                            {/* Info */}
                            <div>
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="text-[15px] font-extrabold text-primary">#{entry.tokenNumber}</span>
                                <span className="text-border-strong">·</span>
                                <span className="text-[14px] font-semibold text-foreground">{entry.patientName}</span>
                                {isMe && (
                                  <span className="text-[10px] font-extrabold tracking-wide bg-primary text-white px-2 py-0.5 rounded-md">YOU</span>
                                )}
                              </div>
                              <div className="text-[12px] text-muted-foreground flex gap-1.5 flex-wrap">
                                <span>{entry.doctorName}</span>
                                <span>·</span>
                                <span>{entry.departmentName}</span>
                              </div>
                              {entry.isEmergency && (
                                <div className="flex items-center gap-1 mt-1 text-[11px] font-extrabold text-destructive uppercase tracking-wider">
                                  <AlertTriangle size={10} /> Emergency
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Right side */}
                          <div className="text-right shrink-0">
                            {entry.status === "waiting" ? (
                              <>
                                <div className="text-[14px] font-extrabold text-foreground">#{entry.tokenNumber}</div>
                                <div className="text-[12px] font-semibold text-primary mt-0.5">{patientsAhead} ahead</div>
                                <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-muted text-muted-foreground border border-border">
                                  Waiting
                                </span>
                              </>
                            ) : (
                              <>
                                <div className="text-[14px] font-extrabold text-green-600">#{entry.tokenNumber}</div>
                                <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-green-50 text-green-600 border border-success/20">
                                  <CheckCircle size={9} /> In Treatment
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {queueEntries.length === 0 && (
                  <div className="text-center py-16 px-6 text-muted-foreground">
                    <Users size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-[15px] font-semibold">You have no active queue entries</p>
                    <p className="text-[13px] mt-1.5">Join a queue to see your status here</p>
                    <Link href="/join-queue" className="inline-flex items-center gap-2 mt-5 px-6 py-3 bg-primary text-white text-sm font-semibold rounded-xl no-underline shadow-[0_2px_8px_rgba(0,102,204,0.25)]">
                      Join Queue
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Stats */}
          <div className="flex flex-col gap-5">
            {/* Queue Statistics */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Activity size={15} className="text-primary" />
                </div>
                <h3 className="text-[14px] font-bold text-foreground">Queue Stats</h3>
              </div>
              <div className="flex flex-col gap-3">
                {[
                  { label: "Total Waiting", val: waitingEntries.length, color: "text-primary", bg: "bg-primary/10" },
                  { label: "In Treatment", val: queueEntries.filter(q => q.status === "in-treatment").length, color: "text-green-600", bg: "bg-green-600/10" },
                  { label: "Emergency", val: queueEntries.filter(q => q.isEmergency).length, color: "text-destructive", bg: "bg-destructive/10" },
                ].map(({ label, val, color, bg }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
                    <span className={`text-lg font-black tracking-tight ${color} ${bg} px-3 py-0.5 rounded-lg`}>{val}</span>
                  </div>
                ))}
                <div className="h-px bg-border-default my-1" />
                <div className="flex justify-between items-center">
                  <span className="text-[13px] font-semibold text-foreground">Avg Wait</span>
                  <span className="text-[16px] font-black tracking-tight text-primary bg-primary/10 px-3 py-0.5 rounded-lg">
                    {waitingEntries.length > 0
                      ? `~${Math.round(waitingEntries.reduce((s, q) => s + q.estimatedWaitTime, 0) / waitingEntries.length)} min`
                      : "0 min"}
                  </span>
                </div>
              </div>
            </div>

            {/* Department Status */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock size={15} className="text-primary" />
                </div>
                <h3 className="text-[14px] font-bold text-foreground">Department Status</h3>
              </div>
              {Array.from(new Set(queueEntries.map(q => q.departmentName))).map(dept => {
                const deptQ = queueEntries.filter(q => q.departmentName === dept && q.status === "waiting");
                return (
                  <div key={dept} className="flex justify-between items-center px-3 py-2.5 rounded-xl bg-muted mb-1.5 last:mb-0">
                    <div className="flex items-center gap-2">
                      <div className="w-[7px] h-[7px] rounded-full bg-primary" />
                      <span className="text-[13px] font-semibold text-foreground">{dept}</span>
                    </div>
                    <span className="text-[12px] font-bold text-muted-foreground bg-card px-3 py-1 rounded-xl border border-border">
                      {deptQ.length} waiting
                    </span>
                  </div>
                );
              })}
              {queueEntries.length === 0 && (
                <p className="text-[13px] text-muted-foreground text-center py-4">No active departments</p>
              )}
            </div>
          </div>
        </div>
      </main>

      <ConfirmDialog
        open={showCancelConfirm}
        title="Cancel Queue Position"
        description="Are you sure you want to cancel your position in the queue? This cannot be undone."
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={doCancelQueue}
        confirmText="Yes, Cancel"
        confirmVariant="destructive"
      />
    </div>
  );
}

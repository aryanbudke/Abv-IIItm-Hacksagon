"use client";

import { useState, useEffect, useRef } from "react";
import { Phone, PhoneCall, PhoneOff, Loader2, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// A call in "pending" or "calling" state older than this is treated as stale/dead
const CALL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const POLL_INTERVAL_MS = 5_000;
// Stop polling after this many attempts even if still "calling"
const MAX_POLL_ATTEMPTS = 120; // 10 min

interface CallToBookButtonProps {
  hospitalId?: string;
  departmentId?: string;
  doctorId?: string;
  userMobile?: string;
  className?: string;
}

interface CallRequest {
  id: string;
  status: "pending" | "calling" | "completed" | "failed" | "cancelled";
  created_at: string;
  appointment_id?: string;
}

function isStale(req: CallRequest): boolean {
  return Date.now() - new Date(req.created_at).getTime() > CALL_TIMEOUT_MS;
}

export function CallToBookButton({
  hospitalId,
  departmentId,
  doctorId,
  userMobile,
  className,
}: CallToBookButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeCall, setActiveCall] = useState<CallRequest | null>(null);
  // Use a ref for the timer so cleanup always sees the latest value
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  const stopPolling = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    pollCountRef.current = 0;
  };

  // On mount, fetch existing active call requests (ignore stale ones)
  useEffect(() => {
    fetchActiveCall();
    return () => stopPolling(); // always cleans up on unmount
  }, []);

  const fetchActiveCall = async () => {
    try {
      const res = await fetch("/api/patient-call/request");
      if (!res.ok) return;
      const { requests } = await res.json();
      const active = (requests || []).find(
        (r: CallRequest) =>
          (r.status === "pending" || r.status === "calling") && !isStale(r)
      );
      setActiveCall(active || null);
      // If we found an active call, start polling for it
      if (active) startPolling(active.id);
    } catch {}
  };

  const startPolling = (callRequestId: string) => {
    stopPolling(); // clear any existing timer first
    pollCountRef.current = 0;

    timerRef.current = setInterval(async () => {
      pollCountRef.current += 1;

      // Give up after MAX_POLL_ATTEMPTS
      if (pollCountRef.current > MAX_POLL_ATTEMPTS) {
        stopPolling();
        setActiveCall(null);
        toast.error("Call timed out. Please try again or book online.");
        return;
      }

      try {
        const res = await fetch("/api/patient-call/request");
        const { requests } = await res.json();
        const req = (requests || []).find((r: CallRequest) => r.id === callRequestId);

        if (!req || isStale(req)) {
          stopPolling();
          setActiveCall(null);
          return;
        }

        setActiveCall(req);

        if (req.status === "completed") {
          stopPolling();
          toast.success("Appointment booked! Check your email and dashboard.");
        } else if (req.status === "failed") {
          stopPolling();
          toast.error("Call ended without booking. Please try again.");
        } else if (req.status === "cancelled") {
          stopPolling();
          setActiveCall(null);
        }
      } catch {}
    }, POLL_INTERVAL_MS);
  };

  const initiateCall = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/patient-call/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hospitalId, departmentId, doctorId }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to initiate call");
        return;
      }

      setOpen(false);
      toast.success(`Calling ${data.phone} now — pick up within 60 seconds!`);
      const newReq: CallRequest = { id: data.callRequestId, status: "calling", created_at: new Date().toISOString() };
      setActiveCall(newReq);
      startPolling(data.callRequestId);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const cancelCall = async () => {
    if (!activeCall) return;
    await fetch(`/api/patient-call/request?id=${activeCall.id}`, { method: "DELETE" });
    stopPolling();
    setActiveCall(null);
    toast.info("Call request cancelled.");
  };

  // ── Active call badge (shown on the page when a call is in progress) ──
  if (activeCall && (activeCall.status === "pending" || activeCall.status === "calling")) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`flex items-center gap-2 ${className}`}
      >
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border font-bold gap-1.5 px-3 py-1.5 rounded-xl text-xs animate-pulse">
          <PhoneCall size={12} className="text-emerald-600" />
          Call Scheduled
        </Badge>
        <button
          onClick={cancelCall}
          className="text-muted-foreground hover:text-destructive transition-colors"
          title="Cancel call"
        >
          <X size={14} />
        </button>
      </motion.div>
    );
  }

  if (activeCall?.status === "completed") {
    return (
      <Badge className="bg-blue-50 text-blue-700 border-blue-200 border font-bold gap-1.5 px-3 py-1.5 rounded-xl text-xs">
        <CheckCircle2 size={12} />
        Booked via Call
      </Badge>
    );
  }

  return (
    <>
      {/* Trigger Button */}
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className={`gap-2 font-bold border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 rounded-xl transition-all ${className}`}
      >
        <Phone size={15} />
        Book via Call
      </Button>

      {/* Confirmation Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-8">
            <DialogHeader className="mb-6">
              <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <PhoneCall size={28} className="text-emerald-600" />
              </div>
              <DialogTitle className="text-xl font-black text-center text-slate-800">
                Book via Phone Call
              </DialogTitle>
              <p className="text-center text-sm text-slate-500 mt-1 font-medium">
                Our AI assistant will call you to complete the booking
              </p>
            </DialogHeader>

            {/* Phone number display */}
            <div className="bg-white rounded-2xl border border-emerald-100 p-4 mb-4 shadow-sm">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Calling number</p>
              <div className="flex items-center gap-2">
                <Phone size={16} className="text-emerald-600" />
                <span className="font-black text-slate-800 text-base">
                  {userMobile || "Your registered number"}
                </span>
              </div>
              {!userMobile && (
                <p className="text-xs text-amber-600 font-semibold mt-1.5">
                  ⚠ Add your mobile number in Profile to use this feature
                </p>
              )}
            </div>

            {/* What the AI will do */}
            <div className="space-y-2 mb-6">
              {[
                "Identity is pre-verified — no name needed",
                "Helps select hospital, date & time slot",
                "Confirms before creating the appointment",
              ].map((point, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                  <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-emerald-700 text-[10px] font-black">{i + 1}</span>
                  </div>
                  {point}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl h-12 font-bold border-slate-200"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-[2] rounded-xl h-12 font-black bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-lg shadow-emerald-200"
                onClick={initiateCall}
                disabled={loading || !userMobile}
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Calling...</>
                ) : (
                  <><PhoneCall size={16} /> Call Me Now</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

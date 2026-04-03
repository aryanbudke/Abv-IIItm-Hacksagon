"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  GitBranch, Plus, Play, Pause, Trash2, Search,
  Zap, Clock, CheckCircle2, XCircle, ChevronRight,
  Phone, Bell, MoreHorizontal,
  Activity, TrendingUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Workflow, TriggerType } from "@/lib/types/workflow";
import { DoctorWorkflowNavbar } from "@/components/doctor/DoctorWorkflowNavbar";

const TRIGGER_LABELS: Record<TriggerType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  lab_results_received: { label: "Lab Results", icon: Activity, color: "text-primary", bg: "bg-primary/10" },
  abnormal_result_detected: { label: "Abnormal Result", icon: Bell, color: "text-[#DC2626]", bg: "bg-[#FEE2E2]" },
  follow_up_due: { label: "Follow-Up Due", icon: Clock, color: "text-[#D97706]", bg: "bg-[#FEF3C7]" },
  appointment_missed: { label: "Appt Missed", icon: XCircle, color: "text-[#DC2626]", bg: "bg-[#FEE2E2]" },
  new_patient_registered: { label: "New Patient", icon: TrendingUp, color: "text-[#16A34A]", bg: "bg-[#DCFCE7]" },
  prescription_expiring: { label: "Rx Expiring", icon: Bell, color: "text-[#D97706]", bg: "bg-[#FEF3C7]" },
  appointment_confirmed: { label: "Appt Confirmed", icon: CheckCircle2, color: "text-[#16A34A]", bg: "bg-[#DCFCE7]" },
  appointment_cancelled: { label: "Appt Cancelled", icon: XCircle, color: "text-[#DC2626]", bg: "bg-[#FEE2E2]" },
  queue_joined: { label: "Queue Joined", icon: Activity, color: "text-primary", bg: "bg-primary/10" },
  patient_called: { label: "Patient Called", icon: Phone, color: "text-[#0097a7]", bg: "bg-[#b2ebf2]" },
  patient_no_show: { label: "No Show", icon: Bell, color: "text-[#D97706]", bg: "bg-[#FEF3C7]" },
  manual: { label: "Manual", icon: Zap, color: "text-[#8B5CF6]", bg: "bg-[#EDE9FE]" },
};

interface DoctorProfile { id: string; name: string; hospital_id: string | null; }

export default function DoctorWorkflowsPage() {
  const router = useRouter();
  const { user } = useUser();
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  // Step 1: resolve the doctor's DB UUID from the doctors table
  useEffect(() => {
    if (!user?.primaryEmailAddress?.emailAddress) return;
    supabase
      .from("doctors")
      .select("id, name, hospital_id")
      .eq("email", user.primaryEmailAddress.emailAddress)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setProfileError(true); setLoading(false); return; }
        setDoctorProfile(data);
      });
  }, [user?.primaryEmailAddress?.emailAddress]);

  // Step 2: fetch workflows once we have the UUID
  useEffect(() => {
    if (!doctorProfile?.id) return;
    fetchWorkflows(doctorProfile.id);
  }, [doctorProfile?.id]);

  const fetchWorkflows = async (doctorUUID: string) => {
    try {
      const { data } = await supabase
        .from("workflows")
        .select("*")
        .eq("doctor_id", doctorUUID)
        .order("updated_at", { ascending: false });
      setWorkflows(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createWorkflow = async () => {
    if (!doctorProfile?.id) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("workflows")
        .insert({
          name: "New Workflow",
          description: "",
          doctor_id: doctorProfile.id,   // ← UUID, not Clerk string
          status: "draft",
          trigger_type: "manual",
          nodes: [],
          edges: [],
          execution_count: 0,
        })
        .select()
        .single();
      if (error) {
        console.error("SUPABASE ERROR:", error.message, error.code, error.details, error.hint);
        throw new Error(error.message);
      }
      router.push(`/doctor/workflows/${data.id}`);
    } catch (err) {
      console.error("CREATE WORKFLOW ERROR:", err instanceof Error ? err.message : err);
      setCreating(false);
    }
  };

  const toggleStatus = async (wf: Workflow) => {
    const newStatus = wf.status === "active" || wf.status === "ENABLED" ? "inactive" : "active";
    try {
      await supabase.from("workflows").update({ status: newStatus }).eq("id", wf.id);
      setWorkflows(prev =>
        prev.map(w => w.id === wf.id ? { ...w, status: newStatus as Workflow["status"] } : w)
      );
    } catch (err) {
      console.error(err);
    }
  };

  const deleteWorkflow = async (id: string) => {
    setIdToDelete(id);
    setShowDeleteConfirm(true);
  };

  const doDelete = async () => {
    if (!idToDelete) return;
    try {
      const { error } = await supabase.from("workflows").delete().eq("id", idToDelete);
      if (error) throw error;
      setWorkflows(prev => prev.filter(w => w.id !== idToDelete));
      toast.success("Workflow deleted successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete workflow");
    } finally {
      setIdToDelete(null);
    }
  };

  const filtered = workflows.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    (w.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: workflows.length,
    active: workflows.filter(w => w.status === "active" || w.status === "ENABLED").length,
    totalRuns: workflows.reduce((s, w) => s + (w.execution_count || 0), 0),
  };

  if (profileError) {
    return (
      <div className="min-h-screen bg-[#F4F7FB]">
        <DoctorWorkflowNavbar title="Doctor Workflows" />
        <div className="p-6 flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
            <GitBranch size={24} className="text-destructive" />
          </div>
          <h3 className="text-base font-bold text-foreground mb-1">Doctor profile not found</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Your account is not linked to a doctor profile. Please ask an admin to create your doctor record.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB]">
      <DoctorWorkflowNavbar title="Doctor Workflows" />
      <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">My Workflows</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automate patient interactions using automated calling
          </p>
        </div>
        <Button
          onClick={createWorkflow}
          disabled={creating || !doctorProfile}
          className="bg-primary hover:bg-[#0097a7] text-white shadow-sm gap-2"
        >
          <Plus size={16} />
          {creating ? "Creating..." : "New Workflow"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Workflows", value: stats.total, icon: GitBranch, color: "text-primary", bg: "bg-primary/10" },
          { label: "Active", value: stats.active, icon: Play, color: "text-[#16A34A]", bg: "bg-[#DCFCE7]" },
          { label: "Total Executions", value: stats.totalRuns, icon: TrendingUp, color: "text-[#8B5CF6]", bg: "bg-[#EDE9FE]" },
        ].map(stat => (
          <Card key={stat.label} className="border-border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bg}`}>
                <stat.icon size={18} className={stat.color} />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{stat.label}</p>
                <p className={`text-2xl font-black tracking-tight ${stat.color}`}>{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search workflows..."
          className="pl-9 h-9 border-border text-sm bg-card"
        />
      </div>

      <Separator className="bg-[#DDE3EE]" />

      {/* Workflow list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="border-border">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-72" />
                    <Skeleton className="h-6 w-28" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <GitBranch size={28} className="text-primary" />
          </div>
          <h3 className="text-base font-bold text-foreground mb-1">
            {search ? "No workflows match your search" : "No workflows yet"}
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            {search
              ? "Try a different search term."
              : "Create your first AI workflow to automate patient communication with ElevenLabs."}
          </p>
          {!search && (
            <Button
              onClick={createWorkflow}
              disabled={creating}
              className="bg-primary hover:bg-[#0097a7] text-white gap-2"
            >
              <Plus size={16} />
              Create First Workflow
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((wf, i) => {
              const trigger = TRIGGER_LABELS[wf.trigger_type] ?? TRIGGER_LABELS.manual;
              const TriggerIcon = trigger.icon;
              const isActive = wf.status === "active" || wf.status === "ENABLED";
              const isDraft = wf.status === "draft" || wf.status === "DRAFT";
              return (
                <motion.div
                  key={wf.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className="border-border shadow-sm hover:shadow-md hover:border-[#00bcd4]/30 transition-all group">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        {/* Trigger icon */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${trigger.bg}`}>
                          <TriggerIcon size={18} className={trigger.color} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="text-sm font-bold text-foreground">{wf.name}</h3>
                            <Badge
                              className={
                                isActive
                                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px] font-bold"
                                  : isDraft
                                  ? "bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] font-bold"
                                  : "bg-muted text-muted-foreground border-border text-[10px] font-bold"
                              }
                            >
                              {wf.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                            {wf.description || "No description"}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                            <span className={`flex items-center gap-1 font-semibold ${trigger.color}`}>
                              <TriggerIcon size={11} />
                              {trigger.label}
                            </span>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Activity size={11} />
                              {wf.execution_count || 0} runs
                            </span>
                            {wf.last_run_at && (
                              <>
                                <span>·</span>
                                <span className="flex items-center gap-1">
                                  <Clock size={11} />
                                  Last: {new Date(wf.last_run_at).toLocaleDateString()}
                                </span>
                              </>
                            )}
                            <span>·</span>
                            <span>{wf.nodes?.length || 0} nodes</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs border-border hover:border-[#00bcd4] hover:text-[#006064] gap-1.5"
                          >
                            <Link href={`/doctor/workflows/${wf.id}`}>
                              Edit <ChevronRight size={13} />
                            </Link>
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal size={15} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onClick={() => toggleStatus(wf)}
                                className="gap-2 text-sm cursor-pointer"
                              >
                                {isActive ? (
                                  <><Pause size={13} /> Deactivate</>
                                ) : (
                                  <><Play size={13} /> Activate</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => deleteWorkflow(wf.id)}
                                className="gap-2 text-sm text-[#DC2626] focus:text-[#DC2626] cursor-pointer"
                              >
                                <Trash2 size={13} /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
          })}
          </AnimatePresence>
        </div>
      )}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Workflow"
        description="Are you sure you want to delete this workflow? This action cannot be undone."
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={doDelete}
        confirmText="Delete"
        confirmVariant="destructive"
      />
      </div>
    </div>
  );
}

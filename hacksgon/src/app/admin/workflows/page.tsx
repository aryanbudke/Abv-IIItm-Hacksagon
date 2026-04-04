"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  GitBranch, Plus, Play, Pause, Trash2, Search,
  Zap, Clock, CheckCircle2, XCircle, ChevronRight,
  Phone, Bell, MoreHorizontal,
  Activity, TrendingUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Stethoscope } from "lucide-react";
import type { Workflow, TriggerType } from "@/lib/types/workflow";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";

interface DoctorOption {
  id: string;
  name: string;
  specialization?: string;
}

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

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForDoctor, setCreateForDoctor] = useState<string>("__none__");
  const [doctorNames, setDoctorNames] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkflows();
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    const { data } = await supabase
      .from("doctors")
      .select("id, name, specialization")
      .order("name");
    const list = data || [];
    setDoctors(list);
    const map: Record<string, string> = {};
    list.forEach((d: DoctorOption) => { map[d.id] = d.name; });
    setDoctorNames(map);
  };

  const fetchWorkflows = async () => {
    try {
      const { data } = await supabase
        .from("workflows")
        .select("*")
        .order("updated_at", { ascending: false });
      setWorkflows(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createWorkflow = async () => {
    setCreating(true);
    try {
      const doctorId = createForDoctor === "__none__" ? null : createForDoctor;
      const { data, error } = await supabase
        .from("workflows")
        .insert({
          name: "New Workflow",
          description: "",
          status: "draft",
          trigger_type: "manual",
          nodes: [],
          edges: [],
          execution_count: 0,
          ...(doctorId ? { doctor_id: doctorId } : {}),
        })
        .select()
        .single();
      if (error) throw error;
      setShowCreateDialog(false);
      router.push(`/admin/workflows/${data.id}`);
    } catch (err) {
      console.error(err);
      setCreating(false);
    }
  };

  const assignToDoctor = async (wfId: string, doctorId: string) => {
    await supabase.from("workflows").update({ doctor_id: doctorId }).eq("id", wfId);
    setWorkflows(prev => prev.map(w => w.id === wfId ? { ...w, doctor_id: doctorId } : w));
  };

  const toggleStatus = async (wf: Workflow) => {
    const newStatus = (wf.status === "active" || wf.status === "ENABLED") ? "inactive" : "active";
    try {
      await supabase.from("workflows").update({ status: newStatus }).eq("id", wf.id);
      setWorkflows(prev => prev.map(w => w.id === wf.id ? { ...w, status: newStatus as any } : w));
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
    w.description?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: workflows.length,
    active: workflows.filter(w => w.status === "active" || w.status === "ENABLED").length,
    totalRuns: workflows.reduce((s, w) => s + (w.execution_count || 0), 0),
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Create Workflow Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch size={16} className="text-primary" /> New Workflow
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Assign to Doctor <span className="font-normal normal-case text-muted-foreground/60">(optional)</span>
              </Label>
              <Select value={createForDoctor} onValueChange={setCreateForDoctor}>
                <SelectTrigger className="h-9 text-sm border-border">
                  <SelectValue placeholder="No doctor — admin workflow" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No doctor — admin workflow</SelectItem>
                  {doctors.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      <div className="flex items-center gap-2">
                        <Stethoscope size={13} className="text-muted-foreground" />
                        <span>{d.name}</span>
                        {d.specialization && (
                          <span className="text-muted-foreground text-xs">· {d.specialization}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {createForDoctor === "__none__"
                  ? "This workflow will be visible to all admins only."
                  : `The doctor will be able to see and edit this workflow in their dashboard.`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={createWorkflow}
              disabled={creating}
              className="bg-primary hover:bg-[#0097a7] text-white gap-1.5"
            >
              <Plus size={14} />
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">AI Workflows</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Automate patient interactions using ElevenLabs AI calling</p>
        </div>
        <Button
          onClick={() => { setCreateForDoctor("__none__"); setShowCreateDialog(true); }}
          disabled={creating}
          className="bg-primary hover:bg-[#0097a7] text-white shadow-sm gap-2 w-full sm:w-auto"
        >
          <Plus size={16} />
          New Workflow
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Total Workflows", value: stats.total, icon: GitBranch, color: "text-primary", bg: "bg-primary/10" },
          { label: "Active", value: stats.active, icon: Play, color: "text-[#16A34A]", bg: "bg-[#DCFCE7]" },
          { label: "Total Executions", value: stats.totalRuns, icon: TrendingUp, color: "text-[#8B5CF6]", bg: "bg-[#EDE9FE]" },
        ].map((stat) => (
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
      <div className="relative w-full sm:max-w-sm">
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
            {search ? "Try a different search term." : "Create your first AI workflow to automate patient communication with ElevenLabs."}
          </p>
          {!search && (
            <Button onClick={createWorkflow} disabled={creating} className="bg-primary hover:bg-[#0097a7] text-white gap-2">
              <Plus size={16} />
              Create First Workflow
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((wf, i) => {
              const trigger = TRIGGER_LABELS[wf.trigger_type] || TRIGGER_LABELS.manual;
              const TriggerIcon = trigger.icon;
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
                      <div className="flex flex-col sm:flex-row items-start gap-4">
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${trigger.bg}`}>
                          <TriggerIcon size={18} className={trigger.color} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="text-sm font-bold text-foreground">{wf.name}</h3>
                            <Badge
                              className={
                                (wf.status === "active" || wf.status === "ENABLED")
                                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px] font-bold"
                                  : (wf.status === "draft" || wf.status === "DRAFT")
                                  ? "bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] font-bold"
                                  : "bg-muted text-muted-foreground border-border text-[10px] font-bold"
                              }
                            >
                              {wf.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{wf.description || "No description"}</p>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                            <div className={`flex items-center gap-1 font-semibold ${trigger.color}`}>
                              <TriggerIcon size={11} />
                              {trigger.label}
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
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
                          {wf.doctor_id && doctorNames[wf.doctor_id] && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <div className="flex items-center gap-1 text-[11px] bg-[#e0f7fa] text-[#006064] border border-[#00bcd4]/30 rounded-full px-2 py-0.5">
                                <Stethoscope size={10} />
                                <span className="font-semibold">{doctorNames[wf.doctor_id]}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-start ml-auto">
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs border-border hover:border-[#00bcd4] hover:text-[#006064] gap-1.5"
                          >
                            <Link href={`/admin/workflows/${wf.id}`}>
                              Edit <ChevronRight size={13} />
                            </Link>
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal size={15} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onClick={() => toggleStatus(wf)} className="gap-2 text-sm cursor-pointer">
                                {wf.status === "active" ? <><Pause size={13} /> Deactivate</> : <><Play size={13} /> Activate</>}
                              </DropdownMenuItem>
                              {doctors.length > 0 && (
                                <>
                                  <DropdownMenuSeparator />
                                  {doctors.slice(0, 5).map(d => (
                                    <DropdownMenuItem
                                      key={d.id}
                                      onClick={() => assignToDoctor(wf.id, d.id)}
                                      className="gap-2 text-sm cursor-pointer"
                                    >
                                      <Stethoscope size={13} />
                                      Assign to {d.name.split(" ")[0]}
                                    </DropdownMenuItem>
                                  ))}
                                </>
                              )}
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
  );
}

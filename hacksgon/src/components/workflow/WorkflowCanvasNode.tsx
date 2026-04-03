"use client";

import type { ElementType } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle,
  Clock,
  Database,
  GitBranch,
  Mail,
  Phone,
  Settings,
  Webhook,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CanvasNodeData = Record<string, unknown> & {
  label?: string;
  nodeType?: string;
  description?: string;
};

type NodeVisual = {
  badge: string;
  icon: ElementType;
  tone: string;
};

const VISUALS: Record<string, NodeVisual> = {
  trigger: { badge: "Trigger", icon: Webhook, tone: "emerald" },
  manual: { badge: "Trigger", icon: Webhook, tone: "emerald" },
  lab_results_received: { badge: "Trigger", icon: Webhook, tone: "emerald" },
  abnormal_result_detected: { badge: "Trigger", icon: Webhook, tone: "emerald" },
  follow_up_due: { badge: "Trigger", icon: Webhook, tone: "emerald" },
  appointment_missed: { badge: "Trigger", icon: Webhook, tone: "emerald" },
  new_patient_registered: { badge: "Trigger", icon: Webhook, tone: "emerald" },
  prescription_expiring: { badge: "Trigger", icon: Webhook, tone: "emerald" },
  appointment_confirmed: { badge: "Trigger", icon: Webhook, tone: "emerald" },
  appointment_cancelled: { badge: "Trigger", icon: Webhook, tone: "emerald" },
  queue_joined: { badge: "Trigger", icon: Webhook, tone: "emerald" },
  patient_called: { badge: "Trigger", icon: Webhook, tone: "emerald" },
  patient_no_show: { badge: "Trigger", icon: Webhook, tone: "emerald" },
  ai_call: { badge: "Action", icon: Phone, tone: "blue" },
  call_patient: { badge: "Action", icon: Phone, tone: "blue" },
  schedule_appointment: { badge: "Action", icon: Calendar, tone: "blue" },
  update_record: { badge: "Action", icon: Database, tone: "blue" },
  update_patient_record: { badge: "Action", icon: Database, tone: "blue" },
  send_notification: { badge: "Action", icon: Bell, tone: "blue" },
  send_sms: { badge: "Action", icon: Mail, tone: "blue" },
  create_lab_order: { badge: "Action", icon: Database, tone: "blue" },
  create_referral: { badge: "Action", icon: ArrowRight, tone: "blue" },
  assign_to_staff: { badge: "Action", icon: Settings, tone: "blue" },
  delay: { badge: "Action", icon: Clock, tone: "indigo" },
  condition: { badge: "Condition", icon: GitBranch, tone: "amber" },
  check_patient_age: { badge: "Condition", icon: GitBranch, tone: "amber" },
  check_insurance: { badge: "Condition", icon: GitBranch, tone: "amber" },
  check_appointment_history: { badge: "Condition", icon: GitBranch, tone: "amber" },
  check_result_values: { badge: "Condition", icon: GitBranch, tone: "amber" },
  check_medication_list: { badge: "Condition", icon: GitBranch, tone: "amber" },
  end: { badge: "Output", icon: CheckCircle, tone: "purple" },
  send_summary_to_doctor: { badge: "Output", icon: Bell, tone: "purple" },
  generate_transcript: { badge: "Output", icon: Mail, tone: "purple" },
  create_report: { badge: "Output", icon: Zap, tone: "purple" },
  log_completion: { badge: "Output", icon: CheckCircle, tone: "purple" },
};

const TONE_CLASSES: Record<string, string> = {
  emerald: "border-emerald-400/40 bg-emerald-400/10 text-emerald-500",
  blue: "border-sky-400/40 bg-sky-400/10 text-sky-500",
  amber: "border-amber-400/40 bg-amber-400/10 text-amber-500",
  purple: "border-violet-400/40 bg-violet-400/10 text-violet-500",
  indigo: "border-indigo-400/40 bg-indigo-400/10 text-indigo-500",
};

function resolveKind(type?: string, nodeType?: string) {
  if (type === "conditional" || nodeType === "condition") return "condition";
  if (type === "trigger") return nodeType ?? "trigger";
  if (type === "endpoint") return "end";
  if (type === "action") return nodeType ?? "ai_call";
  return nodeType ?? type ?? "trigger";
}

export function WorkflowCanvasNode({
  data,
  type,
  selected,
}: NodeProps) {
  const nodeData = data as CanvasNodeData;
  const kind = resolveKind(type, nodeData.nodeType);
  const visual = VISUALS[kind] ?? { badge: "Node", icon: Zap, tone: "blue" };
  const tone = TONE_CLASSES[visual.tone] ?? TONE_CLASSES.blue;
  const Icon = visual.icon;
  const label = nodeData.label ?? "Workflow Step";
  const description = nodeData.description ?? "Configure this step in the properties panel.";
  const isCondition = type === "conditional" || nodeData.nodeType === "condition";
  const isTrigger = type === "trigger" || nodeData.nodeType === "trigger";
  const isTerminal = type === "endpoint" || nodeData.nodeType === "end";

  return (
    <div className="relative w-[200px]">
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-3 !w-3 !border-2 !border-background !bg-cyan-500"
        />
      )}

      <Card
        className={cn(
          "group/node relative overflow-hidden rounded-xl border bg-background/90 p-3 shadow-sm backdrop-blur transition-all",
          tone,
          selected && "ring-2 ring-primary/50 shadow-xl"
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />

        <div className="relative space-y-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-background/80 backdrop-blur",
                tone
              )}
              aria-hidden="true"
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <Badge
                variant="outline"
                className="mb-0.5 rounded-full border-border/40 bg-background/80 px-1.5 py-0 text-[9px] uppercase tracking-[0.15em] text-foreground/60"
              >
                {visual.badge}
              </Badge>
              <h3 className="truncate text-xs font-semibold tracking-tight text-foreground">
                {label}
              </h3>
            </div>
          </div>

          <p className="line-clamp-2 text-[10px] leading-relaxed text-foreground/70">
            {description}
          </p>

          <div className="flex items-center gap-1.5 text-[10px] text-foreground/50">
            <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
            <span className="uppercase tracking-[0.1em]">
              {isCondition ? "Branch" : isTerminal ? "Output" : "Connected"}
            </span>
          </div>
        </div>
      </Card>

      {isCondition ? (
        <>
          <Handle
            id="true"
            type="source"
            position={Position.Bottom}
            style={{ left: "32%" }}
            className="!h-3 !w-3 !border-2 !border-background !bg-emerald-500"
          />
          <Handle
            id="false"
            type="source"
            position={Position.Bottom}
            style={{ left: "68%" }}
            className="!h-3 !w-3 !border-2 !border-background !bg-rose-500"
          />
        </>
      ) : !isTerminal ? (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-3 !w-3 !border-2 !border-background !bg-cyan-500"
        />
      ) : null}
    </div>
  );
}

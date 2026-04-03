"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type Connection,
  MarkerType,
  Panel,
} from "@xyflow/react";

type WFNodeData = Record<string, unknown>;

import "@xyflow/react/dist/style.css";
import dagre from "dagre";
// import { N8nWorkflowBlock } from "@/components/ui/n8n-workflow-block-shadcnui";
import { WorkflowCanvasNode } from "@/components/workflow/WorkflowCanvasNode";
import {
  ArrowLeft, Save, Trash2,
  GitBranch, Zap, CheckCircle, Plus,
  X, Loader2, Stethoscope, Undo2, Redo2, Trash, RefreshCw, Search, Play
} from "lucide-react";

interface DoctorOption { id: string; name: string; specialization?: string; }
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { NODE_CATALOGUE } from "@/lib/workflow/nodeCatalogue";
import type { Workflow, TriggerType, NodeBlueprint } from "@/lib/types/workflow";

const NodeIcon = ({ name, className }: { name: string; className?: string }) => {
  switch (name) {
    case 'zap':          return <Zap className={className} />;
    case 'git-branch':   return <GitBranch className={className} />;
    case 'play':         return <Play className={className} />;
    case 'check-circle': return <CheckCircle className={className} />;
    default:             return <Zap className={className} />;
  }
};

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { MobileCanvasBlock } from "@/components/workflow/MobileCanvasBlock";

const PARAM_LABELS: Record<string, string> = {
  test_name: "Test name",
  threshold: "Minimum value",
  threshold_max: "Maximum value",
  insurance_type: "Insurance plan",
  days_since_last: "Days since last visit",
  medication: "Medicine name",
  message: "Message",
  call_reason: "Reason for call",
  lab_result_summary: "Lab result summary",
  available_slots: "Available appointment slots",
  facility_name: "Facility name",
  facility_address: "Facility address",
  facility_phone_number: "Facility phone number",
  date: "Appointment date",
  time_slot: "Appointment time",
  recipient: "Send to",
  priority: "Priority",
  test_type: "Lab test",
  notes: "Notes",
  specialty: "Specialty",
  reason: "Reason",
  urgency: "Urgency",
  staff_id: "Staff member ID",
  task_type: "Task type",
  due_date: "Due date",
  risk_level: "Risk level",
  title: "Report title",
  operator: "Rule",
};

const PARAM_PLACEHOLDERS: Record<string, string> = {
  test_name: "Example: HbA1c",
  threshold: "Example: 6.5",
  threshold_max: "Example: 8.0",
  insurance_type: "Example: MediAssist",
  days_since_last: "Example: 90",
  medication: "Example: Metformin",
  message: "Write the message to send",
  call_reason: "Explain why the patient is being called",
  lab_result_summary: "Short summary the AI can mention in the call",
  available_slots: "Example: Monday 10:00 AM, Wednesday 2:00 PM",
  facility_name: "Example: City Care Hospital",
  facility_address: "Enter the hospital or clinic address",
  facility_phone_number: "Example: +91 9876543210",
  date: "YYYY-MM-DD",
  time_slot: "Example: 10:30 AM",
  test_type: "Example: Complete blood count",
  notes: "Add any helpful note for the team",
  specialty: "Example: Cardiology",
  reason: "Why is this step needed?",
  staff_id: "Enter the staff member ID",
  task_type: "Example: Follow-up call",
  due_date: "YYYY-MM-DD",
  risk_level: "Example: high",
  title: "Example: Follow-up summary",
};

function getParamLabel(key: string) {
  return PARAM_LABELS[key] || key.replace(/_/g, " ");
}

function getParamPlaceholder(key: string) {
  return PARAM_PLACEHOLDERS[key] || `Enter ${getParamLabel(key).toLowerCase()}...`;
}

/* ── Auto-layout with dagre ─────────────────────────── */
function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach(n => g.setNode(n.id, { width: 200, height: 70 }));
  edges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map(n => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - 100, y: pos.y - 35 } };
  });
}

const NODE_TYPES = {
  trigger: WorkflowCanvasNode,
  action: WorkflowCanvasNode,
  conditional: WorkflowCanvasNode,
  endpoint: WorkflowCanvasNode,
};

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  triggers:   { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200",   label: "Triggers" },
  conditions: { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  label: "Conditions" },
  actions:    { bg: "bg-teal-50",   text: "text-teal-700",   border: "border-teal-200",   label: "Actions" },
  outputs:    { bg: "bg-gray-50",   text: "text-gray-600",   border: "border-gray-200",   label: "Outputs" },
};

const CATEGORY_ORDER = ["triggers", "conditions", "actions", "outputs"] as const;

function buildNodeFromBlueprint(
  blueprint: NodeBlueprint,
  position: { x: number; y: number }
): Node {
  return {
    id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: blueprint.reactFlowType,
    position,
    data: {
      label: blueprint.label,
      nodeType: blueprint.nodeType,
      description: blueprint.description,
      params: { ...blueprint.params },
    },
  };
}

/* ── Workflow Builder Inner ── */
function WorkflowBuilderInner() {
  const params = useParams();
  const router = useRouter();
  const { screenToFlowPosition, fitView } = useReactFlow();
  const workflowId = params.id as string;

  const [, setWorkflow] = useState<Workflow | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<TriggerType>("manual");
  const [status, setStatus] = useState<"active" | "inactive" | "draft">("draft");
  const [assignedDoctorId, setAssignedDoctorId] = useState<string>("__none__");
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<WFNodeData>>([] as Node<WFNodeData>[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([] as Edge[]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Undo/Redo State
  const historyRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const futureRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);

  const pushHistory = useCallback((n: Node[], e: Edge[]) => {
    historyRef.current.push({ nodes: [...n], edges: [...e] });
    futureRef.current = [];
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current.pop()!;
    futureRef.current.push({ nodes: [...nodes], edges: [...edges] });
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setSelectedNode(null);
  }, [nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current.pop()!;
    historyRef.current.push({ nodes: [...nodes], edges: [...edges] });
    setNodes(next.nodes);
    setEdges(next.edges);
    setSelectedNode(null);
  }, [nodes, edges, setNodes, setEdges]);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.shiftKey && e.key === "z") { e.preventDefault(); redo(); }
      else if (meta && e.key === "z") { e.preventDefault(); undo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  useEffect(() => {
    fetchWorkflow();
    fetchDoctors();
  }, [workflowId]);

  const fetchDoctors = async () => {
    const { data } = await supabase.from("doctors").select("id, name, specialization").order("name");
    setDoctors(data || []);
  };

  const fetchWorkflow = async () => {
    const { data } = await supabase.from("workflows").select("*").eq("id", workflowId).single();
    if (!data) { router.push("/admin/workflows"); return; }
    setWorkflow(data);
    setName(data.name);
    setDescription(data.description || "");
    setTriggerType(data.trigger_type);
    setStatus(data.status);
    setAssignedDoctorId(data.doctor_id || "__none__");

    const rawNodes: Node[] = (data.nodes || []).map((n: any) => {
      const storedNodeType = n.data?.nodeType || n.type;
      const blueprint = Object.values(NODE_CATALOGUE).find(bp => bp.nodeType === storedNodeType);
      return {
        id: n.id,
        type: blueprint?.reactFlowType || n.type || "action",
        position: n.position,
        data: {
          label: n.data?.label || n.label || blueprint?.label || "Workflow Step",
          nodeType: storedNodeType,
          description: n.data?.description || blueprint?.description || "",
          params: n.data?.params || blueprint?.params || {},
        },
      };
    });
    const rawEdges: Edge[] = (data.edges || []).map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      sourceHandle: e.sourceHandle || undefined,
      targetHandle: e.targetHandle || undefined,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#00bcd4" },
      style: { stroke: "#00bcd4", strokeWidth: 2 },
    }));
    setNodes(rawNodes);
    setEdges(rawEdges);
    setLoading(false);
  };

  const onConnect = useCallback(
    (params: Connection) => {
      pushHistory(nodes, edges);
      setEdges(eds =>
        addEdge({
          ...params,
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: "#00bcd4" },
          style: { stroke: "#00bcd4", strokeWidth: 2 },
        } as Edge, eds)
      );
    },
    [nodes, edges, pushHistory, setEdges]
  );

  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    style: CATEGORY_STYLES[cat],
    nodes: Object.values(NODE_CATALOGUE).filter(bp =>
      bp.category === cat &&
      (bp.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
       bp.description.toLowerCase().includes(searchTerm.toLowerCase()))
    ),
  })).filter(group => group.nodes.length > 0);

  const triggerBlueprints = Object.values(NODE_CATALOGUE).filter(
    bp => bp.category === "triggers"
  );

  const workflowTriggerNode = nodes.find(n => n.type === "trigger");
  const workflowTriggerLabel =
    (workflowTriggerNode?.data?.label as string | undefined) || "No trigger added";

  const addNode = (blueprint: NodeBlueprint, position?: { x: number, y: number }) => {
    pushHistory(nodes, edges);
    const newNode = buildNodeFromBlueprint(blueprint, position || {
      x: 100 + nodes.length * 40,
      y: 100 + nodes.length * 60,
    });
    setNodes(nds => [...nds, newNode]);
  };

  const onDragStart = (e: React.DragEvent, blueprint: NodeBlueprint) => {
    e.dataTransfer.setData("application/reactflow", JSON.stringify(blueprint));
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/reactflow");
    if (!raw) return;
    const blueprint: NodeBlueprint = JSON.parse(raw);
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addNode(blueprint, position);
  }, [screenToFlowPosition, nodes, addNode]);

  const addTriggerNode = () => {
    const blueprint = triggerBlueprints[0];
    if (!blueprint) return;
    addNode(blueprint);
  };

  const deleteNode = (id: string) => {
    pushHistory(nodes, edges);
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    if (selectedNode?.id === id) setSelectedNode(null);
  };

  const updateNodeLabel = (id: string, label: string) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, label } } : n));
    setSelectedNode(prev => prev?.id === id ? { ...prev, data: { ...prev.data, label } } : prev);
  };

  const runAutoLayout = () => {
    pushHistory(nodes, edges);
    const laid = autoLayout(nodes, edges);
    setNodes(laid);
    setTimeout(() => fitView({ padding: 0.2 }), 100);
  };

  const clearCanvas = () => {
    setShowClearConfirm(true);
  };

  const doClearCanvas = () => {
    pushHistory(nodes, edges);
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const firstTrigger = nodes.find(n =>
        Object.values(NODE_CATALOGUE).some(
          bp => bp.category === "triggers" && bp.nodeType === (n.data?.nodeType as string | undefined)
        )
      );
      const derivedTriggerType = ((firstTrigger?.data?.nodeType as string | undefined) || triggerType) as TriggerType;

      const serializedNodes = nodes.map(n => ({
        id: n.id,
        type: n.type,
        label: n.data.label as string,
        position: n.position,
        data: { ...n.data },
      }));
      const serializedEdges = edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label || "",
        sourceHandle: e.sourceHandle || null,
        targetHandle: e.targetHandle || null,
      }));

      await supabase.from("workflows").update({
        name,
        description,
        trigger_type: derivedTriggerType,
        status,
        nodes: serializedNodes,
        edges: serializedEdges,
        updated_at: new Date().toISOString(),
        doctor_id: assignedDoctorId === "__none__" ? null : assignedDoctorId,
      }).eq("id", workflowId);

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const selectedData = selectedNode?.data as Record<string, unknown> | undefined;
  const selectedBlueprint = Object.values(NODE_CATALOGUE).find(
    bp => bp.nodeType === (selectedData?.nodeType as string | undefined)
  );
  const selectedStyle = selectedBlueprint
    ? CATEGORY_STYLES[selectedBlueprint.category]
    : null;
  const selectedParams = (selectedData?.params as Record<string, string> | undefined) || {};

  const updateNodeParam = (id: string, key: string, value: string) => {
    setNodes(nds =>
      nds.map(n => {
        if (n.id !== id) return n;
        const data = (n.data || {}) as Record<string, unknown>;
        const params = ((data.params as Record<string, string> | undefined) || {});
        return { ...n, data: { ...data, params: { ...params, [key]: value } } };
      })
    );
    setSelectedNode(prev => {
      if (!prev || prev.id !== id) return prev;
      const data = (prev.data || {}) as Record<string, unknown>;
      const params = ((data.params as Record<string, string> | undefined) || {});
      return { ...prev, data: { ...data, params: { ...params, [key]: value } } };
    });
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#00bcd4]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden relative">
      <MobileCanvasBlock backUrl="/admin/workflows" />
      {/* Top toolbar */}
      <div className="h-14 bg-card border-b border-border flex items-center px-4 gap-3 shrink-0 z-10">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 h-8">
          <Link href="/admin/workflows">
            <ArrowLeft size={14} /> Back
          </Link>
        </Button>

        <Separator orientation="vertical" className="h-5 bg-[#DDE3EE]" />

        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          className="h-8 w-52 text-sm font-semibold border-border focus:border-[#00bcd4]"
          placeholder="Workflow name..."
        />

        <Badge variant="outline" className="h-8 rounded-md px-3 text-xs border-border font-normal">
          Trigger: {workflowTriggerLabel}
        </Badge>

        <Select value={status} onValueChange={v => setStatus(v as typeof status)}>
          <SelectTrigger className="h-8 w-32 text-xs border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft" className="text-xs">Draft</SelectItem>
            <SelectItem value="active" className="text-xs">Active</SelectItem>
            <SelectItem value="inactive" className="text-xs">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-5 bg-[#DDE3EE]" />

        <Select value={assignedDoctorId} onValueChange={setAssignedDoctorId}>
          <SelectTrigger className="h-8 w-44 text-xs border-border gap-1.5">
            <Stethoscope size={12} className="text-muted-foreground shrink-0" />
            <SelectValue placeholder="Assign doctor…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__" className="text-xs text-muted-foreground">No doctor assigned</SelectItem>
            {doctors.map(d => (
              <SelectItem key={d.id} value={d.id} className="text-xs">
                {d.name}{d.specialization ? ` · ${d.specialization}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2 bg-muted/50 p-0.5 rounded-lg border border-border">
            <Button variant="ghost" size="icon" onClick={undo} disabled={historyRef.current.length === 0} title="Undo (Cmd+Z)" className="h-7 w-7">
              <Undo2 size={13} />
            </Button>
            <Button variant="ghost" size="icon" onClick={redo} disabled={futureRef.current.length === 0} title="Redo (Cmd+Shift+Z)" className="h-7 w-7">
              <Redo2 size={13} />
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={addTriggerNode} className="h-8 text-xs border-border gap-1.5 focus-visible:ring-[#00bcd4]">
            <Plus size={13} /> Add Trigger
          </Button>
          <Button variant="outline" size="sm" onClick={runAutoLayout} className="h-8 text-xs border-border gap-1.5">
            <RefreshCw size={13} /> Auto-layout
          </Button>
          <Button variant="outline" size="sm" onClick={clearCanvas} className="h-8 text-xs border-border gap-1.5 text-destructive hover:bg-destructive/5">
            <Trash size={13} /> Clear
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={saving}
            className={cn("h-8 text-xs gap-1.5", saved ? "bg-[#16A34A] hover:bg-[#16A34A]" : "bg-[#00bcd4] hover:bg-[#0097a7]", "text-white")}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <CheckCircle size={13} /> : <Save size={13} />}
            {saving ? "Saving..." : saved ? "Saved!" : "Save"}
          </Button>
        </div>
      </div>

      {/* Builder area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Node palette */}
        <aside className="w-52 bg-card border-r border-border flex flex-col shrink-0 overflow-y-auto">
          <div className="px-3 py-3 border-b border-border space-y-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Node Palette</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Add plain-language workflow steps</p>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search steps..."
                className="h-6 pl-7 text-[10px] border-border bg-muted/30 focus:bg-background"
              />
            </div>
          </div>
          <div className="p-2 space-y-3">
            {grouped.map(group => (
              <div key={group.category}>
                <p className={`text-[10px] font-bold uppercase tracking-wider px-1 mb-1 ${group.style.text}`}>
                  {group.style.label}
                </p>
                <div className="space-y-1">
                  {group.nodes.map(bp => (
                    <div
                      key={bp.nodeType}
                      draggable
                      onDragStart={e => onDragStart(e, bp)}
                      onClick={() => addNode(bp)}
                      className={cn(
                        "w-full flex items-start gap-2 px-2 py-1.5 rounded-lg border text-left transition-all hover:scale-[1.02] cursor-grab active:cursor-grabbing",
                        group.style.bg,
                        group.style.border
                      )}
                    >
                      <div className={cn("mt-0.5 shrink-0", group.style.text)}>
                        <NodeIcon name={bp.icon} className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-[11px] font-semibold leading-tight truncate ${group.style.text}`}>
                          {bp.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-tight truncate">
                          {bp.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-auto px-3 pb-3 pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Click or drag a step to add it. Keep each workflow short and easy for staff to understand.
            </p>
          </div>
        </aside>

        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={NODE_TYPES}
            fitView
            style={{ background: "#F4F7FB" }}
            defaultEdgeOptions={{
              markerEnd: { type: MarkerType.ArrowClosed, color: "#00bcd4" },
              style: { stroke: "#00bcd4", strokeWidth: 2 },
            }}
          >
            <Background color="#DDE3EE" gap={20} size={1} />
            <Controls className="[&>button]:border-border [&>button]:bg-card [&>button]:shadow-sm" />
            <MiniMap
              nodeColor={n => {
                const blueprint = Object.values(NODE_CATALOGUE).find(
                  bp => bp.nodeType === (n.data?.nodeType as string | undefined)
                );
                return blueprint ? "#00bcd4" : "#8692A6";
              }}
              className="border border-border rounded-xl overflow-hidden shadow-sm"
            />
            {/* Canvas is always visible now */}
          </ReactFlow>
        </div>

        {/* Properties panel */}
        {selectedNode && (
          <aside className="w-60 bg-card border-l border-border flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Step Settings</p>
              <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
              {selectedBlueprint && selectedStyle && (
                <div className={cn("flex items-center gap-2.5 p-3 rounded-xl border", selectedStyle.bg, selectedStyle.border)}>
                  <div className={cn("shrink-0", selectedStyle.text)}>
                    <NodeIcon name={selectedBlueprint.icon} className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Step type</p>
                    <p className={cn("text-[13px] font-bold", selectedStyle.text)}>{selectedBlueprint.label}</p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Step name</Label>
                <Input
                  value={(selectedNode.data?.label as string) || ""}
                  onChange={e => updateNodeLabel(selectedNode.id, e.target.value)}
                  className="h-8 text-sm border-border"
                  placeholder="Give this step a clear name"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Step ID</Label>
                <p className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-1.5 rounded-lg border border-border truncate">
                  {selectedNode.id}
                </p>
              </div>

              {selectedBlueprint?.description && (
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">What this step does</Label>
                  <p className="text-[11px] text-muted-foreground bg-muted px-2 py-1.5 rounded-lg border border-border leading-relaxed">
                    {selectedBlueprint.description}
                  </p>
                </div>
              )}

              {Object.keys(selectedParams).length > 0 && (
                <div className="space-y-3">
                  <Separator className="bg-[#DDE3EE]" />
                  {Object.entries(selectedParams).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground capitalize">
                        {getParamLabel(key)}
                      </Label>
                      <Input
                        value={String(value)}
                        onChange={e => updateNodeParam(selectedNode.id, key, e.target.value)}
                        className="h-8 text-xs border-border"
                        placeholder={getParamPlaceholder(key)}
                      />
                    </div>
                  ))}
                </div>
              )}

              <Separator className="bg-[#DDE3EE]" />

              <Button
                variant="outline"
                size="sm"
                onClick={() => deleteNode(selectedNode.id)}
                className="w-full h-8 text-xs text-[#DC2626] border-[#DC2626]/30 hover:bg-[#FEE2E2] gap-1.5"
              >
                <Trash2 size={12} /> Delete Node
              </Button>
            </div>
          </aside>
        )}
      </div>
      {/* ══ CONFIRM CLEAR MODAL ══════════════════════ */}
      <ConfirmDialog
        open={showClearConfirm}
        title="Clear Canvas"
        description="Are you sure you want to clear all nodes and edges? This action can be undone with Cmd+Z."
        onClose={() => setShowClearConfirm(false)}
        onConfirm={doClearCanvas}
        confirmText="Clear All"
        confirmVariant="destructive"
      />
    </div>
  );
}

export default function WorkflowBuilderPage() {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner />
    </ReactFlowProvider>
  );
}

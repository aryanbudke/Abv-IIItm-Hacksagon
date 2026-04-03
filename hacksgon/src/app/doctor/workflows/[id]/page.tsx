"use client";

import {
  useEffect, useState, useCallback, useRef, KeyboardEvent, useMemo,
} from "react";
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
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
// @ts-ignore
import dagre from "dagre";
import {
  ArrowLeft, Save, Trash2, Search, Plus,
  Undo2, Redo2, Play, Loader2, CheckCircle, Zap, GitBranch,
  LayoutDashboard, X, FolderOpen, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { WorkflowCanvasNode } from "@/components/workflow/WorkflowCanvasNode";
import { DoctorWorkflowNavbar } from "@/components/doctor/DoctorWorkflowNavbar";
import { NODE_CATALOGUE } from "@/lib/workflow/nodeCatalogue";
import type { NodeBlueprint } from "@/lib/types/workflow";

const NodeIcon = ({ name, className }: { name: string; className?: string }) => {
  switch (name) {
    case 'zap':          return <Zap className={className} />;
    case 'git-branch':   return <GitBranch className={className} />;
    case 'play':         return <Play className={className} />;
    case 'check-circle': return <CheckCircle className={className} />;
    default:             return <Zap className={className} />;
  }
};

/* ── Types ────────────────────────────────────────────── */
interface NodeData extends Record<string, unknown> {
  label: string;
  nodeType: string;
  description: string;
  params: Record<string, string>;
}

interface HistorySnapshot {
  nodes: Node[];
  edges: Edge[];
}

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { MobileCanvasBlock } from "@/components/workflow/MobileCanvasBlock";

interface PatientRecord {
  id: string;
  name: string;
  email: string;
  patient_id?: string | null;
  mobile?: string | null;
}

interface WorkflowRecord {
  id: string;
  name: string;
  description?: string;
  status: string;
  trigger_type: string;
  nodes: Node[];
  edges: Edge[];
  updated_at: string;
}

interface ManualLabResult {
  id: string;
  test_name: string;
  value: string;
  unit: string;
  reference_range: string;
}

interface CallConfigState {
  configured: boolean;
  missing: string[];
}

function normalizeWorkflowNodeType(nodeType: string) {
  switch (nodeType) {
    case "ai_call":
      return "call_patient";
    case "update_record":
      return "update_patient_record";
    default:
      return nodeType;
  }
}

function createManualLabResult(testName = ""): ManualLabResult {
  return {
    id: `lab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    test_name: testName,
    value: "",
    unit: "",
    reference_range: "",
  };
}

function normalizePhone(value: string) {
  const raw = value.trim();
  if (!raw) return "";

  const compact = raw.replace(/[^\d+]/g, "");
  if (compact.startsWith("+")) {
    return `+${compact.slice(1).replace(/\D/g, "")}`;
  }

  if (compact.startsWith("00")) {
    return `+${compact.slice(2).replace(/\D/g, "")}`;
  }

  const digits = compact.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return raw;
}

function formatSupabaseError(error: unknown) {
  if (!error) return "Unknown save error";
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const e = error as Record<string, unknown>;
    return (
      (typeof e.message === "string" && e.message) ||
      (typeof e.details === "string" && e.details) ||
      (typeof e.hint === "string" && e.hint) ||
      JSON.stringify(e)
    );
  }
  return String(error);
}

const AUTO_EVENT_READY_TRIGGERS = new Set([
  "manual",
  "appointment_confirmed",
  "appointment_cancelled",
  "queue_joined",
  "patient_called",
  "patient_no_show",
]);

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

function getOperatorOptions(nodeType: string) {
  switch (nodeType) {
    case "check_result_values":
      return [
        { value: "greater_than", label: "Above a value" },
        { value: "less_than", label: "Below a value" },
        { value: "in_range", label: "Within a range" },
        { value: "out_of_range", label: "Outside a range" },
      ];
    case "check_insurance":
      return [{ value: "any", label: "Any insurance on file" }];
    default:
      return [
        { value: "greater_than", label: "Above a value" },
        { value: "less_than", label: "Below a value" },
        { value: "equal_to", label: "Exactly equal to" },
        { value: "in_range", label: "Within a range" },
      ];
  }
}

/* ── dagre auto-layout ────────────────────────────────── */
function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach(n => g.setNode(n.id, { width: 200, height: 80 }));
  edges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map(n => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - 100, y: pos.y - 40 } };
  });
}

/* ── Node category styles ─────────────────────────────── */
const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  triggers:   { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200",   label: "Triggers" },
  conditions: { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  label: "Conditions" },
  actions:    { bg: "bg-teal-50",   text: "text-teal-700",   border: "border-teal-200",   label: "Actions" },
  outputs:    { bg: "bg-gray-50",   text: "text-gray-600",   border: "border-gray-200",   label: "Outputs" },
};

const CATEGORY_ORDER = ["triggers", "conditions", "actions", "outputs"] as const;

/* ── nodeTypes map ────────────────────────────────────── */
const NODE_TYPES = {
  trigger: WorkflowCanvasNode,
  action: WorkflowCanvasNode,
  conditional: WorkflowCanvasNode,
  endpoint: WorkflowCanvasNode,
};

/* ── Helper: generate node id ─────────────────────────── */
function genId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function buildNodeFromBlueprint(
  blueprint: NodeBlueprint,
  position: { x: number; y: number }
): Node {
  return {
    id: genId(),
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

/* ── Helper: build a styled edge ─────────────────────── */
function styledEdge(partial: Partial<Edge> & { id: string; source: string; target: string }): Edge {
  return {
    ...partial,
    animated: true,
    style: { stroke: "#00bcd4", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#00bcd4" },
  };
}
function WorkflowBuilderInner() {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const { screenToFlowPosition, fitView } = useReactFlow();

  const workflowId = params.id as string;
  const isNew = workflowId === "new";

  /* ── State ─────────────────────────────────────────── */
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [name, setName] = useState("New Workflow");
  const [description, setDescription] = useState("");
  const [savedId, setSavedId] = useState<string | null>(isNew ? null : workflowId);

  // Save states
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Loading
  const [loading, setLoading] = useState(!isNew);

  // Modals
  const [showNameModal, setShowNameModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);

  // Load modal state
  const [loadList, setLoadList] = useState<WorkflowRecord[]>([]);
  const [loadSearch, setLoadSearch] = useState("");
  const [loadingList, setLoadingList] = useState(false);

  // Run modal state
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [phoneOverride, setPhoneOverride] = useState("");
  const [runResult, setRunResult] = useState<string | null>(null);
  const [callConfig, setCallConfig] = useState<CallConfigState | null>(null);
  const [manualLabResults, setManualLabResults] = useState<ManualLabResult[]>([]);
  const [running, setRunning] = useState(false);

  // Undo/redo
  const historyRef = useRef<HistorySnapshot[]>([]);
  const futureRef = useRef<HistorySnapshot[]>([]);

  /* ── Push to undo history ─────────────────────────── */
  const pushHistory = useCallback((n: Node[], e: Edge[]) => {
    historyRef.current.push({ nodes: n, edges: e });
    futureRef.current = [];
  }, []);

  /* ── Load workflow from Supabase ──────────────────── */
  const loadWorkflow = useCallback(async (id: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      router.push("/doctor/workflows");
      return;
    }

    setName(data.name);
    setDescription(data.description || "");
    setSavedId(data.id);

    const rfNodes: Node[] = (data.nodes || []).map((n: Record<string, unknown>) => ({
      id: n.id as string,
      type: n.type as string,
      position: n.position as { x: number; y: number },
      data: {
        label: (n.data as NodeData)?.label ?? "",
        nodeType: normalizeWorkflowNodeType((n.data as NodeData)?.nodeType ?? ""),
        description: (n.data as NodeData)?.description ?? "",
        params: (n.data as NodeData)?.params ?? {},
      },
    }));

    const rfEdges: Edge[] = (data.edges || []).map((e: Record<string, unknown>) =>
      styledEdge({
        id: e.id as string,
        source: e.source as string,
        target: e.target as string,
        sourceHandle: (e.sourceHandle as string) || undefined,
        targetHandle: (e.targetHandle as string) || undefined,
      })
    );

    setNodes(rfNodes);
    setEdges(rfEdges);
    setLoading(false);
    setTimeout(() => fitView({ padding: 0.2 }), 100);
  }, [router, setNodes, setEdges, fitView]);

  useEffect(() => {
    if (!isNew) {
      loadWorkflow(workflowId);
    }
  }, [isNew, workflowId, loadWorkflow]);

  /* ── Keyboard shortcuts ───────────────────────────── */
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.shiftKey && e.key === "z") { e.preventDefault(); redo(); }
      else if (meta && e.key === "z") { e.preventDefault(); undo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  /* ── Undo ─────────────────────────────────────────── */
  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current.pop()!;
    futureRef.current.push({ nodes: [...nodes], edges: [...edges] });
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setSelectedNode(null);
  }, [nodes, edges, setNodes, setEdges]);

  /* ── Redo ─────────────────────────────────────────── */
  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current.pop()!;
    historyRef.current.push({ nodes: [...nodes], edges: [...edges] });
    setNodes(next.nodes);
    setEdges(next.edges);
    setSelectedNode(null);
  }, [nodes, edges, setNodes, setEdges]);

  /* ── onConnect ────────────────────────────────────── */
  const onConnect = useCallback(
    (connection: Connection) => {
      pushHistory([...nodes], [...edges]);
      setEdges(eds =>
        addEdge(
          styledEdge({
            id: `edge_${Date.now()}`,
            source: connection.source ?? "",
            target: connection.target ?? "",
            sourceHandle: connection.sourceHandle ?? undefined,
            targetHandle: connection.targetHandle ?? undefined,
          }),
          eds
        )
      );
    },
    [nodes, edges, pushHistory, setEdges]
  );

  /* ── Drag & drop from palette ─────────────────────── */
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/reactflow");
      if (!raw) return;
      const blueprint: NodeBlueprint = JSON.parse(raw);
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      pushHistory([...nodes], [...edges]);
      setNodes(nds => [...nds, buildNodeFromBlueprint(blueprint, position)]);
    },
    [screenToFlowPosition, nodes, edges, pushHistory, setNodes]
  );

  /* ── Node click / pane click ──────────────────────── */
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  /* ── Update selected node label ───────────────────── */
  const updateNodeLabel = useCallback((label: string) => {
    if (!selectedNode) return;
    setNodes(nds =>
      nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, label } } : n)
    );
    setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, label } } : prev);
  }, [selectedNode, setNodes]);

  /* ── Update a param on selected node ─────────────── */
  const updateNodeParam = useCallback((key: string, value: string) => {
    if (!selectedNode) return;
    setNodes(nds =>
      nds.map(n => {
        if (n.id !== selectedNode.id) return n;
        const data = n.data as NodeData;
        return { ...n, data: { ...data, params: { ...data.params, [key]: value } } };
      })
    );
    setSelectedNode(prev => {
      if (!prev) return prev;
      const data = prev.data as NodeData;
      return { ...prev, data: { ...data, params: { ...data.params, [key]: value } } };
    });
  }, [selectedNode, setNodes]);

  /* ── Delete selected node ─────────────────────────── */
  const deleteSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    pushHistory([...nodes], [...edges]);
    setNodes(nds => nds.filter(n => n.id !== selectedNode.id));
    setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  }, [selectedNode, nodes, edges, pushHistory, setNodes, setEdges]);

  /* ── Clear canvas ─────────────────────────────────── */
  const clearCanvas = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const doClearCanvas = useCallback(() => {
    pushHistory([...nodes], [...edges]);
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setShowClearConfirm(false);
  }, [nodes, edges, pushHistory, setNodes, setEdges]);

  /* ── Auto-layout ──────────────────────────────────── */
  const runAutoLayout = useCallback(() => {
    pushHistory([...nodes], [...edges]);
    const laid = autoLayout(nodes, edges);
    setNodes(laid);
    setTimeout(() => fitView({ padding: 0.2 }), 50);
  }, [nodes, edges, pushHistory, setNodes, fitView]);

  /* ── Fetch Doctor UUID from doctors table ──────────── */
  const [doctorUUID, setDoctorUUID] = useState<string | null>(null);
  const [doctorHospitalId, setDoctorHospitalId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.primaryEmailAddress?.emailAddress) return;
    supabase
      .from("doctors")
      .select("id, hospital_id")
      .eq("email", user.primaryEmailAddress.emailAddress)
      .single()
      .then(({ data }) => {
        if (data?.id) setDoctorUUID(data.id);
        if (data?.hospital_id) setDoctorHospitalId(data.hospital_id);
      });
  }, [user?.primaryEmailAddress?.emailAddress]);

  /* ── Save ─────────────────────────────────────────── */
  const doSave = useCallback(async (saveName: string, saveDesc: string) => {
    if (!doctorUUID) {
      setSaveError("Doctor profile not found for this signed-in account.");
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2500);
      return;
    }
    setSaveState("saving");
    setSaveError(null);

    const firstTrigger = nodes.find(n => n.type === "trigger");
    const triggerType = normalizeWorkflowNodeType(
      ((firstTrigger?.data as NodeData)?.nodeType || "manual")
    );

    const serializedNodes = nodes.map(n => ({
      id: n.id,
      type: n.type,
      label: (n.data as NodeData).label,
      position: n.position,
      data: {
        label: (n.data as NodeData).label,
        nodeType: normalizeWorkflowNodeType((n.data as NodeData).nodeType),
        description: (n.data as NodeData).description,
        params: (n.data as NodeData).params || {},
      },
    }));

    const serializedEdges = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label || "",
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    }));

    const serialized = {
      name: saveName,
      description: saveDesc,
      hospital_id: doctorHospitalId,
      doctor_id: doctorUUID,   // ← UUID from doctors table
      status: "draft",
      trigger_type: triggerType,
      nodes: serializedNodes,
      edges: serializedEdges,
      updated_at: new Date().toISOString(),
    };

    try {
      if (savedId) {
        const { error } = await supabase
          .from("workflows")
          .update(serialized)
          .eq("id", savedId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("workflows")
          .insert(serialized)
          .select()
          .single();
        if (error) {
          console.error("Workflow Insert Error:", error);
          throw error;
        }
        setSavedId(data.id);
        router.replace(`/doctor/workflows/${data.id}`);
      }
      setName(saveName);
      setDescription(saveDesc);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err: any) {
      const message = formatSupabaseError(err);
      console.error("SAVE WORKFLOW EXCEPTION:", err, message);
      setSaveError(message);
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2500);
    }
  }, [doctorUUID, doctorHospitalId, nodes, edges, savedId, router]);

  const handleSave = useCallback(() => {
    if (!savedId) {
      setShowNameModal(true);
    } else {
      doSave(name, description);
    }
  }, [savedId, name, description, doSave]);

  /* ── Open load modal ──────────────────────────────── */
  const openLoadModal = useCallback(async () => {
    if (!doctorUUID) return;
    setShowLoadModal(true);
    setLoadingList(true);
    const { data } = await supabase
      .from("workflows")
      .select("*")
      .eq("doctor_id", doctorUUID)
      .order("updated_at", { ascending: false });
    setLoadList(data || []);
    setLoadingList(false);
  }, [doctorUUID]);

  /* ── Load a workflow from the load modal ──────────── */
  const handleLoadWorkflow = useCallback((wf: WorkflowRecord) => {
    setName(wf.name);
    setDescription(wf.description || "");
    setSavedId(wf.id);
    router.replace(`/doctor/workflows/${wf.id}`);

    const rfNodes: Node[] = (wf.nodes || []).map((n: Record<string, unknown>) => ({
      id: n.id as string,
      type: n.type as string,
      position: n.position as { x: number; y: number },
      data: {
        label: (n.data as NodeData)?.label ?? "",
        nodeType: normalizeWorkflowNodeType((n.data as NodeData)?.nodeType ?? ""),
        description: (n.data as NodeData)?.description ?? "",
        params: (n.data as NodeData)?.params ?? {},
      },
    }));
    const rfEdges: Edge[] = (wf.edges || []).map((e: Record<string, unknown>) =>
      styledEdge({
        id: e.id as string,
        source: e.source as string,
        target: e.target as string,
        sourceHandle: (e.sourceHandle as string) || undefined,
        targetHandle: (e.targetHandle as string) || undefined,
      })
    );

    setNodes(rfNodes);
    setEdges(rfEdges);
    setSelectedNode(null);
    historyRef.current = [];
    futureRef.current = [];
    setShowLoadModal(false);
    setTimeout(() => fitView({ padding: 0.2 }), 100);
  }, [router, setNodes, setEdges, fitView]);

  /* ── Open run modal ───────────────────────────────── */
  const openRunModal = useCallback(async () => {
    setShowRunModal(true);
    setRunResult(null);
    setSelectedPatient(null);
    setPhoneOverride("");
    setPatientSearch("");
    setManualLabResults([]);
    setLoadingPatients(true);
    try {
      const configRes = await fetch("/api/workflow/call-config");
      const configPayload = await configRes.json().catch(() => null) as CallConfigState | null;
      setCallConfig(configPayload);

      const patientRes = await fetch("/api/workflow/patients", { cache: "no-store" });
      const patientPayload = await patientRes.json().catch(() => null) as
        | { patients?: PatientRecord[]; error?: string }
        | null;

      if (!patientRes.ok) {
        throw new Error(patientPayload?.error || `Failed to load patients (${patientRes.status})`);
      }

      setPatients(patientPayload?.patients || []);
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  const selectedPatientPhone = normalizePhone(phoneOverride) || selectedPatient?.mobile || null;
  const requiresPhone = nodes.some(
    n => normalizeWorkflowNodeType((n.data?.nodeType as string | undefined) || "") === "call_patient"
  );
  const hasCallConfig = callConfig?.configured ?? false;
  const requiredLabTests = useMemo(() => {
    const tests = new Set<string>();

    for (const node of nodes) {
      const nodeType = normalizeWorkflowNodeType((node.data?.nodeType as string | undefined) || "");
      if (nodeType !== "check_result_values") continue;

      const params = (node.data?.params as Record<string, string> | undefined) || {};
      const testName = params.test_name?.trim();
      if (testName) tests.add(testName);
    }

    return Array.from(tests);
  }, [nodes]);
  useEffect(() => {
    if (!showRunModal) return;

    setManualLabResults(prev => {
      const next = [...prev];

      for (const testName of requiredLabTests) {
        if (!next.some(result => result.test_name.trim().toLowerCase() === testName.toLowerCase())) {
          next.push(createManualLabResult(testName));
        }
      }

      return next;
    });
  }, [requiredLabTests, showRunModal]);

  const requiresLabResults = requiredLabTests.length > 0;
  const missingLabValues = requiredLabTests.filter(testName => {
    const matching = manualLabResults.find(
      result => result.test_name.trim().toLowerCase() === testName.toLowerCase()
    );
    return !matching?.value || matching.value.trim() === "";
  });

  /* ── Run workflow ─────────────────────────────────── */
  const handleRun = useCallback(async () => {
    if (!selectedPatient || !savedId) return;
    const workflowRequiresPhone = nodes.some(
      n => normalizeWorkflowNodeType((n.data?.nodeType as string | undefined) || "") === "call_patient"
    );
    if (!nodes.some(n => n.type === "trigger")) {
      setRunResult("Error: Add a trigger node before running this workflow.");
      return;
    }
    if (requiresLabResults && missingLabValues.length > 0) {
      setRunResult(`Error: Enter lab values for ${missingLabValues.join(", ")} before running this workflow.`);
      return;
    }
    setRunning(true);
    setRunResult(null);
    try {
      const enteredLabResults = manualLabResults
        .filter(result => result.test_name.trim() && result.value.trim())
        .map(result => ({
          test_name: result.test_name.trim(),
          value: Number(result.value),
          unit: result.unit.trim() || undefined,
          reference_range: result.reference_range.trim() || undefined,
        }));

      const metadata = enteredLabResults.length > 0
        ? { lab_results: enteredLabResults, ...(selectedPatientPhone ? { phone_override: selectedPatientPhone } : {}) }
        : (selectedPatientPhone ? { phone_override: selectedPatientPhone } : undefined);

      const res = await fetch("/api/workflow-executions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow_id: savedId, patient_id: selectedPatient.id, metadata }),
      });
      const payload = await res.json().catch(() => null) as {
        error?: string;
        message?: string;
        call_initiated?: boolean;
        status?: string;
        steps?: Array<{ status?: string; message?: string }>;
      } | null;

      if (!res.ok) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      const errorStep = payload?.steps?.find(step => step.status === "error");

      if (errorStep?.message) {
        setRunResult(`Error: ${errorStep.message}`);
        return;
      }

      if (payload?.call_initiated) {
        setRunResult(`Call initiated successfully for ${selectedPatient.name}.`);
        return;
      }

      if (workflowRequiresPhone) {
        setRunResult(
          "Error: This workflow ran but no outbound call was initiated. Check the Call Patient node and ElevenLabs/Twilio server configuration."
        );
        return;
      }

      setRunResult(payload?.message || "Workflow executed successfully.");
    } catch (err) {
      setRunResult(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setRunning(false);
    }
  }, [selectedPatient, savedId, nodes, requiresLabResults, missingLabValues, manualLabResults]);

  /* ── Filtered load list ───────────────────────────── */
  const filteredLoadList = loadList.filter(wf =>
    wf.name.toLowerCase().includes(loadSearch.toLowerCase())
  );

  /* ── Filtered patients ────────────────────────────── */
  const filteredPatients = patients.filter(p =>
    p.name?.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.email?.toLowerCase().includes(patientSearch.toLowerCase())
  );

  /* ── Grouped node catalogue ───────────────────────── */
  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    style: CATEGORY_STYLES[cat],
    nodes: Object.values(NODE_CATALOGUE).filter(bp => bp.category === cat),
  }));

  const triggerBlueprints = Object.values(NODE_CATALOGUE).filter(
    bp => bp.category === "triggers"
  );

  const workflowTriggerNode = nodes.find(n => n.type === "trigger");
  const workflowTriggerLabel = workflowTriggerNode
    ? ((workflowTriggerNode.data as NodeData)?.label || "Configured Trigger")
    : "No trigger added";
  const workflowHasTrigger = !!workflowTriggerNode;

  const addTriggerNode = useCallback((blueprint?: NodeBlueprint) => {
    const nextTrigger = blueprint ?? triggerBlueprints[0];
    if (!nextTrigger) return;

    const existingTriggerCount = nodes.filter(n => n.type === "trigger").length;
    const position = {
      x: 180 + existingTriggerCount * 40,
      y: 120 + existingTriggerCount * 20,
    };

    pushHistory([...nodes], [...edges]);
    setNodes(nds => [...nds, buildNodeFromBlueprint(nextTrigger, position)]);
  }, [edges, nodes, pushHistory, setNodes, triggerBlueprints]);

  /* ── Selected node data helpers ───────────────────── */
  const selectedData = selectedNode ? (selectedNode.data as NodeData) : null;
  const selectedNodeType = normalizeWorkflowNodeType(selectedData?.nodeType || "");
  const selectedCat = selectedData
    ? Object.values(NODE_CATALOGUE).find(bp => bp.nodeType === selectedNodeType)
    : null;

  const catStyle = selectedCat ? CATEGORY_STYLES[selectedCat.category] : null;
  const paletteAutoTriggerCount =
    grouped.find(group => group.category === "triggers")?.nodes.filter(bp =>
      AUTO_EVENT_READY_TRIGGERS.has(bp.nodeType)
    ).length || 0;

  /* ── Textarea keys ────────────────────────────────── */
  const TEXTAREA_KEYS = new Set([
    "message", "notes", "details", "reason",
    "lab_result_summary", "call_reason",
  ]);

  /* ── Save button label ────────────────────────────── */
  const saveLabel =
    saveState === "saving" ? "Saving..." :
    saveState === "saved"  ? "Saved!" :
    saveState === "error"  ? "Error" :
    "Save";

  const saveBtnClass =
    saveState === "saved"  ? "bg-[#16A34A] hover:bg-[#16A34A] text-white" :
    saveState === "error"  ? "bg-[#DC2626] hover:bg-[#DC2626] text-white" :
    "bg-[#00bcd4] hover:bg-[#0097a7] text-white";

  /* ── Loading screen ───────────────────────────────── */
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#F4F7FB]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-[#00bcd4]" />
          <p className="text-sm text-muted-foreground">Loading workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden relative">
      <MobileCanvasBlock backUrl="/doctor/workflows" />
      <DoctorWorkflowNavbar title={name || "Workflow Builder"} showBackToWorkflows />

      {/* ── TOOLBAR ─────────────────────────────────── */}
      <header className="h-14 bg-card border-b border-border flex items-center px-3 gap-2 shrink-0 z-10">
        {/* Left cluster */}
        <Button asChild variant="ghost" size="sm" className="gap-1.5 h-8 shrink-0">
          <Link href="/doctor/workflows">
            <ArrowLeft size={14} /> Back
          </Link>
        </Button>

        <Separator orientation="vertical" className="h-5 bg-[#DDE3EE]" />

        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          className="h-8 w-48 text-sm font-semibold border-border focus:border-[#00bcd4]"
          placeholder="Workflow name..."
        />

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Badge variant="outline" className="h-5 text-[10px] border-border">
            Trigger: {workflowTriggerLabel}
          </Badge>
          <Badge variant="outline" className="h-5 text-[10px] font-mono border-border">
            {nodes.length} nodes
          </Badge>
          <Badge variant="outline" className="h-5 text-[10px] font-mono border-border">
            {edges.length} edges
          </Badge>
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={historyRef.current.length === 0}
            className="h-8 w-8 p-0 border-border"
            title="Undo (Cmd+Z)"
          >
            <Undo2 size={13} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={redo}
            disabled={futureRef.current.length === 0}
            className="h-8 w-8 p-0 border-border"
            title="Redo (Cmd+Shift+Z)"
          >
            <Redo2 size={13} />
          </Button>

          <Separator orientation="vertical" className="h-5 bg-[#DDE3EE]" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => addTriggerNode()}
            className="h-8 text-xs border-border gap-1.5"
          >
            <Plus size={13} /> Add Trigger
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={openLoadModal}
            className="h-8 text-xs border-border gap-1.5"
          >
            <FolderOpen size={13} /> Load
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={clearCanvas}
            disabled={nodes.length === 0}
            className="h-8 text-xs border-border gap-1.5"
          >
            <RefreshCw size={13} /> Clear
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={runAutoLayout}
            className="h-8 text-xs border-border gap-1.5"
          >
            <LayoutDashboard size={13} /> Auto-layout
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={saveState === "saving"}
            className={`h-8 text-xs gap-1.5 transition-colors ${saveBtnClass}`}
          >
            {saveState === "saving" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : saveState === "saved" ? (
              <CheckCircle size={13} />
            ) : (
              <Save size={13} />
            )}
            {saveLabel}
          </Button>

          <Button
            size="sm"
            onClick={openRunModal}
            disabled={!savedId}
            className="h-8 text-xs gap-1.5 bg-[#16A34A] hover:bg-[#15803d] text-white"
          >
            <Play size={13} /> Run
          </Button>
        </div>
      </header>

      {saveError && (
        <div className="border-b border-[#DC2626]/20 bg-[#FEE2E2] px-4 py-2 text-xs text-[#991B1B]">
          Save failed: {saveError}
        </div>
      )}

      {/* ── MAIN AREA ───────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── NODE PALETTE ──────────────────────────── */}
        <aside className="w-56 bg-card border-r border-border flex flex-col shrink-0 overflow-y-auto">
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-[11px] font-bold uppercase tracking-wider text-foreground">Node Palette</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Drag simple steps into your workflow</p>
          </div>

          <div className="p-2 space-y-3 flex-1">
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
                      onDragStart={e => {
                        e.dataTransfer.setData("application/reactflow", JSON.stringify(bp));
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className={`
                        flex items-start gap-2 px-2 py-1.5 rounded-lg border cursor-grab
                        transition-transform hover:scale-[1.02] active:cursor-grabbing
                        ${group.style.bg} ${group.style.border}
                      `}
                    >
                      <div className={cn("mt-0.5 shrink-0", group.style.text)}>
                        <NodeIcon name={bp.icon} className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-[11px] font-semibold leading-tight truncate ${group.style.text}`}>
                          {bp.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                          {bp.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-auto border-t border-border px-3 py-3 text-[10px] leading-relaxed text-muted-foreground">
            <p>Every action, check, and output is connected to the workflow engine.</p>
            <p className="mt-1">{paletteAutoTriggerCount} trigger types can start automatically right now. All triggers can still be tested with Manual Run.</p>
          </div>
        </aside>

        {/* ── CANVAS ────────────────────────────────── */}
        <div className="flex-1 relative overflow-hidden" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={NODE_TYPES}
            fitView
            style={{ background: "#F4F7FB" }}
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: "#00bcd4", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#00bcd4" },
            }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              color="#DDE3EE"
              gap={20}
              size={1}
            />
            <Controls className="[&>button]:border-border [&>button]:bg-card [&>button]:shadow-sm" />
            <MiniMap
              nodeColor={() => "#00bcd4"}
              className="border border-border rounded-xl overflow-hidden shadow-sm"
            />

            {nodes.length === 0 && (
              <Panel position="top-center">
                <div className="mt-24 flex flex-col items-center gap-3 text-center select-none">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Plus size={28} className="text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    Start by adding a Trigger node
                  </p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Then connect actions and outputs. The Run button is the manual trigger for a selected patient.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => addTriggerNode()}
                    className="pointer-events-auto bg-[#00bcd4] hover:bg-[#0097a7] text-white"
                  >
                    <Plus size={13} /> Add First Trigger
                  </Button>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* ── PROPERTIES PANEL ──────────────────────── */}
        <aside className="w-64 bg-card border-l border-border flex flex-col shrink-0 overflow-y-auto">
          {selectedNode && selectedData ? (
            <>
              <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Step Settings
                </p>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                {/* Type badge */}
                {catStyle && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${catStyle.bg} ${catStyle.border}`}>
                    <span className="text-lg">{selectedCat?.icon}</span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Type</p>
                      <p className={`text-[12px] font-bold ${catStyle.text}`}>
                        {CATEGORY_STYLES[selectedCat?.category ?? "actions"].label.slice(0, -1)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Label */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Step name
                  </Label>
                  <Input
                    value={selectedData.label}
                    onChange={e => updateNodeLabel(e.target.value)}
                    className="h-8 text-sm border-border"
                    placeholder="Give this step a clear name"
                  />
                </div>

                {/* Node type (read-only) */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Workflow step
                  </Label>
                  <p className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-1.5 rounded-lg border border-border truncate">
                    {selectedCat?.label || selectedNodeType}
                  </p>
                </div>

                {/* Description (read-only) */}
                {selectedData.description && (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      What this step does
                    </Label>
                    <p className="text-[11px] text-muted-foreground bg-muted px-2 py-1.5 rounded-lg border border-border leading-relaxed">
                      {selectedData.description}
                    </p>
                  </div>
                )}

                {/* Params */}
                {selectedData.params && Object.keys(selectedData.params).length > 0 && (
                  <div className="space-y-3">
                    <Separator className="bg-[#DDE3EE]" />
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Parameters
                    </p>
                    {Object.entries(selectedData.params).map(([key, val]) => {
                      if (key === "operator") {
                        return (
                          <div key={key} className="space-y-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground capitalize">
                              {getParamLabel(key)}
                            </Label>
                            <Select
                              value={val}
                              onValueChange={v => updateNodeParam(key, v)}
                            >
                              <SelectTrigger className="h-7 text-xs border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {getOperatorOptions(selectedNodeType).map(option => (
                                  <SelectItem key={option.value} value={option.value} className="text-xs">
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      }

                      if (key === "priority" || key === "urgency") {
                        return (
                          <div key={key} className="space-y-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground capitalize">
                              {getParamLabel(key)}
                            </Label>
                            <Select
                              value={val}
                              onValueChange={v => updateNodeParam(key, v)}
                            >
                              <SelectTrigger className="h-7 text-xs border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="routine" className="text-xs">Routine</SelectItem>
                                <SelectItem value="urgent" className="text-xs">Urgent</SelectItem>
                                <SelectItem value="emergent" className="text-xs">Emergent</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      }

                      if (key === "recipient") {
                        return (
                          <div key={key} className="space-y-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground capitalize">
                              {getParamLabel(key)}
                            </Label>
                            <Select
                              value={val}
                              onValueChange={v => updateNodeParam(key, v)}
                            >
                              <SelectTrigger className="h-7 text-xs border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="doctor" className="text-xs">Doctor</SelectItem>
                                <SelectItem value="patient" className="text-xs">Patient</SelectItem>
                                <SelectItem value="staff" className="text-xs">Staff</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      }

                      if (TEXTAREA_KEYS.has(key)) {
                        return (
                          <div key={key} className="space-y-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground capitalize">
                              {getParamLabel(key)}
                            </Label>
                            <textarea
                              value={val}
                              onChange={e => updateNodeParam(key, e.target.value)}
                              rows={3}
                              className="w-full text-xs rounded-lg border border-border bg-background px-2 py-1.5 text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-[#00bcd4] focus:border-[#00bcd4]"
                              placeholder={getParamPlaceholder(key)}
                            />
                          </div>
                        );
                      }

                      return (
                        <div key={key} className="space-y-1">
                          <Label className="text-[10px] font-semibold text-muted-foreground capitalize">
                            {getParamLabel(key)}
                          </Label>
                          <Input
                            value={val}
                            onChange={e => updateNodeParam(key, e.target.value)}
                            className="h-7 text-xs border-border"
                            placeholder={getParamPlaceholder(key)}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                <Separator className="bg-[#DDE3EE]" />

                {/* Delete button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={deleteSelectedNode}
                  className="w-full h-8 text-xs text-[#DC2626] border-[#DC2626]/30 hover:bg-[#FEE2E2] gap-1.5"
                >
                  <Trash2 size={12} /> Delete Node
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <LayoutDashboard size={20} className="text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Select a step to edit it in plain language
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* ══ SAVE NAME MODAL ═══════════════════════════ */}
      <SaveNameModal
        open={showNameModal}
        initialName={name}
        initialDescription={description}
        onClose={() => setShowNameModal(false)}
        onConfirm={(n, d) => {
          setShowNameModal(false);
          doSave(n, d);
        }}
      />

      {/* ══ LOAD MODAL ════════════════════════════════ */}
      <Dialog open={showLoadModal} onOpenChange={setShowLoadModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Load Workflow</DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={loadSearch}
              onChange={e => setLoadSearch(e.target.value)}
              placeholder="Search workflows..."
              className="pl-8 h-8 text-sm border-border"
            />
          </div>
          {loadingList ? (
            <div className="flex justify-center py-8">
              <Loader2 size={22} className="animate-spin text-[#00bcd4]" />
            </div>
          ) : filteredLoadList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No workflows found.</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {filteredLoadList.map(wf => (
                <button
                  key={wf.id}
                  onClick={() => handleLoadWorkflow(wf)}
                  className="w-full text-left px-3 py-2.5 rounded-lg border border-border hover:border-[#00bcd4] hover:bg-[#e0f7fa]/30 transition-all"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-semibold text-foreground truncate">{wf.name}</span>
                    <Badge
                      className={
                        wf.status === "active"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px]"
                          : "bg-muted text-muted-foreground border-border text-[10px]"
                      }
                    >
                      {wf.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{(wf.nodes || []).length} nodes</span>
                    <span>·</span>
                    <span>{(wf.edges || []).length} edges</span>
                    <span>·</span>
                    <span>{new Date(wf.updated_at).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

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

      {/* ══ RUN MODAL ════════════════════════════════ */}
      <Dialog open={showRunModal} onOpenChange={setShowRunModal}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manual Run</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">
            Select a patient to manually trigger this workflow on.
          </p>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={patientSearch}
              onChange={e => setPatientSearch(e.target.value)}
              placeholder="Search patients..."
              className="pl-8 h-8 text-sm border-border"
            />
          </div>
          {loadingPatients ? (
            <div className="flex justify-center py-6">
              <Loader2 size={20} className="animate-spin text-[#00bcd4]" />
            </div>
          ) : (
            <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
              {filteredPatients.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPatient(p)}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                    selectedPatient?.id === p.id
                      ? "border-[#00bcd4] bg-[#e0f7fa]/40"
                      : "border-border hover:border-[#00bcd4]/50"
                  }`}
                >
                  <p className="text-sm font-semibold text-foreground">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.email}{p.patient_id ? ` · ${p.patient_id}` : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.mobile ? `Phone: ${p.mobile}` : "No phone number on file"}
                  </p>
                </button>
              ))}
              {filteredPatients.length === 0 && (
                <div className="py-4 text-center">
                  <p className="text-sm text-muted-foreground">No patient records found.</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Patients show up here after they sign up and receive a `patient_id` in the `users` table.
                  </p>
                </div>
              )}
            </div>
          )}

          {runResult && (
            <div className={`mt-3 px-3 py-2 rounded-lg text-sm font-medium ${
              runResult.startsWith("Error")
                ? "bg-[#FEE2E2] text-[#DC2626] border border-[#DC2626]/20"
                : "bg-[#DCFCE7] text-[#16A34A] border border-[#16A34A]/20"
            }`}>
              {runResult}
            </div>
          )}

          {!workflowHasTrigger && (
            <div className="mt-3 px-3 py-2 rounded-lg text-xs border bg-[#FEE2E2] text-[#991B1B] border-[#DC2626]/20">
              This workflow cannot run yet because it has no trigger node.
            </div>
          )}

          {requiresPhone && (
            <div className={`mt-3 px-3 py-2 rounded-lg text-xs border ${
              selectedPatientPhone
                ? "bg-[#DCFCE7] text-[#166534] border-[#16A34A]/20"
                : "bg-[#FEF3C7] text-[#92400E] border-[#D97706]/20"
            }`}>
              {selectedPatientPhone
                ? `Call Patient can run for this patient using ${selectedPatientPhone}.`
                : "This workflow includes Call Patient. Pick a patient with a phone number before running it."}
            </div>
          )}

          {requiresPhone && selectedPatient && (
            <div className="mt-3 space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">
                Phone Number For This Run
              </Label>
              <Input
                type="tel"
                value={phoneOverride}
                onChange={e => setPhoneOverride(e.target.value)}
                placeholder={selectedPatient.mobile || "+91XXXXXXXXXX"}
                className="h-8 text-xs border-border"
              />
              <p className="text-[11px] text-muted-foreground">
                Leave blank to use the saved patient number. Enter a corrected number here to override it just for this run.
              </p>
            </div>
          )}

          {requiresPhone && !hasCallConfig && (
            <div className="mt-3 px-3 py-2 rounded-lg text-xs border bg-[#FEE2E2] text-[#991B1B] border-[#DC2626]/20">
              Outbound calling is not configured on the server yet.
              {callConfig?.missing?.length
                ? ` Missing: ${callConfig.missing.join(", ")}.`
                : ""}
            </div>
          )}

          {requiresPhone && selectedPatientPhone && !selectedPatientPhone.startsWith("+") && (
            <div className="mt-3 px-3 py-2 rounded-lg text-xs border bg-[#FEF3C7] text-[#92400E] border-[#D97706]/20">
              The patient number should include country code, for example `+91XXXXXXXXXX`, before an outbound call can succeed.
            </div>
          )}

          <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/30 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-foreground">Lab Results For Manual Run</p>
                  <p className="text-[11px] text-muted-foreground">
                    Add report entries here if this workflow needs lab data. These values are sent with the run.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setManualLabResults(prev => [...prev, createManualLabResult()])}
                  className="h-7 text-[11px] gap-1"
                >
                  <Plus size={12} /> Add Report
                </Button>
              </div>
              {requiresLabResults && missingLabValues.length > 0 && (
                <div className="rounded-lg border border-[#D97706]/20 bg-[#FEF3C7] px-2 py-2 text-[11px] text-[#92400E]">
                  This workflow is expecting lab values for: {missingLabValues.join(", ")}.
                </div>
              )}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {manualLabResults.map((result, index) => {
                  const isRequired = requiredLabTests.some(
                    testName => testName.toLowerCase() === result.test_name.trim().toLowerCase()
                  );

                  return (
                    <div key={result.id} className="rounded-lg border border-border bg-background px-2 py-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          Report {index + 1}{isRequired ? " · Required" : ""}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setManualLabResults(prev => prev.filter(entry => entry.id !== result.id))
                          }
                          disabled={isRequired && manualLabResults.length <= requiredLabTests.length}
                          className="h-6 px-2 text-[11px] text-muted-foreground"
                        >
                          Remove
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-medium text-muted-foreground">
                            Test Name
                          </Label>
                          <Input
                            value={result.test_name}
                            onChange={e =>
                              setManualLabResults(prev =>
                                prev.map(entry =>
                                  entry.id === result.id ? { ...entry, test_name: e.target.value } : entry
                                )
                              )
                            }
                            placeholder="HbA1c, Hemoglobin, Glucose..."
                            className="h-8 text-xs border-border"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1 col-span-1">
                            <Label className="text-[11px] font-medium text-muted-foreground">
                              Value
                            </Label>
                            <Input
                              type="number"
                              step="any"
                              value={result.value}
                              onChange={e =>
                                setManualLabResults(prev =>
                                  prev.map(entry =>
                                    entry.id === result.id ? { ...entry, value: e.target.value } : entry
                                  )
                                )
                              }
                              placeholder="7.2"
                              className="h-8 text-xs border-border"
                            />
                          </div>
                          <div className="space-y-1 col-span-1">
                            <Label className="text-[11px] font-medium text-muted-foreground">
                              Unit
                            </Label>
                            <Input
                              value={result.unit}
                              onChange={e =>
                                setManualLabResults(prev =>
                                  prev.map(entry =>
                                    entry.id === result.id ? { ...entry, unit: e.target.value } : entry
                                  )
                                )
                              }
                              placeholder="mg/dL"
                              className="h-8 text-xs border-border"
                            />
                          </div>
                          <div className="space-y-1 col-span-1">
                            <Label className="text-[11px] font-medium text-muted-foreground">
                              Range
                            </Label>
                            <Input
                              value={result.reference_range}
                              onChange={e =>
                                setManualLabResults(prev =>
                                  prev.map(entry =>
                                    entry.id === result.id ? { ...entry, reference_range: e.target.value } : entry
                                  )
                                )
                              }
                              placeholder="4.0-5.6"
                              className="h-8 text-xs border-border"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowRunModal(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleRun}
              disabled={
                !selectedPatient ||
                running ||
                !workflowHasTrigger ||
                (requiresPhone && !selectedPatientPhone) ||
                (requiresPhone && !hasCallConfig) ||
                (requiresPhone && !!selectedPatientPhone && !selectedPatientPhone.startsWith("+")) ||
                (requiresLabResults && missingLabValues.length > 0)
              }
              className="h-8 text-xs bg-[#16A34A] hover:bg-[#15803d] text-white gap-1.5"
            >
              {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {running ? "Running..." : "Run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SAVE NAME MODAL (separate component)
   ══════════════════════════════════════════════════════════ */
interface SaveNameModalProps {
  open: boolean;
  initialName: string;
  initialDescription: string;
  onClose: () => void;
  onConfirm: (name: string, description: string) => void;
}

function SaveNameModal({ open, initialName, initialDescription, onClose, onConfirm }: SaveNameModalProps) {
  const [localName, setLocalName] = useState(initialName);
  const [localDesc, setLocalDesc] = useState(initialDescription);

  useEffect(() => {
    if (open) {
      setLocalName(initialName);
      setLocalDesc(initialDescription);
    }
  }, [open, initialName, initialDescription]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && localName.trim()) {
      onConfirm(localName.trim(), localDesc);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Save Workflow</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Workflow Name</Label>
            <Input
              value={localName}
              onChange={e => setLocalName(e.target.value)}
              placeholder="My Workflow..."
              className="h-9 text-sm border-border"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Description (optional)</Label>
            <textarea
              value={localDesc}
              onChange={e => setLocalDesc(e.target.value)}
              rows={3}
              placeholder="Describe what this workflow does..."
              className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-[#00bcd4] focus:border-[#00bcd4]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="h-8 text-xs">
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(localName.trim(), localDesc)}
            disabled={!localName.trim()}
            className="h-8 text-xs bg-[#00bcd4] hover:bg-[#0097a7] text-white"
          >
            <Save size={12} className="mr-1.5" /> Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════════════════════════
   PAGE EXPORT — wraps inner component in ReactFlowProvider
   ══════════════════════════════════════════════════════════ */
export default function WorkflowBuilderPage() {
  return (
    <div className="min-h-screen bg-[#F4F7FB]">
        <ReactFlowProvider>
          <WorkflowBuilderInner />
        </ReactFlowProvider>
    </div>
  );
}

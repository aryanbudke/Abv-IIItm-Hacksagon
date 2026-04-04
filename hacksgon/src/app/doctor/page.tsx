"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Logo } from "@/components/Logo";
import { useUser, UserButton, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users, Calendar, Activity, ChevronUp, ChevronDown,
  AlertTriangle, User as UserIcon, Clock, CalendarDays, BarChart3,
  ChevronLeft, ChevronRight, Check, ClipboardList, PenTool, FileText,
  Settings, X, Eye, Search, Monitor, LogOut, Bell, ArrowRightLeft, FastForward, UserMinus, UserCheck, Coffee, ArrowRight,
  Zap, Play, CheckCircle, Phone, GitBranch, Plus, Menu, History as HistoryIcon, Info, Download
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";

interface QueuePatient {
  id: string;
  token_number: number;
  patient_id: string;
  patient_name: string;
  position: number;
  status: string;
  is_emergency: boolean;
  created_at: string;
  estimated_wait_time: number;
  medical_records?: any;
}

interface Appointment {
  id: string;
  patient_name: string;
  date: string;
  time_slot: string;
  status: string;
}

interface DashboardWorkflow {
  id: string;
  name: string;
  description?: string;
  status?: string;
  nodes?: Array<{ data?: { nodeType?: string; params?: Record<string, string> } }>;
}

interface DashboardPatient {
  id: string;
  name: string;
  email?: string | null;
  mobile?: string | null;
}

interface DashboardLabResult {
  id: string;
  test_name: string;
  value: string;
  unit: string;
  reference_range: string;
}

type AnalyticsFilter = "yesterday" | "day_before" | "last_7_days" | "custom";

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

function normalizePhone(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  const compact = raw.replace(/[^\d+]/g, "");

  if (compact.startsWith("+")) return `+${compact.slice(1).replace(/\D/g, "")}`;
  if (compact.startsWith("00")) return `+${compact.slice(2).replace(/\D/g, "")}`;

  const digits = compact.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return raw;
}

function createDashboardLabResult(testName = ""): DashboardLabResult {
  return {
    id: `lab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    test_name: testName,
    value: "",
    unit: "",
    reference_range: "",
  };
}

export default function DoctorDashboardPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  
  const [queue, setQueue] = useState<QueuePatient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patientHistory, setPatientHistory] = useState<any[]>([]);
  const [stats, setStats] = useState({ patientsServed: 0, waitingPatients: 0, todayAppointments: 0, avgWaitTime: 15 });
  const [loading, setLoading] = useState(true);
  const [doctorInfo, setDoctorInfo] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"queue" | "appointments" | "history" | "analytics" | "calendar" | "liveboard" | "workflows">("queue");

  const [analyticsFilter, setAnalyticsFilter] = useState<AnalyticsFilter>("last_7_days");
  const [customRange, setCustomRange] = useState({ from: "", to: "" });
  const [analyticsData, setAnalyticsData] = useState({ patientsServed: 0, completedAppointments: 0 });

  const [reportForm, setReportForm] = useState({ symptoms: "", diagnosis: "", prescription: "", notes: "" });
  const [submittingReport, setSubmittingReport] = useState(false);

  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarAppts, setCalendarAppts] = useState<any[]>([]);
  const [calendarQueue, setCalendarQueue] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);

  const [viewingReport, setViewingReport] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);

  const [doctorSearchQuery, setDoctorSearchQuery] = useState("");
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<"all" | "pending" | "confirmed" | "completed">("all");
  const [historyReportFilter, setHistoryReportFilter] = useState<"all" | "has_report" | "no_report">("all");
  
  const [apptPage, setApptPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [viewingAnalyticDetails, setViewingAnalyticDetails] = useState<{ title: string; type: 'served' | 'booked'; data: any[] } | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isAway, setIsAway] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [otherDoctors, setOtherDoctors] = useState<any[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [workflowExecutions, setWorkflowExecutions] = useState<any[]>([]);
  const [availableWorkflows, setAvailableWorkflows] = useState<DashboardWorkflow[]>([]);
  const [fetchingWorkflows, setFetchingWorkflows] = useState(false);
  const [triggeringWorkflow, setTriggeringWorkflow] = useState<string | null>(null);
  const [showRunWorkflowDialog, setShowRunWorkflowDialog] = useState(false);
  const [selectedWorkflowForRunId, setSelectedWorkflowForRunId] = useState("");
  const [workflowRunPatients, setWorkflowRunPatients] = useState<DashboardPatient[]>([]);
  const [loadingWorkflowPatients, setLoadingWorkflowPatients] = useState(false);
  const [workflowRunSearch, setWorkflowRunSearch] = useState("");
  const [selectedRunPatient, setSelectedRunPatient] = useState<DashboardPatient | null>(null);
  const [runPhoneOverride, setRunPhoneOverride] = useState("");
  const [runLabResults, setRunLabResults] = useState<DashboardLabResult[]>([]);
  const [runningManualWorkflow, setRunningManualWorkflow] = useState(false);
  const [workflowRunMessage, setWorkflowRunMessage] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const APPTS_PER_PAGE = 8;
  const HISTORY_PER_PAGE = 10;

  const dsq = doctorSearchQuery.toLowerCase();

  const filteredQueue = queue.filter(p => !dsq || p.patient_name.toLowerCase().includes(dsq) || String(p.token_number).includes(dsq));

  const filteredAppointments = appointments.filter(appt => {
    const matchesSearch = !dsq || appt.patient_name.toLowerCase().includes(dsq) || appt.time_slot.includes(dsq) || appt.date.includes(dsq);
    if (!matchesSearch) return false;
    if (appointmentStatusFilter === "all") return true;
    return appt.status === appointmentStatusFilter;
  });

  const filteredHistory = patientHistory.filter(p => {
    const patientName = p.users?.name?.toLowerCase() || "";
    const matchesSearch = !dsq || patientName.includes(dsq);
    
    if (!matchesSearch) return false;
    
    // Since history is now report-centric, filters are simpler
    if (historyReportFilter === "all") return true;
    if (historyReportFilter === "has_report") return true; // All items in this list have reports
    if (historyReportFilter === "no_report") return false; // Reports-only list
    
    return true;
  });

  const pagedAppointments = filteredAppointments.slice((apptPage - 1) * APPTS_PER_PAGE, apptPage * APPTS_PER_PAGE);
  const pagedHistory = filteredHistory.slice((historyPage - 1) * HISTORY_PER_PAGE, historyPage * HISTORY_PER_PAGE);
  const selectedWorkflowForRun = availableWorkflows.find(wf => wf.id === selectedWorkflowForRunId) || null;
  const selectedWorkflowNodeTypes = (selectedWorkflowForRun?.nodes || []).map(
    n => normalizeWorkflowNodeType(n.data?.nodeType || "")
  );
  const runRequiresPhone = selectedWorkflowNodeTypes.includes("call_patient") || selectedWorkflowNodeTypes.includes("send_sms");
  const runLabCheckNodes = (selectedWorkflowForRun?.nodes || []).filter(
    n => normalizeWorkflowNodeType(n.data?.nodeType || "") === "check_result_values"
  );
  const expectedLabTests = Array.from(
    new Set(
      runLabCheckNodes
        .map(n => n.data?.params?.test_name?.trim() || "")
        .filter(Boolean)
    )
  );
  const filteredWorkflowRunPatients = workflowRunPatients.filter(
    p =>
      p.name?.toLowerCase().includes(workflowRunSearch.toLowerCase()) ||
      p.email?.toLowerCase().includes(workflowRunSearch.toLowerCase())
  );
  const selectedRunPhone = normalizePhone(runPhoneOverride) || normalizePhone(selectedRunPatient?.mobile || "");
  const hasSelectedRunPhone = !!selectedRunPhone;
  const preparedRunLabResults = runLabResults
    .filter(result => result.test_name.trim() && result.value.trim())
    .map(result => {
      const numericValue = Number(result.value);
      return {
        test_name: result.test_name.trim(),
        value: Number.isFinite(numericValue) ? numericValue : result.value.trim(),
        unit: result.unit.trim(),
        reference_range: result.reference_range.trim(),
      };
    });
  const missingExpectedLabTests = expectedLabTests.filter(
    test =>
      !preparedRunLabResults.some(entry =>
        entry.test_name.toLowerCase().includes(test.toLowerCase()) ||
        test.toLowerCase().includes(entry.test_name.toLowerCase())
      )
  );

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push("/sign-in"); return; }
    if ((user?.publicMetadata?.role as string) !== "doctor") router.push("/");
  }, [isLoaded, isSignedIn, user, router]);

  useEffect(() => {
    if (isLoaded && isSignedIn && user && (user.publicMetadata?.role as string) === "doctor") fetchDoctorData();
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (doctorInfo) {
      const sub = supabase.channel("doctor-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, () => fetchDoctorData())
        .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => fetchDoctorData())
        .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => fetchDoctorData())
        .subscribe();
      return () => { sub.unsubscribe(); };
    }
  }, [doctorInfo]);

  useEffect(() => {
    if (doctorInfo) fetchAnalytics();
  }, [analyticsFilter, customRange, doctorInfo]);

  const fetchDoctorData = async () => {
    try {
      const { data: doctor } = await supabase.from("doctors").select("*").eq("email", user?.primaryEmailAddress?.emailAddress).single();
      if (!doctor) { setLoading(false); return; }
      setDoctorInfo(doctor);
      setIsAway(doctor.status === 'away');

      // Fetch other doctors for transfer
      const { data: others } = await supabase.from("doctors").select("*").neq("id", doctor.id);
      setOtherDoctors(others || []);

      // Fetch notifications
      const { data: notifs } = await supabase.from("notifications")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(5);
      setNotifications(notifs || []);

      // Use local midnight so timezone (e.g. IST +5:30) doesn't cut off today's entries
      const localMidnight = new Date(); localMidnight.setHours(0, 0, 0, 0);
      const todayLocalISO = localMidnight.toISOString(); // e.g. 2026-03-24T18:30:00Z for IST midnight
      const apptFrom = new Date(localMidnight); apptFrom.setDate(apptFrom.getDate() - 1);

      const [queueRes, apptRes, historyRes, todayServedRes] = await Promise.all([
        supabase.from("queue").select("*, medical_records(*)").eq("doctor_id", doctor.id).in("status", ["waiting", "in-treatment"]).order("is_emergency", { ascending: false }).order("position", { ascending: true }),
        supabase.from("appointments").select("*").eq("doctor_id", doctor.id)
          .gte("date", apptFrom.toISOString().split("T")[0])
          .order("date").order("time_slot"),
        supabase.from("reports").select("*, users!reports_patient_id_fkey(name, patient_id)").eq("doctor_id", doctor.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("queue").select("id", { count: "exact", head: true }).eq("doctor_id", doctor.id).eq("status", "completed").gte("updated_at", todayLocalISO),
      ]);

      setQueue(queueRes.data || []);
      setAppointments(apptRes.data || []);
      // Using historyRes (which is now reports) as the primary history source
      setPatientHistory(historyRes.data || []);
      setReports(historyRes.data || []);

      const todayAppointments = (apptRes.data || []).filter(a => !["cancelled", "completed"].includes(a.status)).length;
      const todayServed = todayServedRes.count || 0;
      setStats({
        patientsServed: todayServed,
        waitingPatients: queueRes.data?.length || 0,
        todayAppointments: todayAppointments,
        avgWaitTime: doctor.average_treatment_time || 15,
      });
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  const fetchWorkflowExecutions = async () => {
    if (!doctorInfo) return;
    setFetchingWorkflows(true);
    try {
      console.log("[DoctorDashboard] Fetching workflow executions for doctor:", doctorInfo.id);
      const { data: ownedWorkflows } = await supabase
        .from("workflows")
        .select("id, name")
        .eq("doctor_id", doctorInfo.id);

      if (!ownedWorkflows || ownedWorkflows.length === 0) {
        console.log("[DoctorDashboard] No workflows owned by doctor");
        setWorkflowExecutions([]);
        return;
      }

      const workflowIds = ownedWorkflows.map(w => w.id);
      const workflowNameById = new Map(ownedWorkflows.map(w => [w.id, w.name]));

      const res = await fetch("/api/workflow-executions", { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) {
        console.error("[DoctorDashboard] workflow_executions query failed:", payload);
        setWorkflowExecutions([]);
        return;
      }

      const enriched = (Array.isArray(payload) ? payload : [])
        .filter(ex => workflowIds.includes(ex.workflow_id))
        .sort((a, b) => {
          const aTs = new Date((a.started_at || a.created_at || a.completed_at || 0) as string | number).getTime();
          const bTs = new Date((b.started_at || b.created_at || b.completed_at || 0) as string | number).getTime();
          return bTs - aTs;
        })
        .slice(0, 20)
        .map(ex => ({
        ...ex,
        workflow_name: workflowNameById.get(ex.workflow_id) || "Workflow",
      }));

      console.log("[DoctorDashboard] Loaded executions:", enriched.length);
      setWorkflowExecutions(enriched);
    } catch (error) { console.error(error); }
    finally { setFetchingWorkflows(false); }
  };

  const fetchAvailableWorkflows = async () => {
    if (!doctorInfo) return;
    const { data, error } = await supabase
      .from('workflows')
      .select('id, name, description, status, nodes')
      .eq('doctor_id', doctorInfo.id)
      .in('status', ['active', 'ENABLED'])
      .order('updated_at', { ascending: false });
    if (error) {
      console.error("[DoctorDashboard] available workflows query failed:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      setAvailableWorkflows([]);
      return;
    }
    console.log("[DoctorDashboard] Loaded available workflows:", (data || []).length);
    setAvailableWorkflows(data || []);
  };

  const openWorkflowRunDialog = async (workflowId?: string) => {
    const initialWorkflowId = workflowId || availableWorkflows[0]?.id || "";
    if (!initialWorkflowId) return;

    setSelectedWorkflowForRunId(initialWorkflowId);
    setSelectedRunPatient(null);
    setWorkflowRunSearch("");
    setRunPhoneOverride("");
    setRunLabResults([]);
    setWorkflowRunMessage(null);
    setShowRunWorkflowDialog(true);
    setLoadingWorkflowPatients(true);

    try {
      const res = await fetch("/api/workflow/patients");
      const payload = await res.json();
      if (!res.ok) {
        setWorkflowRunMessage(payload?.error || "Failed to load patients.");
        setWorkflowRunPatients([]);
      } else {
        setWorkflowRunPatients(payload?.patients || []);
      }
    } catch (error) {
      console.error(error);
      setWorkflowRunMessage("Failed to load patients.");
      setWorkflowRunPatients([]);
    } finally {
      setLoadingWorkflowPatients(false);
    }
  };

  const runWorkflowFromDashboard = async () => {
    if (!selectedWorkflowForRun || !selectedRunPatient) return;
    if (runRequiresPhone && !hasSelectedRunPhone) return;
    if (expectedLabTests.length > 0 && missingExpectedLabTests.length > 0) return;

    setRunningManualWorkflow(true);
    setWorkflowRunMessage(null);
    try {
      const metadata: Record<string, unknown> = {};
      if (preparedRunLabResults.length > 0) metadata.lab_results = preparedRunLabResults;
      if (runPhoneOverride.trim()) metadata.phone_override = normalizePhone(runPhoneOverride);

      console.log("[DoctorDashboard] Manual workflow run start", {
        workflow_id: selectedWorkflowForRun.id,
        workflow_name: selectedWorkflowForRun.name,
        patient_id: selectedRunPatient.id,
        has_phone_override: !!metadata.phone_override,
        lab_results_count: preparedRunLabResults.length,
      });

      const res = await fetch("/api/workflow-executions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow_id: selectedWorkflowForRun.id,
          patient_id: selectedRunPatient.id,
          trigger_type: "manual",
          metadata,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        console.error("[DoctorDashboard] Manual workflow run failed", payload);
        setWorkflowRunMessage(payload?.error || "Manual trigger failed.");
        return;
      }

      console.log("[DoctorDashboard] Manual workflow run success", payload);
      setWorkflowRunMessage(payload?.message || "Workflow triggered successfully.");
      fetchWorkflowExecutions();
    } catch (error) {
      console.error(error);
      setWorkflowRunMessage("Manual trigger failed.");
    } finally {
      setRunningManualWorkflow(false);
    }
  };

  const triggerWorkflow = async (workflowId: string, patientId: string) => {
    setTriggeringWorkflow(workflowId);
    try {
      const res = await fetch('/api/workflow/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId, patientId })
      });
      const data = await res.json();
      if (data.success) {
        fetchWorkflowExecutions();
      } else {
        toast.error("Trigger failed: " + data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTriggeringWorkflow(null);
    }
  };

  useEffect(() => {
    if (activeTab === "calendar" && doctorInfo) { fetchCalendarData(calendarDate); setSelectedCalendarDay(null); }
    if (activeTab === "workflows" && doctorInfo) { 
      fetchWorkflowExecutions(); 
      fetchAvailableWorkflows();
    }
  }, [activeTab, calendarDate, doctorInfo]);

  useEffect(() => {
    if (activeTab !== "workflows" || !doctorInfo) return;
    const interval = setInterval(() => {
      fetchWorkflowExecutions();
    }, 15000);
    return () => clearInterval(interval);
  }, [activeTab, doctorInfo]);

  useEffect(() => {
    if (!showRunWorkflowDialog || !selectedWorkflowForRun) return;
    if (expectedLabTests.length === 0) {
      setRunLabResults([]);
      return;
    }
    setRunLabResults(prev => {
      const next = expectedLabTests.map(test => {
        const existing = prev.find(entry => entry.test_name.toLowerCase() === test.toLowerCase());
        return existing || createDashboardLabResult(test);
      });
      return next;
    });
  }, [showRunWorkflowDialog, selectedWorkflowForRunId]);

  const fetchAnalytics = async () => {
    if (!doctorInfo) return;
    const today = new Date();
    let fromDate = "", toDate = today.toISOString().split("T")[0];

    if (analyticsFilter === "yesterday") {
      const y = new Date(today); y.setDate(y.getDate() - 1); fromDate = toDate = y.toISOString().split("T")[0];
    } else if (analyticsFilter === "day_before") {
      const d = new Date(today); d.setDate(d.getDate() - 2); fromDate = toDate = d.toISOString().split("T")[0];
    } else if (analyticsFilter === "last_7_days") {
      const d = new Date(today); d.setDate(d.getDate() - 7); fromDate = d.toISOString().split("T")[0];
    } else if (analyticsFilter === "custom") {
      fromDate = customRange.from; toDate = customRange.to;
    }

    if (!fromDate) return;

    // Use full timestamp strings for more reliable TIMESTAMPTZ comparison
    const fromISO = fromDate + "T00:00:00Z";
    const toISO = toDate + "T23:59:59Z";

    const [qRes, aRes] = await Promise.all([
      supabase.from("queue").select("*", { count: "exact", head: true }).eq("doctor_id", doctorInfo.id).eq("status", "completed").gte("updated_at", fromISO).lte("updated_at", toISO),
      supabase.from("appointments").select("*", { count: "exact", head: true }).eq("doctor_id", doctorInfo.id).in("status", ["confirmed", "completed"]).gte("date", fromISO).lte("date", toISO),
    ]);
    setAnalyticsData({ patientsServed: qRes.count || 0, completedAppointments: aRes.count || 0 });
  };

  const fetchAnalyticDetails = async (type: 'served' | 'booked') => {
    if (!doctorInfo) return;
    setDetailsLoading(true);
    const today = new Date();
    let fromDate = "", toDate = today.toISOString().split("T")[0];

    if (analyticsFilter === "yesterday") {
      const y = new Date(today); y.setDate(y.getDate() - 1); fromDate = toDate = y.toISOString().split("T")[0];
    } else if (analyticsFilter === "day_before") {
      const d = new Date(today); d.setDate(d.getDate() - 2); fromDate = toDate = d.toISOString().split("T")[0];
    } else if (analyticsFilter === "last_7_days") {
      const d = new Date(today); d.setDate(d.getDate() - 7); fromDate = d.toISOString().split("T")[0];
    } else if (analyticsFilter === "custom") {
      fromDate = customRange.from; toDate = customRange.to;
    }

    if (!fromDate) {
        setDetailsLoading(false);
        return;
    }

    const fromISO = fromDate + "T00:00:00Z";
    const toISO = toDate + "T23:59:59Z";

    try {
      if (type === 'served') {
        const { data } = await supabase.from("queue").select("*, medical_records(title)").eq("doctor_id", doctorInfo.id).eq("status", "completed").gte("updated_at", fromISO).lte("updated_at", toISO).order("updated_at", { ascending: false });
        setViewingAnalyticDetails({ title: 'Completed Consultations', type: 'served', data: data || [] });
      } else {
        const { data } = await supabase.from("appointments").select("*").eq("doctor_id", doctorInfo.id).in("status", ["confirmed", "completed"]).gte("date", fromISO).lte("date", toISO).order("date", { ascending: false });
        setViewingAnalyticDetails({ title: 'Successful Bookings', type: 'booked', data: data || [] });
      }
    } catch (error) { console.error(error); }
    finally { setDetailsLoading(false); }
  };

  const callNextPatient = async () => {
    const next = queue.find(q => q.status === "waiting");
    if (!next) return;
    try {
      await supabase.from("queue").update({ status: "in-treatment", service_start_time: new Date().toISOString() }).eq("id", next.id);
      await supabase.from("notifications").insert({
        type: "queue", title: "Your Turn!", message: `Proceed to Dr. ${doctorInfo?.name}. Token: ${next.token_number}`,
        read: false, created_at: new Date().toISOString(), metadata: { patientId: next.patient_id, doctorId: doctorInfo?.id, tokenNumber: next.token_number },
      });
      fetchDoctorData();
    } catch (error) { console.error(error); }
  };

  const skipPatient = async (patientId: string) => {
    setSkipping(true);
    try {
      await supabase.from("queue").update({ status: "skipped", updated_at: new Date().toISOString() }).eq("id", patientId);
      // Automatically call next
      await callNextPatient();
      fetchDoctorData();
    } catch (error) { console.error(error); }
    finally { setSkipping(false); }
  };

  const transferPatient = async (patientId: string, targetDoctorId: string) => {
    setTransferLoading(true);
    try {
      await supabase.from("queue").update({ 
        doctor_id: targetDoctorId, 
        status: "waiting", 
        position: 999, // Move to end of new doctor's queue
        updated_at: new Date().toISOString() 
      }).eq("id", patientId);
      
      setTransferDialogOpen(false);
      fetchDoctorData();
    } catch (error) { console.error(error); }
    finally { setTransferLoading(false); }
  };

  const toggleStatus = async () => {
    const newStatus = isAway ? 'active' : 'away';
    try {
      await supabase.from("doctors").update({ status: newStatus }).eq("id", doctorInfo.id);
      setIsAway(!isAway);
    } catch (error) { console.error(error); }
  };

  const completeVisit = async (patientId: string) => {
    if (!reportForm.diagnosis || !reportForm.prescription) { 
        toast.error("Please fill in diagnosis and prescription."); 
        return; 
    }
    setSubmittingReport(true);
    try {
      const p = queue.find(q => q.id === patientId);
      if (!p) return;
      await supabase.from("reports").insert({ patient_id: p.patient_id, doctor_id: doctorInfo.id, symptoms: reportForm.symptoms, diagnosis: reportForm.diagnosis, prescription: reportForm.prescription, notes: reportForm.notes, status: 'submitted' });
      await supabase.from("queue").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", patientId);
      setReportForm({ symptoms: "", diagnosis: "", prescription: "", notes: "" });
      toast.success("Visit report submitted successfully!");
      fetchDoctorData();
    } catch (error) { 
      console.error(error); 
      toast.error("Failed to submit report."); 
    } 
    finally { setSubmittingReport(false); }
  };

  const movePatient = async (patientId: string, currentPos: number, direction: "up" | "down") => {
    const w = queue.filter(q => q.status === "waiting");
    const targetPos = direction === "up" ? currentPos - 1 : currentPos + 1;
    if (targetPos < 1 || targetPos > w.length) return;
    const other = w.find(p => p.position === targetPos);
    if (!other) return;
    try {
      await Promise.all([
        supabase.from("queue").update({ position: targetPos }).eq("id", patientId),
        supabase.from("queue").update({ position: currentPos }).eq("id", other.id),
      ]);
      fetchDoctorData();
    } catch (error) { console.error(error); }
  };

  const getDaysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  const toLocalDateStr = (iso: string) => iso ? iso.split("T")[0] : "";

  const fetchCalendarData = async (d: Date) => {
    if (!doctorInfo) return;
    setCalendarLoading(true);
    const yr = d.getFullYear(), m = d.getMonth();
    const from = `${yr}-${String(m + 1).padStart(2, "0")}-01`;
    const to = `${yr}-${String(m + 1).padStart(2, "0")}-${String(getDaysInMonth(d)).padStart(2, "0")}T23:59:59`;
    const [aRes, qRes] = await Promise.all([
      supabase.from("appointments").select("*").eq("doctor_id", doctorInfo.id).gte("date", from).lte("date", to).order("date").order("time_slot"),
      supabase.from("queue").select("*").eq("doctor_id", doctorInfo.id).gte("date", from).lte("date", to).order("date").order("position"),
    ]);
    setCalendarAppts(aRes.data || []); setCalendarQueue(qRes.data || []); setCalendarLoading(false);
  };

  if (!isLoaded || !isSignedIn || (user?.publicMetadata?.role as string) !== "doctor") {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="spinner" /></div>;
  }

  const tabs = [
    { key: "queue", label: "Queue", icon: Activity },
    { key: "appointments", label: "Appointments", icon: Calendar },
    { key: "history", label: "History", icon: HistoryIcon },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
    { key: "calendar", label: "Calendar", icon: CalendarDays },
    { key: "workflows", label: "Workflows", icon: Zap },
    { key: "liveboard", label: "Live Board", icon: Monitor },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Trigger */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden -ml-2">
                  <Menu size={20} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
                <div className="sr-only">
                  <SheetTitle>Navigation Menu</SheetTitle>
                  <SheetDescription>Doctor Dashboard navigation and settings</SheetDescription>
                </div>
                <div className="p-6 border-b border-border bg-muted/30">
                   <Logo height={30} />
                   <p className="text-[10px] uppercase font-black text-muted-foreground/40 mt-1">Doctor Portal Nav</p>
                </div>
                <div className="flex-1 overflow-y-auto py-4">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => {
                        setActiveTab(tab.key);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-6 py-4 transition-colors text-left ${
                        activeTab === tab.key 
                          ? 'bg-primary/10 text-primary border-r-4 border-primary font-bold' 
                          : 'text-muted-foreground hover:bg-muted font-medium'
                      }`}
                    >
                      <tab.icon size={18} />
                      <span className="text-sm">{tab.label}</span>
                    </button>
                  ))}
                </div>
                <div className="p-4 border-t border-border mt-auto">
                    <Button variant="outline" className="w-full justify-start gap-3 h-11 text-rose-500 hover:text-rose-600 hover:bg-rose-50 border-none" onClick={() => signOut()}>
                         <LogOut size={18} /> Logout
                    </Button>
                </div>
              </SheetContent>
            </Sheet>
            
            <Link href="/doctor" className="no-underline flex items-center gap-2 overflow-hidden">
               <Logo height={26} />
               <span className="hidden xs:inline-block text-[9px] uppercase tracking-[0.1em] font-black text-muted-foreground/40 bg-muted/50 px-1.5 py-0.5 rounded-md mt-0.5 truncate">Doctor Portal</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Button variant="ghost" size="icon" onClick={() => setShowNotifications(!showNotifications)} className="relative">
                <Bell size={20} className="text-muted-foreground" />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-card" />
                )}
              </Button>
              <AnimatePresence>
                {showNotifications && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="p-4 border-b border-border bg-muted/30">
                      <p className="text-sm font-bold">Notifications</p>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-xs text-muted-foreground text-center">No new notifications</p>
                      ) : notifications.map(n => (
                        <div key={n.id} className="p-4 border-b border-border hover:bg-muted transition-colors cursor-pointer">
                          <p className="text-[13px] font-bold">{n.title}</p>
                          <p className="text-[12px] text-muted-foreground mt-0.5">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-2">{new Date(n.created_at).toLocaleTimeString()}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-10 pb-20">
        
        {/* Welcome Section */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-[28px] font-black text-foreground tracking-tight mb-1">
              Welcome, Dr. {doctorInfo?.name?.replace(/^Dr\.?\s*/i, "") || user?.firstName || "Doctor"}
            </h2>
            <p className="text-[15px] font-medium text-muted-foreground">
              {doctorInfo?.specialization || "Medical Professional"} · {isAway ? "Away" : "Active"}
            </p>
          </div>
          <Button variant={isAway ? "default" : "outline"} onClick={toggleStatus} className={`gap-2 rounded-xl h-12 px-6 font-bold ${isAway ? 'bg-amber-500 hover:bg-amber-600 border-none' : 'border-border'}`}>
            {isAway ? <Coffee size={18} /> : <Activity size={18} />}
            {isAway ? "Back to Active" : "Set to Away"}
          </Button>
        </div>

        {/* Global Search */}
        <div className="relative mb-8">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text" value={doctorSearchQuery} onChange={e => setDoctorSearchQuery(e.target.value)}
            placeholder="Search patients, appointments, IDs..."
            className="pl-9 pr-8"
          />
          {doctorSearchQuery && (
            <button onClick={() => setDoctorSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              <X size={15} />
            </button>
          )}
        </div>

        {/* KPI Grid */}
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Today's Served", value: stats.patientsServed, icon: Users, color: "text-green-600", bg: "bg-green-50", action: () => setActiveTab("history") },
            { label: "Waiting Now", value: stats.waitingPatients, icon: Activity, color: "text-primary", bg: "bg-primary/10", solid: true, action: () => setActiveTab("queue") },
            { label: "Upcoming Appts", value: stats.todayAppointments, icon: Calendar, color: "text-primary", bg: "bg-primary/10", action: () => setActiveTab("appointments") },
            { label: "Avg Wait", value: `${stats.avgWaitTime}m`, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
          ].map((s) => (
            <div key={s.label} onClick={s.action} className={`p-5 rounded-2xl border ${s.solid ? 'bg-primary border-primary text-white' : 'bg-card border-border shadow-sm'} ${s.action ? 'cursor-pointer hover:border-primary/40 transition-all' : ''}`}>
              <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center mb-3 ${s.solid ? 'bg-card/20' : s.bg}`}>
                <s.icon size={20} className={s.solid ? 'text-white' : s.color} />
              </div>
              <div className={`text-[28px] font-black tracking-tight leading-none mb-1.5 ${s.solid ? 'text-white' : 'text-foreground'}`}>{s.value}</div>
              <div className={`text-[13px] font-bold ${s.solid ? 'text-white/80' : 'text-muted-foreground'}`}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs - Hidden on Mobile, Fixed Bottom Nav handled above or via Hamburger */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="mb-8">
          <TabsList className="hidden md:flex w-full h-auto bg-muted p-1 rounded-xl overflow-x-auto">
            {tabs.map(tab => (
              <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-1.5 text-[12px] flex-1 min-w-[90px]">
                <tab.icon size={13} />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* --- DYNAMIC TAB CONTENT --- */}
        <AnimatePresence mode="wait">
          
          {/* QUEUE */}
          {activeTab === "queue" && (
            <motion.div key="queue" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}>
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-border bg-muted/30 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="text-[18px] font-extrabold text-foreground flex items-center gap-2">
                      <Activity size={18} className="text-primary" /> Live Queue
                    </h3>
                    <p className="text-[13px] font-medium text-muted-foreground mt-0.5">Manage and prioritize arriving patients</p>
                  </div>
                  <Button onClick={callNextPatient} disabled={!queue.some(p => p.status === "waiting") || queue.some(p => p.status === "in-treatment")} size="sm" className="gap-1.5">
                    Call Next <ChevronRight size={14} />
                  </Button>
                </div>

                <div className="max-h-[800px] overflow-y-auto w-full">
                  {loading ? (
                    <div className="flex items-center justify-center p-16"><div className="spinner" /></div>
                  ) : (
                    <div>
                      {/* Active Patient */}
                      {filteredQueue.filter(p => p.status === "in-treatment").map(active => (
                        <div key={active.id} className="p-6 md:p-8 bg-primary/10 border-b-2 border-primary/20">
                          <div className="flex flex-col sm:flex-row gap-5 mb-8 items-start sm:items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="min-w-[64px] h-14 px-4 bg-primary text-white rounded-2xl flex items-center justify-center text-[18px] font-black shadow-[0_4px_10px_rgba(0,102,204,0.3)] shrink-0">
                                {active.token_number}
                              </div>
                              <div>
                                <span className="inline-block text-[10px] font-extrabold bg-primary text-white px-2 py-0.5 rounded-[4px] uppercase tracking-wider mb-1.5">In Treatment</span>
                                <h3 className="text-[22px] font-black text-foreground tracking-tight leading-none mb-1">{active.patient_name}</h3>
                                <p className="text-[13px] font-semibold text-muted-foreground">Token #{active.token_number} · {active.is_emergency ? "Emergency" : "General Visit"}</p>
                              </div>
                            </div>
                            {active.medical_records?.file_url && (
                              <a href={active.medical_records.file_url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 border-[1.5px] border-primary/20 bg-card text-primary rounded-xl text-[13px] font-bold no-underline hover:bg-primary hover:text-white transition-all">
                                <Eye size={16} /> View Record
                              </a>
                            )}
                          </div>

                          <div className="grid md:grid-cols-2 gap-5 mb-6">
                            <div className="space-y-4">
                              <div>
                                <Label className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground mb-1.5"><ClipboardList size={13} className="text-primary"/> Symptoms</Label>
                                <textarea placeholder="Patient symptoms..." value={reportForm.symptoms} onChange={e => setReportForm(f => ({ ...f, symptoms: e.target.value }))}
                                  className="w-full p-3 rounded-xl border border-border bg-card text-[14px] text-foreground min-h-[100px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-y" />
                              </div>
                              <div>
                                <Label className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground mb-1.5"><PenTool size={13} className="text-primary"/> Diagnosis</Label>
                                <textarea placeholder="Final diagnosis..." value={reportForm.diagnosis} onChange={e => setReportForm(f => ({ ...f, diagnosis: e.target.value }))}
                                  className="w-full p-3 rounded-xl border border-border bg-card text-[14px] font-bold text-foreground min-h-[100px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-y" />
                              </div>
                            </div>
                            <div className="space-y-4">
                              <div>
                                <Label className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground mb-1.5"><FileText size={13} className="text-green-600"/> Prescription</Label>
                                <textarea placeholder="Medications, dosage..." value={reportForm.prescription} onChange={e => setReportForm(f => ({ ...f, prescription: e.target.value }))}
                                  className="w-full p-3 rounded-xl border border-border bg-card text-[14px] font-medium text-foreground min-h-[100px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-y" />
                              </div>
                              <div>
                                <Label className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground mb-1.5"><Settings size={13} className="text-muted-foreground"/> Clinical Notes</Label>
                                <textarea placeholder="Internal notes..." value={reportForm.notes} onChange={e => setReportForm(f => ({ ...f, notes: e.target.value }))}
                                  className="w-full p-3 rounded-xl border border-border bg-card text-[14px] italic text-muted-foreground min-h-[100px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-y" />
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-4 border-t border-border flex-wrap gap-4">
                            <div className="flex gap-2 w-full sm:w-auto">
                              {availableWorkflows.length > 0 && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="flex-1 sm:flex-initial gap-2 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 h-10 px-4">
                                      <Zap size={16} /> Assist
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-[240px]">
                                    <DropdownMenuLabel>Trigger Workflow</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {availableWorkflows.map(wf => (
                                      <DropdownMenuItem key={wf.id} disabled={!!triggeringWorkflow} onClick={() => triggerWorkflow(wf.id, active.patient_id)} className="flex flex-col items-start gap-1 p-3">
                                        <div className="flex items-center gap-2 font-bold text-sm">
                                          {triggeringWorkflow === wf.id ? <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /> : <Play size={12} />}
                                          {wf.name}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">{wf.description}</p>
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                              <Button variant="outline" onClick={() => skipPatient(active.id)} disabled={skipping} className="flex-1 sm:flex-initial border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 font-bold gap-2">
                                <FastForward size={15} /> Skip
                              </Button>
                              <Button variant="outline" onClick={() => setTransferDialogOpen(true)} className="flex-1 sm:flex-initial border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 font-bold gap-2">
                                <ArrowRightLeft size={15} /> Transfer
                              </Button>
                            </div>
                            <Button onClick={() => completeVisit(active.id)} disabled={submittingReport || !reportForm.diagnosis || !reportForm.prescription} className="bg-green-600 hover:bg-green-600/90 font-bold gap-1.5 w-full sm:w-auto">
                              {submittingReport ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={15} />} Complete Visit
                            </Button>
                          </div>
                        </div>
                      ))}

                      {/* Waiting Queue */}
                      {filteredQueue.filter(p => p.status === "waiting").length === 0 ? (
                        <div className="text-center py-16 px-6">
                          <Activity size={32} className="text-muted-foreground/40 mx-auto mb-4" />
                          <p className="text-[15px] font-bold text-muted-foreground">No patients currently in queue.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          <AnimatePresence>
                            {filteredQueue.filter(p => p.status === "waiting").map((p, i) => (
                              <motion.div layout key={p.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }}
                                className={`flex items-center justify-between p-5 hover:bg-muted transition-colors ${p.is_emergency ? "bg-destructive/10 hover:bg-destructive/20" : ""}`}>
                                <div className="flex items-center gap-4">
                                  <div className={`min-w-[48px] h-12 px-2 rounded-full flex items-center justify-center font-black text-[16px] shrink-0 border-[1.5px] ${
                                    p.is_emergency ? "bg-card text-destructive border-destructive/30" : i === 0 ? "bg-primary text-white border-primary shadow-[0_2px_8px_rgba(0,102,204,0.2)]" : "bg-card text-foreground border-border"
                                  }`}>
                                    {p.position}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="text-[16px] font-extrabold text-foreground tracking-tight">{p.patient_name}</span>
                                      {p.is_emergency && <span className="text-[9px] font-extrabold bg-destructive text-white px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider"><AlertTriangle size={10} className="inline mr-1" />Emergency</span>}
                                      {i===0 && !p.is_emergency && <span className="text-[9px] font-extrabold bg-primary text-white px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider">Next</span>}
                                    </div>
                                    <div className="text-[13px] font-semibold text-muted-foreground flex gap-2 items-center">
                                      <span className="bg-muted border border-border px-1.5 py-0.5 rounded">TKN: {p.token_number}</span>
                                      <span className="flex items-center gap-1"><Clock size={12}/> ~{p.estimated_wait_time}m</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                                  <button disabled={p.position <= 1 || p.is_emergency} onClick={(e) => { e.stopPropagation(); movePatient(p.id, p.position, "up"); }} 
                                    className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"><ChevronUp size={16}/></button>
                                  <button disabled={p.position >= queue.length} onClick={(e) => { e.stopPropagation(); movePatient(p.id, p.position, "down"); }} 
                                    className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"><ChevronDown size={16}/></button>
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* APPOINTMENTS */}
          {activeTab === "appointments" && (
            <motion.div key="appointments" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}>
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-border bg-muted/30">
                  <h3 className="text-[18px] font-extrabold text-foreground flex items-center gap-2 mb-3">
                    <Calendar size={18} className="text-primary" /> Appointment Schedule
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {["all", "pending", "confirmed", "completed"].map(s => (
                      <Button key={s} size="sm" variant={appointmentStatusFilter === s ? "default" : "outline"} onClick={() => setAppointmentStatusFilter(s as any)} className="rounded-full text-[11px] h-7 px-3 uppercase tracking-wider">{s}</Button>
                    ))}
                  </div>
                </div>

                <div className="p-6">
                  {filteredAppointments.length === 0 ? (
                    <div className="text-center py-16"><Calendar size={32} className="text-muted-foreground/40 mx-auto mb-4" /><p className="text-[15px] font-bold text-muted-foreground">No appointments match filter.</p></div>
                  ) : (
                    <div className="grid gap-3">
                      {pagedAppointments.map((appt, i) => {
                        const todayStr = new Date().toISOString().split("T")[0];
                        const isToday = appt.date?.startsWith(todayStr);
                        const isPast = new Date(`${appt.date?.split(' ')[0] || appt.date} ${appt.time_slot}`) < new Date();
                        return (
                          <div key={appt.id} className={`p-5 border rounded-xl flex items-center justify-between ${
                            isToday && !isPast ? "border-primary/40 bg-primary/10 shadow-sm" : isPast ? "border-border bg-muted/50 opacity-70" : "border-border bg-card"
                          }`}>
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isToday && !isPast ? "bg-primary text-white" : "bg-muted border border-border text-muted-foreground"}`}><UserIcon size={16}/></div>
                              <div>
                                <h4 className="text-[15px] font-extrabold text-foreground">{appt.patient_name}</h4>
                                <div className="text-[12px] font-semibold text-muted-foreground mt-0.5">{new Date(appt.date).toLocaleDateString("en-US", { weekday:"short", month:"long", day:"numeric"})}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[15px] font-black text-foreground">{appt.time_slot}</div>
                              <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-[4px] uppercase tracking-wider border ${
                                appt.status==="confirmed" ? "bg-green-50 text-green-600 border-green-600/20" : appt.status==="completed" ? "bg-muted text-muted-foreground border-border" : "bg-amber-50 text-amber-600 border-amber-500/20"
                              }`}>{appt.status}</span>
                            </div>
                          </div>
                        )
                      })}
                      {filteredAppointments.length > APPTS_PER_PAGE && (
                        <div className="flex items-center justify-between pt-4 border-t border-border">
                          <span className="text-xs text-muted-foreground">Page {apptPage} of {Math.ceil(filteredAppointments.length / APPTS_PER_PAGE)}</span>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setApptPage(p => Math.max(1, p - 1))} disabled={apptPage === 1}><ChevronLeft size={14} /></Button>
                            <Button size="sm" variant="outline" onClick={() => setApptPage(p => Math.min(Math.ceil(filteredAppointments.length / APPTS_PER_PAGE), p + 1))} disabled={apptPage >= Math.ceil(filteredAppointments.length / APPTS_PER_PAGE)}><ChevronRight size={14} /></Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* WORKFLOWS */}
          {activeTab === "workflows" && (
            <motion.div key="workflows" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}>
              <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="px-6 py-6 md:px-8 md:py-7 border-b border-border bg-gradient-to-r from-[#ecfeff] via-[#f0f9ff] to-[#eef2ff]">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h3 className="text-[20px] font-black text-foreground tracking-tight flex items-center gap-2">
                        <Zap size={19} className="text-amber-500" /> Workflow Command Center
                      </h3>
                      <p className="text-[13px] font-medium text-muted-foreground mt-1">
                        Launch, monitor, and review automations without opening the builder.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          fetchWorkflowExecutions();
                          fetchAvailableWorkflows();
                        }}
                        disabled={fetchingWorkflows}
                        className="h-8 bg-card"
                      >
                        Refresh
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openWorkflowRunDialog()}
                        disabled={availableWorkflows.length === 0}
                        className="h-8 gap-1.5 bg-card"
                      >
                        <Play size={13} /> Run Now
                      </Button>
                      <Button asChild size="sm" className="h-8 bg-primary hover:bg-[#0097a7] text-white gap-1.5">
                        <Link href="/doctor/workflows">
                          <GitBranch size={13} /> Design
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { label: "Active Workflows", value: availableWorkflows.length, icon: GitBranch },
                      { label: "Recent Runs", value: workflowExecutions.length, icon: Activity },
                      { label: "Ready Actions", value: availableWorkflows.length > 0 ? "Manual + Auto" : "Set up needed", icon: Play },
                    ].map((metric) => (
                      <div key={metric.label} className="rounded-2xl border border-white/70 bg-white/70 backdrop-blur px-4 py-3">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-bold text-muted-foreground">
                          <metric.icon size={12} className="text-primary" /> {metric.label}
                        </div>
                        <p className="mt-1 text-[22px] font-black text-foreground leading-none">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 md:p-8">
                  {fetchingWorkflows ? (
                    <div className="flex items-center justify-center p-16"><div className="spinner" /></div>
                  ) : workflowExecutions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
                      <Zap size={32} className="text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-[16px] font-extrabold text-foreground">No execution history yet</p>
                      <p className="text-[12px] text-muted-foreground mt-1">Run one workflow to populate live activity here.</p>
                      {availableWorkflows.length > 0 && (
                        <div className="mt-6 max-w-3xl mx-auto grid gap-3">
                          {availableWorkflows.slice(0, 6).map((wf, index) => (
                            <div
                              key={wf.id}
                              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30"
                            >
                              <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#00bcd4] via-[#22c55e] to-[#f59e0b] opacity-70" />
                              <div className="pl-3 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary/10 px-1.5 text-[10px] font-black text-primary">
                                      {index + 1}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                      <GitBranch size={10} />
                                      {String(wf.status || "active")}
                                    </span>
                                  </div>
                                  <p className="text-[15px] font-extrabold text-foreground truncate">
                                    {wf.name}
                                  </p>
                                  <p className="text-[12px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                    {wf.description || "Ready to run. Add steps or launch it now from dashboard."}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  className="h-8 text-[11px] shrink-0 bg-primary/90 hover:bg-primary text-white gap-1.5"
                                  onClick={() => openWorkflowRunDialog(wf.id)}
                                >
                                  <Play size={12} />
                                  Run
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {workflowExecutions.map((ex, i) => {
                        const normalizedStatus = String(ex.status || "").toLowerCase();
                        const statusTone = {
                          completed: "bg-[#dcfce7] text-[#166534] border-[#86efac]",
                          failed: "bg-[#fee2e2] text-[#991b1b] border-[#fca5a5]",
                          running: "bg-[#fef9c3] text-[#854d0e] border-[#fde047]",
                          pending: "bg-muted text-muted-foreground border-border",
                        } as const;
                        const executionAt = ex.started_at || ex.created_at;
                        return (
                          <motion.div
                            key={ex.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                          >
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[15px] font-extrabold text-foreground truncate">
                                  {ex.workflow_name || "Workflow"}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  Execution #{ex.id.split("-")[0]} {ex.patient_id ? `- Patient ${ex.patient_id.slice(0, 8)}` : "- System"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={`text-[10px] uppercase font-black border ${statusTone[normalizedStatus as keyof typeof statusTone] || statusTone.pending}`}>
                                  {normalizedStatus || "pending"}
                                </Badge>
                                <span className="text-[11px] font-semibold text-muted-foreground">
                                  {executionAt
                                    ? new Date(executionAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                                    : "N/A"}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="px-6 pb-6 md:px-8 md:pb-8">
                  <div className="rounded-2xl border border-border bg-muted/20 p-5">
                    <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-4">Automation Capabilities</h4>
                    <div className="grid sm:grid-cols-3 gap-4">
                      {[
                        { icon: Phone, title: "AI Voice Calls", desc: "Automated follow-ups and appointment confirmations via ElevenLabs" },
                        { icon: Bell, title: "In-App + SMS", desc: "Doctor and patient notifications across workflow outcomes" },
                        { icon: Play, title: "Manual Trigger", desc: "Run complex protocols with guided dialog inputs" },
                      ].map(cap => (
                        <div key={cap.title} className="p-4 rounded-xl bg-card border border-border shadow-sm">
                          <cap.icon size={16} className="text-primary mb-2" />
                          <h5 className="text-[13px] font-bold mb-1">{cap.title}</h5>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{cap.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* HISTORY */}
          {activeTab === "history" && (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}>
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-border bg-muted/30">
                  <h3 className="text-[18px] font-extrabold text-foreground flex items-center gap-2 mb-3">
                    <Users size={18} className="text-green-600" /> Patient History
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {[ {key:"all", label:"All"}, {key:"has_report", label:"With Report"}, {key:"no_report", label:"No Report"} ].map(f => (
                      <Button key={f.key} size="sm" variant={historyReportFilter === f.key ? "default" : "outline"} onClick={() => setHistoryReportFilter(f.key as any)} className="rounded-full text-[11px] h-7 px-3">{f.label}</Button>
                    ))}
                  </div>
                </div>

                <div className="p-0">
                  {filteredHistory.length === 0 ? (
                    <div className="text-center py-16"><FileText size={32} className="text-muted-foreground/40 mx-auto mb-4" /><p className="text-[15px] font-bold text-muted-foreground">No history records match criteria.</p></div>
                  ) : (
                    <div className="divide-y divide-border">
                      {pagedHistory.map((report, i) => {
                        return (
                          <div key={report.id} className="flex items-center justify-between p-5 hover:bg-muted transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 font-extrabold flex items-center justify-center shrink-0 border border-green-100 shadow-sm">
                                {report.users?.name?.charAt(0) || "P"}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-[15px] font-extrabold text-foreground leading-tight truncate max-w-[150px]">{report.users?.name || "Private Patient"}</h4>
                                <div className="text-[11px] font-black text-muted-foreground mt-0.5 uppercase tracking-widest tabular-nums">
                                  {new Date(report.created_at).toLocaleDateString()} · {new Date(report.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="hidden sm:flex flex-col items-end mr-2 text-right">
                                <span className="text-[11px] font-black text-primary uppercase tracking-widest">{report.diagnosis || "Consultation"}</span>
                                <span className="text-[10px] text-muted-foreground truncate max-w-[100px] italic">"{report.symptoms}"</span>
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => setViewingReport({ ...report, patient_name: report.users?.name || "Patient" })} 
                                className="h-9 px-4 rounded-xl text-green-600 border-green-600/30 hover:bg-green-50 hover:border-green-600 font-bold gap-2 shadow-sm"
                              >
                                <FileText size={14}/> 
                                Details
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                      {filteredHistory.length > HISTORY_PER_PAGE && (
                        <div className="flex items-center justify-between p-5 border-t border-border bg-muted/30">
                          <span className="text-xs text-muted-foreground">Page {historyPage} of {Math.ceil(filteredHistory.length / HISTORY_PER_PAGE)}</span>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1}><ChevronLeft size={14} /></Button>
                            <Button size="sm" variant="outline" onClick={() => setHistoryPage(p => Math.min(Math.ceil(filteredHistory.length / HISTORY_PER_PAGE), p + 1))} disabled={historyPage >= Math.ceil(filteredHistory.length / HISTORY_PER_PAGE)}><ChevronRight size={14} /></Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ANALYTICS */}
          {activeTab === "analytics" && (
            <motion.div key="analytics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}>
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-border bg-muted/30">
                  <h3 className="text-[18px] font-extrabold text-foreground flex items-center gap-2 mb-1">
                    <BarChart3 size={18} className="text-primary" /> Statistics & Analytics
                  </h3>
                  <p className="text-[13px] font-medium text-muted-foreground">Analyze your patient flow and appointment completion</p>
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap gap-2 mb-6">
                    {[
                      { key: "yesterday", label: "Yesterday" },
                      { key: "day_before", label: "Day Before" },
                      { key: "last_7_days", label: "Last 7 Days" },
                      { key: "custom", label: "Custom Range" },
                    ].map(f => (
                      <Button key={f.key} size="sm" variant={analyticsFilter === f.key ? "default" : "outline"} onClick={() => setAnalyticsFilter(f.key as any)} className="rounded-[10px] text-[13px] font-bold">
                        {f.label}
                      </Button>
                    ))}
                  </div>

                  {analyticsFilter === "custom" && (
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                      <div className="flex-1 space-y-1.5">
                        <Label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">From Date</Label>
                        <Input type="date" value={customRange.from} onChange={e => setCustomRange(r => ({ ...r, from: e.target.value }))} className="h-10 text-sm" />
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <Label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">To Date</Label>
                        <Input type="date" value={customRange.to} onChange={e => setCustomRange(r => ({ ...r, to: e.target.value }))} className="h-10 text-sm" />
                      </div>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-5">
                    <div onClick={() => fetchAnalyticDetails('served')} className="p-6 bg-primary/10 border border-primary/20 rounded-2xl flex flex-col justify-center cursor-pointer hover:bg-primary/10/70 transition-all">
                      <p className="text-[14px] font-extrabold text-primary uppercase tracking-wider mb-2">Patients Served</p>
                      <p className="text-[42px] font-black text-primary leading-none tracking-tight">{analyticsData.patientsServed}</p>
                      <p className="text-[13px] font-semibold text-primary/70 mt-2">Completed queue visits</p>
                    </div>
                    <div onClick={() => fetchAnalyticDetails('booked')} className="p-6 bg-green-50 border border-green-600/20 rounded-2xl flex flex-col justify-center cursor-pointer hover:bg-green-50/70 transition-all">
                      <p className="text-[14px] font-extrabold text-green-600 uppercase tracking-wider mb-2">Completed Appointments</p>
                      <p className="text-[42px] font-black text-green-600 leading-none tracking-tight">{analyticsData.completedAppointments}</p>
                      <p className="text-[13px] font-semibold text-green-600/70 mt-2">Fulfilled bookings</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* CALENDAR */}
          {activeTab === "calendar" && (
            <motion.div key="calendar" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-4">
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-[18px] font-extrabold text-foreground flex items-center gap-2 mb-1">
                      <CalendarDays size={18} className="text-primary" /> Schedule Calendar
                    </h3>
                    <p className="text-[12px] sm:text-[13px] font-medium text-muted-foreground flex flex-wrap items-center gap-2 sm:gap-3">
                      <span>{calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                      {calendarLoading && <span className="text-[11px] text-primary font-bold animate-pulse inline-block">Loading...</span>}
                      <span className="flex items-center gap-1.5 ml-0 sm:ml-2"><span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-[3px] bg-primary" /> Appt</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-[3px] bg-primary" /> Queue</span>
                    </p>
                  </div>
                  <div className="flex w-full sm:w-auto bg-card border border-border rounded-xl overflow-hidden shadow-sm shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="flex-1 sm:flex-none rounded-none border-r border-border min-h-[44px]"><ChevronLeft size={16} /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { setCalendarDate(new Date()); setSelectedCalendarDay(null); }} className="flex-1 sm:flex-none rounded-none border-r border-border min-h-[44px] text-[13px] font-extrabold">Today</Button>
                    <Button variant="ghost" size="sm" onClick={() => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="flex-1 sm:flex-none rounded-none min-h-[44px]"><ChevronRight size={16} /></Button>
                  </div>
                </div>

                <div className="p-3 sm:p-6">
                  <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 sm:mb-3">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                      <div key={d} className="text-center text-[10px] sm:text-[12px] font-black text-muted-foreground tracking-wider uppercase">
                        <span className="sm:hidden">{d.substring(0, 1)}</span>
                        <span className="hidden sm:inline">{d}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1 sm:gap-2">
                    {Array.from({ length: getFirstDayOfMonth(calendarDate) }).map((_, i) => <div key={`empty-${i}`} className="min-h-[40px] sm:min-h-[80px]" />)}
                    {Array.from({ length: getDaysInMonth(calendarDate) }).map((_, i) => {
                      const day = i + 1;
                      const dateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const dayAppts = calendarAppts.filter(a => toLocalDateStr(a.date) === dateStr);
                      const dayQueue = calendarQueue.filter(q => toLocalDateStr(q.date) === dateStr);
                      const isToday = dateStr === new Date().toISOString().split("T")[0];
                      const isSelected = selectedCalendarDay === dateStr;
                      const hasItems = dayAppts.length > 0 || dayQueue.length > 0;
                      
                      return (
                        <div key={day} onClick={() => setSelectedCalendarDay(isSelected ? null : dateStr)}
                          className={`min-h-[50px] sm:min-h-[85px] p-1 sm:p-2 rounded-xl border flex flex-col cursor-pointer transition-all ${
                            isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" :
                            isToday ? "border-primary bg-primary/10 shadow-[0_2px_8px_rgba(0,102,204,0.15)]" :
                            hasItems ? "border-border bg-card shadow-sm hover:border-border" :
                            "border-border bg-muted hover:bg-card"
                          }`}>
                          <span className={`text-[11px] sm:text-[13px] font-black text-center sm:text-right sm:mb-1.5 ${isSelected ? "text-primary" : isToday ? "text-primary" : "text-muted-foreground"}`}>{day}</span>
                          
                          {/* Desktop details */}
                          <div className="hidden sm:block space-y-1 mt-1">
                            {dayAppts.slice(0, 2).map(a => (
                              <div key={a.id} className="text-[10px] font-bold bg-primary text-white rounded-[4px] px-1.5 py-0.5 truncate tracking-tight">{a.time_slot} {a.patient_name.split(" ")[0]}</div>
                            ))}
                            {dayQueue.slice(0, 1).map(q => (
                              <div key={q.id} className={`text-[10px] font-bold rounded-[4px] px-1.5 py-0.5 truncate tracking-tight ${q.is_emergency ? "bg-destructive text-white" : "bg-primary text-white"}`}>#{q.token_number} {q.patient_name.split(" ")[0]}</div>
                            ))}
                            {(dayAppts.length + dayQueue.length > 3) && <div className="text-[10px] font-bold text-muted-foreground mt-0.5 px-1 truncate">+{dayAppts.length + dayQueue.length - 3} more</div>}
                          </div>

                          {/* Mobile dots indicator */}
                          <div className="sm:hidden flex flex-wrap justify-center gap-1 mt-auto pt-1">
                            {dayAppts.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                            {dayQueue.length > 0 && <div className={`w-1.5 h-1.5 rounded-full ${dayQueue.some(q => q.is_emergency) ? 'bg-destructive' : 'bg-primary'}`} />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              
              <AnimatePresence>
                {selectedCalendarDay && (() => {
                  const dayAppts = calendarAppts.filter(a => toLocalDateStr(a.date) === selectedCalendarDay);
                  const dayQueue = calendarQueue.filter(q => toLocalDateStr(q.date) === selectedCalendarDay);
                  const displayDate = new Date(selectedCalendarDay + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
                  
                  return (
                    <motion.div key={selectedCalendarDay} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}>
                      <div className="bg-card border-[1.5px] border-primary/20 rounded-2xl shadow-lg overflow-hidden">
                        <div className="px-4 sm:px-6 py-4 border-b border-border flex items-start sm:items-center justify-between gap-4 bg-primary/10">
                          <div>
                            <h4 className="text-[15px] sm:text-[16px] font-extrabold text-primary flex items-center gap-2"><CalendarDays size={18} /> {displayDate}</h4>
                            <p className="text-[11px] sm:text-[12px] font-bold text-muted-foreground mt-0.5">{dayAppts.length} appointments, {dayQueue.length} queue entries</p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => setSelectedCalendarDay(null)} className="shrink-0 text-muted-foreground"><X size={18} /></Button>
                        </div>
                        <div className="p-4 sm:p-6">
                          {(dayAppts.length === 0 && dayQueue.length === 0) ? (
                            <p className="text-[14px] text-muted-foreground font-medium text-center py-6">No scheduled activity for this day.</p>
                          ) : (
                            <div className="grid md:grid-cols-2 gap-6">
                              <div>
                                <h5 className="text-[12px] uppercase tracking-widest font-black text-muted-foreground mb-3 flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-[3px] bg-primary" /> Appointments
                                </h5>
                                <div className="space-y-2">
                                  {dayAppts.length === 0 ? <p className="text-[13px] text-muted-foreground">None</p> : dayAppts.map(a => (
                                    <div key={a.id} className="flex flex-col p-3 rounded-xl bg-muted border border-border">
                                      <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-[14px] text-foreground">{a.patient_name}</span>
                                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-[4px] ${
                                          a.status === "confirmed" ? "bg-green-600 text-white" : a.status === "completed" ? "bg-muted text-foreground" : a.status === "cancelled" ? "bg-destructive text-white" : "bg-amber-500 text-white"
                                        }`}>{a.status}</span>
                                      </div>
                                      <span className="text-[12px] font-semibold text-muted-foreground flex items-center gap-1.5"><Clock size={12}/> {a.time_slot}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <h5 className="text-[12px] uppercase tracking-widest font-black text-muted-foreground mb-3 flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-[3px] bg-primary" /> Live Queue
                                </h5>
                                <div className="space-y-2">
                                  {dayQueue.length === 0 ? <p className="text-[13px] text-muted-foreground">None</p> : dayQueue.map(q => (
                                    <div key={q.id} className={`flex flex-col p-3 rounded-xl border ${q.is_emergency ? "bg-destructive/10 border-destructive/20" : "bg-card border-border"}`}>
                                      <div className="flex justify-between items-start mb-1">
                                        <div className="font-bold text-[14px] text-foreground flex items-center gap-1">
                                          {q.is_emergency && <AlertTriangle size={14} className="text-destructive" />}
                                          <span className="text-primary">#{q.token_number}</span> {q.patient_name}
                                        </div>
                                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-[4px] ${
                                          q.status === "in-treatment" ? "bg-primary text-white" : q.status === "completed" ? "bg-green-600 text-white" : q.status === "cancelled" ? "bg-destructive text-white" : "bg-muted border border-border text-foreground"
                                        }`}>{q.status}</span>
                                      </div>
                                      <span className="text-[12px] font-semibold text-muted-foreground">{q.treatment_type || "General Visit"}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })()}
              </AnimatePresence>
            </motion.div>
          )}

          {/* LIVEBOARD */}
          {activeTab === "liveboard" && (
            <motion.div key="liveboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}>
              {/* Serving Alert */}
              <AnimatePresence>
                {queue.filter(p => p.status === "in-treatment").map(active => (
                  <motion.div key={active.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="mb-6 rounded-2xl bg-green-600 text-white shadow-[0_10px_30px_rgba(22,163,74,0.3)] border-2 border-white overflow-hidden">
                    <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                      <div>
                        <div className="inline-flex items-center px-3 py-1 bg-card/20 rounded-[8px] text-[11px] font-black uppercase tracking-widest mb-4 border border-white/20">
                          <Activity size={14} className="mr-2 animate-pulse" /> Serving Now
                        </div>
                        <div className="text-[60px] md:text-[80px] font-black leading-none tracking-tighter mb-2">#{active.token_number}</div>
                        <div className="text-[24px] font-extrabold text-white/90">{active.patient_name}</div>
                        {active.is_emergency && (
                          <div className="mt-4 inline-flex items-center px-3 py-1.5 bg-destructive text-white rounded-[8px] text-[12px] font-black tracking-wide border border-white/20 shadow-md">
                            <AlertTriangle size={14} className="mr-1.5" /> PRIORITY
                          </div>
                        )}
                      </div>
                      <div className="hidden md:flex flex-col items-center justify-center w-40 h-40 bg-card/10 rounded-full border-[8px] border-white/20 relative shadow-inner">
                        <span className="text-[11px] font-bold text-white/50 uppercase tracking-widest mb-1">Token</span>
                        <span className="text-[48px] font-black leading-none drop-shadow-sm">#{active.token_number}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-border bg-muted/30 flex justify-between items-center">
                  <h3 className="text-[18px] font-extrabold text-foreground flex items-center gap-2">
                    <Monitor size={18} className="text-primary" /> Live Lobby Display
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-black bg-card border border-border px-3 py-1 rounded-[8px] text-foreground">{queue.filter(p => p.status === "waiting").length} Waiting</span>
                    <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider bg-green-50 text-green-600 px-3 py-1.5 rounded-[8px] border border-green-600/20">
                      <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse"/> Live
                    </span>
                  </div>
                </div>

                <div className="max-h-[600px] overflow-y-auto">
                  <div className="divide-y divide-border">
                    <AnimatePresence>
                      {queue.filter(p => p.status === "waiting").map((p, i) => {
                        const ahead = queue.filter(q => q.status === "waiting" && q.position < p.position).length;
                        return (
                          <motion.div layout key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                            className={`flex flex-col sm:flex-row items-center justify-between p-6 gap-4 ${p.is_emergency ? "bg-destructive/10/50" : i === 0 ? "bg-primary/10/50" : ""}`}>
                            <div className="flex flex-col sm:flex-row items-center sm:gap-6 w-full text-center sm:text-left">
                              <div className={`min-w-[56px] h-14 px-3 shrink-0 rounded-[14px] flex items-center justify-center font-black text-[20px] border-[2px] mb-3 sm:mb-0 ${
                                p.is_emergency ? "bg-card text-destructive border-destructive shadow-sm" : 
                                i === 0 ? "bg-primary text-white border-primary shadow-[0_4px_12px_rgba(0,102,204,0.3)]" : "bg-muted text-muted-foreground border-border"
                              }`}>{p.token_number}</div>
                              <div>
                                <div className="font-black text-[22px] text-foreground tracking-tight mb-1 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                                  <span className={`${p.is_emergency ? "text-destructive" : i === 0 ? "text-primary" : "text-foreground"}`}>#{p.token_number}</span>
                                  <span className="text-muted-foreground/40 hidden sm:inline">•</span>
                                  <span>{p.patient_name}</span>
                                  {p.is_emergency && <span className="text-[10px] uppercase font-black bg-destructive text-white px-2 py-0.5 rounded-[4px]">EMERGENCY</span>}
                                </div>
                                <div className="text-[13px] font-semibold text-muted-foreground flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                                  <span className="flex items-center gap-1 bg-card border border-border px-2 py-0.5 rounded shadow-sm"><Clock size={12}/> ~{p.estimated_wait_time}m</span>
                                  <span>{ahead} ahead</span>
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0 text-right hidden md:block">
                              <div className="text-[32px] font-black leading-none text-foreground tracking-tighter">#{p.token_number}</div>
                              <span className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-widest mt-1 block">Waiting</span>
                            </div>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                    {queue.filter(p => p.status === "waiting").length === 0 && (
                      <div className="py-20 text-center"><Monitor size={48} className="text-muted-foreground/40 mx-auto mb-4" /><p className="text-[16px] font-bold text-muted-foreground">Empty Queue</p></div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-border text-center py-10 mt-10">
        <p className="text-[12px] font-bold text-muted-foreground mb-4 uppercase tracking-widest">Doctor Access</p>
        <Button variant="outline" onClick={() => signOut(() => router.push("/"))} className="gap-2 border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white"><LogOut size={16} /> End Secure Session</Button>
      </footer>

      {/* Report Modal */}
      <Dialog open={showRunWorkflowDialog} onOpenChange={setShowRunWorkflowDialog}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manual Workflow Trigger</DialogTitle>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Pick a workflow and patient, then provide only the inputs required by that workflow.
            </p>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Workflow</Label>
              <select
                value={selectedWorkflowForRunId}
                onChange={(e) => setSelectedWorkflowForRunId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm"
              >
                {availableWorkflows.map((wf) => (
                  <option key={wf.id} value={wf.id}>{wf.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Patient</Label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={workflowRunSearch}
                  onChange={(e) => setWorkflowRunSearch(e.target.value)}
                  placeholder="Search patients..."
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2 space-y-1">
                {loadingWorkflowPatients ? (
                  <p className="text-xs text-muted-foreground text-center py-5">Loading patients...</p>
                ) : filteredWorkflowRunPatients.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-5">No patients found.</p>
                ) : (
                  filteredWorkflowRunPatients.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => setSelectedRunPatient(patient)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${
                        selectedRunPatient?.id === patient.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <p className="font-semibold text-foreground">{patient.name}</p>
                      <p className="text-xs text-muted-foreground">{patient.mobile || "No phone number"}</p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {runRequiresPhone && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Phone For This Run</Label>
                <Input
                  value={runPhoneOverride}
                  onChange={(e) => setRunPhoneOverride(e.target.value)}
                  placeholder={selectedRunPatient?.mobile || "+91XXXXXXXXXX"}
                  className="h-8 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Needed because this workflow contains a call or SMS step.
                </p>
              </div>
            )}

            {runLabCheckNodes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Lab Results</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => setRunLabResults(prev => [...prev, createDashboardLabResult()])}
                  >
                    <Plus size={12} className="mr-1" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {runLabResults.map((result) => (
                    <div key={result.id} className="grid grid-cols-12 gap-2">
                      <Input
                        value={result.test_name}
                        onChange={(e) => setRunLabResults(prev => prev.map(x => x.id === result.id ? { ...x, test_name: e.target.value } : x))}
                        placeholder="Test name"
                        className="col-span-4 h-8 text-xs"
                      />
                      <Input
                        value={result.value}
                        onChange={(e) => setRunLabResults(prev => prev.map(x => x.id === result.id ? { ...x, value: e.target.value } : x))}
                        placeholder="Value"
                        className="col-span-3 h-8 text-xs"
                      />
                      <Input
                        value={result.unit}
                        onChange={(e) => setRunLabResults(prev => prev.map(x => x.id === result.id ? { ...x, unit: e.target.value } : x))}
                        placeholder="Unit"
                        className="col-span-2 h-8 text-xs"
                      />
                      <Input
                        value={result.reference_range}
                        onChange={(e) => setRunLabResults(prev => prev.map(x => x.id === result.id ? { ...x, reference_range: e.target.value } : x))}
                        placeholder="Range"
                        className="col-span-2 h-8 text-xs"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="col-span-1 h-8 text-xs"
                        onClick={() => setRunLabResults(prev => prev.filter(x => x.id !== result.id))}
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  ))}
                </div>
                {missingExpectedLabTests.length > 0 && (
                  <p className="text-[11px] text-amber-600">
                    Missing required tests: {missingExpectedLabTests.join(", ")}
                  </p>
                )}
              </div>
            )}

            {workflowRunMessage && (
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
                {workflowRunMessage}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowRunWorkflowDialog(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={runWorkflowFromDashboard}
              disabled={
                runningManualWorkflow ||
                !selectedWorkflowForRun ||
                !selectedRunPatient ||
                (runRequiresPhone && !hasSelectedRunPhone) ||
                (expectedLabTests.length > 0 && missingExpectedLabTests.length > 0)
              }
              className="bg-primary hover:bg-[#0097a7] text-white gap-1.5"
            >
              <Play size={13} />
              {runningManualWorkflow ? "Running..." : "Run Workflow"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Modal */}
      <Dialog open={!!viewingReport} onOpenChange={(open) => { if (!open) setViewingReport(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <div className="p-8 border-b border-border bg-slate-50">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-sm shrink-0">
                <FileText size={28} className="text-primary" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-2xl font-black tracking-tight text-slate-800">Medical Record Archive</DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                   <div className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-md text-[10px] font-black uppercase tracking-widest">
                     CONSULTATION COMPLETE
                   </div>
                   <span className="text-[12px] font-bold text-slate-400 tabular-nums">
                     {new Date(viewingReport?.created_at || Date.now()).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                   </span>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-8 space-y-8 bg-white custom-scrollbar">
            {viewingReport && (
              <>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
                   <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-slate-200 shrink-0">
                      <UserIcon className="text-slate-400" size={24} />
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Patient Name</p>
                      <p className="text-lg font-black text-slate-800 leading-tight">{viewingReport.patient_name}</p>
                   </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="text-[11px] uppercase tracking-[0.2em] font-black text-slate-400 flex items-center gap-2">
                       <ClipboardList size={14} className="text-slate-400" /> Symptoms
                    </h4>
                    <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl text-[14px] font-bold text-slate-600 italic leading-relaxed min-h-[100px]">
                      "{viewingReport.symptoms || "No subjective symptoms recorded."}"
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-[11px] uppercase tracking-[0.2em] font-black text-sky-500 flex items-center gap-2">
                       <PenTool size={14} className="text-sky-400" /> Assessment
                    </h4>
                    <div className="p-5 bg-sky-50/50 border border-sky-100 rounded-2xl text-[14px] font-black text-sky-900 leading-relaxed min-h-[100px] shadow-sm">
                      {viewingReport.diagnosis || "No specific diagnosis provided."}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[11px] uppercase tracking-[0.2em] font-black text-emerald-500 flex items-center gap-2">
                     <FileText size={14} className="text-emerald-400" /> Treatment Plan
                  </h4>
                  <div className="p-6 bg-emerald-50/50 border border-emerald-100 rounded-3xl text-[15px] font-black text-emerald-900 whitespace-pre-line leading-relaxed shadow-sm min-h-[120px]">
                    {viewingReport.prescription || "No medications prescribed."}
                  </div>
                </div>

                {viewingReport.notes && (
                  <div className="space-y-3">
                    <h4 className="text-[11px] uppercase tracking-[0.2em] font-black text-amber-500 flex items-center gap-2">
                       <Info size={14} className="text-amber-400" /> Clinical Notes
                    </h4>
                    <div className="p-6 bg-amber-50/30 border border-amber-100 rounded-2xl text-[13px] font-bold text-slate-600 border-dashed">
                      {viewingReport.notes}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="p-6 border-t border-border bg-slate-50 flex items-center justify-between">
             <Button variant="ghost" className="text-slate-400 hover:text-slate-600 font-bold text-xs px-6" onClick={() => setViewingReport(null)}>
               CLOSE
             </Button>
             <Button className="h-12 px-8 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 gap-2" onClick={() => window.print()}>
               <Download size={16}/> EXPORT RECORD
             </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Analytics Details Modal */}
      <Dialog open={!!viewingAnalyticDetails} onOpenChange={(open) => { if (!open) setViewingAnalyticDetails(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{viewingAnalyticDetails?.title}</DialogTitle>
            {viewingAnalyticDetails && <p className="text-[13px] text-muted-foreground mt-0.5">{viewingAnalyticDetails.data.length} records found for selected period</p>}
          </DialogHeader>
          <div className="overflow-y-auto">
            {detailsLoading ? (
              <div className="flex items-center justify-center p-20"><div className="spinner" /></div>
            ) : viewingAnalyticDetails && (
              <Table>
                <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur z-20">
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Date / Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewingAnalyticDetails.data.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="py-20 text-center text-muted-foreground font-bold">No records found for this period.</TableCell></TableRow>
                  ) : viewingAnalyticDetails.data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-extrabold text-foreground text-[14px]">{item.patient_name}</div>
                        <div className="text-[11px] text-muted-foreground font-bold mt-0.5">#{item.token_number || 'APPT'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-foreground text-[14px]">{new Date(item.created_at || item.date).toLocaleDateString()}</div>
                        <div className="text-[11px] text-muted-foreground font-semibold">{item.time_slot || new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-[4px] border ${
                          item.status === 'completed' ? 'bg-green-50 text-green-600 border-green-600/20' : 'bg-amber-50 text-amber-600 border-amber-500/20'
                        }`}>{item.status}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-primary text-[12px] font-bold h-auto p-1" onClick={() => {
                          if (viewingAnalyticDetails.type === 'served') {
                            const report = reports.find(r => r.patient_id === item.patient_id && Math.abs(new Date(r.created_at).getTime() - new Date(item.created_at).getTime()) < 300000);
                            if (report) setViewingReport({...report, patient_name: item.patient_name});
                          }
                          setViewingAnalyticDetails(null);
                        }}>Details</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Patient</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground font-medium">Select a doctor to transfer the current patient to.</p>
            <div className="space-y-2">
              {otherDoctors.map(doc => (
                <button key={doc.id} onClick={() => transferPatient(queue.find(q => q.status === 'in-treatment')?.id || '', doc.id)}
                  className="w-full p-4 flex items-center justify-between bg-muted/30 border border-border rounded-xl hover:border-primary transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">{doc.name.charAt(0)}</div>
                    <div className="text-left">
                      <p className="font-bold">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.specialization}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

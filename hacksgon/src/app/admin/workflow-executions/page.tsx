"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { 
  Play, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  Database,
  History,
  Activity,
  ChevronRight,
  RefreshCcw,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

interface WorkflowExecution {
  id: string;
  workflow_id: string;
  workflow_name?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  trigger_type: string;
  trigger_data: any;
  result: any;
  error?: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
}

export default function WorkflowExecutionsPage() {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    fetchExecutions();
  }, []);

  const fetchExecutions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('workflow_executions')
        .select(`
          *,
          workflow:workflows(name)
        `)
        .order('started_at', { ascending: false });

      if (error) throw error;

      const formattedData = data.map(ex => ({
        ...ex,
        workflow_name: ex.workflow?.name || 'Unknown Workflow'
      }));

      setExecutions(formattedData);
    } catch (err) {
      console.error('Error fetching executions:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Success</Badge>;
      case 'FAILED':
        return <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20">Failed</Badge>;
      case 'RUNNING':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse">Running</Badge>;
      default:
        return <Badge className="bg-slate-500/10 text-slate-500 border-slate-500/20">Pending</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'FAILED':
        return <XCircle className="w-4 h-4 text-rose-500" />;
      case 'RUNNING':
        return <Activity className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  const filteredExecutions = executions.filter(ex => {
    const matchesSearch = 
      ex.workflow_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ex.trigger_type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "ALL" || ex.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3 text-[#1A1A1A]">
            <History className="w-8 h-8 text-primary" />
            Workflow History
          </h1>
          <p className="text-[#64748B] font-medium mt-1">Monitor and debug your automation executions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={fetchExecutions}
            disabled={loading}
            className="border-[#E2E8F0] hover:bg-[#F8FAFC]"
          >
            <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Runs', value: executions.length, icon: Database, color: 'text-primary' },
          { label: 'Success Rate', value: `${executions.length ? Math.round((executions.filter(e => e.status === 'COMPLETED').length / executions.length) * 100) : 0}%`, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Failed', value: executions.filter(e => e.status === 'FAILED').length, icon: XCircle, color: 'text-rose-500' },
          { label: 'Active', value: executions.filter(e => e.status === 'RUNNING').length, icon: Activity, color: 'text-blue-500' },
        ].map((stat, i) => (
          <Card key={i} className="border-[#E2E8F0] shadow-sm overflow-hidden group hover:border-primary/50 transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-[#64748B] uppercase tracking-wider">{stat.label}</p>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-3xl font-black text-[#1A1A1A]">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <Input 
            placeholder="Search by workflow or trigger..." 
            className="pl-10 border-[#E2E8F0] focus-visible:ring-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <Filter className="w-4 h-4 text-[#64748B] mr-2" />
          {['ALL', 'COMPLETED', 'FAILED', 'RUNNING'].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-4 text-xs font-bold ${
                statusFilter === status 
                  ? 'bg-primary text-white' 
                  : 'border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-[#F8FAFC]">
            <TableRow>
              <TableHead className="font-bold text-[#1A1A1A]">Workflow</TableHead>
              <TableHead className="font-bold text-[#1A1A1A]">Trigger</TableHead>
              <TableHead className="font-bold text-[#1A1A1A]">Status</TableHead>
              <TableHead className="font-bold text-[#1A1A1A]">Started At</TableHead>
              <TableHead className="font-bold text-[#1A1A1A]">Duration</TableHead>
              <TableHead className="text-right font-bold text-[#1A1A1A]">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={6}><div className="h-4 bg-[#F1F5F9] rounded w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredExecutions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center text-[#94A3B8]">
                      <Database className="w-12 h-12 mb-2 opacity-20" />
                      <p className="font-medium">No executions found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredExecutions.map((ex) => (
                <TableRow 
                  key={ex.id} 
                  className="group hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                  onClick={() => setSelectedExecution(ex)}
                >
                  <TableCell>
                    <div className="font-bold text-[#1A1A1A] group-hover:text-primary transition-colors">
                      {ex.workflow_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-[#F1F5F9] border-none text-[#64748B] font-medium">
                      {ex.trigger_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(ex.status)}
                      <span className="text-sm font-semibold">{getStatusBadge(ex.status)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-[#64748B] font-medium">
                      {new Date(ex.started_at).toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-[#64748B] font-bold">
                      {ex.duration_ms ? `${ex.duration_ms}ms` : '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="group-hover:translate-x-1 transition-transform">
                      <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      {/* Execution Detail Modal */}
      <Dialog open={!!selectedExecution} onOpenChange={() => setSelectedExecution(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border-none p-0 bg-[#F8FAFC]">
          {selectedExecution && (
            <div className="space-y-0">
              <div className="p-6 bg-white border-b border-[#E2E8F0]">
                <div className="flex items-center justify-between mb-4">
                  {getStatusBadge(selectedExecution.status)}
                  <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-tighter">
                    ID: {selectedExecution.id}
                  </p>
                </div>
                <h2 className="text-2xl font-black text-[#1A1A1A] mb-1">{selectedExecution.workflow_name}</h2>
                <div className="flex items-center gap-4 text-sm font-medium text-[#64748B]">
                  <div className="flex items-center gap-1.5 border-r pr-4 border-[#E2E8F0]">
                    <Play className="w-4 h-4" />
                    {selectedExecution.trigger_type}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {new Date(selectedExecution.started_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Error Banner */}
                {selectedExecution.error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex gap-3 items-start">
                    <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-rose-700 text-sm">Execution Error</p>
                      <p className="text-rose-600 text-sm font-medium mt-1">{selectedExecution.error}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Trigger Data */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#1A1A1A]">
                      <div className="w-1.5 h-4 bg-primary rounded-full" />
                      Trigger Data
                    </div>
                    <div className="bg-[#1E293B] rounded-xl p-4 overflow-x-auto">
                      <pre className="text-xs text-[#CBD5E1] leading-relaxed">
                        {JSON.stringify(selectedExecution.trigger_data, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {/* Result Data */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#1A1A1A]">
                      <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                      Execution Result
                    </div>
                    <div className="bg-[#1E293B] rounded-xl p-4 overflow-x-auto">
                      <pre className="text-xs text-[#CBD5E1] leading-relaxed">
                        {JSON.stringify(selectedExecution.result, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white border-t border-[#E2E8F0] flex justify-end">
                <Button onClick={() => setSelectedExecution(null)} className="font-bold">
                  Close Details
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

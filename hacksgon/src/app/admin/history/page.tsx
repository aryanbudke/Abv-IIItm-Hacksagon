"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { 
  Search, Filter, History, Calendar, User, Stethoscope, 
  ChevronRight, Eye, Download, Info, ArrowLeft, MoreHorizontal,
  FileText, ClipboardList, PenTool
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogDescription, DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("all");
  const [selectedReport, setSelectedReport] = useState<any>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [doctorsRes, reportsRes] = await Promise.all([
        supabase.from("doctors").select("id, name, specialization"),
        supabase.from("reports")
          .select("*, users!reports_patient_id_fkey(name, patient_id), doctors!reports_doctor_id_fkey(name, specialization)")
          .order("created_at", { ascending: false })
      ]);

      if (doctorsRes.error) throw doctorsRes.error;
      if (reportsRes.error) throw reportsRes.error;

      setDoctors(doctorsRes.data || []);
      setReports(reportsRes.data || []);
    } catch (error: any) {
      toast.error("Failed to fetch history: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = !searchTerm ||
      report.users?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.users?.patient_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDoctor = selectedDoctor === "all" || report.doctor_id === selectedDoctor;
    
    return matchesSearch && matchesDoctor;
  });

  return (
    <div className="p-4 sm:p-8 space-y-8 bg-background min-h-screen pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <History className="text-primary" size={24} />
            </div>
            Treatment History
          </h1>
          <p className="text-muted-foreground text-sm font-medium ml-13">
            Audit logs of all clinical consultations and prescriptions
          </p>
        </div>
        
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-10 rounded-xl gap-2 font-bold px-4" onClick={fetchInitialData}>
                Refresh Data
            </Button>
        </div>
      </div>

      <Card className="border-none shadow-2xl bg-card rounded-3xl overflow-hidden">
        <CardHeader className="pb-0 pt-8 px-8">
            <div className="flex flex-col md:flex-row md:items-center gap-4 bg-muted/30 p-2 rounded-2xl border border-border/50">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
                    <Input 
                        placeholder="Search by patient name or ID..."
                        className="pl-12 h-12 bg-transparent border-none focus-visible:ring-0 text-sm font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="flex items-center gap-2 shrink-0 pr-2">
                    <div className="w-px h-8 bg-border/50 mx-2 hidden md:block" />
                    <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                        <SelectTrigger className="w-[200px] h-10 bg-card/50 border-border/50 rounded-xl text-xs font-bold gap-2">
                            <Stethoscope size={14} className="text-primary" />
                            <SelectValue placeholder="All Doctors" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border">
                            <SelectItem value="all" className="text-xs font-bold">All Doctors</SelectItem>
                            {doctors.map(doc => (
                                <SelectItem key={doc.id} value={doc.id} className="text-xs font-medium">
                                    {doc.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </CardHeader>
        
        <CardContent className="p-0 mt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/50 bg-muted/20 hover:bg-muted/20">
                  <TableHead className="w-[180px] h-14 px-8 text-[10px] uppercase tracking-widest font-black text-muted-foreground/60">Date & Time</TableHead>
                  <TableHead className="h-14 text-[10px] uppercase tracking-widest font-black text-muted-foreground/60">Patient</TableHead>
                  <TableHead className="h-14 text-[10px] uppercase tracking-widest font-black text-muted-foreground/60">Attending Doctor</TableHead>
                  <TableHead className="h-14 text-[10px] uppercase tracking-widest font-black text-muted-foreground/60">Diagnosis</TableHead>
                  <TableHead className="h-14 text-[10px] uppercase tracking-widest font-black text-muted-foreground/60">Status</TableHead>
                  <TableHead className="text-right h-14 px-8 text-[10px] uppercase tracking-widest font-black text-muted-foreground/60">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-b border-border/20">
                      <TableCell colSpan={6} className="h-16 px-8"><div className="animate-pulse bg-muted h-6 rounded-lg w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredReports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center space-y-4">
                           <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                               <Info className="text-muted-foreground" size={32} />
                           </div>
                           <p className="text-muted-foreground font-medium">No history found for the selected criteria.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                ) : (
                  filteredReports.map((report) => (
                    <TableRow key={report.id} className="group border-b border-border/20 hover:bg-muted/30 transition-colors">
                      <TableCell className="px-8">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground">
                            {format(new Date(report.created_at), "MMM d, yyyy")}
                          </span>
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            {format(new Date(report.created_at), "h:mm aa")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs shrink-0">
                               {report.users?.name?.[0]}
                           </div>
                           <div className="flex flex-col">
                             <span className="text-sm font-bold text-foreground truncate max-w-[150px]">{report.users?.name || "Unknown Patient"}</span>
                             <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{report.users?.patient_id}</span>
                           </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground">{report.doctors?.name}</span>
                          <span className="text-[10px] font-medium text-primary uppercase tracking-widest">{report.doctors?.specialization}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium text-muted-foreground line-clamp-1 max-w-[200px]">
                            {report.diagnosis}
                        </p>
                      </TableCell>
                      <TableCell>
                         <Badge variant="outline" className="rounded-lg bg-green-500/5 text-green-600 border-green-500/20 font-bold px-2.5 py-0.5 text-[10px] uppercase">
                             Completed
                         </Badge>
                      </TableCell>
                      <TableCell className="text-right px-8">
                         <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary" onClick={() => setSelectedReport(report)}>
                                    <Eye size={18} />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-3xl bg-white">
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
                                                {format(new Date(selectedReport?.created_at || Date.now()), "PPPPp")}
                                            </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="p-8 space-y-8 overflow-y-auto flex-1 bg-white custom-scrollbar">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 shadow-sm">
                                            <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2">Patient Details</p>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 border border-slate-200">
                                                    <User className="text-primary" size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-base font-black text-slate-800 leading-tight">{selectedReport?.users?.name}</p>
                                                    <p className="text-[11px] font-bold text-slate-500 tabular-nums">{selectedReport?.users?.patient_id}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-indigo-50/30 rounded-2xl p-5 border border-indigo-100/50 shadow-sm">
                                            <p className="text-[10px] uppercase font-black text-indigo-400 tracking-widest mb-2">Attending Physician</p>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 border border-indigo-100">
                                                    <Stethoscope className="text-indigo-500" size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-base font-black text-slate-800 leading-tight">{selectedReport?.doctors?.name}</p>
                                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-tight">{selectedReport?.doctors?.specialization}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="relative pl-6">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200 rounded-full" />
                                            <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Patient History & Symptoms</h4>
                                            <p className="text-sm font-bold text-slate-600 leading-relaxed italic">
                                                "{selectedReport?.symptoms || "No subjective symptoms recorded."}"
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-4">
                                                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-500">Clinical Assessment</h4>
                                                <div className="bg-sky-50 rounded-2xl p-6 border border-sky-100 shadow-sm min-h-[100px]">
                                                    <p className="text-sm font-black text-sky-900 leading-relaxed whitespace-pre-line">
                                                        {selectedReport?.diagnosis || "Consultation complete."}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-500">Therapeutic Plan</h4>
                                                <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 shadow-sm min-h-[100px]">
                                                    <p className="text-sm font-black text-emerald-900 leading-relaxed whitespace-pre-line">
                                                        {selectedReport?.prescription || "No medications prescribed."}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-500">Internal Physician Notes</h4>
                                            <div className="bg-amber-50/50 rounded-2xl p-6 border border-amber-100/50 border-dashed">
                                                <p className="text-sm font-bold text-slate-700 leading-relaxed">
                                                    {selectedReport?.notes || "No additional clinical observations recorded."}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="p-6 border-t border-border bg-slate-50 flex items-center justify-between">
                                    <Button variant="ghost" className="text-slate-400 hover:text-slate-600 font-bold text-xs px-6" onClick={() => setSelectedReport(null)}>
                                        CLOSE
                                    </Button>
                                    <Button className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 gap-2" onClick={() => window.print()}>
                                        <Download size={16}/> EXPORT MEDICAL PDF
                                    </Button>
                                </div>
                            </DialogContent>
                         </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      {/* Scroll fix padding */}
      <div className="md:hidden h-20" />
    </div>
  );
}

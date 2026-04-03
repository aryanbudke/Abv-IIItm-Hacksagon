"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUser } from "@clerk/nextjs";
import { 
  Search, History, Calendar, User, Stethoscope, 
  Eye, Download, Info, ArrowLeft, FileText,
  Clock, Plus, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogDescription, DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function DoctorHistoryPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [doctorInfo, setDoctorInfo] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReport, setSelectedReport] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchDoctorAndHistory();
    }
  }, [user]);

  const fetchDoctorAndHistory = async () => {
    setLoading(true);
    try {
      // 1. Get doctor profile
      const { data: doc, error: docErr } = await supabase
        .from("doctors")
        .select("*")
        .eq("email", user?.primaryEmailAddress?.emailAddress)
        .single();
      
      if (docErr) throw docErr;
      setDoctorInfo(doc);

      // 2. Get history records
      const { data: reportsRes, error: reportsErr } = await supabase
        .from("reports")
        .select("*, users!reports_patient_id_fkey(name, patient_id)")
        .eq("doctor_id", doc.id)
        .order("created_at", { ascending: false });

      if (reportsErr) throw reportsErr;
      setReports(reportsRes || []);
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to load clinical history.");
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(report => 
    report.users?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.users?.patient_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl shrink-0">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
             <Link href="/doctor" className="no-underline flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                    <ArrowLeft size={20} className="text-white" />
                </div>
                <div className="hidden sm:block">
                  <Logo height={24} />
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">Doctor History Portal</p>
                </div>
             </Link>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-black text-slate-800">{doctorInfo?.name}</span>
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{doctorInfo?.specialization}</span>
             </div>
             <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 font-bold text-slate-600">
                {doctorInfo?.name?.[0]}
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-slate-200">
          <div className="space-y-1">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
               Treatment Archive
            </h2>
            <p className="text-slate-500 font-medium max-w-lg">
               Browse through your entire history of clinical consultations, diagnostics, and prescriptions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
             <div className="relative group w-full sm:w-[350px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                <Input 
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   placeholder="Search patient name or ID..."
                   className="pl-12 h-12 bg-white border-slate-200 rounded-2xl shadow-sm focus-visible:ring-primary/20 text-sm font-semibold"
                />
             </div>
             <Button variant="outline" className="h-12 rounded-2xl border-slate-200 bg-white hover:bg-slate-50 transition-all font-bold gap-2 px-6 shadow-sm shrink-0" onClick={fetchDoctorAndHistory}>
                <Plus size={18} className="text-primary rotate-45" /> Refresh
             </Button>
          </div>
        </div>

        <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden border border-slate-200/50">
          <CardContent className="p-0">
             <div className="overflow-x-auto min-w-full">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="border-b border-slate-100 hover:bg-transparent">
                      <TableHead className="px-8 h-14 text-[10px] font-black uppercase tracking-widest text-slate-400">Consultation Date</TableHead>
                      <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest text-slate-400">Patient Details</TableHead>
                      <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest text-slate-400">Clinical Diagnosis</TableHead>
                      <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</TableHead>
                      <TableHead className="px-8 h-14 text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                       Array.from({ length: 6 }).map((_, i) => (
                         <TableRow key={i} className="border-b border-slate-50">
                            <TableCell colSpan={5} className="h-20 px-8 py-4"><div className="w-full h-8 bg-slate-50 animate-pulse rounded-xl" /></TableCell>
                         </TableRow>
                       ))
                    ) : filteredReports.length === 0 ? (
                       <TableRow>
                          <TableCell colSpan={5} className="h-[400px] text-center">
                             <div className="flex flex-col items-center justify-center p-12">
                                <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-4">
                                   <History size={32} className="text-slate-300" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800">No records found</h3>
                                <p className="text-slate-500 max-w-xs mt-2 font-medium">We couldn't find any treatment history matching your search criteria.</p>
                             </div>
                          </TableCell>
                       </TableRow>
                    ) : (
                      filteredReports.map((report) => (
                        <TableRow key={report.id} className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <TableCell className="px-8">
                             <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-800">{format(new Date(report.created_at), "MMM d, yyyy")}</span>
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                   <Clock size={10} /> {format(new Date(report.created_at), "h:mm aa")}
                                </div>
                             </div>
                          </TableCell>
                          <TableCell>
                             <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-xs shrink-0 ring-4 ring-primary/5">
                                   {report.users?.name?.[0]}
                                </div>
                                <div className="flex flex-col min-w-0">
                                   <span className="text-sm font-bold text-slate-800 truncate block">{report.users?.name || "Private Patient"}</span>
                                   <span className="text-[10px] font-bold text-slate-400 tabular-nums">{report.users?.patient_id}</span>
                                </div>
                             </div>
                          </TableCell>
                          <TableCell>
                             <div className="max-w-[280px]">
                                <p className="text-sm font-bold text-slate-700 truncate">{report.diagnosis || "No specific diagnosis"}</p>
                                <p className="text-[11px] font-bold text-slate-400 truncate mt-0.5 italic">"{report.symptoms}"</p>
                             </div>
                          </TableCell>
                          <TableCell className="text-center">
                             <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg font-black text-[10px] uppercase tracking-widest px-3 py-1 shadow-sm">
                                COMPLETED
                             </Badge>
                          </TableCell>
                          <TableCell className="px-8 text-right">
                             <Dialog>
                                <DialogTrigger asChild>
                                   <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl group-hover:bg-primary group-hover:text-white transition-all shadow-sm group-hover:shadow-lg group-hover:shadow-primary/30" onClick={() => setSelectedReport(report)}>
                                      <Eye size={18} />
                                   </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl rounded-[2.5rem] border-slate-200 shadow-2xl p-0 overflow-hidden bg-white">
                                  <DialogHeader className="p-10 border-b border-slate-100 bg-slate-50/50">
                                      <div className="flex items-center justify-between">
                                          <div className="space-y-1.5">
                                              <DialogTitle className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                                                  <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                                                      <FileText className="text-white" size={24} />
                                                  </div>
                                                  Treatment Record
                                              </DialogTitle>
                                              <DialogDescription className="text-xs font-bold text-slate-400 ml-15 uppercase tracking-[0.1em]">
                                                 ID: {selectedReport?.id?.substring(0, 12).toUpperCase()} — ARCHIVED {format(new Date(selectedReport?.created_at || Date.now()), "PPpp")}
                                              </DialogDescription>
                                          </div>
                                      </div>
                                  </DialogHeader>
                                  
                                  <div className="p-10 space-y-10 overflow-y-auto max-h-[60vh] custom-scrollbar">
                                      <div className="grid grid-cols-2 gap-4">
                                          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 shadow-sm">
                                             <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-3">Patient Identity</p>
                                             <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shrink-0 border border-slate-200">
                                                   <User className="text-primary" size={20} />
                                                </div>
                                                <div>
                                                   <p className="text-base font-black text-slate-900">{selectedReport?.users?.name}</p>
                                                   <p className="text-[11px] font-bold text-slate-500 tabular-nums">{selectedReport?.users?.patient_id}</p>
                                                </div>
                                             </div>
                                          </div>
                                          <div className="bg-indigo-50/30 rounded-3xl p-6 border border-indigo-100/50 shadow-sm">
                                             <p className="text-[10px] uppercase font-black text-indigo-400 tracking-widest mb-3">Service Provider</p>
                                             <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shrink-0 border border-indigo-100">
                                                   <Stethoscope className="text-indigo-500" size={20} />
                                                </div>
                                                <div>
                                                   <p className="text-base font-black text-slate-900">{doctorInfo?.name}</p>
                                                   <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{doctorInfo?.specialization}</p>
                                                </div>
                                             </div>
                                          </div>
                                      </div>

                                      <div className="space-y-8">
                                          <div className="relative pl-6">
                                             <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200 rounded-full" />
                                             <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Subjective (Symptoms)</h4>
                                             <p className="text-sm font-bold text-slate-600 leading-relaxed italic">
                                                "{selectedReport?.symptoms || "No recorded symptoms"}"
                                             </p>
                                          </div>

                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                              <div className="space-y-4">
                                                 <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-500">Assessment (Diagnosis)</h4>
                                                 <div className="bg-sky-50 rounded-3xl p-8 border border-sky-100 shadow-sm min-h-[120px]">
                                                    <p className="text-sm font-black text-sky-900 leading-relaxed whitespace-pre-line">
                                                       {selectedReport?.diagnosis || "Consultation complete."}
                                                    </p>
                                                 </div>
                                              </div>
                                              <div className="space-y-4">
                                                 <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-500">Plan (Prescription)</h4>
                                                 <div className="bg-emerald-50 rounded-3xl p-8 border border-emerald-100 shadow-sm min-h-[120px]">
                                                    <p className="text-sm font-black text-emerald-900 leading-relaxed whitespace-pre-line">
                                                       {selectedReport?.prescription || "No meds prescribed."}
                                                    </p>
                                                 </div>
                                              </div>
                                          </div>

                                          <div className="space-y-3">
                                             <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-500">Clinical Notes</h4>
                                             <div className="bg-amber-50/50 rounded-3xl p-8 border border-amber-100/50">
                                                <p className="text-sm font-bold text-slate-700 leading-relaxed">
                                                   {selectedReport?.notes || "No additional clinical observations were recorded for this session."}
                                                </p>
                                             </div>
                                          </div>
                                      </div>
                                  </div>
                                  
                                  <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100 flex-row gap-3 px-10">
                                      <Link href="/doctor" className="no-underline">
                                         <Button variant="ghost" className="rounded-2xl font-black text-[11px] uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">
                                            Return to Dashboard
                                         </Button>
                                      </Link>
                                      <Button variant="outline" className="rounded-2xl font-black text-[11px] uppercase tracking-widest border-slate-200 bg-white shadow-sm gap-2 px-8 h-12" onClick={() => window.print()}>
                                         <Download size={16} /> Export PDF
                                      </Button>
                                      <DialogTrigger asChild>
                                          <Button className="rounded-2xl font-black text-[11px] uppercase tracking-widest h-12 px-10 shadow-lg shadow-primary/20">Close Record</Button>
                                      </DialogTrigger>
                                  </DialogFooter>
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
      </main>
      
      {/* Footer Branding */}
      <footer className="max-w-7xl mx-auto px-8 py-12 text-center border-t border-slate-100">
         <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">MediQueue Pro · Secure Clinical Records</p>
      </footer>
    </div>
  );
}

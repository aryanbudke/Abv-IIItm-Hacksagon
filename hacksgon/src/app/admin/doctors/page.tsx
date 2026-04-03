"use client";

import { useEffect, useState, Suspense } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus, X, Loader2, Stethoscope, Building2, Pencil, Trash2, Search,
  UserCheck, UserX, AlertCircle, Mail, RotateCw
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";

interface HospitalOption {
  id: string;
  name: string;
  city: string;
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface Doctor {
  id: string;
  name: string;
  email: string;
  phone: string;
  hospital_id: string;
  department_id: string;
  specialization: string;
  qualification: string;
  experience: number;
  rating: number;
  is_on_leave: boolean;
  average_treatment_time: number;
  created_at: string;
  hospitals?: { name: string; city: string };
  departments?: { name: string };
}

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  hospital_id: "",
  department_id: "",
  specialization: "",
  qualification: "",
  experience: "",
  average_treatment_time: "15",
};

const QUALIFICATIONS = ["MBBS", "MD", "MS", "DM", "MCh", "BDS", "MDS", "BHMS", "BAMS", "DNB", "PhD"];
const SPECIALIZATIONS = [
  "General Medicine", "General Surgery", "Cardiology", "Neurology", "Orthopedics",
  "Gynecology & Obstetrics", "Pediatrics", "Dermatology", "Ophthalmology", "ENT",
  "Psychiatry", "Oncology", "Urology", "Nephrology", "Pulmonology",
  "Gastroenterology", "Endocrinology", "Rheumatology", "Anesthesiology", "Radiology",
  "Pathology", "Emergency Medicine", "Dentistry", "Physiotherapy"
];

function AccountStatus({ email, role, data, onUpdate }: { 
  email: string; 
  role: string; 
  data?: any; 
  onUpdate: () => void; 
}) {
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await fetch("/api/set-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, resend: true }),
      });
      if (res.ok) {
        toast.success(`Invitation resent to ${email}`);
        onUpdate();
      } else {
        toast.error("Failed to resend invitation");
      }
    } catch (e) {
      toast.error("Failed to resend invitation");
    } finally {
      setResending(false);
    }
  };

  const styles: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: any }> = {
    active:  { label: "Active",     variant: "secondary",  icon: UserCheck },
    pending: { label: "Pending",    variant: "outline",    icon: RotateCw },
    revoked: { label: "Revoked",    variant: "destructive", icon: UserX },
    none:    { label: "No Account", variant: "outline",    icon: AlertCircle },
  };

  const current = styles[data?.status] || styles.none;
  const Icon = current.icon;

  return (
    <div className="flex items-center gap-2">
      <Badge variant={current.variant} className="gap-1 px-1.5 h-5 text-[10px] uppercase font-bold tracking-wider">
        <Icon size={10} className={data?.status === 'pending' ? "animate-spin" : ""} />
        {current.label}
      </Badge>
      {(data?.status !== 'active') && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors"
          onClick={handleResend}
          disabled={resending}
          title="Resend Invite"
        >
          {resending ? <Loader2 size={10} className="animate-spin" /> : <Mail size={10} />}
        </Button>
      )}
    </div>
  );
}

function AdminDoctorsContent() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filterHospital, setFilterHospital] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [newDeptName, setNewDeptName] = useState("");
  const [addingDept, setAddingDept] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [invitationStatuses, setInvitationStatuses] = useState<Record<string, any>>({});
  const [fetchingStatuses, setFetchingStatuses] = useState(false);
  const DOCTORS_PER_PAGE = 11; // Slightly more for better density

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push("/sign-in"); return; }
    if ((user?.publicMetadata?.role as string) !== "admin") router.push("/");
  }, [isLoaded, isSignedIn, user, router]);

  useEffect(() => {
    if (isLoaded && isSignedIn && (user?.publicMetadata?.role as string) === "admin") {
      fetchHospitals();
      fetchDoctors();
    }
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    const prefillEmail = searchParams.get("email");
    const prefillName  = searchParams.get("name");
    if (prefillEmail) {
      setForm(f => ({ ...f, email: prefillEmail, name: prefillName || f.name }));
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [searchParams]);

  useEffect(() => {
    let list = doctors;
    if (filterHospital !== "all") list = list.filter(d => d.hospital_id === filterHospital);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.specialization.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q)
      );
    }
    setFilteredDoctors(list);
  }, [doctors, filterHospital, searchQuery]);

  useEffect(() => {
    if (form.hospital_id) fetchDepartments(form.hospital_id);
    else setDepartments([]);
  }, [form.hospital_id]);

  const fetchHospitals = async () => {
    const { data } = await supabase.from("hospitals").select("id, name, city").order("name");
    setHospitals(data || []);
  };

  const fetchDepartments = async (hospitalId: string) => {
    const { data } = await supabase.from("departments").select("id, name").eq("hospital_id", hospitalId).order("name");
    setDepartments(data || []);
  };

  const fetchDoctors = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("doctors")
      .select("*, hospitals(name, city), departments(name)")
      .order("created_at", { ascending: false });
    setDoctors(data || []);
    setLoading(false);
  };

  const fetchBulkStatuses = async (emails: string[]) => {
    if (emails.length === 0) return;
    setFetchingStatuses(true);
    try {
      const res = await fetch(`/api/admin/invitations?emails=${emails.join(",")}`);
      const data = await res.json();
      setInvitationStatuses(prev => ({ ...prev, ...data }));
    } catch (e) {
      console.error("Error fetching bulk statuses:", e);
    } finally {
      setFetchingStatuses(false);
    }
  };

  useEffect(() => {
    // When doctors list or pagination changes, fetch statuses for visible doctors
    const pagedDocs = filteredDoctors.slice(
      (currentPage - 1) * DOCTORS_PER_PAGE,
      currentPage * DOCTORS_PER_PAGE
    );
    
    const visibleEmails: string[] = [];
    pagedDocs.forEach(d => {
      if (!invitationStatuses[d.email]) visibleEmails.push(d.email);
    });

    if (visibleEmails.length > 0) {
      fetchBulkStatuses(visibleEmails);
    }
  }, [filteredDoctors, currentPage]);

  const handleAddDepartment = async () => {
    if (!newDeptName.trim() || !form.hospital_id) return;
    setAddingDept(true);
    const { data, error } = await supabase
      .from("departments")
      .insert({ name: newDeptName.trim(), hospital_id: form.hospital_id })
      .select()
      .single();
    setAddingDept(false);
    if (error) { toast.error("Failed to create department: " + error.message); return; }
    setDepartments(prev => [...prev, data]);
    setForm(f => ({ ...f, department_id: data.id }));
    setNewDeptName("");
    toast.success(`Department "${data.name}" created.`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const required = ["name", "email", "phone", "hospital_id", "department_id", "specialization", "qualification", "experience"];
    for (const field of required) {
      if (!form[field as keyof typeof form]) {
        toast.error("Please fill in all required fields.");
        return;
      }
    }
    setSaving(true);

    const payload = {
      ...form,
      experience: parseInt(form.experience),
      average_treatment_time: parseInt(form.average_treatment_time) || 15,
    };

    const { error } = editingId
      ? await supabase.from("doctors").update(payload).eq("id", editingId)
      : await supabase.from("doctors").insert(payload);

    setSaving(false);
    if (error) { toast.error(error.message); return; }

    if (!editingId) {
      try {
        const res = await fetch("/api/set-role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email, role: "doctor" }),
        });
        const data = await res.json();
        if (data.invited) {
          toast.success(`Doctor added manually. Invitation sent to ${form.email}.`);
        } else {
          toast.success("Doctor added and role assigned successfully.");
        }
      } catch (err) {
        toast.error("Database updated but failed to sync with Clerk. Please try inviting manually.");
      }
    } else {
      toast.success("Doctor updated successfully.");
    }

    resetForm();
    fetchDoctors();
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setDepartments([]);
    setNewDeptName("");
  };

  const handleEdit = (d: Doctor) => {
    setForm({
      name: d.name,
      email: d.email,
      phone: d.phone,
      hospital_id: d.hospital_id,
      department_id: d.department_id,
      specialization: d.specialization,
      qualification: d.qualification,
      experience: d.experience?.toString() || "",
      average_treatment_time: d.average_treatment_time?.toString() || "15",
    });
    setEditingId(d.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("doctors").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Doctor removed.");
    setDeleteConfirm(null);
    fetchDoctors();
  };

  const toggleLeave = async (id: string, current: boolean) => {
    await supabase.from("doctors").update({ is_on_leave: !current }).eq("id", id);
    fetchDoctors();
  };

  const doctorsByHospital = hospitals.map(h => ({
    hospital: h,
    doctors: filteredDoctors.filter(d => d.hospital_id === h.id),
  })).filter(g => g.doctors.length > 0);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Doctor Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{doctors.length} doctor{doctors.length !== 1 ? "s" : ""} registered</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(v => !v); }} className="gap-2">
          <Plus size={16} />
          Add Doctor
        </Button>
      </div>

      {/* Add / Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            <Card>
              <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>{editingId ? "Edit Doctor" : "Add New Doctor"}</CardTitle>
                  <CardDescription>Fill in the details below to {editingId ? "update" : "register"} a doctor.</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={resetForm}>
                  <X size={18} />
                </Button>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Personal Details */}
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Personal Details</p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-2 space-y-1.5">
                        <Label htmlFor="doc-name">Full Name <span className="text-destructive">*</span></Label>
                        <Input id="doc-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Dr. Full Name" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="doc-phone">Phone <span className="text-destructive">*</span></Label>
                        <Input id="doc-phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 XXXXXXXXXX" required />
                      </div>
                      <div className="lg:col-span-2 space-y-1.5">
                        <Label htmlFor="doc-email">Email <span className="text-destructive">*</span></Label>
                        <Input id="doc-email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="doctor@hospital.com" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="doc-exp">Experience (years) <span className="text-destructive">*</span></Label>
                        <Input id="doc-exp" type="number" min="0" max="60" value={form.experience} onChange={e => setForm(f => ({ ...f, experience: e.target.value }))} placeholder="0" required />
                      </div>
                    </div>
                  </div>

                  {/* Professional Details */}
                  <div className="border-t border-border pt-6">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Professional Details</p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label>Qualification <span className="text-destructive">*</span></Label>
                        <Select value={form.qualification} onValueChange={v => setForm(f => ({ ...f, qualification: v }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select qualification" />
                          </SelectTrigger>
                          <SelectContent>
                            {QUALIFICATIONS.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="lg:col-span-2 space-y-1.5">
                        <Label>Specialization <span className="text-destructive">*</span></Label>
                        <Select value={form.specialization} onValueChange={v => setForm(f => ({ ...f, specialization: v }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select specialization" />
                          </SelectTrigger>
                          <SelectContent>
                            {SPECIALIZATIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="doc-avg-time">Avg. Treatment Time (min)</Label>
                        <Input id="doc-avg-time" type="number" min="5" max="120" value={form.average_treatment_time} onChange={e => setForm(f => ({ ...f, average_treatment_time: e.target.value }))} />
                      </div>
                    </div>
                  </div>

                  {/* Hospital & Department */}
                  <div className="border-t border-border pt-6">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Assignment</p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Hospital <span className="text-destructive">*</span></Label>
                        {hospitals.length === 0 ? (
                          <div className="flex items-center gap-2 px-3 py-2.5 border border-amber-200 bg-amber-50 rounded-lg text-sm text-amber-700">
                            <AlertCircle size={16} className="flex-shrink-0" />
                            No hospitals found.{" "}
                            <Link href="/admin/hospitals" className="underline font-semibold">Add one first.</Link>
                          </div>
                        ) : (
                          <Select value={form.hospital_id} onValueChange={v => setForm(f => ({ ...f, hospital_id: v, department_id: "" }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select hospital" />
                            </SelectTrigger>
                            <SelectContent>
                              {hospitals.map(h => <SelectItem key={h.id} value={h.id}>{h.name} — {h.city}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label>Department <span className="text-destructive">*</span></Label>
                        {!form.hospital_id ? (
                          <div className="px-3 py-2.5 border border-border bg-muted rounded-lg text-sm text-muted-foreground italic">
                            Select a hospital first
                          </div>
                        ) : (
                          <Select value={form.department_id} onValueChange={v => setForm(f => ({ ...f, department_id: v }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                              {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {form.hospital_id && (
                        <div className="sm:col-span-2 space-y-1.5">
                          <Label htmlFor="new-dept">Or create a new department</Label>
                          <div className="flex gap-2">
                            <Input
                              id="new-dept"
                              value={newDeptName}
                              onChange={e => setNewDeptName(e.target.value)}
                              placeholder="e.g. Neurology"
                            />
                            <Button type="button" variant="secondary" onClick={handleAddDepartment} disabled={!newDeptName.trim() || addingDept} className="gap-2 shrink-0">
                              {addingDept ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                              Create
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button type="submit" disabled={saving} className="gap-2">
                      {saving && <Loader2 size={16} className="animate-spin" />}
                      {editingId ? "Save Changes" : "Add Doctor"}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, specialization, or email…"
            className="pl-9"
          />
        </div>
        <Select value={filterHospital} onValueChange={setFilterHospital}>
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Hospitals</SelectItem>
            {hospitals.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Global Doctor Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : doctors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Stethoscope size={48} className="mb-4 opacity-20" />
            <p className="font-semibold text-foreground">No doctors registered yet</p>
            <p className="text-sm mt-1">Click &quot;Add Doctor&quot; to register the first doctor.</p>
          </CardContent>
        </Card>
      ) : filteredDoctors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Search size={40} className="mb-4 opacity-20" />
            <p className="font-semibold text-foreground">No matching doctors found</p>
          </CardContent>
        </Card>
      ) : (() => {
        const totalPages = Math.max(1, Math.ceil(filteredDoctors.length / DOCTORS_PER_PAGE));
        const pagedDocs = filteredDoctors.slice((currentPage - 1) * DOCTORS_PER_PAGE, currentPage * DOCTORS_PER_PAGE);
        
        return (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[280px]">Doctor</TableHead>
                    <TableHead>Hospital</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Specialization</TableHead>
                    <TableHead>Exp.</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedDocs.map((d, i) => (
                    <motion.tr key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      className="border-b border-border hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm flex-shrink-0">
                            {d.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-foreground truncate">{d.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{d.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 size={13} className="text-muted-foreground shrink-0" />
                          <p className="text-sm font-medium truncate max-w-[150px]">{d.hospitals?.name || "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-medium whitespace-nowrap">
                          {d.departments?.name || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium text-foreground">{d.specialization}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">{d.qualification}</p>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-foreground">{d.experience}y</span>
                      </TableCell>
                      <TableCell>
                        <AccountStatus 
                          email={d.email} 
                          role="doctor" 
                          data={invitationStatuses[d.email]} 
                          onUpdate={() => fetchBulkStatuses([d.email])}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleLeave(d.id, d.is_on_leave)}
                          className={`gap-1.5 h-7 px-2.5 text-xs font-semibold rounded-full border ${
                            d.is_on_leave
                              ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                              : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                          }`}
                        >
                          {d.is_on_leave
                            ? <><UserX size={11} /> On Leave</>
                            : <><UserCheck size={11} /> Available</>
                          }
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => handleEdit(d)}>
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => setDeleteConfirm(d.id)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/20">
                <p className="text-sm text-muted-foreground">
                  Showing <span className="font-medium text-foreground">{((currentPage - 1) * DOCTORS_PER_PAGE) + 1}</span>–<span className="font-medium text-foreground">{Math.min(currentPage * DOCTORS_PER_PAGE, filteredDoctors.length)}</span> of <span className="font-medium text-foreground">{filteredDoctors.length}</span> doctors
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={e => { e.preventDefault(); setCurrentPage(Math.max(1, currentPage - 1)); }}
                        className={currentPage <= 1 ? "pointer-events-none opacity-40" : ""}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const p = i + 1;
                      if (totalPages > 7 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) {
                        if (p === 2 || p === totalPages - 1) return <PaginationItem key={p}><span className="px-2">...</span></PaginationItem>;
                        return null;
                      }
                      return (
                        <PaginationItem key={p}>
                          <Button
                            variant={currentPage === p ? "default" : "ghost"}
                            size="sm"
                            className="w-9 h-9 p-0"
                            onClick={() => setCurrentPage(p)}
                          >
                            {p}
                          </Button>
                        </PaginationItem>
                      );
                    })}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={e => { e.preventDefault(); setCurrentPage(Math.min(totalPages, currentPage + 1)); }}
                        className={currentPage >= totalPages ? "pointer-events-none opacity-40" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </Card>
        );
      })()}

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={open => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <Trash2 size={22} className="text-destructive" />
            </div>
            <DialogTitle className="text-center">Remove Doctor?</DialogTitle>
            <DialogDescription className="text-center">
              This doctor&apos;s account and all associated data will be removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminDoctorsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <AdminDoctorsContent />
    </Suspense>
  );
}

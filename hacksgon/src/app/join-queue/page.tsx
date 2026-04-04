"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Logo } from "@/components/Logo";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft, Hospital, Activity, User as UserIcon, Calendar, Mail, ArrowRight, CheckCircle, HeartPulse, Loader2 } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import { queueService } from "@/lib/services/queueService";
import { EmergencyButton } from "@/components/EmergencyButton";
import { QueueStatusWidget } from "@/components/QueueStatusWidget";
import { notificationService } from "@/lib/services/notificationService";
import { MedicalRecordsModal } from "@/components/MedicalRecordsModal";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function JoinQueuePage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const [selectedHospital, setSelectedHospital] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", age: "", dob: "", email: "" });
  const [showMedicalModal, setShowMedicalModal] = useState(false);
  const pendingFormRef = useRef<typeof formData | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push("/sign-in");
    if (user) {
      setFormData({
        name: user.fullName || "",
        age: "",
        dob: "",
        email: user.primaryEmailAddress?.emailAddress || "",
      });
    }
  }, [isLoaded, isSignedIn, user, router]);

  useEffect(() => { if (isLoaded && isSignedIn) fetchHospitals(); }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (selectedHospital) fetchDepartments(selectedHospital);
    else { setDepartments([]); setSelectedDepartment(""); }
    setDoctors([]); setSelectedDoctor("");
  }, [selectedHospital]);

  useEffect(() => {
    if (selectedHospital && selectedDepartment) fetchDoctors(selectedHospital, selectedDepartment);
    else { setDoctors([]); setSelectedDoctor(""); }
  }, [selectedHospital, selectedDepartment]);

  const fetchHospitals = async () => {
    try {
      const { data, error } = await supabase.from("hospitals").select("*").order("name");
      if (error) throw error;
      setHospitals(data || []);
    } catch (error) { console.error("Error fetching hospitals:", error); }
  };

  const fetchDepartments = async (hospitalId: string) => {
    try {
      const { data, error } = await supabase.from("departments").select("*").eq("hospital_id", hospitalId).order("name");
      if (error) throw error;
      setDepartments(data || []);
    } catch (error) { console.error("Error fetching departments:", error); }
  };

  const fetchDoctors = async (hospitalId: string, departmentId: string) => {
    try {
      const { data, error } = await supabase.from("doctors").select("*").eq("hospital_id", hospitalId).eq("department_id", departmentId).eq("is_on_leave", false).order("rating", { ascending: false });
      if (error) throw error;
      setDoctors(data || []);
    } catch (error) { console.error("Error fetching doctors:", error); }
  };

  const calculateWaitTime = async (departmentId: string): Promise<number> => {
    try {
      const { data: queueData } = await supabase.from("queue").select("position, created_at").eq("department_id", departmentId).eq("status", "waiting").order("position", { ascending: true });
      const { data: doctorsData } = await supabase.from("doctors").select("average_treatment_time").eq("department_id", departmentId);
      const avgTreatmentTime = doctorsData?.reduce((sum, doc) => sum + (doc.average_treatment_time || 15), 0) || 0 / (doctorsData?.length || 1);
      const queueLength = queueData?.length || 0;
      return queueLength * (avgTreatmentTime || 15);
    } catch { return 30; }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    pendingFormRef.current = { ...formData };
    setShowMedicalModal(true);
  };

  const handleMedicalModalConfirm = async (medicalRecordId: string | null) => {
    setShowMedicalModal(false);
    await joinQueue(medicalRecordId);
  };

  const joinQueue = async (medicalRecordId: string | null) => {
    if (!user) return;
    setLoading(true);
    try {
      const patientId = `PAT${Date.now().toString().slice(-6)}`;
      const userResponse = await fetch("/api/ensure-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, name: formData.name, email: formData.email, patientId }),
      });
      if (!userResponse.ok) throw new Error((await userResponse.json()).error || "Failed to create user");

      const doctorId = (selectedDoctor && selectedDoctor !== "any") ? selectedDoctor : null;
      const estimatedWaitTime = await calculateWaitTime(selectedDepartment);

      const [{ data: hospitalData }, { data: departmentData }, { data: doctorData }] = await Promise.all([
        supabase.from("hospitals").select("name").eq("id", selectedHospital).single(),
        supabase.from("departments").select("name").eq("id", selectedDepartment).single(),
        supabase.from("doctors").select("name").eq("id", doctorId).single(),
      ]);

      const queueEntry = await queueService.addToQueue({
        patientId: user.id, patientName: formData.name, hospitalId: selectedHospital,
        departmentId: selectedDepartment, doctorId: doctorId || "", date: new Date(), time: new Date(),
        treatmentType: "General Consultation", isEmergency: false, status: "waiting",
      });

      if (medicalRecordId) await supabase.from("queue").update({ medical_record_id: medicalRecordId }).eq("id", queueEntry.id);

      await notificationService.notifyPatientAdded(formData.name, hospitalData?.name || "Unknown", departmentData?.name || "Unknown", queueEntry.tokenNumber);

      toast.success(`Queue joined! Your token number is ${queueEntry.tokenNumber}.`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to join queue. Please try again.");
    } finally { setLoading(false); }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 flex h-14 items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5 text-muted-foreground">
            <ArrowLeft size={16} /> Back
          </Button>
          <Link href="/" className="no-underline">
             <Logo height={28} />
          </Link>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-20 space-y-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

          {selectedDepartment && (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mb-4">
              <QueueStatusWidget departmentId={selectedDepartment} hospitalId={selectedHospital} />
            </motion.div>
          )}

          <Card>
            <CardHeader className="border-b border-border bg-muted/30">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Image src="/images/logo.png" alt="MediQueue" width={100} height={28} className="h-7 w-auto object-contain mix-blend-multiply" />
                </div>
                <div>
                  <CardTitle className="text-lg">Registration Details</CardTitle>
                  <CardDescription>Select your facility and enter patient details</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-6">

                {/* Facility Selection */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <Label>Hospital <span className="text-destructive">*</span></Label>
                    <Select value={selectedHospital} onValueChange={v => { setSelectedHospital(v); setSelectedDepartment(""); setSelectedDoctor(""); setDoctors([]); }} required>
                      <SelectTrigger>
                        <Hospital size={15} className="mr-1.5 text-muted-foreground" />
                        <SelectValue placeholder="Choose hospital..." />
                      </SelectTrigger>
                      <SelectContent>
                        {hospitals.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Department <span className="text-destructive">*</span></Label>
                    <Select value={selectedDepartment} onValueChange={v => { setSelectedDepartment(v); setSelectedDoctor(""); }} disabled={!selectedHospital} required>
                      <SelectTrigger>
                        <SelectValue placeholder={selectedHospital ? "Choose department..." : "Select hospital first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Doctor Selection */}
                <div className="space-y-1.5">
                  <Label>Preferred Doctor <span className="text-muted-foreground text-xs font-normal">(Optional)</span></Label>
                  <Select value={selectedDoctor} onValueChange={setSelectedDoctor} disabled={!selectedDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any available doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any available doctor</SelectItem>
                      {doctors.map(doc => <SelectItem key={doc.id} value={doc.id}>{doc.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Patient Information */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="q-name">Full Name <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <UserIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <Input id="q-name" type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g. John Doe" className="pl-9" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="q-email">Email Address <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <Input id="q-email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required placeholder="john@example.com" className="pl-9" />
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="q-age">Age <span className="text-destructive">*</span></Label>
                    <Input
                      id="q-age"
                      type="number"
                      value={formData.age}
                      min="1"
                      max="120"
                      required
                      onChange={e => {
                        let age = e.target.value;
                        if (age && parseInt(age) > 120) age = "120";
                        let dob = formData.dob;
                        if (age) {
                          const d = dob ? new Date(dob) : new Date();
                          d.setFullYear(new Date().getFullYear() - parseInt(age));
                          dob = d.toISOString().split("T")[0];
                        } else dob = "";
                        setFormData({ ...formData, age, dob });
                      }}
                      placeholder="e.g. 35"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="q-dob">Date of Birth <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <Input
                        id="q-dob"
                        type="date"
                        value={formData.dob}
                        max={new Date().toISOString().split("T")[0]}
                        required
                        onChange={e => {
                          const dob = e.target.value;
                          const todayStr = new Date().toISOString().split("T")[0];
                          // Reject dates in the future
                          if (dob > todayStr) return;
                          let age = formData.age;
                          if (dob) {
                            const d = new Date(dob); const now = new Date();
                            let a = now.getFullYear() - d.getFullYear();
                            if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
                            age = a >= 0 ? Math.min(a, 120).toString() : "0";
                          }
                          setFormData({ ...formData, dob, age });
                        }}
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>

                {/* Info banners */}
                <div className="space-y-3">
                  <div className="flex gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                    <CheckCircle size={18} className="text-green-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground leading-relaxed">
                      <span className="font-bold text-green-700 pr-1">Fast Track Enabled:</span>
                      Your queue token and wait time will be delivered instantly upon confirming.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 bg-muted border border-border rounded-xl p-4">
                    <Activity size={16} className="text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground flex-1">
                      You can attach your medical records in the next step.{" "}
                      <Link href="/medical-records" className="font-bold text-primary hover:underline">Manage here</Link>
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading} className="flex-[2] gap-2">
                    {loading ? <><Loader2 size={15} className="animate-spin" /> Joining...</> : <>Confirm &amp; Join Queue <ArrowRight size={15} /></>}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-6">
              <h3 className="text-base font-bold text-foreground mb-1">Emergency Service</h3>
              <p className="text-sm text-muted-foreground mb-5">Click below if you need immediate life-saving medical attention.</p>
              <EmergencyButton hospitalId={selectedHospital} departmentId={selectedDepartment} onEmergencyCreated={() => {}} />
            </CardContent>
          </Card>

        </motion.div>
      </main>

      <MedicalRecordsModal isOpen={showMedicalModal} onClose={() => setShowMedicalModal(false)} onConfirm={handleMedicalModalConfirm} />

    </div>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Hospital, Plus, Upload, X, FileText, Pencil, Trash2, ExternalLink, Loader2
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";

const HOSPITAL_TYPES = ["private", "government", "clinic", "multi-specialty", "trust"] as const;

interface HospitalRecord {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  hospital_type: string;
  bed_count: number;
  accreditation: string;
  website: string;
  license_number: string;
  license_expiry: string;
  license_document_url: string;
  is_active: boolean;
  created_at: string;
}

const emptyForm = {
  name: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  phone: "",
  email: "",
  hospital_type: "private",
  bed_count: "",
  accreditation: "",
  website: "",
  license_number: "",
  license_expiry: "",
};

export default function AdminHospitalsPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hospitals, setHospitals] = useState<HospitalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [hospitalPage, setHospitalPage] = useState(1);
  const HOSPITALS_PER_PAGE = 8;

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push("/sign-in"); return; }
    if ((user?.publicMetadata?.role as string) !== "admin") router.push("/");
  }, [isLoaded, isSignedIn, user, router]);

  useEffect(() => {
    if (isLoaded && isSignedIn && (user?.publicMetadata?.role as string) === "admin") fetchHospitals();
  }, [isLoaded, isSignedIn, user]);

  const fetchHospitals = async () => {
    setLoading(true);
    const { data } = await supabase.from("hospitals").select("*").order("created_at", { ascending: false });
    setHospitals(data || []);
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setLicenseFile(file);
  };

  const uploadLicenseDocument = async (): Promise<string | null> => {
    if (!licenseFile) return null;
    setUploading(true);
    const ext = licenseFile.name.split(".").pop();
    const path = `licenses/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("hospital-documents").upload(path, licenseFile);
    setUploading(false);
    if (error) { toast.error("License upload failed: " + error.message); return null; }
    const { data } = supabase.storage.from("hospital-documents").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.address || !form.city || !form.state || !form.pincode || !form.phone || !form.email) {
      toast.error("Please fill all required fields.");
      return;
    }
    setSaving(true);

    let licenseDocUrl: string | null = null;
    if (licenseFile) {
      licenseDocUrl = await uploadLicenseDocument();
      if (!licenseDocUrl) { setSaving(false); return; }
    }

    const payload: any = {
      ...form,
      bed_count: form.bed_count ? parseInt(form.bed_count) : 0,
      license_expiry: form.license_expiry || null,
    };
    if (licenseDocUrl) payload.license_document_url = licenseDocUrl;

    const { error } = editingId
      ? await supabase.from("hospitals").update(payload).eq("id", editingId)
      : await supabase.from("hospitals").insert(payload);

    setSaving(false);
    if (error) { toast.error(error.message); return; }

    toast.success(editingId ? "Hospital updated successfully." : "Hospital added successfully.");
    resetForm();
    fetchHospitals();
  };

  const resetForm = () => {
    setForm(emptyForm);
    setLicenseFile(null);
    setEditingId(null);
    setShowForm(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEdit = (h: HospitalRecord) => {
    setForm({
      name: h.name,
      address: h.address,
      city: h.city,
      state: h.state,
      pincode: h.pincode,
      phone: h.phone,
      email: h.email,
      hospital_type: h.hospital_type || "private",
      bed_count: h.bed_count?.toString() || "",
      accreditation: h.accreditation || "",
      website: h.website || "",
      license_number: h.license_number || "",
      license_expiry: h.license_expiry || "",
    });
    setEditingId(h.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("hospitals").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Hospital deleted.");
    setDeleteConfirm(null);
    fetchHospitals();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("hospitals").update({ is_active: !current }).eq("id", id);
    fetchHospitals();
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(hospitals.length / HOSPITALS_PER_PAGE));
  const pagedHospitals = hospitals.slice((hospitalPage - 1) * HOSPITALS_PER_PAGE, hospitalPage * HOSPITALS_PER_PAGE);

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Hospital Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{hospitals.length} hospital{hospitals.length !== 1 ? "s" : ""} registered</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(v => !v); }} className="gap-2">
          <Plus size={16} />
          Add Hospital
        </Button>
      </div>

      {/* Add / Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            <Card>
              <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>{editingId ? "Edit Hospital" : "Add New Hospital"}</CardTitle>
                  <CardDescription>Fill in the details below to {editingId ? "update" : "register"} a hospital.</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={resetForm}>
                  <X size={18} />
                </Button>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Basic Info */}
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Basic Information</p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-2 space-y-1.5">
                        <Label htmlFor="hosp-name">Hospital Name <span className="text-destructive">*</span></Label>
                        <Input id="hosp-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Apollo Hospital" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Type <span className="text-destructive">*</span></Label>
                        <Select value={form.hospital_type} onValueChange={v => setForm(f => ({ ...f, hospital_type: v }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {HOSPITAL_TYPES.map(t => (
                              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="lg:col-span-2 space-y-1.5">
                        <Label htmlFor="hosp-address">Address <span className="text-destructive">*</span></Label>
                        <Input id="hosp-address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street address" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="hosp-city">City <span className="text-destructive">*</span></Label>
                        <Input id="hosp-city" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="City" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="hosp-state">State <span className="text-destructive">*</span></Label>
                        <Input id="hosp-state" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="State" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="hosp-pincode">Pincode <span className="text-destructive">*</span></Label>
                        <Input id="hosp-pincode" value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} placeholder="6-digit pincode" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="hosp-phone">Phone <span className="text-destructive">*</span></Label>
                        <Input id="hosp-phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 XXXXXXXXXX" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="hosp-email">Email <span className="text-destructive">*</span></Label>
                        <Input id="hosp-email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@hospital.com" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="hosp-beds">Bed Count</Label>
                        <Input id="hosp-beds" type="number" min="0" value={form.bed_count} onChange={e => setForm(f => ({ ...f, bed_count: e.target.value }))} placeholder="0" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="hosp-accred">Accreditation</Label>
                        <Input id="hosp-accred" value={form.accreditation} onChange={e => setForm(f => ({ ...f, accreditation: e.target.value }))} placeholder="e.g. NABH, JCI" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="hosp-website">Website</Label>
                        <Input id="hosp-website" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://hospital.com" />
                      </div>
                    </div>
                  </div>

                  {/* License */}
                  <div className="border-t border-border pt-6">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">License &amp; Compliance</p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="hosp-license">License Number</Label>
                        <Input id="hosp-license" value={form.license_number} onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))} placeholder="e.g. MH/HOS/2024/1234" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="hosp-expiry">License Expiry Date</Label>
                        <Input id="hosp-expiry" type="date" value={form.license_expiry} onChange={e => setForm(f => ({ ...f, license_expiry: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>License Document</Label>
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-3 px-3 py-2.5 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group"
                        >
                          <Upload size={16} className="text-muted-foreground group-hover:text-primary" />
                          <span className="text-sm text-muted-foreground group-hover:text-primary truncate">
                            {licenseFile ? licenseFile.name : "Upload PDF / Image"}
                          </span>
                        </div>
                        <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileChange} className="hidden" />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button type="submit" disabled={saving || uploading} className="gap-2">
                      {(saving || uploading) && <Loader2 size={16} className="animate-spin" />}
                      {editingId ? "Save Changes" : "Add Hospital"}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hospitals Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Registered Hospitals</CardTitle>
          <CardDescription>{hospitals.length} hospital{hospitals.length !== 1 ? "s" : ""} on the platform</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : hospitals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Hospital size={48} className="mb-4 opacity-20" />
              <p className="font-semibold text-foreground">No hospitals yet</p>
              <p className="text-sm mt-1">Click &quot;Add Hospital&quot; to register your first facility.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hospital</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>License</TableHead>
                      <TableHead>Beds</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedHospitals.map((h, i) => {
                      const isExpiringSoon = h.license_expiry
                        ? new Date(h.license_expiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                        : false;
                      return (
                        <motion.tr key={h.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                          className="border-b border-border hover:bg-muted/30 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Hospital size={16} className="text-primary" />
                              </div>
                              <div>
                                <p className="font-bold text-foreground">{h.name}</p>
                                <p className="text-xs text-muted-foreground">{h.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-foreground">{h.city}, {h.state}</p>
                            <p className="text-xs text-muted-foreground">{h.pincode}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">{h.hospital_type || "private"}</Badge>
                          </TableCell>
                          <TableCell>
                            {h.license_number ? (
                              <div>
                                <p className="font-mono text-xs font-medium text-foreground">{h.license_number}</p>
                                {h.license_expiry && (
                                  <p className={`text-xs mt-0.5 font-medium ${isExpiringSoon ? "text-amber-600" : "text-muted-foreground"}`}>
                                    {isExpiringSoon && "⚠ "}Exp: {new Date(h.license_expiry).toLocaleDateString("en-IN")}
                                  </p>
                                )}
                                {h.license_document_url && (
                                  <a href={h.license_document_url} target="_blank" rel="noreferrer"
                                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-1 font-medium">
                                    <FileText size={11} /> View Doc
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Not provided</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-foreground">{h.bed_count || 0}</span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleActive(h.id, h.is_active ?? true)}
                              className={`gap-1.5 h-7 px-2.5 text-xs font-semibold rounded-full border ${
                                (h.is_active ?? true)
                                  ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                  : "border-border bg-muted text-muted-foreground hover:bg-muted/80"
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${(h.is_active ?? true) ? "bg-green-500" : "bg-muted-foreground"}`} />
                              {(h.is_active ?? true) ? "Active" : "Inactive"}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {h.website && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                  <a href={h.website} target="_blank" rel="noreferrer">
                                    <ExternalLink size={14} />
                                  </a>
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => handleEdit(h)}>
                                <Pencil size={14} />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => setDeleteConfirm(h.id)}>
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-border flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {((hospitalPage - 1) * HOSPITALS_PER_PAGE) + 1}–{Math.min(hospitalPage * HOSPITALS_PER_PAGE, hospitals.length)} of {hospitals.length} hospitals
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={e => { e.preventDefault(); setHospitalPage(p => Math.max(1, p - 1)); }}
                          className={hospitalPage <= 1 ? "pointer-events-none opacity-40" : ""}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <span className="px-3 text-sm font-medium">{hospitalPage} / {totalPages}</span>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={e => { e.preventDefault(); setHospitalPage(p => Math.min(totalPages, p + 1)); }}
                          className={hospitalPage >= totalPages ? "pointer-events-none opacity-40" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={open => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <Trash2 size={22} className="text-destructive" />
            </div>
            <DialogTitle className="text-center">Delete Hospital?</DialogTitle>
            <DialogDescription className="text-center">
              This will also remove all associated departments and doctors. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

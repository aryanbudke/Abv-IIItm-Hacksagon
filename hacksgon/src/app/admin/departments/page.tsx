"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { motion } from "framer-motion";

interface Department {
  id: string;
  name: string;
  floor: string | null;
  counter_numbers: number[];
  hospital_id: string;
  hospitals?: { name: string };
}

interface Hospital {
  id: string;
  name: string;
}

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: "", floor: "", hospital_id: "", counter_numbers: "" });
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: depts }, { data: hosps }] = await Promise.all([
      supabase.from("departments").select("*, hospitals(name)").order("name"),
      supabase.from("hospitals").select("id, name").eq("is_active", true),
    ]);
    setDepartments(depts || []);
    setHospitals(hosps || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", floor: "", hospital_id: hospitals[0]?.id || "", counter_numbers: "" });
    setDialogOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    setForm({
      name: dept.name,
      floor: dept.floor || "",
      hospital_id: dept.hospital_id,
      counter_numbers: (dept.counter_numbers || []).join(", "),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      name: form.name,
      floor: form.floor || null,
      hospital_id: form.hospital_id,
      counter_numbers: form.counter_numbers ? form.counter_numbers.split(",").map(n => parseInt(n.trim())).filter(Boolean) : [],
    };

    const res = await fetch("/api/departments", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
    });

    if (res.ok) {
      toast.success(editing ? "Department updated" : "Department created");
      setDialogOpen(false);
      fetchAll();
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to save");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setIdToDelete(id);
    setShowDeleteConfirm(true);
  };

  const doDelete = async () => {
    if (!idToDelete) return;
    const res = await fetch("/api/departments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: idToDelete }),
    });
    if (res.ok) { 
      toast.success("Deleted"); 
      fetchAll(); 
    } else {
      toast.error("Failed to delete");
    }
    setIdToDelete(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Departments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage hospital departments and counters</p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-2">
          <Plus size={14} /> Add Department
        </Button>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Building2 size={15} className="text-primary" /> All Departments ({departments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Hospital</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead>Counters</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept, i) => (
                  <motion.tr key={dept.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-border hover:bg-muted/30">
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{dept.hospitals?.name || "—"}</TableCell>
                    <TableCell className="text-sm">{dept.floor || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(dept.counter_numbers || []).map(n => (
                          <Badge key={n} className="bg-primary/10 text-primary border-0 text-[10px]">#{n}</Badge>
                        ))}
                        {!dept.counter_numbers?.length && <span className="text-sm text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(dept)} className="h-7 w-7 p-0">
                          <Pencil size={13} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(dept.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Department" : "Add Department"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Department Name</Label>
              <Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Cardiology" />
            </div>
            <div>
              <Label>Hospital</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.hospital_id}
                onChange={e => setForm(f => ({ ...f, hospital_id: e.target.value }))}
              >
                <option value="">Select hospital...</option>
                {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Floor (optional)</Label>
              <Input className="mt-1" value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))} placeholder="e.g. 3rd Floor" />
            </div>
            <div>
              <Label>Counter Numbers (comma separated)</Label>
              <Input className="mt-1" value={form.counter_numbers} onChange={e => setForm(f => ({ ...f, counter_numbers: e.target.value }))} placeholder="e.g. 1, 2, 3" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.hospital_id}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Department"
        description="Are you sure you want to delete this department? This action cannot be undone."
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={doDelete}
        confirmText="Delete"
        confirmVariant="destructive"
      />
    </div>
  );
}

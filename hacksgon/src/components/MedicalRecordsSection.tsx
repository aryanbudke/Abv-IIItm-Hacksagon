"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Image as ImageIcon, Upload, Trash2, Edit3, Eye, Plus,
  Loader2, X, Save, FilePlus2, Calendar, StickyNote, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface MedicalRecord {
  id: string;
  title: string;
  notes: string | null;
  record_date: string | null;
  file_url: string | null;
  file_type: string | null;
  file_name: string | null;
  created_at: string;
}

export function MedicalRecordsSection() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Upload form
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadDate, setUploadDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit form
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Search & Filter
  const [recordSearch, setRecordSearch] = useState("");
  const [recordTypeFilter, setRecordTypeFilter] = useState<"all" | "pdf" | "image" | "notes">("all");

  const filteredRecords = useMemo(() => {
    const rsq = recordSearch.toLowerCase();
    return records.filter(rec => {
      const matchesSearch = !rsq || rec.title.toLowerCase().includes(rsq) || (rec.notes || "").toLowerCase().includes(rsq);
      if (!matchesSearch) return false;
      if (recordTypeFilter === "all") return true;
      if (recordTypeFilter === "pdf") return rec.file_type === "pdf";
      if (recordTypeFilter === "image") return rec.file_type === "image";
      if (recordTypeFilter === "notes") return !rec.file_url;
      return true;
    });
  }, [records, recordSearch, recordTypeFilter]);

  useEffect(() => { fetchRecords(); }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/medical-records");
      if (!res.ok) {
        const text = await res.text();
        console.error("Failed to fetch medical records:", res.status, text);
        return;
      }
      const json = await res.json();
      setRecords(json.records || []);
    } catch (err) {
      console.error("Error fetching medical records:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadTitle) return;
    setUploading(true);
    try {
      let fileUrl: string | null = null;
      let fileType: string | null = null;
      let fileName: string | null = null;

      if (uploadFile) {
        const form = new FormData();
        form.append("file", uploadFile);
        const res = await fetch("/api/medical-records/upload", { method: "POST", body: form });
        if (!res.ok) { toast.error((await res.json()).error || "Upload failed"); return; }
        const d = await res.json();
        fileUrl = d.file_url; fileType = d.file_type; fileName = d.file_name;
      }

      const res = await fetch("/api/medical-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: uploadTitle, notes: uploadNotes || null, record_date: uploadDate || null, file_url: fileUrl, file_type: fileType, file_name: fileName }),
      });
      if (!res.ok) { toast.error((await res.json()).error || "Failed"); return; }
      await fetchRecords();
      setShowUploadForm(false);
      setUploadFile(null); setUploadTitle(""); setUploadNotes(""); setUploadDate("");
    } finally {
      setUploading(false);
    }
  };

  const openEdit = (rec: MedicalRecord) => {
    setEditingId(rec.id);
    setEditTitle(rec.title);
    setEditNotes(rec.notes || "");
    setEditDate(rec.record_date || "");
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editTitle) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/medical-records/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, notes: editNotes || null, record_date: editDate || null }),
      });
      if (!res.ok) { toast.error((await res.json()).error || "Failed to save"); return; }
      await fetchRecords();
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/medical-records/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">My Medical Records</h2>
          <p className="text-sm text-slate-500 mt-0.5">Upload and manage prescriptions, reports, and scans</p>
        </div>
        <Button
          onClick={() => setShowUploadForm(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-md shadow-blue-500/20 px-5"
        >
          <Plus className="h-4 w-4" />
          Add Record
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search records by title or notes…"
            value={recordSearch}
            onChange={e => setRecordSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm transition-all"
          />
          {recordSearch && (
            <button onClick={() => setRecordSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([
            { key: "all", label: "All Records" },
            { key: "pdf", label: "PDF" },
            { key: "image", label: "Images" },
            { key: "notes", label: "Notes Only" },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setRecordTypeFilter(f.key)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                recordTypeFilter === f.key
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Upload Form */}
      <AnimatePresence>
        {showUploadForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <FilePlus2 className="h-5 w-5 text-blue-600" /> New Record
                </h3>
                <button onClick={() => setShowUploadForm(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { 
                  e.preventDefault(); 
                  setDragOver(false); 
                  const f = e.dataTransfer.files[0]; 
                  if (f) {
                    if (f.size > 10 * 1024 * 1024) {
                      toast.error("File must be under 10 MB");
                      return;
                    }
                    setUploadFile(f); 
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  dragOver ? "border-blue-500 bg-blue-50" : uploadFile ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                }`}
              >
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  accept=".pdf,.jpg,.jpeg,.png,.webp" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file && file.size > 10 * 1024 * 1024) {
                      toast.error("File must be under 10 MB");
                      return;
                    }
                    setUploadFile(file);
                  }} 
                />
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-3">
                    {uploadFile.type === "application/pdf" ? <FileText className="h-8 w-8 text-red-500" /> : <ImageIcon className="h-8 w-8 text-indigo-500" />}
                    <div className="text-left">
                      <p className="font-medium text-slate-800 text-sm">{uploadFile.name}</p>
                      <p className="text-xs text-slate-400">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setUploadFile(null); }} className="ml-auto text-slate-400 hover:text-red-500 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-600">Drop file here or click to browse</p>
                    <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG or WebP — max 10 MB (optional)</p>
                  </>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Title <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g. Blood Test Report"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Record Date</label>
                  <input
                    type="date"
                    value={uploadDate}
                    onChange={(e) => setUploadDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Notes (optional)</label>
                <textarea
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  rows={2}
                  placeholder="Any additional details..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setShowUploadForm(false)} className="rounded-xl" disabled={uploading}>Cancel</Button>
                <Button
                  onClick={handleUpload}
                  disabled={!uploadTitle || uploading}
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 gap-2"
                >
                  {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save Record</>}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Records Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
          <FilePlus2 className="h-12 w-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">{recordSearch || recordTypeFilter !== "all" ? "No matching records" : "No medical records yet"}</p>
          <p className="text-slate-400 text-sm mt-1 mb-4">{recordSearch ? "Try a different search term" : "Upload prescriptions, lab reports, or scans"}</p>
          {(!recordSearch && recordTypeFilter === "all") && (
            <Button onClick={() => setShowUploadForm(true)} variant="outline" className="rounded-xl gap-2">
              <Plus className="h-4 w-4" /> Add your first record
            </Button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredRecords.map((rec) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Card top: file preview */}
                <div className={`h-28 flex items-center justify-center ${rec.file_type === "pdf" ? "bg-red-50" : rec.file_type === "image" ? "bg-indigo-50" : "bg-slate-50"}`}>
                  {rec.file_url && rec.file_type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={rec.file_url} alt={rec.title} className="h-full w-full object-cover" />
                  ) : rec.file_type === "pdf" ? (
                    <FileText className="h-10 w-10 text-red-400" />
                  ) : (
                    <StickyNote className="h-10 w-10 text-slate-300" />
                  )}
                </div>

                {/* Card body */}
                {editingId === rec.id ? (
                  <div className="p-4 space-y-3">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="Title"
                    />
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="Notes"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="flex-1 rounded-lg text-xs" disabled={saving}>Cancel</Button>
                      <Button size="sm" onClick={handleSaveEdit} disabled={!editTitle || saving} className="flex-1 rounded-lg text-xs bg-blue-600 text-white hover:bg-blue-700 gap-1">
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-900 text-sm truncate">{rec.title}</h3>
                    {rec.notes && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{rec.notes}</p>}
                    <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                      <Calendar className="h-3 w-3" />
                      {rec.record_date
                        ? new Date(rec.record_date).toLocaleDateString()
                        : new Date(rec.created_at).toLocaleDateString()}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
                      {rec.file_url && (
                        <a
                          href={rec.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </a>
                      )}
                      <button
                        onClick={() => openEdit(rec)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Edit
                      </button>
                      {deleteConfirmId === rec.id ? (
                        <button
                          onClick={() => handleDelete(rec.id)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          Confirm?
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(rec.id)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

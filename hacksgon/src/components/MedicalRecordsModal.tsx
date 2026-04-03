"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, FileText, Image as ImageIcon, CheckCircle, ChevronRight, Plus, Loader2, FilePlus2 } from "lucide-react";
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

interface MedicalRecordsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with selected record id (or null if skipped) */
  onConfirm: (recordId: string | null) => void;
}

export function MedicalRecordsModal({ isOpen, onClose, onConfirm }: MedicalRecordsModalProps) {
  const [view, setView] = useState<"choose" | "existing" | "upload">("choose");
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadDate, setUploadDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && view === "existing") fetchRecords();
  }, [isOpen, view]);

  useEffect(() => {
    if (!isOpen) {
      // reset on close
      setView("choose");
      setSelected(null);
      setUploadFile(null);
      setUploadTitle("");
      setUploadNotes("");
      setUploadDate("");
    }
  }, [isOpen]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/medical-records");
      if (!res.ok) {
        console.error("Failed to fetch medical records:", res.status);
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

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File must be under 10 MB");
        return;
      }
      setUploadFile(file);
    }
  };

  const handleUploadSubmit = async () => {
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
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || "Upload failed");
          return;
        }
        const uploadData = await res.json();
        fileUrl = uploadData.file_url;
        fileType = uploadData.file_type;
        fileName = uploadData.file_name;
      }

      const res = await fetch("/api/medical-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: uploadTitle,
          notes: uploadNotes || null,
          record_date: uploadDate || null,
          file_url: fileUrl,
          file_type: fileType,
          file_name: fileName,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to save record");
        return;
      }

      const { record } = await res.json();
      onConfirm(record.id);
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm overflow-y-auto p-4 flex items-center justify-center"
            onClick={onClose}
          />

          {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col my-auto border border-gray-100"
              onClick={(e) => e.stopPropagation()}
            >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Medical Records</h2>
                  <p className="text-xs text-slate-500">Attach a record to your queue entry</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {view === "choose" && <ChooseView onExisting={() => setView("existing")} onUpload={() => setView("upload")} onSkip={() => onConfirm(null)} />}
              {view === "existing" && (
                <ExistingView
                  records={records}
                  loading={loading}
                  selected={selected}
                  onSelect={setSelected}
                  onBack={() => setView("choose")}
                  onConfirm={() => onConfirm(selected)}
                  onUploadNew={() => setView("upload")}
                />
              )}
              {view === "upload" && (
                <UploadView
                  uploadFile={uploadFile}
                  uploadTitle={uploadTitle}
                  uploadNotes={uploadNotes}
                  uploadDate={uploadDate}
                  uploading={uploading}
                  dragOver={dragOver}
                  fileInputRef={fileInputRef}
                  onFileChange={(f) => setUploadFile(f)}
                  onTitleChange={setUploadTitle}
                  onNotesChange={setUploadNotes}
                  onDateChange={setUploadDate}
                  onDragOver={(v) => setDragOver(v)}
                  onBack={() => setView("choose")}
                  onSubmit={handleUploadSubmit}
                />
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ── Sub-views ────────────────────────────────────────────────── */

function ChooseView({ onExisting, onUpload, onSkip }: { onExisting: () => void; onUpload: () => void; onSkip: () => void }) {
  return (
    <div className="p-6 space-y-4">
      <p className="text-sm text-slate-500 text-center mb-6">
        Would you like to attach a medical record or prescription to your queue entry?
      </p>

      <button
        onClick={onExisting}
        className="w-full flex items-center gap-4 p-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all group text-left"
      >
        <div className="p-3 bg-blue-100 group-hover:bg-blue-200 rounded-xl transition-colors">
          <FileText className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-800">Choose Existing Record</p>
          <p className="text-xs text-slate-500">Select from your previously uploaded records</p>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
      </button>

      <button
        onClick={onUpload}
        className="w-full flex items-center gap-4 p-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all group text-left"
      >
        <div className="p-3 bg-emerald-100 group-hover:bg-emerald-200 rounded-xl transition-colors">
          <Upload className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-800">Upload New Record</p>
          <p className="text-xs text-slate-500">Upload a prescription, report, or scan (PDF / Image)</p>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
      </button>

      <button
        onClick={onSkip}
        className="w-full flex items-center justify-center gap-2 p-3.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl border border-dashed border-slate-200 transition-all text-sm font-medium"
      >
        Skip for now
      </button>
    </div>
  );
}

function ExistingView({
  records, loading, selected, onSelect, onBack, onConfirm, onUploadNew,
}: {
  records: MedicalRecord[];
  loading: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  onUploadNew: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 flex-1 space-y-3">
        <button onClick={onBack} className="text-xs text-blue-600 hover:underline mb-2 flex items-center gap-1">
          ← Back
        </button>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-10">
            <FilePlus2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No records yet.</p>
            <button onClick={onUploadNew} className="mt-3 text-sm text-blue-600 hover:underline flex items-center gap-1 mx-auto">
              <Plus className="h-4 w-4" /> Upload your first record
            </button>
          </div>
        ) : (
          records.map((rec) => (
            <button
              key={rec.id}
              onClick={() => onSelect(rec.id)}
              className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                selected === rec.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-blue-300 bg-white"
              }`}
            >
              <div className={`p-2 rounded-lg flex-shrink-0 ${rec.file_type === "pdf" ? "bg-red-100" : "bg-indigo-100"}`}>
                {rec.file_type === "pdf" ? (
                  <FileText className="h-4 w-4 text-red-600" />
                ) : (
                  <ImageIcon className="h-4 w-4 text-indigo-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 truncate">{rec.title}</p>
                {rec.notes && <p className="text-xs text-slate-500 truncate mt-0.5">{rec.notes}</p>}
                <p className="text-xs text-slate-400 mt-1">
                  {rec.record_date
                    ? new Date(rec.record_date).toLocaleDateString()
                    : new Date(rec.created_at).toLocaleDateString()}
                </p>
              </div>
              {selected === rec.id && <CheckCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />}
            </button>
          ))
        )}
      </div>
      {records.length > 0 && (
        <div className="p-6 border-t border-gray-100 flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1 rounded-xl">Back</Button>
          <Button
            onClick={onConfirm}
            disabled={!selected}
            className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 disabled:opacity-50"
          >
            Attach & Continue
          </Button>
        </div>
      )}
    </div>
  );
}

function UploadView({
  uploadFile, uploadTitle, uploadNotes, uploadDate, uploading, dragOver, fileInputRef,
  onFileChange, onTitleChange, onNotesChange, onDateChange, onDragOver, onBack, onSubmit,
}: {
  uploadFile: File | null;
  uploadTitle: string;
  uploadNotes: string;
  uploadDate: string;
  uploading: boolean;
  dragOver: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (f: File | null) => void;
  onTitleChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onDateChange: (v: string) => void;
  onDragOver: (v: boolean) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="p-6 space-y-5">
      <button onClick={onBack} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
        ← Back
      </button>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); onDragOver(true); }}
        onDragLeave={() => onDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          onDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) onFileChange(file);
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
            onFileChange(file);
          }}
        />
        {uploadFile ? (
          <div className="flex items-center justify-center gap-3">
            {uploadFile.type === "application/pdf" ? (
              <FileText className="h-8 w-8 text-red-500" />
            ) : (
              <ImageIcon className="h-8 w-8 text-indigo-500" />
            )}
            <div className="text-left">
              <p className="font-medium text-slate-800 text-sm">{uploadFile.name}</p>
              <p className="text-xs text-slate-400">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onFileChange(null); }}
              className="ml-auto text-slate-400 hover:text-red-500 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600">Drop file here or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG or WebP — max 10 MB</p>
          </>
        )}
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700">Record Title <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={uploadTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g. Blood Test Report, Prescription"
          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
        />
      </div>

      {/* Date */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700">Record Date</label>
        <input
          type="date"
          value={uploadDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
        />
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700">Notes (optional)</label>
        <textarea
          value={uploadNotes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          placeholder="Any additional details about this record..."
          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm resize-none"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <Button variant="outline" onClick={onBack} className="flex-1 rounded-xl" disabled={uploading}>Cancel</Button>
        <Button
          onClick={onSubmit}
          disabled={!uploadTitle || uploading}
          className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 disabled:opacity-50"
        >
          {uploading ? (
            <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Saving...</span>
          ) : (
            "Save & Attach"
          )}
        </Button>
      </div>
    </div>
  );
}

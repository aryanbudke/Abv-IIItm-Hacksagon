"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CheckCircle2, XCircle, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface QueueEntry {
  id: string;
  token_number: number;
  position: number;
  status: string;
  estimated_wait_time: number;
  is_emergency: boolean;
  created_at: string;
  users?: { name: string; email: string };
  doctors?: { name: string };
  hospitals?: { name: string };
  departments?: { name: string };
}

export default function AdminQueueManagementPage() {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { fetchQueue(); }, []);

  const fetchQueue = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("queue")
      .select("*, users(name, email), doctors(name), hospitals(name), departments(name)")
      .in("status", ["waiting", "in-treatment"])
      .order("position");
    setQueue(data || []);
    setLoading(false);
  };

  const handleAction = async (queueId: string, action: "complete" | "cancel") => {
    setActionLoading(queueId + action);
    const res = await fetch("/api/admin/queues", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queue_id: queueId, action }),
    });
    if (res.ok) {
      toast.success(`Queue entry ${action}d`);
      fetchQueue();
    } else {
      toast.error("Action failed");
    }
    setActionLoading(null);
  };

  const statusColor: Record<string, string> = {
    waiting: "bg-amber-100 text-amber-700",
    "in-treatment": "bg-blue-100 text-blue-700",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Queue Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Live queue overview — force complete or cancel entries</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {queue.length} active
          </Badge>
          <Button variant="outline" size="sm" onClick={fetchQueue} className="gap-2">
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Users size={15} className="text-primary" /> Active Queue
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : queue.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Queue is empty</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Wait</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((entry, i) => (
                  <motion.tr key={entry.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-border hover:bg-muted/30">
                    <TableCell>
                      <div className="font-bold text-primary">#{entry.token_number}</div>
                      {entry.is_emergency && <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">EMERGENCY</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{entry.users?.name || "—"}</div>
                      <div className="text-[11px] text-muted-foreground">{entry.users?.email}</div>
                    </TableCell>
                    <TableCell className="text-sm">{entry.doctors?.name || "—"}</TableCell>
                    <TableCell className="text-sm">{entry.departments?.name || "—"}</TableCell>
                    <TableCell className="text-sm">{entry.estimated_wait_time ?? "—"}m</TableCell>
                    <TableCell>
                      <Badge className={`border-0 text-[11px] ${statusColor[entry.status] || "bg-muted text-muted-foreground"}`}>
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-green-200 text-green-700 hover:bg-green-50"
                          disabled={!!actionLoading} onClick={() => handleAction(entry.id, "complete")}>
                          <CheckCircle2 size={12} /> Complete
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-red-200 text-destructive hover:bg-red-50"
                          disabled={!!actionLoading} onClick={() => handleAction(entry.id, "cancel")}>
                          <XCircle size={12} /> Cancel
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
    </div>
  );
}

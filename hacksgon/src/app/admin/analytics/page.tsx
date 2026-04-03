"use client";

import { useEffect, useState } from "react";
import {
  Users, Clock, Calendar, CheckCircle2, TrendingUp,
  Activity, Stethoscope, FileText, BarChart3, RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Area, AreaChart, Legend
} from "recharts";
import { motion } from "framer-motion";

const COLORS = ["#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPatients: 0,
    completedToday: 0,
    totalReports: 0,
    totalDoctors: 0,
    avgWaitTime: 0,
    appointmentsThisWeek: 0,
    totalQueueAllTime: 0,
    completedAllTime: 0,
  });
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [doctorData, setDoctorData] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const localMidnight = new Date(); localMidnight.setHours(0, 0, 0, 0);
      const todayISO = localMidnight.toISOString();
      const weekAgoDate = new Date(now.getTime() - 7 * 86400000);

      const [
        queueAllRes,
        queueTodayRes,
        appointmentsRes,
        reportsRes,
        doctorsRes,
      ] = await Promise.all([
        supabase.from("queue").select("status, estimated_wait_time, created_at, doctor_id"),
        supabase.from("queue").select("status, created_at").gte("created_at", todayISO),
        supabase.from("appointments").select("date, status, created_at").gte("created_at", weekAgoDate.toISOString()),
        supabase.from("reports").select("id, doctor_id, created_at, diagnosis"),
        supabase.from("doctors").select("id, name, specialization"),
      ]);

      const allQueue = queueAllRes.data || [];
      const todayQueue = queueTodayRes.data || [];
      const appointments = appointmentsRes.data || [];
      const reports = reportsRes.data || [];
      const doctors = doctorsRes.data || [];

      // Stats
      const completedToday = todayQueue.filter(q => q.status === "completed").length;
      const completedAll = allQueue.filter(q => q.status === "completed").length;
      const avgWait = allQueue.length > 0
        ? Math.round(allQueue.reduce((s, q) => s + (q.estimated_wait_time || 0), 0) / allQueue.length)
        : 0;

      setStats({
        totalPatients: todayQueue.length,
        completedToday,
        totalReports: reports.length,
        totalDoctors: doctors.length,
        avgWaitTime: avgWait,
        appointmentsThisWeek: appointments.length,
        totalQueueAllTime: allQueue.length,
        completedAllTime: completedAll,
      });

      // Weekly chart — use queue data grouped by day
      const dayMap: Record<string, { date: string; queued: number; completed: number; reports: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const key = d.toISOString().split("T")[0];
        dayMap[key] = {
          date: d.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" }),
          queued: 0, completed: 0, reports: 0,
        };
      }
      allQueue.forEach((q: any) => {
        const key = new Date(q.created_at).toISOString().split("T")[0];
        if (dayMap[key]) {
          dayMap[key].queued++;
          if (q.status === "completed") dayMap[key].completed++;
        }
      });
      reports.forEach((r: any) => {
        const key = new Date(r.created_at).toISOString().split("T")[0];
        if (dayMap[key]) dayMap[key].reports++;
      });
      setWeeklyData(Object.values(dayMap));

      // Queue status distribution
      const statusCounts: Record<string, number> = {};
      allQueue.forEach(q => {
        const s = q.status || "unknown";
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });
      setStatusData(Object.entries(statusCounts).map(([name, value]) => ({ name, value })));

      // Doctor performance — reports per doctor
      const doctorReportCounts: Record<string, number> = {};
      reports.forEach(r => {
        if (r.doctor_id) doctorReportCounts[r.doctor_id] = (doctorReportCounts[r.doctor_id] || 0) + 1;
      });
      setDoctorData(doctors.map(d => ({
        name: d.name,
        specialization: d.specialization,
        reports: doctorReportCounts[d.id] || 0,
      })).sort((a, b) => b.reports - a.reports));

      // Hourly distribution from real queue data
      const hourCounts: Record<number, number> = {};
      for (let h = 8; h <= 20; h++) hourCounts[h] = 0;
      allQueue.forEach(q => {
        const h = new Date(q.created_at).getHours();
        if (hourCounts[h] !== undefined) hourCounts[h]++;
      });
      setHourlyData(Object.entries(hourCounts).map(([h, count]) => ({
        hour: `${h}:00`,
        patients: count,
      })));

    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: "Queue Today", value: stats.totalPatients, icon: Users, color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-100", sub: "Patients in today's queue" },
    { label: "Served Today", value: stats.completedToday, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", sub: "Completed consultations" },
    { label: "Avg Wait", value: `${stats.avgWaitTime}m`, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100", sub: "Estimated wait time" },
    { label: "This Week", value: stats.appointmentsThisWeek, icon: Calendar, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100", sub: "Appointments booked" },
    { label: "Total Reports", value: stats.totalReports, icon: FileText, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100", sub: "Clinical reports filed" },
    { label: "Active Doctors", value: stats.totalDoctors, icon: Stethoscope, color: "text-pink-600", bg: "bg-pink-50", border: "border-pink-100", sub: "Registered physicians" },
  ];

  return (
    <div className="p-4 sm:p-8 space-y-8 bg-background min-h-screen pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <BarChart3 className="text-primary" size={24} />
            </div>
            Analytics Dashboard
          </h1>
          <p className="text-muted-foreground text-sm font-medium ml-13">
            Real-time operational metrics across your hospital network
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 font-bold gap-1.5 px-3 py-1.5 rounded-xl">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live data
          </Badge>
          <Button variant="outline" size="sm" className="h-10 rounded-xl gap-2 font-bold px-4" onClick={fetchAnalytics}>
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className={`border shadow-sm hover:shadow-md transition-shadow ${s.border}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{s.label}</p>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${s.bg}`}>
                    <s.icon size={15} className={s.color} />
                  </div>
                </div>
                <div className={`text-2xl font-black tracking-tight ${s.color}`}>
                  {loading ? <Skeleton className="h-7 w-12" /> : s.value}
                </div>
                <p className="text-[10px] text-muted-foreground font-medium mt-1">{s.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Weekly Appointments */}
        <Card className="lg:col-span-2 border-none shadow-xl bg-card rounded-3xl overflow-hidden">
          <CardHeader className="pb-2 px-8 pt-8">
            <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" /> Weekly Activity
            </CardTitle>
            <CardDescription className="text-xs font-medium">Queue volume and completed consultations (last 7 days)</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {loading ? (
              <Skeleton className="h-56 w-full rounded-2xl" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={weeklyData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="colorQueued" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, border: "none", borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,.1)" }} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                  <Area type="monotone" dataKey="queued" name="Queued" stroke="#06b6d4" strokeWidth={2} fill="url(#colorQueued)" dot={{ r: 3 }} />
                  <Area type="monotone" dataKey="completed" name="Completed" stroke="#10b981" strokeWidth={2} fill="url(#colorCompleted)" dot={{ r: 3 }} />
                  <Area type="monotone" dataKey="reports" name="Reports Filed" stroke="#8b5cf6" strokeWidth={2} fillOpacity={0} dot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Queue Status Distribution */}
        <Card className="border-none shadow-xl bg-card rounded-3xl overflow-hidden">
          <CardHeader className="pb-2 px-8 pt-8">
            <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
              <Activity size={18} className="text-primary" /> Queue Status
            </CardTitle>
            <CardDescription className="text-xs font-medium">Distribution of all-time queue entries</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {loading ? (
              <Skeleton className="h-56 w-full rounded-2xl" />
            ) : statusData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm font-medium">No queue data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {statusData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, border: "none", borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,.1)" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Hourly Distribution */}
        <Card className="border-none shadow-xl bg-card rounded-3xl overflow-hidden">
          <CardHeader className="pb-2 px-8 pt-8">
            <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
              <Clock size={18} className="text-amber-500" /> Hourly Patient Flow
            </CardTitle>
            <CardDescription className="text-xs font-medium">Real queue arrivals by hour of day</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {loading ? (
              <Skeleton className="h-48 w-full rounded-2xl" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={hourlyData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, border: "none", borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,.1)" }} />
                  <Bar dataKey="patients" name="Patients" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Doctor Performance */}
        <Card className="border-none shadow-xl bg-card rounded-3xl overflow-hidden">
          <CardHeader className="pb-2 px-8 pt-8">
            <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
              <Stethoscope size={18} className="text-pink-500" /> Doctor Performance
            </CardTitle>
            <CardDescription className="text-xs font-medium">Clinical reports filed per physician</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {loading ? (
              <Skeleton className="h-48 w-full rounded-2xl" />
            ) : doctorData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm font-medium">No doctor data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={doctorData} layout="vertical" margin={{ top: 4, right: 20, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#334155", fontWeight: 700 }} width={120} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, border: "none", borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,.1)" }}
                    formatter={(value: any, name: any) => [`${value} reports`, "Reports Filed"]}
                  />
                  <Bar dataKey="reports" name="Reports" fill="#ec4899" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-100 shadow-sm bg-slate-50">
          <CardContent className="p-5 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">All-Time Queue</p>
            <p className="text-3xl font-black text-slate-800">{loading ? <Skeleton className="h-9 w-16 mx-auto" /> : stats.totalQueueAllTime}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-100 shadow-sm bg-emerald-50/50">
          <CardContent className="p-5 text-center">
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">All-Time Completed</p>
            <p className="text-3xl font-black text-emerald-700">{loading ? <Skeleton className="h-9 w-16 mx-auto" /> : stats.completedAllTime}</p>
          </CardContent>
        </Card>
        <Card className="border-violet-100 shadow-sm bg-violet-50/50">
          <CardContent className="p-5 text-center">
            <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-1">Success Rate</p>
            <p className="text-3xl font-black text-violet-700">
              {loading ? <Skeleton className="h-9 w-16 mx-auto" /> : stats.totalQueueAllTime > 0 ? `${Math.round((stats.completedAllTime / stats.totalQueueAllTime) * 100)}%` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-amber-100 shadow-sm bg-amber-50/50">
          <CardContent className="p-5 text-center">
            <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">Reports / Patient</p>
            <p className="text-3xl font-black text-amber-700">
              {loading ? <Skeleton className="h-9 w-16 mx-auto" /> : stats.completedAllTime > 0 ? (stats.totalReports / stats.completedAllTime).toFixed(1) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="md:hidden h-20" />
    </div>
  );
}

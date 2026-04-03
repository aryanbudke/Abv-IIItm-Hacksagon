"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, ArrowRight, Bell, RefreshCw, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { notificationService } from "@/lib/services/notificationService";
import { toast } from "sonner";

interface QueueEntry {
  id: string;
  tokenNumber: number;
  patientName: string;
  hospitalName: string;
  departmentName: string;
  doctorName: string;
  position: number;
  status: string;
  isEmergency: boolean;
  estimatedWaitTime: number;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export function AdminQueueManager() {
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [callingNext, setCallingNext] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");

  useEffect(() => {
    let isMounted = true;
    let fetchTimeout: NodeJS.Timeout;

    const fetchQueueData = async () => {
      try {
        const { data, error } = await supabase
          .from('queue')
          .select(`
            *,
            hospitals!queue_hospital_id_fkey(name),
            departments!queue_department_id_fkey(name),
            doctors!queue_doctor_id_fkey(name)
          `)
          .in('status', ['waiting', 'in-treatment'])
          .order('position', { ascending: true });

        if (error) throw error;
        if (!isMounted) return;

        const formattedData = (data || []).map(item => ({
          id: item.id,
          tokenNumber: item.token_number,
          patientName: item.patient_name,
          hospitalName: item.hospitals?.name || 'Unknown Hospital',
          departmentName: item.departments?.name || 'Unknown Department',
          doctorName: item.doctors?.name || 'Available Doctor',
          position: item.position || 0,
          status: item.status,
          isEmergency: item.is_emergency || false,
          estimatedWaitTime: item.estimated_wait_time || 0
        }));

        setQueueEntries(formattedData);
      } catch (error) {
        console.error('Error fetching queue data:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const fetchNotifications = async () => {
      const notifs = await notificationService.getNotifications(20);
      if (isMounted) setNotifications(notifs);
    };

    fetchQueueData();
    fetchNotifications();

    // Debounce realtime updates to avoid rendering thrash when multiple updates fire instantly
    const debouncedFetchQueue = () => {
      clearTimeout(fetchTimeout);
      fetchTimeout = setTimeout(fetchQueueData, 500);
    };

    // Set up real-time subscriptions
    const queueSubscription = supabase
      .channel('admin-queue')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'queue' }, 
        debouncedFetchQueue
      )
      .subscribe();

    const notificationSubscription = notificationService.subscribeToNotifications((notification) => {
      if (isMounted) {
        setNotifications(prev => [notification, ...prev].slice(0, 20));
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(fetchTimeout);
      queueSubscription.unsubscribe();
      notificationSubscription.unsubscribe();
    };
  }, []);

  // Performance Optimization: Memoize derived queues to avoid O(N^2) loops inside JSX
  const departments = useMemo(() => {
    return Array.from(new Set(queueEntries.map(q => q.departmentName)));
  }, [queueEntries]);

  const filteredQueue = useMemo(() => {
    return selectedDepartment === "all" 
      ? queueEntries 
      : queueEntries.filter(q => q.departmentName === selectedDepartment);
  }, [queueEntries, selectedDepartment]);

  const waitingPatients = useMemo(() => {
    return filteredQueue.filter(q => q.status === 'waiting');
  }, [filteredQueue]);

  const waitingLength = waitingPatients.length;

  const callNextPatient = useCallback(async () => {
    if (waitingLength === 0) {
      toast.info('No patients waiting in queue');
      return;
    }

    setCallingNext(true);

    try {
      // Priority: Emergency patients first, then by position
      // Create a shallow copy to sort to avoid mutating the memoized array
      const nextPatient = [...waitingPatients].sort((a, b) => {
        if (a.isEmergency && !b.isEmergency) return -1;
        if (!a.isEmergency && b.isEmergency) return 1;
        return a.position - b.position;
      })[0];

      // Update patient status to in-treatment
      const { error } = await supabase
        .from('queue')
        .update({ 
          status: 'in-treatment',
          called_at: new Date().toISOString()
        })
        .eq('id', nextPatient.id);

      if (error) throw error;

      // Update remaining patients' positions
      const patientsToUpdate = waitingPatients.filter(q => q.id !== nextPatient.id);
      for (let i = 0; i < patientsToUpdate.length; i++) {
        await supabase
          .from('queue')
          .update({ position: i + 1 })
          .eq('id', patientsToUpdate[i].id);
      }

      // Send notification
      await notificationService.notifyPatientCalled(
        nextPatient.patientName,
        nextPatient.doctorName,
        nextPatient.tokenNumber
      );
      toast.success(`Calling ${nextPatient.patientName} (Token #${nextPatient.tokenNumber})`);
    } catch (error) {
      console.error('Error calling next patient:', error);
      toast.error('Failed to call next patient. Please try again.');
    } finally {
      setCallingNext(false);
    }
  }, [waitingPatients, waitingLength]);

  const rearrangeQueue = useCallback(async (patientId: string, newPosition: number) => {
    try {
      const patient = waitingPatients.find(q => q.id === patientId);
      if (!patient) return;

      const oldPosition = patient.position;
      
      if (newPosition < oldPosition) {
        for (const p of waitingPatients) {
          if (p.position >= newPosition && p.position < oldPosition && p.id !== patientId) {
            await supabase.from('queue').update({ position: p.position + 1 }).eq('id', p.id);
          }
        }
      } else {
        for (const p of waitingPatients) {
          if (p.position > oldPosition && p.position <= newPosition && p.id !== patientId) {
            await supabase.from('queue').update({ position: p.position - 1 }).eq('id', p.id);
          }
        }
      }

      await supabase.from('queue').update({ position: newPosition }).eq('id', patientId);
    } catch (error) {
      console.error('Error rearranging queue:', error);
    }
  }, [waitingPatients]);

  const markAllNotificationsRead = useCallback(async () => {
    await notificationService.markAllAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const handleDepartmentChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDepartment(e.target.value);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notifications Panel */}
      {notifications.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5 text-red-600 shrink-0" />
                <span className="truncate">Recent Notifications</span>
                <Badge variant="destructive" className="shrink-0">
                  {notifications.filter(n => !n.read).length}
                </Badge>
              </CardTitle>
              <Button variant="outline" size="sm" onClick={markAllNotificationsRead} className="shrink-0">
                Mark All Read
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
              {notifications.slice(0, 5).map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg text-sm transition-colors ${
                    notification.read ? 'bg-gray-50' : 'bg-blue-50 border border-blue-100'
                  }`}
                >
                  <div className="font-semibold text-slate-800">{notification.title}</div>
                  <div className="text-slate-600 mt-1">{notification.message}</div>
                  <div className="text-xs text-slate-400 mt-2">
                    {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue Management */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <CardTitle className="flex items-center space-x-2 shrink-0">
              <Users className="h-5 w-5 text-blue-600" />
              <span>Queue Management</span>
            </CardTitle>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center w-full md:w-auto gap-3">
              <select
                value={selectedDepartment}
                onChange={handleDepartmentChange}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[150px]"
              >
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <Button
                onClick={callNextPatient}
                disabled={callingNext || waitingLength === 0}
                className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
              >
                {callingNext ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2 shrink-0" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2 shrink-0" />
                )}
                Next Patient
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {waitingPatients
              .map((entry) => (
                <div
                  key={entry.id}
                  className={`p-4 rounded-xl border transition-all ${
                    entry.isEmergency
                      ? 'bg-red-50 border-red-200 hover:border-red-300'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm hover:shadow'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center space-x-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${
                        entry.isEmergency
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'bg-blue-600 text-white shadow-sm'
                      }`}>
                        {entry.position}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">
                          #{entry.tokenNumber} - {entry.patientName}
                        </div>
                        <div className="text-sm text-slate-500 truncate mt-0.5">
                          {entry.doctorName} • {entry.departmentName}
                        </div>
                        {entry.isEmergency && (
                          <Badge variant="destructive" className="mt-2 text-[10px] uppercase font-bold tracking-wider">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Emergency
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Position Selector */}
                    <div className="flex items-center space-x-2 self-end sm:self-auto bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                      <select
                        className="px-2 py-1.5 border-0 bg-transparent text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer"
                        value={entry.position}
                        onChange={(e) => rearrangeQueue(entry.id, parseInt(e.target.value))}
                      >
                        {Array.from({ length: waitingLength }, (_, i) => i + 1).map(pos => (
                          <option key={pos} value={pos}>Pos {pos}</option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => rearrangeQueue(entry.id, 1)}
                        disabled={entry.position === 1}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600"
                        title="Move to front"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

            {waitingLength === 0 && (
              <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                <Users className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                <h3 className="text-sm font-semibold text-slate-700">Queue is empty</h3>
                <p className="text-xs text-slate-500 mt-1">No patients currently waiting for treatment.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


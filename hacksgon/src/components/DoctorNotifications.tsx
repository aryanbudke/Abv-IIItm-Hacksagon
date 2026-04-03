"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, Hospital, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { notificationService } from "@/lib/services/notificationService";

interface DoctorNotificationsProps {
  doctorId?: string; // If provided, show only this doctor's notifications
  showAll?: boolean; // If true, show all appointment notifications
}

export function DoctorNotifications({ doctorId, showAll = false }: DoctorNotificationsProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get appointment notifications
        const notifs = await notificationService.getNotifications(30);
        const appointmentNotifs = notifs.filter(n => n.type === 'appointment');
        
        // If doctorId is provided, filter notifications for this doctor
        const filteredNotifs = doctorId 
          ? appointmentNotifs.filter(n => n.data?.targetDoctorId === doctorId)
          : showAll 
            ? appointmentNotifs 
            : appointmentNotifs.slice(0, 10);

        setNotifications(filteredNotifs);

        // Also fetch recent appointments directly
        const { data: appointmentData } = await supabase
          .from('appointments')
          .select(`
            *,
            hospitals!appointments_hospital_id_fkey(name),
            departments!appointments_department_id_fkey(name),
            doctors!appointments_doctor_id_fkey(name)
          `)
          .order('created_at', { ascending: false })
          .limit(10);

        const filteredAppointments = doctorId
          ? appointmentData?.filter(a => a.doctor_id === doctorId) || []
          : appointmentData || [];

        setAppointments(filteredAppointments);
      } catch (error) {
        console.error('Error fetching doctor notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Subscribe to real-time updates
    const subscription = notificationService.subscribeToNotifications((notification) => {
      if (notification.type === 'appointment') {
        setNotifications(prev => [notification, ...prev].slice(0, 30));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [doctorId, showAll]);

  const markAllAsRead = async () => {
    await notificationService.markAllAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

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
      {/* Notification Panel */}
      {notifications.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center space-x-2 shrink-0">
                <Calendar className="h-5 w-5 text-blue-600" />
                <span className="truncate">Appointment Notifications</span>
                <Badge variant="destructive" className="shrink-0">
                  {notifications.filter(n => !n.read).length}
                </Badge>
              </CardTitle>
              <Button variant="outline" size="sm" onClick={markAllAsRead} className="shrink-0">
                Mark All Read
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg text-sm ${
                    notification.read ? 'bg-gray-50' : 'bg-blue-50 border border-blue-200'
                  }`}
                >
                  <div className="font-medium text-gray-900">{notification.title}</div>
                  <div className="text-gray-600 mt-1">{notification.message}</div>
                  {notification.data && (
                    <div className="mt-2 text-xs text-gray-500">
                      <div>Patient: {notification.data.patientName}</div>
                      <div>Time: {notification.data.date} at {notification.data.time}</div>
                      <div>Hospital: {notification.data.hospitalName}</div>
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-2">
                    {notification.createdAt.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Appointments */}
      {appointments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-green-600" />
              <span>Recent Appointments</span>
            </CardTitle>
            <CardDescription>
              Latest appointment bookings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {appointment.patient_name}
                        </div>
                        <div className="text-sm text-gray-600">
                          with Dr. {appointment.doctors?.name || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(appointment.date).toLocaleDateString()} at {appointment.time_slot}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start space-x-3 sm:space-x-0 sm:space-y-2 mt-2 sm:mt-0 w-full sm:w-auto">
                      <Badge 
                        variant={appointment.status === 'confirmed' ? 'default' : 'secondary'}
                        className="shrink-0"
                      >
                        {appointment.status}
                      </Badge>
                      <div className="text-xs text-gray-500 truncate text-right">
                        {appointment.hospitals?.name || 'Hospital'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {notifications.length === 0 && appointments.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No appointment notifications</p>
            <p className="text-sm text-gray-400 mt-2">
              {doctorId ? "This doctor has no recent appointments" : "No recent appointments"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

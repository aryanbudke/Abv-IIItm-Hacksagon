"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowLeft, Clock, User as UserIcon, X, Hospital, Activity, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import { notificationService } from "@/lib/services/notificationService";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CallToBookButton } from "@/components/CallToBookButton";
import { toast } from "sonner";

/** Formats a date string (YYYY-MM-DD or ISO) into a human-friendly label. */
function formatDate(raw: string): string {
  if (!raw) return "TBD";
  // Handle YYYY-MM-DD by appending time to avoid TZ shifts
  const dStr = raw.includes('T') ? raw : `${raw}T00:00:00`;
  const date = new Date(dStr);
  if (isNaN(date.getTime())) return raw;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function BookAppointmentPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [selectedHospital, setSelectedHospital] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mobile: "",
  });
  const [userMobile, setUserMobile] = useState("");
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [pendingAppointmentData, setPendingAppointmentData] = useState<any>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationData, setConfirmationData] = useState<any>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [userAppointments, setUserAppointments] = useState<any[]>([]);
  const [rescheduleData, setRescheduleData] = useState<any>(null);
  const [cancelData, setCancelData] = useState<any>(null);
  const [waitlistData, setWaitlistData] = useState<any>(null);
  const [showWaitlistConfirm, setShowWaitlistConfirm] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
    if (user) {
      setFormData({
        name: user.fullName || "",
        email: user.primaryEmailAddress?.emailAddress || "",
        mobile: "",
      });
      // Try to fetch mobile from users table
      import('@/lib/supabase/client').then(({ supabase }) => {
        supabase.from('users').select('mobile').eq('id', user.id).single()
          .then(({ data }) => { if (data?.mobile) setUserMobile(data.mobile); });
      });
    }
  }, [isLoaded, isSignedIn, user, router]);

  useEffect(() => {
    fetchHospitals();
    if (user) {
      fetchUserAppointments();
    }
  }, [user]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchHospitals();
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (selectedHospital) {
      fetchDepartments(selectedHospital);
    } else {
      setDepartments([]);
      setDoctors([]);
    }
  }, [selectedHospital]);

  useEffect(() => {
    if (selectedDepartment) {
      fetchDoctors(selectedDepartment);
    } else {
      setDoctors([]);
    }
  }, [selectedDepartment]);

  useEffect(() => {
    if (selectedDoctor && appointmentDate) {
      fetchBookedSlots();
    } else {
      setBookedSlots([]);
    }
  }, [selectedDoctor, appointmentDate]);

  // Fetch user appointments
  const fetchUserAppointments = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, hospitals(name), doctors(name)')
        .eq('patient_id', user.id)
        .in('status', ['pending', 'confirmed'])
        .order('date', { ascending: true })
        .order('time_slot', { ascending: true });

      if (error) {
        console.error('Error fetching appointments:', error);
      } else {
        const mapped = (data || []).map((a: any) => ({
          ...a,
          hospital_name: a.hospitals?.name || a.hospital_name,
          doctor_name: a.doctors?.name || a.doctor_name
        }));
        setUserAppointments(mapped);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  };

  // Reschedule appointment
  const handleReschedule = async (appointment: any) => {
    setRescheduleData(appointment);
    setShowRescheduleModal(true);
  };

  const confirmReschedule = async () => {
    if (!rescheduleData || !user) return;

    try {
      const response = await fetch('/api/appointments/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: rescheduleData.id,
          newDate: rescheduleData.newDate,
          newTimeSlot: rescheduleData.newTimeSlot,
          reason: rescheduleData.reason,
          userId: user.id
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Appointment rescheduled successfully!');
        setShowRescheduleModal(false);
        fetchUserAppointments();
      } else {
        toast.error(result.error || 'Failed to reschedule appointment');
      }
    } catch (error) {
      console.error('Reschedule error:', error);
      toast.error('Failed to reschedule appointment');
    }
  };

  // Cancel appointment
  const handleCancel = async (appointment: any) => {
    setCancelData(appointment);
    setShowCancelModal(true);
  };

  const confirmCancel = async () => {
    if (!cancelData || !user) return;

    try {
      const response = await fetch('/api/appointments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: cancelData.id,
          reason: cancelData.cancellationReason,
          userId: user.id,
          notifyDoctor: true
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Appointment cancelled successfully!');
        setShowCancelModal(false);
        fetchUserAppointments();
      } else {
        toast.error(result.error || 'Failed to cancel appointment');
      }
    } catch (error) {
      console.error('Cancel error:', error);
      toast.error('Failed to cancel appointment');
    }
  };

  // Add to waitlist
  const handleWaitlist = async (doctorId: string, date: string, timeSlot: string) => {
    if (!user) return;

    setWaitlistData({
      doctorId,
      date,
      timeSlot,
      userName: user.fullName,
      userEmail: user.primaryEmailAddress?.emailAddress
    });
    setShowWaitlistModal(true);
  };

  const confirmWaitlist = async () => {
    if (!waitlistData || !user) return;

    try {
      const response = await fetch('/api/appointments/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...waitlistData,
          userId: user.id,
          reason: waitlistData.reason
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(`You are position ${result.data.position} on the waitlist!`);
        setShowWaitlistModal(false);
      } else {
        toast.error(result.error || 'Failed to add to waitlist');
      }
    } catch (error) {
      console.error('Waitlist error:', error);
      toast.error('Failed to add to waitlist');
    }
  };

  const fetchHospitals = async () => {
    try {
      const response = await fetch('/api/hospitals');
      const result = await response.json();
      if (!response.ok) {
        toast.error(`Failed to load hospitals: ${result.error || 'Unknown error'}`);
        return;
      }
      setHospitals(result.data || []);
    } catch (error) {
      console.error('Error fetching hospitals:', error);
      toast.error('Failed to load hospitals. Please refresh the page.');
    }
  };

  const fetchDepartments = async (hospitalId: string) => {
    try {
      // Fix: API uses hospital_id param
      const response = await fetch(`/api/departments?hospital_id=${hospitalId}`);
      const result = await response.json();
      if (!response.ok) {
        toast.error(`Failed to load departments: ${result.error || 'Unknown error'}`);
        setDepartments([]);
        return;
      }
      // departments API returns array directly
      const depts = Array.isArray(result) ? result : (result.data || []);
      setDepartments(depts);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to load departments.');
      setDepartments([]);
    }
  };

  const fetchDoctors = async (departmentId: string) => {
    try {
      const response = await fetch(`/api/doctors?departmentId=${departmentId}`);
      const result = await response.json();
      if (!response.ok) {
        toast.error(`Failed to load doctors: ${result.error || 'Unknown error'}`);
        setDoctors([]);
        return;
      }
      setDoctors(result.data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      toast.error('Failed to load doctors.');
      setDoctors([]);
    }
  };

  const fetchBookedSlots = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('time_slot')
        .eq('doctor_id', selectedDoctor)
        .eq('date', appointmentDate)
        .neq('status', 'cancelled');
      
      if (error) throw error;
      
      const slots = data?.map(appointment => appointment.time_slot) || [];
      setBookedSlots(slots);
    } catch (error) {
      console.error('Error fetching booked slots:', error);
      setBookedSlots([]);
    }
  };

  const sendOTP = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          purpose: 'appointment'
        })
      });

      const data = await response.json();

      if (response.ok) {
        setOtpSent(true);
        toast.success('OTP sent to your email. Please check your inbox.');
      } else {
        toast.error(data.error || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      toast.error('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          otp: otp,
          purpose: 'appointment'
        })
      });

      const data = await response.json();

      if (response.ok) {
        setOtpVerified(true);
        toast.success('OTP verified successfully! Booking your appointment...');
        await completeAppointmentBooking();
      } else {
        toast.error(data.error || 'Invalid OTP. Please try again.');
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      toast.error('Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    // Validate that the selected time slot is not already booked
    if (bookedSlots.includes(timeSlot)) {
      setShowWaitlistConfirm(true);
      return;
    }

    // Store appointment data for later use after OTP verification
    setPendingAppointmentData({
      selectedHospital,
      selectedDepartment,
      selectedDoctor,
      appointmentDate,
      timeSlot,
      formData
    });

    // Show OTP modal
    setShowOTPModal(true);
    
    // Automatically send OTP
    await sendOTP();
  };

  const completeAppointmentBooking = async () => {
    if (!user || !pendingAppointmentData) return;
    
    setLoading(true);
    try {
      // First, ensure user exists in the database using server-side API
      const userResponse = await fetch('/api/ensure-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: formData.name,
          email: formData.email,
          mobile: formData.mobile
        })
      });

      if (!userResponse.ok) {
        const errorData = await userResponse.json();
        throw new Error(errorData.error || 'Failed to create user');
      }
      
      // Get hospital, department, and doctor details for notifications
      const [hospitalData, departmentData, doctorData] = await Promise.all([
        supabase.from('hospitals').select('name').eq('id', selectedHospital).single(),
        supabase.from('departments').select('name').eq('id', selectedDepartment).single(),
        supabase.from('doctors').select('name').eq('id', selectedDoctor).single()
      ]);

      const { data, error } = await supabase
        .from('appointments')
        .insert({
          patient_id: user.id,
          patient_name: formData.name,
          hospital_id: selectedHospital,
          department_id: selectedDepartment,
          doctor_id: selectedDoctor,
          date: appointmentDate,  // store as YYYY-MM-DD string, no UTC conversion
          time_slot: timeSlot,
          status: 'pending',
          otp_verified: false
        })
        .select()
        .single();
      
      if (error) throw error;

      // Send notification to admin about new appointment
      await notificationService.createNotification(
        'appointment',
        '📅 New Appointment Booked',
        `${formData.name} has booked an appointment with Dr. ${doctorData.data?.name || 'Unknown'} at ${hospitalData.data?.name || 'Hospital'} on ${appointmentDate} at ${timeSlot}`,
        {
          appointmentId: data.id,
          patientName: formData.name,
          doctorName: doctorData.data?.name,
          hospitalName: hospitalData.data?.name,
          departmentName: departmentData.data?.name,
          date: appointmentDate,
          time: timeSlot
        }
      );

      // Send notification to the specific doctor
      if (doctorData.data?.name) {
        await notificationService.createNotification(
          'appointment',
          `📅 New Appointment - ${appointmentDate}`,
          `You have a new appointment with ${formData.name} on ${appointmentDate} at ${timeSlot} at ${hospitalData.data?.name || 'Hospital'}`,
          {
            appointmentId: data.id,
            patientName: formData.name,
            doctorName: doctorData.data.name,
            hospitalName: hospitalData.data?.name,
            departmentName: departmentData.data?.name,
            date: appointmentDate,
            time: timeSlot,
            targetDoctorId: selectedDoctor
          }
        );
      }
      
      // Set confirmation data and show popup
      setConfirmationData({
        appointmentId: data.id,
        patientName: formData.name,
        doctorName: doctorData.data?.name || 'Unknown',
        hospitalName: hospitalData.data?.name || 'Hospital',
        departmentName: departmentData.data?.name || 'Department',
        date: appointmentDate,
        time: timeSlot,
        status: 'confirmed'
      });
      setShowConfirmation(true);
      
      // Reset form
      setSelectedHospital("");
      setSelectedDepartment("");
      setSelectedDoctor("");
      setAppointmentDate("");
      setTimeSlot("");
      setBookedSlots([]);
    } catch (error: any) {
      console.error('Error booking appointment:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
      toast.error(`Failed to book appointment. Error: ${error?.message || 'Unknown error'}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-white to-[#EFF6FF] relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], x: [0, 50, 0], y: [0, 30, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] -left-[10%] w-[80%] sm:w-[50%] h-[50%] bg-blue-600 rounded-full mix-blend-multiply filter blur-[80px] sm:blur-[100px] opacity-[0.07]"
        />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], x: [0, -50, 0], y: [0, -30, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[30%] -right-[10%] w-[70%] sm:w-[40%] h-[60%] bg-primary rounded-full mix-blend-multiply filter blur-[100px] sm:blur-[120px] opacity-[0.07]"
        />
      </div>

      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="p-1.5 sm:p-2 bg-gray-50 rounded-full group-hover:bg-blue-50 transition-colors">
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-slate-500 group-hover:text-blue-600" />
              </div>
              <span className="text-sm sm:text-base text-slate-600 font-semibold group-hover:text-slate-900 hidden xs:block">Back</span>
            </Link>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight text-center">
              Book Appointment
            </h1>
            <div className="w-10 sm:w-24"></div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-12">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="border-0 shadow-2xl shadow-blue-900/10 rounded-3xl overflow-hidden bg-white/95">
            <CardHeader className="bg-gradient-to-b from-gray-50/50 to-white p-6 sm:p-8 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 flex items-center justify-center rounded-2xl text-blue-600 shrink-0 shadow-sm border border-blue-200/50">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">Schedule Your Visit</CardTitle>
                  <CardDescription className="text-sm sm:text-base text-slate-500 mt-1">Book an appointment based on real-time doctor availability</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-8">
            {/* Existing Appointments Section */}
              {userAppointments.length > 0 && (
                <div className="mb-10">
                  <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 mb-4 px-1">Your Upcoming Appointments</h3>
                  <div className="grid gap-3 sm:gap-4">
                    {userAppointments.map((appointment) => (
                      <div key={appointment.id} className="bg-card border-[1.5px] border-gray-100 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 border border-gray-100">
                               <Clock className="h-5 w-5 text-slate-400" />
                             </div>
                             <div>
                                <div className="font-black text-slate-900 text-[14px] sm:text-[16px]">
                                  {formatDate(appointment.date)} at {appointment.time_slot}
                                </div>
                               <div className="text-[13px] font-bold text-slate-500 mt-0.5">
                                 Dr. {appointment.doctor_name || 'Assigned Specialist'} · {appointment.hospital_name || 'Hospital'}
                               </div>
                             </div>
                          </div>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-50">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-3 py-1 text-[10px] sm:text-[11px] font-black uppercase tracking-widest rounded-full border shrink-0 ${
                                appointment.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                appointment.status === 'pending' ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                                appointment.status === 'rescheduled' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}>{appointment.status}</span>
                              {appointment.booked_via_call && (
                                <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border bg-teal-50 text-teal-700 border-teal-200 flex items-center gap-1 animate-pulse">
                                  📞 Call Scheduled
                                </span>
                              )}
                              <div className="sm:hidden text-[11px] font-bold text-slate-400">Manage Visit</div>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:flex gap-2 w-full">
                              <Button
                                onClick={() => handleReschedule(appointment)}
                                variant="outline"
                                size="sm"
                                className="h-11 sm:h-9 px-4 text-blue-600 border-blue-100 bg-blue-50 font-black text-[11px] sm:text-[12px] uppercase tracking-wider rounded-xl hover:bg-blue-100 transition-all shadow-none flex-1"
                              >
                                Reschedule
                              </Button>
                              <Button
                                onClick={() => handleCancel(appointment)}
                                variant="outline"
                                size="sm"
                                className="h-11 sm:h-9 px-4 text-red-600 border-red-100 bg-red-50 font-black text-[11px] sm:text-[12px] uppercase tracking-wider rounded-xl hover:bg-red-100 transition-all shadow-none flex-1"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8 mt-4">
              <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
                    <Hospital size={14} className="text-blue-600"/> Select Hospital
                  </label>
                  <div className="relative">
                    <select
                      value={selectedHospital}
                      onChange={(e) => {
                        setSelectedHospital(e.target.value);
                        setSelectedDepartment('');
                        setSelectedDoctor('');
                      }}
                      required
                      className="w-full h-12 sm:h-auto px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all appearance-none cursor-pointer pr-10"
                    >
                      <option value="">Choose a hospital...</option>
                      {hospitals.length === 0 ? (
                        <option value="" disabled>Loading hospitals...</option>
                      ) : (
                        hospitals.map((hospital) => (
                          <option key={hospital.id} value={hospital.id}>
                            {hospital.name}
                          </option>
                        ))
                      )}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
                    <Activity size={14} className="text-blue-600"/> Select Department
                  </label>
                  <div className="relative">
                    <select
                      value={selectedDepartment}
                      onChange={(e) => {
                        setSelectedDepartment(e.target.value);
                        setSelectedDoctor('');
                      }}
                      required
                      disabled={!selectedHospital}
                      className="w-full h-12 sm:h-auto px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed pr-10"
                    >
                      <option value="">Choose a department...</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
                  <UserIcon size={14} className="text-blue-600"/> Select Doctor
                </label>
                <div className="relative">
                  <select
                    value={selectedDoctor}
                    onChange={(e) => setSelectedDoctor(e.target.value)}
                    required
                    disabled={!selectedDepartment}
                    className="w-full h-12 sm:h-auto px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed pr-10"
                  >
                    <option value="">Choose a doctor...</option>
                    {doctors.length > 0 ? (
                      doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.name}
                        </option>
                      ))
                    ) : selectedDepartment ? (
                      <option value="" disabled>No doctors available in this department</option>
                    ) : (
                      <option value="" disabled>Please select a department first</option>
                    )}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
                {selectedDepartment && doctors.length === 0 && (
                  <p className="text-sm text-amber-600 mt-1">
                    No doctors are currently available in this department. Please try another department.
                  </p>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
                    <Calendar size={14} className="text-blue-600"/> Appointment Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={appointmentDate}
                      onChange={(e) => setAppointmentDate(e.target.value)}
                      required
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full h-12 sm:h-auto px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
                    <Clock size={14} className="text-blue-600"/> Time Slot
                  </label>
                  <div className="relative">
                    <select
                      value={timeSlot}
                      onChange={(e) => setTimeSlot(e.target.value)}
                      required
                      className="w-full h-12 sm:h-auto px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all appearance-none cursor-pointer pr-10"
                    >
                      <option value="">Select time...</option>
                      {(() => {
                        const allSlots = [
                          { value: "09:00 AM", label: "09:00 AM", hour: 9 },
                          { value: "10:00 AM", label: "10:00 AM", hour: 10 },
                          { value: "11:00 AM", label: "11:00 AM", hour: 11 },
                          { value: "02:00 PM", label: "02:00 PM", hour: 14 },
                          { value: "03:00 PM", label: "03:00 PM", hour: 15 },
                          { value: "04:00 PM", label: "04:00 PM", hour: 16 },
                          { value: "05:00 PM", label: "05:00 PM", hour: 17 },
                        ];
                        const todayStr = new Date().toISOString().split('T')[0];
                        const nowHour = new Date().getHours();
                        const isToday = appointmentDate === todayStr;
                        return allSlots.map(slot => {
                          const isPast = isToday && slot.hour <= nowHour;
                          const isBooked = bookedSlots.includes(slot.value);
                          return (
                            <option
                              key={slot.value}
                              value={slot.value}
                              disabled={isBooked || isPast}
                            >
                              {slot.label}{isBooked ? ' (Booked)' : isPast ? ' (Past)' : ''}
                            </option>
                          );
                        });
                      })()}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                  {bookedSlots.length > 0 && (
                    <p className="text-[11px] font-bold text-slate-400 ml-1">
                      Note: Some slots are currently unavailable
                    </p>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
                    <UserIcon size={14} className="text-blue-600"/> Patient Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="e.g. John Doe"
                      className="w-full h-12 sm:h-auto px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
                    <Mail size={14} className="text-blue-600"/> Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      placeholder="you@email.com"
                      className="w-full h-12 sm:h-auto px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
                  <Phone size={14} className="text-blue-600"/> Mobile Number
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    required
                    placeholder="+91 10-digit number"
                    className="w-full h-12 sm:h-auto px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
                  />
                </div>
              </div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex gap-3 shadow-sm">
                <div className="p-1.5 bg-emerald-100 rounded-full shrink-0 h-fit">
                   <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black">✓</div>
                </div>
                <p className="text-[13px] text-emerald-800 font-semibold leading-relaxed">
                  <span className="text-emerald-900 font-black uppercase tracking-wider text-[11px] block mb-0.5">Note</span>
                  You will receive an OTP on your email to confirm this physical visit.
                </p>
              </motion.div>

              {/* AI Assistant Highlight Card */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 p-5 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 border border-emerald-100 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex items-center gap-4 text-center sm:text-left">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                    <Phone size={24} />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-black text-slate-900 leading-tight">Smart AI Booking</h4>
                    <p className="text-[13px] text-slate-500 font-bold mt-0.5">Let our medical assistant call you to handle everything.</p>
                  </div>
                </div>
                <CallToBookButton
                  hospitalId={selectedHospital}
                  departmentId={selectedDepartment}
                  doctorId={selectedDoctor}
                  userMobile={userMobile || formData.mobile}
                  className="w-full sm:w-auto"
                />
              </motion.div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-6">
                <Link href="/" className="sm:w-1/3">
                  <Button type="button" variant="outline" className="w-full h-12 sm:h-14 text-[13px] font-black uppercase tracking-widest rounded-2xl border-slate-200 text-slate-500 hover:bg-slate-50 transition-all shadow-none">
                    Cancel
                  </Button>
                </Link>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1 h-12 sm:h-14 text-[13px] font-black uppercase tracking-widest rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-900/10 hover:bg-slate-800 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300"
                >
                  {loading ? (
                    <div className="flex items-center gap-2 font-black uppercase tracking-widest text-[11px]"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</div>
                  ) : (
                    <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Book Appointment</div>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        </motion.div>
      </main>

      <AnimatePresence>
        {/* OTP Verification Modal */}
        {showOTPModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card rounded-[2rem] p-6 sm:p-10 max-w-md w-full shadow-2xl overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-purple-500" />
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mx-auto mb-4 border border-blue-100 shadow-sm">
                  <Mail className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Verify Your Email</h2>
                <p className="text-[15px] font-bold text-slate-500 leading-relaxed px-2">
                  We've sent a 6-digit code to <span className="text-blue-600 underline decoration-2 underline-offset-4">{formData.email}</span>
                </p>
              </div>

              <div className="mb-8">
                <label className="block text-[12px] font-black uppercase tracking-[0.15em] text-slate-400 mb-3 text-center">
                  6-Digit OTP Code
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="······"
                  maxLength={6}
                  className="w-full px-4 py-5 text-center text-3xl font-black border-2 border-slate-100 bg-slate-50/50 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 tracking-[0.4em] transition-all placeholder:text-slate-200"
                />
                <div className="flex items-center justify-center gap-2 mt-4 text-[13px] font-bold text-slate-400">
                  <Clock size={14} />
                  <span>Valid for 10 minutes</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {!otpSent ? (
                  <Button
                    type="button"
                    onClick={sendOTP}
                    className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-500/20"
                    disabled={loading}
                  >
                    {loading ? 'Sending...' : 'Send OTP'}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={verifyOTP}
                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/20"
                    disabled={loading || otp.length !== 6}
                  >
                    {loading ? 'Verifying...' : 'Verify & Book'}
                  </Button>
                )}
                
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowOTPModal(false);
                    setOtp('');
                    setOtpSent(false);
                  }}
                  className="w-full h-12 text-slate-400 font-bold hover:text-slate-600 hover:bg-slate-50 rounded-xl"
                  disabled={loading}
                >
                  Go Back
                </Button>
              </div>

              {otpSent && (
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={sendOTP}
                    className="text-[13px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-wider underline underline-offset-4"
                    disabled={loading}
                  >
                    Resend Code
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* Appointment Confirmation Popup */}
        {showConfirmation && confirmationData && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-card rounded-[2.5rem] p-6 sm:p-10 max-w-md w-full shadow-2xl relative overflow-hidden my-auto"
            >
              <div className="absolute top-0 right-0 p-4">
                <button
                  onClick={() => {
                    setShowConfirmation(false);
                    router.push('/dashboard');
                  }}
                  className="p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="text-center mb-8">
                <div className="w-24 h-24 bg-emerald-50 rounded-[2rem] flex items-center justify-center text-emerald-500 mx-auto mb-4 border border-emerald-100 shadow-sm relative">
                   <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs font-black ring-4 ring-white">✓</div>
                   <Calendar className="h-10 w-10" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-1 leading-tight">Booking Confirmed!</h2>
                <p className="text-[14px] font-bold text-emerald-600 uppercase tracking-widest">See you soon at the hospital</p>
              </div>

              <div className="space-y-4 bg-slate-50/80 rounded-3xl p-5 mb-8 border border-slate-100/50">
                <div className="grid gap-4">
                  {[
                    { label: 'Patient', value: confirmationData.patientName },
                    { label: 'Doctor', value: `Dr. ${confirmationData.doctorName}` },
                    { label: 'Hospital', value: confirmationData.hospitalName },
                    { label: 'Date', value: formatDate(confirmationData.date) },
                    { label: 'Time', value: confirmationData.time, isPrimary: true },
                  ].map((row, idx) => (
                    <div key={idx} className="flex justify-between items-start gap-4">
                      <span className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400 mt-1 shrink-0">{row.label}</span>
                      <span className={`text-[14px] font-black text-right break-words max-w-[70%] ${row.isPrimary ? 'text-blue-600' : 'text-slate-700'}`}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={() => {
                  setShowConfirmation(false);
                  router.push('/dashboard');
                }}
                className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-slate-900/10 active:scale-[0.98] transition-all"
              >
                Go to Dashboard
              </Button>
            </motion.div>
          </div>
        )}

        {/* Reschedule Modal */}
        {showRescheduleModal && rescheduleData && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card rounded-[2rem] p-6 sm:p-10 max-w-md w-full shadow-2xl relative overflow-hidden my-auto"
            >
              <div className="text-center mb-6">
                 <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mx-auto mb-4 border border-blue-100 shadow-sm">
                   <Calendar className="h-8 w-8" />
                 </div>
                 <h2 className="text-2xl font-black text-slate-900">Reschedule</h2>
                 <p className="text-[13px] font-bold text-slate-500 mt-1 uppercase tracking-widest">Update your visit time</p>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-50/80 border border-slate-100/50 rounded-2xl p-4">
                  <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Appointment</div>
                  <div className="text-[15px] font-black text-slate-700">
                    {formatDate(rescheduleData.date)} at {rescheduleData.time_slot}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.1em] ml-1">New Date</label>
                    <input
                      type="date"
                      value={rescheduleData.newDate || ''}
                      onChange={(e) => setRescheduleData({...rescheduleData, newDate: e.target.value})}
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.1em] ml-1">New Time</label>
                    <select
                      value={rescheduleData.newTimeSlot || ''}
                      onChange={(e) => setRescheduleData({...rescheduleData, newTimeSlot: e.target.value})}
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select new time...</option>
                      {["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"].map(slot => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <Button
                    onClick={confirmReschedule}
                    className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-500/10"
                  >
                    Confirm Changes
                  </Button>
                  <Button
                    onClick={() => setShowRescheduleModal(false)}
                    variant="ghost"
                    className="w-full h-12 text-slate-400 font-bold hover:text-slate-600 hover:bg-slate-50 rounded-xl"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Cancel Modal */}
        {showCancelModal && cancelData && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card rounded-[2rem] p-6 sm:p-10 max-w-md w-full shadow-2xl relative overflow-hidden my-auto"
            >
              <div className="text-center mb-6">
                 <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-4 border border-red-100 shadow-sm">
                   <X className="h-8 w-8" />
                 </div>
                 <h2 className="text-2xl font-black text-slate-900">Cancel Visit</h2>
                 <p className="text-[13px] font-bold text-slate-500 mt-1 uppercase tracking-widest">Are you absolutely sure?</p>
              </div>

              <div className="space-y-6">
                <div className="bg-red-50/50 border border-red-100/30 rounded-2xl p-4">
                  <div className="text-[11px] font-black text-red-400 uppercase tracking-widest mb-1">Appointment Details</div>
                  <div className="text-[15px] font-black text-red-700">
                    {new Date(cancelData.date).toLocaleDateString()} at {cancelData.time_slot}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.1em] ml-1">Reason for Cancellation</label>
                  <textarea
                    value={cancelData.cancellationReason || ''}
                    onChange={(e) => setCancelData({...cancelData, cancellationReason: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold focus:ring-4 focus:ring-red-100 focus:border-red-500 transition-all min-h-[100px]"
                    placeholder="Tell us why you are cancelling..."
                  />
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <Button
                    onClick={confirmCancel}
                    className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-red-500/10"
                  >
                    Confirm Cancellation
                  </Button>
                  <Button
                    onClick={() => setShowCancelModal(false)}
                    variant="ghost"
                    className="w-full h-12 text-slate-400 font-bold hover:text-slate-600 hover:bg-slate-50 rounded-xl"
                  >
                    Keep Appointment
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Waitlist Modal */}
        {showWaitlistModal && waitlistData && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card rounded-[2rem] p-6 sm:p-10 max-w-md w-full shadow-2xl relative overflow-hidden my-auto"
            >
              <div className="text-center mb-6">
                 <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 mx-auto mb-4 border border-orange-100 shadow-sm">
                   <Clock className="h-8 w-8" />
                 </div>
                 <h2 className="text-2xl font-black text-slate-900">Join Waitlist</h2>
                 <p className="text-[13px] font-bold text-slate-500 mt-1 uppercase tracking-widest">Get notified of openings</p>
              </div>

              <div className="space-y-6">
                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
                  <div className="text-[11px] font-black text-orange-400 uppercase tracking-widest mb-1">Requested Slot</div>
                  <div className="text-[15px] font-black text-orange-700">
                    {new Date(waitlistData.date).toLocaleDateString()} at {waitlistData.timeSlot}
                  </div>
                </div>

                <div className="bg-blue-50/80 rounded-2xl p-4 border border-blue-100/50">
                  <h4 className="text-[12px] font-black text-blue-900 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" /> How it works
                  </h4>
                  <ul className="grid gap-1.5 text-[12px] font-bold text-blue-700">
                    <li className="flex gap-2"><span>•</span> You'll be notified if a slot opens up</li>
                    <li className="flex gap-2"><span>•</span> 2-hour window to confirm once notified</li>
                    <li className="flex gap-2"><span>•</span> Waitlist entries expire in 24 hours</li>
                  </ul>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <Button
                    onClick={confirmWaitlist}
                    className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-orange-500/10"
                  >
                    Join Waitlist
                  </Button>
                  <Button
                    onClick={() => setShowWaitlistModal(false)}
                    variant="ghost"
                    className="w-full h-12 text-slate-400 font-bold hover:text-slate-600 hover:bg-slate-50 rounded-xl"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={showWaitlistConfirm}
        title="Time Slot Fully Booked"
        description="This time slot is already booked. Would you like to join the waitlist?"
        onClose={() => setShowWaitlistConfirm(false)}
        onConfirm={() => handleWaitlist(selectedDoctor, appointmentDate, timeSlot)}
        confirmText="Join Waitlist"
        confirmVariant="default"
      />
    </div>
  );
}

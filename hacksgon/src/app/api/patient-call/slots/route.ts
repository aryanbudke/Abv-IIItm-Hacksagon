import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';

// GET /api/patient-call/slots?doctorId=...&date=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get('doctorId');
  const date = searchParams.get('date');

  const allSlots = [
    { value: '09:00 AM', label: '9:00 AM', hour: 9 },
    { value: '10:00 AM', label: '10:00 AM', hour: 10 },
    { value: '11:00 AM', label: '11:00 AM', hour: 11 },
    { value: '02:00 PM', label: '2:00 PM', hour: 14 },
    { value: '03:00 PM', label: '3:00 PM', hour: 15 },
    { value: '04:00 PM', label: '4:00 PM', hour: 16 },
    { value: '05:00 PM', label: '5:00 PM', hour: 17 },
  ];

  if (!doctorId || !date) {
    return NextResponse.json({ slots: allSlots.map(s => ({ ...s, available: true })) });
  }

  try {
    const supabase = createServerClient();

    // Fetch already-booked slots for this doctor/date
    const { data: booked } = await supabase
      .from('appointments')
      .select('time_slot')
      .eq('doctor_id', doctorId)
      .eq('date', date)
      .neq('status', 'cancelled');

    const bookedSet = new Set((booked || []).map((a: any) => a.time_slot));

    // Filter past times if selecting today
    const todayStr = new Date().toISOString().split('T')[0];
    const nowHour = new Date().getHours();
    const isToday = date === todayStr;

    const slots = allSlots.map(slot => ({
      ...slot,
      available: !bookedSet.has(slot.value) && !(isToday && slot.hour <= nowHour),
      booked: bookedSet.has(slot.value),
      past: isToday && slot.hour <= nowHour,
    }));

    return NextResponse.json({ slots, date, doctorId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

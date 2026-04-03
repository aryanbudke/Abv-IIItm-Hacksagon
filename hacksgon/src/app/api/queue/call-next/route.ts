import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { counterId } = await request.json();

    if (!counterId) {
      return NextResponse.json(
        { error: 'Counter ID is required' },
        { status: 400 }
      );
    }

    // Get next customer in queue
    const { data: queueData, error: queueError } = await supabase
      .from('queue')
      .select('*')
      .eq('status', 'waiting')
      .order('position', { ascending: true })
      .limit(1);

    if (queueError) {
      console.error('Queue fetch error:', queueError);
      return NextResponse.json({ error: queueError.message }, { status: 500 });
    }

    if (!queueData || queueData.length === 0) {
      return NextResponse.json(
        { error: 'No customers in queue' },
        { status: 404 }
      );
    }

    const nextCustomer = queueData[0];

    // Update customer status to in-treatment
    const { data: updatedCustomer, error: updateError } = await supabase
      .from('queue')
      .update({
        status: 'in-treatment',
        service_start_time: new Date().toISOString(),
        counter_id: counterId
      })
      .eq('id', nextCustomer.id)
      .select()
      .single();

    if (updateError) {
      console.error('Customer update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Update counter status
    await supabase
      .from('counters')
      .update({
        status: 'busy',
        current_customer_id: nextCustomer.patient_id,
        last_service_time: new Date().toISOString()
      })
      .eq('id', counterId);

    // Send notification to customer
    await supabase
      .from('notifications')
      .insert({
        type: 'queue',
        title: 'Your Turn!',
        message: `Please proceed to ${nextCustomer.counter_name || 'counter'} ${counterId}`,
        user_id: nextCustomer.patient_id,
        customer_id: nextCustomer.patient_id,
        read: false,
        created_at: new Date().toISOString(),
        metadata: {
          counterId,
          customerName: nextCustomer.customer_name,
          action: 'call_next'
        }
      });

    // Update queue positions for remaining customers
    const { data: remainingQueue } = await supabase
      .from('queue')
      .select('*')
      .eq('status', 'waiting')
      .order('position', { ascending: true });

    if (remainingQueue) {
      for (let i = 0; i < remainingQueue.length; i++) {
        await supabase
          .from('queue')
          .update({
            position: i + 1,
            estimated_wait_time: (i + 1) * 5 // 5 min average service time
          })
          .eq('id', remainingQueue[i].id);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        customer: updatedCustomer,
        counterId,
        queueLength: remainingQueue ? remainingQueue.length : 0
      }
    });

  } catch (error: any) {
    console.error('Call next error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

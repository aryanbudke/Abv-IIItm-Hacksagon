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

    // Get current customer being served at this counter
    const { data: counterData, error: counterError } = await supabase
      .from('counters')
      .select('*')
      .eq('id', counterId)
      .single();

    if (counterError) {
      console.error('Counter fetch error:', counterError);
      return NextResponse.json({ error: counterError.message }, { status: 500 });
    }

    if (!counterData || !counterData.current_customer_id) {
      return NextResponse.json(
        { error: 'No customer currently being served at this counter' },
        { status: 404 }
      );
    }

    const currentCustomerId = counterData.current_customer_id;

    // Remove current customer from queue or mark as skipped
    const { data: updatedCustomer, error: updateError } = await supabase
      .from('queue')
      .update({
        status: 'skipped',
        skip_reason: 'Staff action',
        skip_time: new Date().toISOString()
      })
      .eq('patient_id', currentCustomerId)
      .select()
      .single();

    if (updateError) {
      console.error('Customer skip error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Update counter status to open
    await supabase
      .from('counters')
      .update({
        status: 'open',
        current_customer_id: null,
        last_service_time: new Date().toISOString()
      })
      .eq('id', counterId);

    // Get next customer in queue
    const { data: nextQueueData } = await supabase
      .from('queue')
      .select('*')
      .eq('status', 'waiting')
      .order('position', { ascending: true })
      .limit(1);

    if (nextQueueData && nextQueueData.length > 0) {
      const nextCustomer = nextQueueData[0];

      // Update next customer to in-treatment
      await supabase
        .from('queue')
        .update({
          status: 'in-treatment',
          service_start_time: new Date().toISOString(),
          counter_id: counterId
        })
        .eq('id', nextCustomer.id);

      // Update counter with new customer
      await supabase
        .from('counters')
        .update({
          status: 'busy',
          current_customer_id: nextCustomer.patient_id
        })
        .eq('id', counterId);

      // Send notification to next customer
      await supabase
        .from('notifications')
        .insert({
          type: 'queue',
          title: 'Your Turn!',
          message: `Please proceed to ${counterData.name}`,
          user_id: nextCustomer.patient_id,
          customer_id: nextCustomer.patient_id,
          read: false,
          created_at: new Date().toISOString(),
          metadata: {
            counterId,
            customerName: nextCustomer.customer_name,
            action: 'skip_next'
          }
        });
    }

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
            estimated_wait_time: (i + 1) * 5
          })
          .eq('id', remainingQueue[i].id);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        skippedCustomer: updatedCustomer,
        nextCustomer: nextQueueData?.[0] || null,
        counterId,
        queueLength: remainingQueue ? remainingQueue.length : 0
      }
    });

  } catch (error: any) {
    console.error('Skip customer error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { fromCounterId, toCounterId } = await request.json();

    if (!fromCounterId || !toCounterId) {
      return NextResponse.json(
        { error: 'From counter ID and to counter ID are required' },
        { status: 400 }
      );
    }

    if (fromCounterId === toCounterId) {
      return NextResponse.json(
        { error: 'Cannot transfer to same counter' },
        { status: 400 }
      );
    }

    // Get from counter and current customer
    const { data: fromCounterData, error: fromError } = await supabase
      .from('counters')
      .select('*')
      .eq('id', fromCounterId)
      .single();

    if (fromError) {
      console.error('From counter fetch error:', fromError);
      return NextResponse.json({ error: fromError.message }, { status: 500 });
    }

    if (!fromCounterData || !fromCounterData.current_customer_id) {
      return NextResponse.json(
        { error: 'No customer currently being served at source counter' },
        { status: 404 }
      );
    }

    // Get to counter
    const { data: toCounterData, error: toError } = await supabase
      .from('counters')
      .select('*')
      .eq('id', toCounterId)
      .single();

    if (toError) {
      console.error('To counter fetch error:', toError);
      return NextResponse.json({ error: toError.message }, { status: 500 });
    }

    if (!toCounterData || toCounterData.status !== 'open') {
      return NextResponse.json(
        { error: 'Target counter is not available' },
        { status: 400 }
      );
    }

    const currentCustomerId = fromCounterData.current_customer_id;

    // Update customer with new counter
    const { data: updatedCustomer, error: updateError } = await supabase
      .from('queue')
      .update({
        counter_id: toCounterId,
        transfer_time: new Date().toISOString(),
        transfer_from_counter: fromCounterId
      })
      .eq('patient_id', currentCustomerId)
      .select()
      .single();

    if (updateError) {
      console.error('Customer transfer error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Update from counter to open
    await supabase
      .from('counters')
      .update({
        status: 'open',
        current_customer_id: null,
        last_service_time: new Date().toISOString()
      })
      .eq('id', fromCounterId);

    // Update to counter to busy
    await supabase
      .from('counters')
      .update({
        status: 'busy',
        current_customer_id: currentCustomerId,
        last_service_time: new Date().toISOString()
      })
      .eq('id', toCounterId);

    // Send notification to customer
    await supabase
      .from('notifications')
      .insert({
        type: 'queue',
        title: 'Counter Transfer',
        message: `Please move to ${toCounterData.name}`,
        user_id: currentCustomerId,
        customer_id: currentCustomerId,
        read: false,
        created_at: new Date().toISOString(),
        metadata: {
          fromCounterId,
          toCounterId,
          action: 'transfer'
        }
      });

    // Send notification to staff
    await supabase
      .from('notifications')
      .insert({
        type: 'staff',
        title: 'Customer Transferred',
        message: `Customer transferred from ${fromCounterData.name || 'counter'} to ${toCounterData.name || 'counter'}`,
        created_at: new Date().toISOString(),
        metadata: {
          fromCounterId,
          toCounterId,
          customerId: currentCustomerId,
          action: 'transfer'
        }
      });

    return NextResponse.json({
      success: true,
      data: {
        transferredCustomer: updatedCustomer,
        fromCounter: fromCounterData,
        toCounter: toCounterData
      }
    });

  } catch (error: any) {
    console.error('Transfer customer error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

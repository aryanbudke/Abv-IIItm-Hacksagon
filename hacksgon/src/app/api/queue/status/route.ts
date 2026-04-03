import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { SmartQueueManager } from '@/lib/queueLogic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('locationId') || 'default';

    // Get current queue
    const { data: queueData, error: queueError } = await supabase
      .from('queue')
      .select('*')
      .eq('location_id', locationId)
      .eq('status', 'waiting')
      .order('position', { ascending: true });

    if (queueError) {
      console.error('Queue status error:', queueError);
      return NextResponse.json({ error: queueError.message }, { status: 500 });
    }

    // Get counters
    const { data: countersData, error: counterError } = await supabase
      .from('counters')
      .select('*')
      .eq('location_id', locationId);

    if (counterError) {
      console.error('Counters error:', counterError);
      return NextResponse.json({ error: counterError.message }, { status: 500 });
    }

    // Get queue configuration
    const { data: config } = await supabase
      .from('queue_config')
      .select('*')
      .eq('location_id', locationId)
      .single();

    const queueConfig = config || {
      priorityWeights: {
        emergency: 100,
        vip: 80,
        elderly: 60,
        regular: 40
      },
      averageServiceTime: 5,
      maxQueueLength: 50,
      overflowThreshold: 15
    };

    // Initialize queue manager
    const queueManager = new SmartQueueManager(queueConfig);
    
    // Convert database records to queue customer format
    const queueCustomers = queueData?.map(item => ({
      id: item.customer_id,
      name: item.customer_name,
      priority: item.priority,
      arrivalTime: new Date(item.arrival_time),
      estimatedWaitTime: item.estimated_wait_time,
      serviceType: item.service_type,
      locationId: item.location_id,
      counterId: item.counter_id,
      isRemote: item.is_remote
    })) || [];

    // Convert counters
    const counters = countersData?.map(item => ({
      id: item.id,
      name: item.name,
      status: item.status,
      currentCustomerId: item.current_customer_id,
      queueLength: queueCustomers.filter(c => c.counterId === item.id).length,
      averageServiceTime: item.average_service_time,
      locationId: item.location_id,
      staffId: item.staff_id
    })) || [];

    // Update queue manager with current state
    queueManager.updateCounters(counters);

    // Get queue state with metrics
    const queueState = queueManager.getQueueState();

    return NextResponse.json({
      success: true,
      data: {
        queue: queueCustomers,
        counters,
        metrics: queueState.metrics,
        recommendations: queueState.recommendations,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Queue status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

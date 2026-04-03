import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { SmartQueueManager, QueueCustomer } from '@/lib/queueLogic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { 
      customerId, 
      name, 
      priority = 'regular',
      serviceType = 'general',
      locationId = 'default',
      isRemote = false 
    } = await request.json();

    if (!customerId || !name) {
      return NextResponse.json(
        { error: 'Customer ID and name are required' },
        { status: 400 }
      );
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

    // Create customer object
    const customer: QueueCustomer = {
      id: customerId,
      name,
      priority,
      arrivalTime: new Date(),
      estimatedWaitTime: 0,
      serviceType,
      locationId,
      isRemote
    };

    // Get current queue
    const { data: currentQueue } = await supabase
      .from('queue')
      .select('*')
      .eq('location_id', locationId)
      .eq('status', 'waiting')
      .order('position', { ascending: true });

    // Add to database
    const position = currentQueue ? currentQueue.length + 1 : 1;
    
    const { data, error } = await supabase
      .from('queue')
      .insert({
        patient_id: customerId,
        patient_name: name,
        priority,
        service_type: serviceType,
        location_id: locationId,
        position,
        arrival_time: new Date().toISOString(),
        estimated_wait_time: queueManager.calculateWaitTime(position),
        status: 'waiting',
        is_remote: isRemote
      })
      .select()
      .single();

    if (error) {
      console.error('Queue join error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate QR code
    const QRCode = require('qrcode');
    const qrData = JSON.stringify({
      customerId,
      position,
      priority,
      timestamp: new Date().toISOString()
    });
    
    const qrCode = await QRCode.toDataURL(qrData);

    // Send notification
    await supabase
      .from('notifications')
      .insert({
        type: 'queue',
        title: 'Joined Queue',
        message: `You are now position ${position} in the queue`,
        user_id: customerId,
        customer_id: customerId,
        read: false,
        created_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        position,
        estimatedWaitTime: data.estimated_wait_time,
        qrCode,
        priority,
        queueLength: currentQueue ? currentQueue.length + 1 : 1
      }
    });

  } catch (error: any) {
    console.error('Queue join error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

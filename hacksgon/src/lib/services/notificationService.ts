import { supabase } from '@/lib/supabase/client';

export interface Notification {
  id: string;
  type: 'patient_added' | 'patient_called' | 'emergency' | 'queue_updated' | 'appointment';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: Date;
}

class NotificationService {
  async createNotification(type: Notification['type'], title: string, message: string, data?: any) {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          type,
          title,
          message,
          read: false,
          created_at: new Date().toISOString(),
          metadata: data
        });

      if (error) {
        console.error('Error inserting notification:', error);
        throw error;
      }

      // Also create a real-time event for immediate notification
      const { error: eventError } = await supabase
        .from('admin_events')
        .insert({
          type,
          title,
          message,
          created_at: new Date().toISOString()
        });

      if (eventError) {
        console.error('Error inserting admin event:', eventError);
      }

      return true;
    } catch (error) {
      console.error('Error creating notification:', error);
      return false;
    }
  }

  async notifyPatientAdded(patientName: string, hospitalName: string, departmentName: string, tokenNumber: number) {
    return this.createNotification(
      'patient_added',
      'New Patient Added',
      `${patientName} has joined the queue at ${hospitalName} - ${departmentName}`,
      { patientName, hospitalName, departmentName, tokenNumber }
    );
  }

  async notifyPatientCalled(patientName: string, doctorName: string, tokenNumber: number) {
    return this.createNotification(
      'patient_called',
      'Patient Called',
      `${patientName} (Token #${tokenNumber}) has been called by Dr. ${doctorName}`,
      { patientName, doctorName, tokenNumber }
    );
  }

  async notifyEmergency(patientName: string, hospitalName: string) {
    return this.createNotification(
      'emergency',
      'Emergency Case',
      `Emergency case: ${patientName} at ${hospitalName} - Immediate attention required`,
      { patientName, hospitalName }
    );
  }

  async getNotifications(limit: number = 50): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(item => ({
        id: item.id,
        type: item.type,
        title: item.title,
        message: item.message,
        data: item.metadata || item.data, // Map metadata to data for UI
        read: item.read,
        createdAt: new Date(item.created_at)
      }));
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  async markAsRead(notificationId: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  async markAllAsRead() {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }

  // Subscribe to real-time notifications
  subscribeToNotifications(callback: (notification: Notification) => void) {
    return supabase
      .channel('admin-notifications')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications'
        }, 
        (payload) => {
          const notification: Notification = {
            id: payload.new.id,
            type: payload.new.type,
            title: payload.new.title,
            message: payload.new.message,
            data: payload.new.metadata || payload.new.data,
            read: payload.new.read,
            createdAt: new Date(payload.new.created_at)
          };
          callback(notification);
        }
      )
      .subscribe();
  }
}

export const notificationService = new NotificationService();

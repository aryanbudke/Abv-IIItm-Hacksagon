import { supabase } from '@/lib/supabase/client';

export interface OTP {
  id: string;
  email: string;
  otp: string;
  purpose: 'appointment' | 'queue' | 'verification';
  expires_at: string;
  verified: boolean;
  created_at: string;
}

class OTPService {
  // Generate a 6-digit OTP
  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Store OTP in database
  async createOTP(email: string, purpose: 'appointment' | 'queue' | 'verification' = 'appointment'): Promise<{ otp: string; id: string }> {
    const otp = this.generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // OTP valid for 10 minutes

    const { data, error } = await supabase
      .from('otps')
      .insert({
        email,
        otp,
        purpose,
        expires_at: expiresAt.toISOString(),
        verified: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating OTP:', error);
      throw new Error('Failed to create OTP');
    }

    return { otp, id: data.id };
  }

  // Verify OTP
  async verifyOTP(email: string, otp: string, purpose: 'appointment' | 'queue' | 'verification' = 'appointment'): Promise<boolean> {
    // Get the most recent OTP for this email and purpose
    const { data, error } = await supabase
      .from('otps')
      .select('*')
      .eq('email', email)
      .eq('otp', otp)
      .eq('purpose', purpose)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.error('OTP not found or error:', error);
      return false;
    }

    // Check if OTP has expired
    const expiresAt = new Date(data.expires_at);
    const now = new Date();

    if (now > expiresAt) {
      console.error('OTP has expired');
      return false;
    }

    // Mark OTP as verified
    await supabase
      .from('otps')
      .update({ verified: true })
      .eq('id', data.id);

    return true;
  }

  // Clean up expired OTPs (can be called periodically)
  async cleanupExpiredOTPs(): Promise<void> {
    const now = new Date().toISOString();
    
    await supabase
      .from('otps')
      .delete()
      .lt('expires_at', now);
  }

  // Invalidate all OTPs for an email
  async invalidateOTPs(email: string, purpose?: 'appointment' | 'queue' | 'verification'): Promise<void> {
    let query = supabase
      .from('otps')
      .update({ verified: true })
      .eq('email', email);

    if (purpose) {
      query = query.eq('purpose', purpose);
    }

    await query;
  }
}

export const otpService = new OTPService();

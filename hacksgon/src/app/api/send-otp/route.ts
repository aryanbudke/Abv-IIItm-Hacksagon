import { NextRequest, NextResponse } from 'next/server';
import { otpService } from '@/lib/services/otpService';
import { emailService } from '@/lib/services/emailService';

export async function POST(request: NextRequest) {
  try {
    console.log('🔐 OTP Request received');
    const { email, purpose } = await request.json();
    console.log('📧 Email:', email, '| Purpose:', purpose);

    if (!email) {
      console.log('❌ Email is required');
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ Invalid email format:', email);
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    console.log('✅ Email validation passed');

    // Invalidate any previous OTPs for this email and purpose
    console.log('🗑️ Invalidating previous OTPs...');
    await otpService.invalidateOTPs(email, purpose || 'appointment');

    // Generate and store new OTP
    console.log('🎲 Generating new OTP...');
    const { otp, id } = await otpService.createOTP(email, purpose || 'appointment');
    console.log('✅ OTP generated:', otp, '| ID:', id);

    // Send OTP via email
    console.log('📨 Sending OTP email...');
    const emailSent = await emailService.sendOTPEmail(email, otp, purpose || 'appointment');

    if (!emailSent) {
      console.log('❌ Failed to send OTP email');
      return NextResponse.json(
        { error: 'Failed to send OTP email. Please check SMTP configuration.' },
        { status: 500 }
      );
    }

    console.log('✅ OTP sent successfully!');
    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully to your email',
      otpId: id
    });

  } catch (error: any) {
    console.error('Error sending OTP:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    });
    return NextResponse.json(
      { error: `Failed to send OTP: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}

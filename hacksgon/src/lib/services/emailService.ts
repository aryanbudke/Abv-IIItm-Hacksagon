interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: any = null;

  private async initializeTransporter() {
    if (this.transporter) {
      console.log('✅ Using existing SMTP transporter');
      return this.transporter;
    }

    console.log('🔧 Initializing SMTP transporter...');
    console.log('📧 SMTP Configuration:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE,
      user: process.env.SMTP_USER,
      passLength: process.env.SMTP_PASS?.length,
      passPreview: process.env.SMTP_PASS?.substring(0, 4) + '****'
    });

    // Check if SMTP credentials are configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('❌ SMTP credentials not configured:', {
        host: !!process.env.SMTP_HOST,
        user: !!process.env.SMTP_USER,
        pass: !!process.env.SMTP_PASS
      });
      throw new Error('SMTP credentials not configured. Please check your .env.local file.');
    }

    try {
      const nodemailer = await import('nodemailer');
      
      // Remove spaces from password
      const cleanPassword = process.env.SMTP_PASS.replace(/\s/g, '');
      console.log('🔑 Password cleaned:', {
        original: process.env.SMTP_PASS.length,
        cleaned: cleanPassword.length,
        preview: cleanPassword.substring(0, 4) + '****'
      });
      
      this.transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: cleanPassword,
        },
      });

      console.log('✅ SMTP transporter initialized successfully');
      return this.transporter;
    } catch (error) {
      console.error('❌ Failed to initialize nodemailer:', error);
      throw error;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      console.log('📨 Attempting to send email to:', options.to);
      const transporter = await this.initializeTransporter();
      
      console.log('📧 Sending email with options:', {
        from: `"${process.env.SMTP_FROM_NAME || 'Queue Management System'}" <${process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject
      });
      
      const info = await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'Queue Management System'}" <${process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      console.log('✅ Email sent successfully! Message ID:', info.messageId);
      return true;
    } catch (error: any) {
      console.error('❌ Error sending email:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        response: error?.response,
        responseCode: error?.responseCode
      });
      return false;
    }
  }

  async sendOTPEmail(email: string, otp: string, purpose: string = 'appointment'): Promise<boolean> {
    const subject = `Your OTP for ${purpose} verification`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background-color: #2563eb;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .otp-box {
              background-color: #f0f9ff;
              border: 2px solid #2563eb;
              border-radius: 5px;
              padding: 20px;
              text-align: center;
              margin: 20px 0;
            }
            .otp-code {
              font-size: 32px;
              font-weight: bold;
              color: #2563eb;
              letter-spacing: 5px;
            }
            .warning {
              color: #dc2626;
              font-size: 14px;
              margin-top: 20px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏥 Queue Management System</h1>
            </div>
            <div class="content">
              <h2>OTP Verification</h2>
              <p>Hello,</p>
              <p>You have requested to verify your ${purpose}. Please use the following One-Time Password (OTP) to complete the verification:</p>
              
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
              </div>
              
              <p><strong>This OTP is valid for 10 minutes.</strong></p>
              
              <p>If you did not request this OTP, please ignore this email or contact our support team.</p>
              
              <div class="warning">
                ⚠️ Never share your OTP with anyone. Our team will never ask for your OTP.
              </div>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
              <p>&copy; 2026 Queue Management System. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Your OTP for ${purpose} verification is: ${otp}

This OTP is valid for 10 minutes.

If you did not request this OTP, please ignore this email.

Never share your OTP with anyone.

Queue Management System
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  async sendAppointmentConfirmation(
    email: string,
    appointmentDetails: {
      patientName: string;
      doctorName: string;
      hospitalName: string;
      departmentName: string;
      date: string;
      timeSlot: string;
      appointmentId: string;
    }
  ): Promise<boolean> {
    const subject = 'Appointment Confirmed - Queue Management System';
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background-color: #10b981;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .appointment-details {
              background-color: #f0fdf4;
              border-left: 4px solid #10b981;
              padding: 15px;
              margin: 20px 0;
            }
            .detail-row {
              display: flex;
              margin: 10px 0;
            }
            .detail-label {
              font-weight: bold;
              min-width: 150px;
            }
            .success-icon {
              font-size: 48px;
              text-align: center;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Appointment Confirmed</h1>
            </div>
            <div class="content">
              <div class="success-icon">🎉</div>
              <h2>Your appointment has been successfully booked!</h2>
              <p>Dear ${appointmentDetails.patientName},</p>
              <p>Your appointment has been confirmed. Please find the details below:</p>
              
              <div class="appointment-details">
                <div class="detail-row">
                  <span class="detail-label">Appointment ID:</span>
                  <span>${appointmentDetails.appointmentId}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Doctor:</span>
                  <span>Dr. ${appointmentDetails.doctorName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Hospital:</span>
                  <span>${appointmentDetails.hospitalName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Department:</span>
                  <span>${appointmentDetails.departmentName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Date:</span>
                  <span>${appointmentDetails.date}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Time:</span>
                  <span>${appointmentDetails.timeSlot}</span>
                </div>
              </div>
              
              <p><strong>Important:</strong></p>
              <ul>
                <li>Please arrive 15 minutes before your scheduled time</li>
                <li>Bring your appointment ID for reference</li>
                <li>Carry any relevant medical documents</li>
              </ul>
              
              <p>If you need to reschedule or cancel, please contact us at least 24 hours in advance.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
    });
  }
}

export const emailService = new EmailService();

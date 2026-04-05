# Gmail SMTP Setup Guide

## Step-by-Step Guide to Get Gmail SMTP Credentials

### Option 1: Using App Password (Recommended)

#### Prerequisites
- A Gmail account
- 2-Step Verification enabled on your Google account

#### Steps:

1. **Enable 2-Step Verification**
   - Go to https://myaccount.google.com/security
   - Click on "2-Step Verification"
   - Follow the steps to enable it (if not already enabled)

2. **Generate App Password**
   - Go to https://myaccount.google.com/apppasswords
   - Or navigate: Google Account → Security → 2-Step Verification → App passwords
   - Select app: Choose "Mail"
   - Select device: Choose "Other (Custom name)"
   - Enter name: "Queue Management System" or any name you prefer
   - Click "Generate"
   - **IMPORTANT:** Copy the 16-character password shown (you won't see it again!)

3. **Configure Environment Variables**
   - Create or update `.env.local` file in your project root
   - Add the following variables:

```env
# Gmail SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
SMTP_FROM_NAME=Queue Management System
```

### Option 2: Using OAuth2 (Advanced)

This is more secure but complex. For most use cases, App Password is sufficient.

## Environment Variables Explained

| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_HOST` | Gmail SMTP server | `smtp.gmail.com` |
| `SMTP_PORT` | Port number (587 for TLS, 465 for SSL) | `587` |
| `SMTP_SECURE` | Use SSL (true for port 465, false for 587) | `false` |
| `SMTP_USER` | Your Gmail address | `yourname@gmail.com` |
| `SMTP_PASS` | App password (16 characters, no spaces) | `abcd efgh ijkl mnop` |
| `SMTP_FROM_NAME` | Sender name in emails | `Queue Management System` |

## Testing Your Configuration

After setting up the environment variables:

1. Restart your development server
2. Try booking an appointment
3. Check if you receive the OTP email

## Troubleshooting

### Common Issues:

1. **"Invalid login" error**
   - Make sure 2-Step Verification is enabled
   - Regenerate the App Password
   - Check that you copied the password correctly (no spaces)

2. **"Less secure app access" error**
   - Use App Password instead of your regular Gmail password
   - Google has deprecated "Less secure apps" access

3. **Connection timeout**
   - Check your firewall settings
   - Verify SMTP_HOST and SMTP_PORT are correct
   - Try port 465 with SMTP_SECURE=true

4. **Emails going to spam**
   - This is normal for development
   - In production, consider using a dedicated email service
   - Add SPF and DKIM records to your domain

## Security Best Practices

1. **Never commit `.env.local` to Git**
   - It's already in `.gitignore`
   - Double-check before pushing code

2. **Use different credentials for production**
   - Create a separate Gmail account for production
   - Or use a professional email service (SendGrid, AWS SES, etc.)

3. **Rotate passwords regularly**
   - Regenerate App Passwords periodically
   - Revoke old passwords you're not using

## Alternative Email Services (Production)

For production environments, consider:

- **SendGrid** - Free tier: 100 emails/day
- **AWS SES** - Pay as you go, very cheap
- **Mailgun** - Free tier: 5,000 emails/month
- **Postmark** - Transactional email specialist
- **Resend** - Modern email API

These services offer better deliverability and analytics.

## Quick Setup Checklist

- [ ] Enable 2-Step Verification on Gmail
- [ ] Generate App Password
- [ ] Create `.env.local` file
- [ ] Add all SMTP variables
- [ ] Copy App Password (16 characters)
- [ ] Restart development server
- [ ] Test by booking an appointment
- [ ] Check email inbox (and spam folder)

## Example `.env.local` File

```env
# Clerk Authentication (existing)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Supabase (existing)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Gmail SMTP Configuration (NEW)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=yourname@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
SMTP_FROM_NAME=Queue Management System
```

## Support

If you encounter issues:
1. Check the console logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test with a simple email first
4. Check Gmail's "Less secure apps" settings (should be disabled)
5. Ensure 2-Step Verification is enabled

---

**Last Updated:** March 10, 2026

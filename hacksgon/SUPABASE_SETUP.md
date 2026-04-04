# Supabase Setup Guide

This guide will help you set up the Supabase database for the Hospital Queue Management System.

## Prerequisites

- A Supabase account (sign up at https://supabase.com)
- Your Supabase project credentials (already in `.env.local`)

## Database Setup

### 1. Create a New Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in your project details
4. Wait for the project to be provisioned

### 2. Run the Database Schema

1. In your Supabase dashboard, go to the **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `supabase-schema.sql`
4. Paste it into the SQL editor
5. Click "Run" to execute the schema

This will create all the necessary tables, indexes, and security policies.

### 3. Verify Your Environment Variables

Make sure your `.env.local` file has the correct Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xghlsulhctipiqxpodoi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Database Tables

The schema creates the following tables:

### Core Tables
- **users** - Patient/user information linked to Clerk authentication
- **hospitals** - Hospital information
- **departments** - Hospital departments
- **doctors** - Doctor profiles and availability

### Queue Management
- **queue** - Regular queue entries with QR codes
- **emergency_queue** - Emergency queue with priority levels
- **appointments** - Scheduled appointments with OTP verification

### Analytics & Feedback
- **ratings** - Doctor and hospital ratings
- **historical_data** - Historical queue data for AI predictions
- **notifications** - User notifications

## Row Level Security (RLS)

The schema includes RLS policies to ensure:
- Users can only access their own data
- Authenticated users can view public data (hospitals, doctors, departments)
- Proper authorization for all operations

## Authentication Integration

The database is designed to work with **Clerk** authentication:
- User IDs from Clerk are stored as TEXT in the `users.id` field
- RLS policies use `auth.uid()` which maps to Clerk user IDs
- Clerk handles all authentication; Supabase handles data storage

## Realtime Subscriptions

Supabase Realtime is enabled for:
- Queue updates (for live position tracking)
- Notifications (for instant alerts)

To use realtime in your app, the `queueService.subscribeToQueue()` method is already set up.

## Sample Data (Optional)

You can add sample data for testing:

```sql
-- Insert a sample hospital
INSERT INTO hospitals (name, address, city, state, pincode, phone, email, departments)
VALUES (
  'City General Hospital',
  '123 Main Street',
  'Mumbai',
  'Maharashtra',
  '400001',
  '+91-22-12345678',
  'info@cityhospital.com',
  ARRAY['General Medicine', 'Cardiology', 'Orthopedics']
);

-- Insert a sample department
INSERT INTO departments (hospital_id, name, description, floor, counter_numbers)
VALUES (
  (SELECT id FROM hospitals WHERE name = 'City General Hospital'),
  'General Medicine',
  'General medical consultations and treatments',
  'Ground Floor',
  ARRAY[1, 2, 3, 4, 5]
);
```

## Troubleshooting

### Connection Issues
- Verify your Supabase URL and keys in `.env.local`
- Check that your Supabase project is active
- Ensure you're using the correct region

### RLS Policy Issues
- If queries fail, check RLS policies in Supabase Dashboard → Authentication → Policies
- Ensure Clerk user IDs match the format expected by Supabase

### Migration from Firebase
All Firebase code has been removed and replaced with Supabase:
- ✅ Authentication now uses Clerk
- ✅ Database queries use Supabase client
- ✅ Realtime updates use Supabase channels
- ✅ All service files updated

## Next Steps

1. Run the schema in Supabase SQL Editor
2. Add sample data (optional)
3. Test the application
4. Set up Supabase Storage for face verification images (if needed)

## Support

For Supabase-specific issues, refer to:
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)

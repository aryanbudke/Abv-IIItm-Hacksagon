# Hospital Queue Management System - Setup Guide

## 🚀 Complete Production-Ready Hospital Queue Management System

A comprehensive web application for managing hospital queues with AI-powered wait time prediction, face verification, QR code tokens, and real-time updates.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Firebase Setup](#firebase-setup)
3. [Environment Configuration](#environment-configuration)
4. [Installation](#installation)
5. [Database Schema](#database-schema)
6. [Running Locally](#running-locally)
7. [Deployment to Vercel](#deployment-to-vercel)
8. [Features Overview](#features-overview)
9. [API Routes](#api-routes)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 18+ and npm
- Firebase account
- Gmail account (for SMTP)
- Vercel account (for deployment)
- OpenAI API key (optional, for chatbot)

---

## Firebase Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Enter project name: `hospital-queue-system`
4. Enable Google Analytics (optional)
5. Create project

### 2. Enable Authentication

1. Go to **Authentication** → **Sign-in method**
2. Enable the following providers:
   - **Phone** (for OTP login)
   - **Google** (for Google login)
   - **Apple** (for Apple login)

### 3. Create Firestore Database

1. Go to **Firestore Database**
2. Click **Create database**
3. Start in **production mode**
4. Choose location closest to your users
5. Click **Enable**

### 4. Set Up Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /hospitals/{hospitalId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    match /departments/{departmentId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    match /doctors/{doctorId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    match /queue/{queueId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null;
    }
    
    match /emergencyQueue/{queueId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null;
    }
    
    match /appointments/{appointmentId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null;
    }
    
    match /ratings/{ratingId} {
      allow read: if true;
      allow create: if request.auth != null;
    }
  }
}
```

### 5. Enable Firebase Storage

1. Go to **Storage**
2. Click **Get Started**
3. Use default security rules
4. Click **Done**

### 6. Get Firebase Configuration

1. Go to **Project Settings** (gear icon)
2. Scroll to **Your apps**
3. Click **Web** icon (</>)
4. Register app name: `hospital-queue-web`
5. Copy the configuration object

### 7. Get Firebase Admin SDK

1. Go to **Project Settings** → **Service accounts**
2. Click **Generate new private key**
3. Save the JSON file securely
4. Extract: `project_id`, `client_email`, `private_key`

---

## Environment Configuration

Create `.env.local` file in the root directory:

```bash
# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Firebase Admin SDK (Server-side)
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@your_project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Private_Key_Here\n-----END PRIVATE KEY-----\n"

# SMTP Configuration (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM=noreply@hospital-queue.com

# OpenAI API (Optional - for chatbot)
OPENAI_API_KEY=sk-your_openai_api_key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Gmail App Password Setup

1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Security → 2-Step Verification (enable if not enabled)
3. App passwords → Generate new app password
4. Select "Mail" and "Other"
5. Copy the 16-character password
6. Use this as `SMTP_PASSWORD`

---

## Installation

```bash
# Install dependencies
npm install --legacy-peer-deps

# Download face-api.js models (required for face verification)
mkdir -p public/models
cd public/models
wget https://github.com/justadudewhohacks/face-api.js-models/raw/master/tiny_face_detector_model-weights_manifest.json
wget https://github.com/justadudewhohacks/face-api.js-models/raw/master/tiny_face_detector_model-shard1
wget https://github.com/justadudewhohacks/face-api.js-models/raw/master/face_landmark_68_model-weights_manifest.json
wget https://github.com/justadudewhohacks/face-api.js-models/raw/master/face_landmark_68_model-shard1
wget https://github.com/justadudewhohacks/face-api.js-models/raw/master/face_recognition_model-weights_manifest.json
wget https://github.com/justadudewhohacks/face-api.js-models/raw/master/face_recognition_model-shard1
wget https://github.com/justadudewhohacks/face-api.js-models/raw/master/face_recognition_model-shard2
wget https://github.com/justadudewhohacks/face-api.js-models/raw/master/face_expression_model-weights_manifest.json
wget https://github.com/justadudewhohacks/face-api.js-models/raw/master/face_expression_model-shard1
cd ../..
```

---

## Database Schema

### Collections Structure

#### 1. **users**
```typescript
{
  id: string;
  name: string;
  email: string;
  mobile: string;
  patientId: string;
  lastVisit?: Date;
  hospitalVisited?: string[];
  treatmentType?: string[];
  faceData?: string; // Base64 encoded face embedding
  createdAt: Date;
  updatedAt: Date;
}
```

#### 2. **hospitals**
```typescript
{
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  departments: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

#### 3. **departments**
```typescript
{
  id: string;
  hospitalId: string;
  name: string;
  description: string;
  floor?: string;
  counterNumbers: number[];
  createdAt: Date;
  updatedAt: Date;
}
```

#### 4. **doctors**
```typescript
{
  id: string;
  name: string;
  email: string;
  phone: string;
  hospitalId: string;
  departmentId: string;
  specialization: string;
  qualification: string;
  experience: number;
  rating: number;
  totalRatings: number;
  availability: Array<{
    day: string;
    startTime: string;
    endTime: string;
    slots: number;
  }>;
  isOnLeave: boolean;
  leaveFrom?: Date;
  leaveTo?: Date;
  averageTreatmentTime: number; // in minutes
  createdAt: Date;
  updatedAt: Date;
}
```

#### 5. **queue**
```typescript
{
  id: string;
  tokenNumber: number;
  patientId: string;
  patientName: string;
  hospitalId: string;
  departmentId: string;
  doctorId: string;
  date: Date;
  time: Date;
  treatmentType: string;
  isEmergency: boolean;
  faceEmbedding?: number[];
  qrCode: string; // Base64 QR code image
  status: 'waiting' | 'in-treatment' | 'completed' | 'cancelled';
  estimatedWaitTime?: number;
  position?: number;
  counterNumber?: number;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 6. **emergencyQueue**
```typescript
{
  id: string;
  tokenNumber: number;
  patientId: string;
  patientName: string;
  hospitalId: string;
  departmentId: string;
  emergencyType: string;
  severity: 'critical' | 'high' | 'medium';
  qrCode: string;
  status: 'waiting' | 'in-treatment' | 'completed';
  counterNumber?: number;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 7. **appointments**
```typescript
{
  id: string;
  patientId: string;
  patientName: string;
  hospitalId: string;
  departmentId: string;
  doctorId: string;
  date: Date;
  timeSlot: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  otpVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 8. **ratings**
```typescript
{
  id: string;
  patientId: string;
  doctorId: string;
  hospitalId: string;
  appointmentId: string;
  rating: number; // 1-5
  feedback: string;
  treatmentSuccess: boolean;
  createdAt: Date;
}
```

#### 9. **historicalData**
```typescript
{
  id: string;
  hospitalId: string;
  departmentId: string;
  date: Date;
  hour: number; // 0-23
  patientCount: number;
  averageWaitTime: number;
  createdAt: Date;
}
```

---

## Running Locally

```bash
# Development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deployment to Vercel

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Deploy

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### 4. Set Environment Variables

In Vercel Dashboard:
1. Go to your project
2. Settings → Environment Variables
3. Add all variables from `.env.local`
4. Redeploy

---

## Features Overview

### ✅ Authentication System
- Mobile OTP login
- Google OAuth
- Apple OAuth
- Secure user management

### ✅ Patient Queue System
- Hospital selection
- Department selection
- Doctor selection (sorted by rating)
- Face capture & verification
- QR code generation
- Token number assignment
- Real-time queue position

### ✅ Emergency Mode
- Priority queue
- Instant token generation
- No face verification required
- Admin notifications

### ✅ Admin Dashboard
- Total patients waiting
- Emergency patients count
- Token queue management
- Doctor schedule
- Department management
- Counter management
- Manual queue rearrangement
- Call next patient
- Mark treatment completed

### ✅ Appointment Booking
- Hospital/Department/Doctor selection
- Time slot selection
- OTP verification via email
- Appointment confirmation
- Doctor ratings

### ✅ Digital Waiting Room
- Real-time queue updates
- Current token display
- Waiting tokens list
- Department counters
- Emergency count
- Live Firebase sync

### ✅ AI Wait Time Prediction
- TensorFlow.js model
- Historical data analysis
- Factors considered:
  - Patients waiting
  - Emergency count
  - Doctor availability
  - Average treatment time
  - Hour of day

### ✅ Crowd Prediction
- Hourly patient count prediction
- Best time slots recommendation
- Peak hours identification
- Historical data visualization

### ✅ Face Verification
- Browser camera access
- Face detection using face-api.js
- Face embedding extraction
- Identity verification
- Similarity threshold matching

### ✅ QR Code System
- Unique QR code per patient
- Token number encoding
- Patient ID encoding
- Timestamp encoding
- Easy check-in

### ✅ Notifications
- Firebase Cloud Messaging
- Token near notification
- Appointment confirmation
- Emergency alerts

---

## API Routes

### Authentication
- `POST /api/auth/send-otp` - Send OTP to phone
- `POST /api/auth/verify-otp` - Verify OTP
- `POST /api/auth/google` - Google OAuth
- `POST /api/auth/apple` - Apple OAuth

### Queue Management
- `POST /api/queue/join` - Join queue
- `GET /api/queue/:hospitalId/:departmentId` - Get queue
- `PUT /api/queue/:queueId/status` - Update status
- `GET /api/queue/:queueId/position` - Get position
- `DELETE /api/queue/:queueId` - Remove from queue

### Emergency
- `POST /api/emergency/add` - Add to emergency queue
- `GET /api/emergency/:hospitalId` - Get emergency queue

### Appointments
- `POST /api/appointments/create` - Create appointment
- `POST /api/appointments/send-otp` - Send OTP email
- `POST /api/appointments/verify` - Verify OTP
- `GET /api/appointments/patient/:patientId` - Get patient appointments
- `PUT /api/appointments/:id/cancel` - Cancel appointment

### Hospitals
- `GET /api/hospitals` - Get all hospitals
- `GET /api/hospitals/:id` - Get hospital by ID
- `GET /api/hospitals/:id/departments` - Get departments
- `GET /api/departments/:id/doctors` - Get doctors

### AI Prediction
- `POST /api/ai/predict-wait-time` - Predict wait time
- `GET /api/ai/crowd-prediction/:hospitalId` - Get crowd prediction

---

## Troubleshooting

### Firebase Connection Issues
- Verify all environment variables are set correctly
- Check Firebase project settings
- Ensure Firestore is enabled
- Verify authentication providers are enabled

### Face Verification Not Working
- Ensure models are downloaded to `public/models`
- Check browser camera permissions
- Verify HTTPS in production (required for camera access)

### Email OTP Not Sending
- Verify Gmail app password is correct
- Check SMTP settings
- Ensure 2-factor authentication is enabled on Gmail
- Check spam folder

### Build Errors
- Run `npm install --legacy-peer-deps`
- Clear `.next` folder: `rm -rf .next`
- Clear node_modules: `rm -rf node_modules && npm install --legacy-peer-deps`

### Deployment Issues
- Verify all environment variables are set in Vercel
- Check build logs for errors
- Ensure Node.js version is 18+

---

## Support

For issues and questions:
- Check Firebase Console for errors
- Review Vercel deployment logs
- Check browser console for client-side errors
- Verify all environment variables

---

## License

MIT License - feel free to use this project for your hospital management needs.

---

**Built with ❤️ using Next.js, Firebase, TensorFlow.js, and ShadCN UI**

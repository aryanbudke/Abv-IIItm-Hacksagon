import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

import { createServerClient } from "@/lib/supabase/server";

type PatientProfile = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  patient_id: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value: unknown) {
  const raw = normalizeString(value);
  if (!raw) return "";

  const compact = raw.replace(/[^\d+]/g, "");
  if (compact.startsWith("+")) {
    return `+${compact.slice(1).replace(/\D/g, "")}`;
  }

  if (compact.startsWith("00")) {
    return `+${compact.slice(2).replace(/\D/g, "")}`;
  }

  const digits = compact.replace(/\D/g, "");
  if (!digits) return "";

  // App defaults are India-focused, so normalize bare 10-digit mobile numbers to +91.
  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }

  return raw;
}

function buildPatientId() {
  return `PAT${Date.now().toString().slice(-6)}`;
}

async function ensurePatientProfile(userId: string): Promise<PatientProfile> {
  const supabase = createServerClient();
  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);

  const email = clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase().trim() || "";
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
    clerkUser.fullName ||
    email.split("@")[0] ||
    "Patient";
  const mobile = normalizePhone(clerkUser.phoneNumbers?.[0]?.phoneNumber || "");

  const { data: existingById } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (existingById) {
    return existingById as PatientProfile;
  }

  const { data: existingByEmail } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (existingByEmail) {
    const { data: updated, error } = await supabase
      .from("users")
      .update({
        id: userId,
        name: existingByEmail.name || name,
        mobile: existingByEmail.mobile || mobile || null,
        updated_at: new Date().toISOString(),
      })
      .eq("email", email)
      .select("*")
      .single();

    if (error) throw error;
    return updated as PatientProfile;
  }

  const { data: created, error } = await supabase
    .from("users")
    .insert({
      id: userId,
      name,
      email,
      mobile: mobile || null,
      patient_id: buildPatientId(),
      address: null,
      city: null,
      state: null,
      pincode: null,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return created as PatientProfile;
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await ensurePatientProfile(userId);
    return NextResponse.json({
      profile,
      completeness: {
        hasMobile: !!profile.mobile,
        hasAddress: !!profile.address,
        hasCity: !!profile.city,
        hasState: !!profile.state,
        hasPincode: !!profile.pincode,
        isComplete: !!(profile.mobile && profile.address && profile.city && profile.state && profile.pincode),
      },
    });
  } catch (error: any) {
    console.error("Profile GET error:", error);
    return NextResponse.json({ error: error?.message || "Failed to load profile" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const current = await ensurePatientProfile(userId);
    const supabase = createServerClient();

    const payload = {
      name: normalizeString(body.name) || current.name,
      mobile: normalizePhone(body.mobile),
      address: normalizeString(body.address),
      city: normalizeString(body.city),
      state: normalizeString(body.state),
      pincode: normalizeString(body.pincode),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("users")
      .update(payload)
      .eq("id", userId)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      profile: data,
      completeness: {
        hasMobile: !!data.mobile,
        hasAddress: !!data.address,
        hasCity: !!data.city,
        hasState: !!data.state,
        hasPincode: !!data.pincode,
        isComplete: !!(data.mobile && data.address && data.city && data.state && data.pincode),
      },
    });
  } catch (error: any) {
    console.error("Profile PATCH error:", error);
    return NextResponse.json({ error: error?.message || "Failed to update profile" }, { status: 500 });
  }
}

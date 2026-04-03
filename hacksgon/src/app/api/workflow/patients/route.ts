import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

import { createServerClient } from "@/lib/supabase/server";

type PatientRecord = {
  id: string;
  name: string;
  email: string;
  patient_id: string | null;
  mobile: string | null;
};

function normalizePhone(value: unknown) {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  const compact = raw.replace(/[^\d+]/g, "");
  if (compact.startsWith("+")) {
    return `+${compact.slice(1).replace(/\D/g, "")}`;
  }

  if (compact.startsWith("00")) {
    return `+${compact.slice(2).replace(/\D/g, "")}`;
  }

  const digits = compact.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return raw;
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerClient();

    const { data: users, error } = await supabase
      .from("users")
      .select("id, name, email, patient_id, mobile")
      .not("patient_id", "is", null)
      .order("name", { ascending: true })
      .limit(100);

    if (error) {
      throw error;
    }

    const records = new Map<string, PatientRecord>();

    for (const user of users || []) {
      records.set(user.id as string, {
        id: user.id as string,
        name: (user.name as string | null) || "Unnamed patient",
        email: (user.email as string | null) || "",
        patient_id: (user.patient_id as string | null) || null,
        mobile: normalizePhone(user.mobile),
      });
    }

    if (records.size === 0) {
      const [{ data: appointmentRows }, { data: queueRows }] = await Promise.all([
        supabase
          .from("appointments")
          .select("patient_id, patient_name")
          .not("patient_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("queue")
          .select("patient_id, patient_name")
          .not("patient_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      for (const row of [...(appointmentRows || []), ...(queueRows || [])]) {
        const id = row.patient_id as string | null;
        if (!id || records.has(id)) continue;

        records.set(id, {
          id,
          name: (row.patient_name as string | null) || "Unnamed patient",
          email: "",
          patient_id: null,
          mobile: null,
        });
      }

      if (records.size > 0) {
        const fallbackIds = Array.from(records.keys());
        const { data: fallbackUsers } = await supabase
          .from("users")
          .select("id, name, email, patient_id, mobile")
          .in("id", fallbackIds);

        for (const user of fallbackUsers || []) {
          records.set(user.id as string, {
            id: user.id as string,
            name: (user.name as string | null) || records.get(user.id as string)?.name || "Unnamed patient",
            email: (user.email as string | null) || "",
            patient_id: (user.patient_id as string | null) || null,
            mobile: normalizePhone(user.mobile),
          });
        }
      }
    }

    const missingPhoneIds = Array.from(records.values())
      .filter(record => !record.mobile)
      .map(record => record.id);

    if (missingPhoneIds.length > 0) {
      const clerk = await clerkClient();

      await Promise.all(missingPhoneIds.map(async (id) => {
        try {
          const clerkUser = await clerk.users.getUser(id);
          const mobile = normalizePhone(clerkUser.phoneNumbers?.[0]?.phoneNumber || "");
          if (!mobile) return;

          const existing = records.get(id);
          if (!existing) return;

          records.set(id, { ...existing, mobile });

          await supabase
            .from("users")
            .update({ mobile, updated_at: new Date().toISOString() })
            .eq("id", id);
        } catch {
          // Ignore Clerk lookup failures for non-Clerk IDs / demo data.
        }
      }));
    }

    return NextResponse.json({
      patients: Array.from(records.values()).slice(0, 100),
    });
  } catch (error: any) {
    console.error("Workflow patients GET error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load workflow patients" },
      { status: 500 }
    );
  }
}

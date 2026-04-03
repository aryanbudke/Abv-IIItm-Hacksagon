"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Home,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProfileResponse = {
  profile: {
    id: string;
    name: string;
    email: string;
    mobile: string | null;
    patient_id: string;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
  };
  completeness: {
    hasMobile: boolean;
    hasAddress: boolean;
    hasCity: boolean;
    hasState: boolean;
    hasPincode: boolean;
    isComplete: boolean;
  };
};

const EMPTY_FORM = {
  name: "",
  email: "",
  mobile: "",
  patientId: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
};

function ProfileContent() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboarding = searchParams.get("onboarding") === "1";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [profileData, setProfileData] = useState(EMPTY_FORM);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const loadProfile = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        const data: ProfileResponse = await res.json();
        if (!res.ok) throw new Error((data as any).error || "Failed to load profile");

        setProfileData({
          name: data.profile.name || user?.fullName || "",
          email: data.profile.email || user?.primaryEmailAddress?.emailAddress || "",
          mobile: data.profile.mobile || "",
          patientId: data.profile.patient_id || "",
          address: data.profile.address || "",
          city: data.profile.city || "",
          state: data.profile.state || "",
          pincode: data.profile.pincode || "",
        });
      } catch (error) {
        console.error("Profile load error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [isLoaded, isSignedIn, user]);

  const missingFields = useMemo(() => {
    return [
      !profileData.mobile && "mobile number",
      !profileData.address && "address",
      !profileData.city && "city",
      !profileData.state && "state",
      !profileData.pincode && "pincode",
    ].filter(Boolean) as string[];
  }, [profileData]);

  const isComplete = missingFields.length === 0;

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileData.name,
          mobile: profileData.mobile,
          address: profileData.address,
          city: profileData.city,
          state: profileData.state,
          pincode: profileData.pincode,
        }),
      });
      const data: ProfileResponse = await res.json();
      if (!res.ok) throw new Error((data as any).error || "Failed to update profile");

      setProfileData(prev => ({
        ...prev,
        name: data.profile.name || prev.name,
        mobile: data.profile.mobile || "",
        address: data.profile.address || "",
        city: data.profile.city || "",
        state: data.profile.state || "",
        pincode: data.profile.pincode || "",
      }));

      setSaveMessage("Profile saved successfully.");

      if (onboarding && data.completeness.isComplete) {
        router.push("/dashboard?profile=completed");
      }
    } catch (error: any) {
      setSaveMessage(error?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded || !isSignedIn || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 flex h-14 items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 text-muted-foreground">
            <Link href="/dashboard"><ArrowLeft size={16} /> Back</Link>
          </Button>
          <span className="font-bold text-foreground">
            {onboarding ? "Complete Your Profile" : "My Profile"}
          </span>
          <Badge variant="outline" className={isComplete ? "gap-1.5 text-green-600 border-green-200 bg-green-50" : "gap-1.5 text-amber-700 border-amber-200 bg-amber-50"}>
            <Shield size={11} />
            {isComplete ? "Complete" : "Needs Details"}
          </Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            {onboarding ? "Let’s finish your patient profile" : "Patient Settings"}
          </h2>
          <p className="text-muted-foreground mt-1">
            {onboarding
              ? "Add your contact and address details so hospitals can reach you and process your bookings smoothly."
              : "Manage your contact and address details."}
          </p>
        </div>

        {!isComplete && (
          <Card className="border-amber-200 bg-amber-50/70">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-amber-900">Missing details</p>
              <p className="mt-1 text-sm text-amber-800">
                Please add {missingFields.join(", ")}.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1 h-fit">
            <CardHeader className="text-center pb-0">
              <CardTitle className="text-base">Patient Identity</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center pt-4 pb-6">
              <div className="w-28 h-28 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-4xl font-black shadow-lg mb-4">
                {user?.firstName?.[0] || user?.fullName?.[0] || "U"}
              </div>
              <h3 className="text-lg font-bold text-foreground text-center">{profileData.name || user?.fullName}</h3>
              <div className="flex items-center gap-1.5 mt-2 px-3 py-1 bg-muted rounded-lg">
                <Shield size={12} className="text-muted-foreground" />
                <p className="text-xs font-bold text-muted-foreground">ID: {profileData.patientId}</p>
              </div>
              <p className="mt-4 text-xs text-muted-foreground text-center">
                This information is used by hospitals and workflows to contact you correctly.
              </p>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Keep your patient contact details up to date.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="p-name" className="flex items-center gap-2">
                  <User size={13} className="text-primary" /> Full Name
                </Label>
                <Input
                  id="p-name"
                  value={profileData.name}
                  onChange={e => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <Mail size={13} className="text-primary" /> Email Address
                </Label>
                <div className="relative">
                  <p className="px-3 py-2.5 bg-muted rounded-lg text-sm font-medium text-muted-foreground border border-border pr-10">
                    {profileData.email}
                  </p>
                  <Shield size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                </div>
                <p className="text-xs text-muted-foreground">Managed securely by Clerk</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-mobile" className="flex items-center gap-2">
                  <Phone size={13} className="text-primary" /> Mobile Number
                </Label>
                <Input
                  id="p-mobile"
                  type="tel"
                  value={profileData.mobile}
                  onChange={e => setProfileData(prev => ({ ...prev, mobile: e.target.value }))}
                  placeholder="+91 1234567890"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-address" className="flex items-center gap-2">
                  <Home size={13} className="text-primary" /> Address
                </Label>
                <Input
                  id="p-address"
                  value={profileData.address}
                  onChange={e => setProfileData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Street address"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="p-city" className="flex items-center gap-2">
                    <MapPin size={13} className="text-primary" /> City
                  </Label>
                  <Input
                    id="p-city"
                    value={profileData.city}
                    onChange={e => setProfileData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="City"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="p-state">State</Label>
                  <Input
                    id="p-state"
                    value={profileData.state}
                    onChange={e => setProfileData(prev => ({ ...prev, state: e.target.value }))}
                    placeholder="State"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="p-pincode">Pincode</Label>
                  <Input
                    id="p-pincode"
                    value={profileData.pincode}
                    onChange={e => setProfileData(prev => ({ ...prev, pincode: e.target.value }))}
                    placeholder="Pincode"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <Calendar size={13} className="text-primary" /> Member Since
                </Label>
                <p className="px-3 py-2.5 bg-muted rounded-lg text-sm font-semibold text-foreground border border-border">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "N/A"}
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? "Saving..." : onboarding ? "Save And Continue" : "Save Profile"}
                </Button>
                {onboarding && (
                  <Button variant="outline" asChild>
                    <Link href="/dashboard">Later</Link>
                  </Button>
                )}
              </div>

              {saveMessage && (
                <p className={`text-sm ${saveMessage.includes("successfully") ? "text-green-600" : "text-destructive"}`}>
                  {saveMessage}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}

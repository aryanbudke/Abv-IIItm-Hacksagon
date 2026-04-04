"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/Logo";
import {
  HeartPulse, Users, Calendar, Shield,
  CheckCircle, QrCode, ChevronRight, ChevronDown,
  Stethoscope, Hospital, LayoutDashboard, Menu, X,
  Phone, MapPin, Star,
  Play, ArrowUpRight, Search, Ticket,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AppUserButton } from "@/components/AppUserButton";
import { GenerativeArtScene } from "@/components/ui/anomalous-matter-hero";

const EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.65, delay: i * 0.1, ease: EXPO },
  }),
};


const STEPS = [
  { step: "01", icon: Users,    title: "Create Account",          desc: "Sign up as a patient in under a minute. Your profile is pre-filled from your credentials." },
  { step: "02", icon: Hospital, title: "Choose Hospital & Dept",  desc: "Select hospital, department, and preferred doctor. See live queue lengths before you join." },
  { step: "03", icon: QrCode,   title: "Get Your Token",          desc: "Receive a QR-coded token instantly. Track your position in real time from phone or desktop." },
];

const SERVICE_TABS = ["Queue Management", "Appointments", "Medical Records"];



export default function HomePage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const role = user?.publicMetadata?.role as string | undefined;

  const [scrolled, setScrolled]         = useState(false);
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [dashDropdown, setDashDropdown] = useState(false);
  const [activeTab, setActiveTab]       = useState(0);

  // Search state
  const [searchQuery, setSearchQuery]         = useState("");
  const [departments, setDepartments]         = useState<any[]>([]);
  const [searchResults, setSearchResults]     = useState<any[]>([]);
  const [showDropdown, setShowDropdown]       = useState(false);
  const [searchLoading, setSearchLoading]     = useState(false);
  const searchRef                             = useRef<HTMLDivElement>(null);

  // Active queue token for nav link
  const [activeTokenId, setActiveTokenId] = useState<string | null>(null);

  // Real doctors from DB
  const [featuredDoctors, setFeaturedDoctors] = useState<any[]>([]);
  const [doctorsLoading, setDoctorsLoading]   = useState(true);

  // Fetch departments for search + featured doctors
  useEffect(() => {
    fetch("/api/departments")
      .then(r => r.json())
      .then(data => Array.isArray(data) && setDepartments(data))
      .catch(() => {});

    fetch("/api/doctors/featured")
      .then(r => r.json())
      .then(json => { setFeaturedDoctors(json.data || []); setDoctorsLoading(false); })
      .catch(() => setDoctorsLoading(false));
  }, []);

  // Filter departments as user types
  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    const lower = q.toLowerCase();
    const filtered = departments.filter(d =>
      d.name?.toLowerCase().includes(lower) ||
      d.hospitals?.name?.toLowerCase().includes(lower)
    ).slice(0, 6);
    setSearchResults(filtered);
    setShowDropdown(true);
  }, [departments]);

  const handleSearchSubmit = () => {
    if (!searchQuery.trim()) return;
    if (!isSignedIn) { router.push("/sign-in"); return; }
    router.push("/book-appointment");
  };

  const handleSelectResult = (dept: any) => {
    setSearchQuery(dept.name);
    setShowDropdown(false);
    if (!isSignedIn) { router.push("/sign-in"); return; }
    router.push("/book-appointment");
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!dashDropdown) return;
    const close = () => setDashDropdown(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [dashDropdown]);

  // Fetch user's latest active queue token
  useEffect(() => {
    if (!isSignedIn || !user) return;
    supabase
      .from("queue")
      .select("id")
      .eq("patient_id", user.id)
      .in("status", ["waiting", "in-treatment"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => setActiveTokenId(data?.id ?? null));
  }, [isSignedIn, user]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAFAF6" }}>
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const dashLinks = [
    role === "patient" && { href: "/dashboard", label: "Patient Dashboard", icon: Users },
    role === "doctor"  && { href: "/doctor",     label: "Doctor Dashboard",  icon: Stethoscope },
    role === "admin"   && { href: "/admin",       label: "Admin Panel",       icon: Hospital },
  ].filter(Boolean) as { href: string; label: string; icon: React.ElementType }[];

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "#FAFAF6", color: "#0D0D0D" }}>

      {/* ── NAVBAR ─────────────────────────────────────────── */}
      <motion.header
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: EXPO }}
        className="fixed top-0 left-0 right-0 z-[100] transition-all duration-300"
        style={{
          background: scrolled ? "rgba(250,250,246,0.92)" : "rgba(250,250,246,0.85)",
          backdropFilter: "blur(16px)",
          borderBottom: scrolled ? "1px solid rgba(0,0,0,0.08)" : "1px solid transparent",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <Link href="/" className="no-underline">
            <Logo height={36} />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-7">
            {["Features", "How It Works"].map((label, i) => (
              <a key={label} href={i === 0 ? "#features" : "#how"}
                className="text-[14px] font-medium text-[#555] hover:text-[#0D0D0D] transition-colors no-underline">
                {label}
              </a>
            ))}

            {isSignedIn ? (
              <div className="flex items-center gap-3">
                {activeTokenId && (
                  <Link href={`/my-token/${activeTokenId}`}
                    className="flex items-center gap-1.5 text-[14px] font-medium text-primary hover:text-primary/80 transition-colors no-underline">
                    <Ticket size={15} />
                    My Token
                  </Link>
                )}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setDashDropdown(!dashDropdown); }}
                    className="flex items-center gap-1.5 text-[14px] font-medium text-[#555] hover:text-[#0D0D0D] transition-colors"
                  >
                    <LayoutDashboard size={15} />
                    Dashboard
                    <ChevronDown size={13} className={`transition-transform duration-200 ${dashDropdown ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {dashDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-[calc(100%+10px)] left-0 min-w-[200px] rounded-2xl shadow-2xl border border-black/8 p-1.5 z-[200]"
                        style={{ background: "#fff" }}
                      >
                        {dashLinks.map(({ href, label, icon: Icon }) => (
                          <Link key={href} href={href} onClick={() => setDashDropdown(false)}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[#0D0D0D] hover:bg-primary/8 hover:text-primary no-underline transition-colors">
                            <Icon size={15} /> {label}
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <AppUserButton />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/sign-in" className="text-[14px] font-medium text-[#555] hover:text-[#0D0D0D] transition-colors no-underline">
                  Sign In
                </Link>
                <Link href="/sign-up" className="no-underline">
                  <button className="flex items-center gap-1.5 px-5 py-2 rounded-full border-2 border-[#0D0D0D] text-[14px] font-bold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-white transition-all duration-200">
                    Join Now <ArrowUpRight size={14} />
                  </button>
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile */}
          <div className="md:hidden flex items-center gap-3">
            {isSignedIn && <AppUserButton />}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2">
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="md:hidden overflow-hidden border-t border-black/8"
              style={{ background: "#FAFAF6" }}
            >
              <div className="p-4 flex flex-col gap-1">
                <a href="#features" onClick={() => setMobileOpen(false)} className="px-4 py-3 rounded-xl text-sm font-medium text-[#555] hover:bg-black/5 no-underline transition-colors">Features</a>
                <a href="#how"      onClick={() => setMobileOpen(false)} className="px-4 py-3 rounded-xl text-sm font-medium text-[#555] hover:bg-black/5 no-underline transition-colors">How It Works</a>
                {!isSignedIn && (
                  <div className="pt-2 flex flex-col gap-2">
                    <Link href="/sign-in" onClick={() => setMobileOpen(false)} className="px-4 py-3 rounded-xl text-sm font-medium text-[#555] no-underline block">Sign In</Link>
                    <Link href="/sign-up" onClick={() => setMobileOpen(false)} className="mx-2 py-3 rounded-xl text-sm font-bold bg-primary text-white text-center no-underline block">Join Now</Link>
                  </div>
                )}
                {isSignedIn && dashLinks.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium text-[#0D0D0D] hover:bg-black/5 no-underline transition-colors">
                    <Icon size={16} /> {label}
                  </Link>
                ))}
                {isSignedIn && activeTokenId && (
                  <Link href={`/my-token/${activeTokenId}`} onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium text-primary hover:bg-primary/8 no-underline transition-colors">
                    <Ticket size={16} /> My Token
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="relative w-full min-h-screen flex items-center pt-16" style={{ background: "#FAFAF6" }}>

        {/* Subtle background blobs */}
        <div className="absolute top-20 left-[10%] w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(0,188,212,0.07) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 right-[5%] w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)" }} />

        <div className="max-w-7xl mx-auto px-5 sm:px-8 w-full py-10 sm:py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-8 items-center">

            {/* LEFT */}
            <div className="relative">
              {/* User avatars + count */}


              {/* Big Headline */}
              <motion.h1 variants={fadeUp} initial="hidden" animate="visible" custom={1}
                className="font-black leading-[1.08] tracking-[-0.04em] mb-6"
                style={{ fontSize: "clamp(34px,9vw,80px)" }}>
                Smart{" "}
                <span className="relative inline-block">
                  <span className="text-primary">Healthcare</span>
                  <svg className="absolute -bottom-1 left-0 w-full" height="6" viewBox="0 0 200 6" fill="none" preserveAspectRatio="none">
                    <path d="M0 5 Q50 0 100 5 Q150 10 200 5" stroke="currentColor" strokeWidth="2.5" fill="none" className="text-primary" />
                  </svg>
                </span>
                <br />& Queue Control
              </motion.h1>

              <motion.p variants={fadeUp} initial="hidden" animate="visible" custom={2}
                className="text-[16px] leading-[1.75] text-[#666] mb-9 max-w-[440px]">
                MediQueue eliminates waiting room chaos — giving patients real-time queue visibility and QR tokens while hospitals get full operational control.
              </motion.p>

              {/* CTAs */}
              <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-10">
                {isSignedIn ? (
                  <>
                    <Link href="/join-queue" className="no-underline w-full sm:w-auto">
                      <button className="w-full flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-primary text-white font-bold text-[15px] shadow-[0_4px_20px_rgba(0,188,212,0.35)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,188,212,0.45)] transition-all duration-200">
                        <Users size={16} /> Join Queue <ArrowUpRight size={15} />
                      </button>
                    </Link>
                    <Link href="/book-appointment" className="no-underline w-full sm:w-auto">
                      <button className="w-full flex items-center justify-center gap-2 px-7 py-3.5 rounded-full border-2 border-[#0D0D0D] text-[#0D0D0D] font-bold text-[15px] hover:bg-[#0D0D0D] hover:text-white transition-all duration-200">
                        <Calendar size={16} /> Book Appointment
                      </button>
                    </Link>
                    <Link href="/digital-waiting-room" className="no-underline w-full sm:w-auto">
                      <button className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-white border border-black/10 text-[#555] font-semibold text-[14px] hover:border-primary hover:text-primary transition-all duration-200 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        Live Queue
                      </button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/sign-up" className="no-underline w-full sm:w-auto">
                      <button className="w-full flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-primary text-white font-bold text-[15px] shadow-[0_4px_20px_rgba(0,188,212,0.35)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,188,212,0.45)] transition-all duration-200">
                        Book Schedule <ArrowUpRight size={15} />
                      </button>
                    </Link>
                    <div className="flex items-center gap-4">
                      <Link href="/sign-in" className="no-underline">
                        <button className="flex items-center gap-2 w-12 h-12 rounded-full border-2 border-[#0D0D0D] justify-center hover:bg-[#0D0D0D] hover:text-white transition-all duration-200 group">
                          <Play size={15} className="text-[#0D0D0D] group-hover:text-white ml-0.5" fill="currentColor" />
                        </button>
                      </Link>
                      <span className="text-[15px] font-medium text-[#555]">See a Demo</span>
                    </div>
                  </>
                )}
              </motion.div>

              {/* Heartbeat line */}
              <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}
                className="flex items-center gap-4 mb-10">
                <svg width="160" height="30" viewBox="0 0 160 30" fill="none" className="text-primary">
                  <path d="M0 15 L30 15 L38 5 L46 25 L54 3 L62 27 L70 15 L160 15" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[12px] font-bold text-primary tracking-wider uppercase">Real-time Monitoring</span>
              </motion.div>

              {/* Trust badges */}
              <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}
                className="flex flex-wrap justify-center sm:justify-start gap-2.5 sm:gap-3">
                {[
                  { icon: Shield,      label: "HIPAA Compliant" },
                  { icon: CheckCircle, label: "Real-time Updates" },
                  { icon: QrCode,      label: "QR Token System" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-black/8 text-[12px] font-semibold text-[#555] shadow-sm">
                    <Icon size={13} className="text-primary" /> {label}
                  </div>
                ))}
              </motion.div>
            </div>

            {/* RIGHT — Animation + floating cards */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}
              className="relative hidden md:flex flex-col items-center justify-center min-h-[420px] lg:min-h-[520px]">

              {/* Main dark card with 3D animation */}
              <div className="relative w-full max-w-[380px] lg:max-w-[420px] h-[360px] lg:h-[440px] rounded-3xl overflow-hidden shadow-2xl"
                style={{ background: "#0F1F35" }}>
                <GenerativeArtScene color="#00bcd4" />
                {/* Overlay */}
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(15,31,53,0.8) 0%, transparent 60%)" }} />
                {/* Bottom label */}
                <div className="absolute bottom-5 left-5 right-5 z-10">
                  <p className="text-white/50 text-[11px] font-bold uppercase tracking-wider mb-1">Live System Status</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-white text-[13px] font-semibold">38 patients in queue · All systems operational</span>
                  </div>
                </div>
              </div>

              {/* Floating card: Today's Queues */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8, duration: 0.6, ease: EXPO }}
                className="absolute -left-4 sm:-left-8 top-12 bg-white rounded-2xl shadow-xl p-3.5 border border-black/5 w-[152px] sm:w-[168px]"
              >
                <p className="text-[10px] font-black text-[#0D0D0D] uppercase tracking-wider mb-2.5">Today&apos;s Activity</p>
                {[
                  { label: "Tokens issued",   val: "142", color: "text-primary" },
                  { label: "Avg wait time",   val: "8 min", color: "text-green-600" },
                  { label: "Depts active",    val: "6 / 6", color: "text-blue-600" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex items-center justify-between mb-1.5 last:mb-0">
                    <span className="text-[10px] text-[#888]">{label}</span>
                    <span className={`text-[10px] font-black ${color}`}>{val}</span>
                  </div>
                ))}
                <div className="mt-2.5 pt-2 border-t border-black/6 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">System Live</span>
                </div>
              </motion.div>

              {/* Floating card: Live Queue */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1, duration: 0.6, ease: EXPO }}
                className="absolute -right-4 sm:-right-8 top-20 bg-white rounded-2xl shadow-xl p-3.5 border border-black/5 w-[150px] sm:w-[165px]"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[11px] font-bold text-green-600">Live Queue</span>
                </div>
                {[
                  { dept: "Cardiology", n: 5 },
                  { dept: "Neurology",  n: 12 },
                  { dept: "Paediatrics",n: 3 },
                ].map(({ dept, n }) => (
                  <div key={dept} className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-[#555] font-medium">{dept}</span>
                    <span className="text-[10px] font-black text-primary">{n}</span>
                  </div>
                ))}
              </motion.div>

            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FEATURE HIGHLIGHTS ─────────────────────────────── */}
      <section className="py-16" style={{ background: "#F2F2EE" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <motion.p variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="text-center text-[12px] font-bold text-primary uppercase tracking-widest mb-10">
            Everything you need, nothing you don&apos;t
          </motion.p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: QrCode,       label: "Instant QR Token",   desc: "Join any hospital queue and get a scannable token in under 30 seconds.",                   accent: "bg-primary/10", iconColor: "text-primary"   },
              { icon: CheckCircle,  label: "Real-Time Queue",    desc: "Live WebSocket updates — see exactly who's ahead and your estimated wait.",                  accent: "bg-green-50",   iconColor: "text-green-600" },
              { icon: Calendar,     label: "Smart Scheduling",   desc: "Book or cancel appointments in seconds, with instant doctor confirmation.",                  accent: "bg-blue-50",    iconColor: "text-blue-600"  },
              { icon: Shield,       label: "HIPAA Compliant",    desc: "All patient data encrypted at rest and in transit. Privacy by default.",                     accent: "bg-primary/10", iconColor: "text-primary"   },
            ].map(({ icon: Icon, label, desc, accent, iconColor }, i) => (
              <motion.div key={label} variants={fadeUp} initial="hidden" whileInView="visible" custom={i}
                viewport={{ once: true, margin: "-60px" }}
                className="bg-white rounded-2xl p-6 border border-black/5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <div className={`w-11 h-11 rounded-xl ${accent} flex items-center justify-center mb-4`}>
                  <Icon size={20} className={iconColor} />
                </div>
                <h3 className="text-[15px] font-black text-[#0D0D0D] mb-2">{label}</h3>
                <p className="text-[13px] text-[#777] leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES (with tabs) ───────────────────────────── */}
      <section id="features" className="py-20 sm:py-28" style={{ background: "#FAFAF6" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8">

          {/* Tab pills */}
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="flex flex-wrap justify-center sm:justify-start gap-2.5 sm:gap-3 mb-10 sm:mb-12">
            {SERVICE_TABS.map((tab, i) => (
              <button key={tab} onClick={() => setActiveTab(i)}
                className={`px-5 py-2 rounded-full text-[13px] font-bold border-2 transition-all duration-200 ${
                  activeTab === i
                    ? "bg-primary text-white border-primary shadow-[0_4px_14px_rgba(0,188,212,0.3)]"
                    : "bg-white text-[#555] border-black/10 hover:border-primary/40"
                }`}>
                {tab}
              </button>
            ))}
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8 items-stretch">
            {/* Dark feature card */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
              className="rounded-3xl overflow-hidden shadow-xl flex flex-col"
              style={{ background: "#0F1F35" }}>
              <div className="relative flex-1 min-h-[200px] sm:min-h-[280px] overflow-hidden">
                {/* Real images per tab */}
                <AnimatePresence mode="wait">
                  {activeTab === 0 && (
                    <motion.div key="img0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="absolute inset-0">
                      <Image src="/images/doctor-consult.jpg" alt="Doctor consulting patient" fill className="object-cover" />
                    </motion.div>
                  )}
                  {activeTab === 1 && (
                    <motion.div key="img1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="absolute inset-0">
                      <Image src="/images/doctor-office.jpg" alt="Doctor scheduling appointment" fill className="object-cover" />
                    </motion.div>
                  )}
                  {activeTab === 2 && (
                    <motion.div key="img2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="absolute inset-0">
                      <Image src="/images/medical-pro.jpg" alt="Medical records" fill className="object-cover" />
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* Dark overlay */}
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(15,31,53,0.75) 0%, rgba(15,31,53,0.2) 100%)" }} />
              </div>
              <div className="p-7">
                <p className="text-white/40 text-[11px] font-bold uppercase tracking-wider mb-2">1 / 3</p>
                <h3 className="text-white font-black text-[20px] mb-3 leading-tight">
                  {activeTab === 0 && "We Provide Intelligent Queue Management for Hospitals"}
                  {activeTab === 1 && "Smart Appointment Booking with Instant Confirmation"}
                  {activeTab === 2 && "Secure Medical Records Attached to Every Visit"}
                </h3>
                <p className="text-white/50 text-[13px] leading-relaxed mb-6">
                  {activeTab === 0 && "Real-time WebSocket updates, QR tokens, and AI-powered wait time estimates. No lobby anxiety."}
                  {activeTab === 1 && "Patients book, reschedule, and cancel in seconds. Doctors see schedules update live."}
                  {activeTab === 2 && "Medical history is encrypted and attached to queue entries so doctors arrive prepared."}
                </p>
                <Link href={isSignedIn ? "/join-queue" : "/sign-up"} className="no-underline">
                  <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#0D0D0D] font-bold text-[13px] hover:bg-primary hover:text-white transition-all duration-200">
                    {isSignedIn ? "Get Started" : "Book Now"} <ArrowUpRight size={14} />
                  </button>
                </Link>
              </div>
            </motion.div>

            {/* Feature detail card */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" custom={1} viewport={{ once: true }}
              className="flex flex-col">
              <div className="mb-6">
                <h2 className="font-black text-[#0D0D0D] leading-tight mb-3" style={{ fontSize: "clamp(26px,3.5vw,38px)" }}>
                  Discover Excellence in{" "}
                  <span className="text-primary">Healthcare</span>,{" "}
                  Clinics & Technology
                </h2>
                <p className="text-[14px] text-[#777] leading-relaxed">
                  MediQueue combines real-time queue intelligence with clinical workflow tools — trusted by hospitals across 50+ cities.
                </p>
              </div>

              {/* Detail specs */}
              <div className="bg-white rounded-2xl border border-black/8 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-black/5">
                  <p className="text-[12px] font-bold text-[#888] uppercase tracking-wider mb-4">Platform Details</p>
                  {[
                    { label: "Queue Engine",    value: "WebSocket real-time, sub-second updates" },
                    { label: "Booking System",  value: "Multi-slot, conflict-free scheduling" },
                    { label: "Security",        value: "AES-256 encryption, HIPAA compliant" },
                    { label: "Availability",    value: "99.9% uptime SLA, 24/7 monitoring" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-4 mb-3 last:mb-0">
                      <span className="text-[13px] font-bold text-[#0D0D0D] w-28 shrink-0">{label}</span>
                      <span className="text-[13px] text-[#666]">: {value}</span>
                    </div>
                  ))}
                </div>
                <div className="p-5 grid grid-cols-1 xs:grid-cols-3 gap-3">
                  {[
                    { val: "38",  label: "In Queue",     color: "text-primary" },
                    { val: "214", label: "Served Today",  color: "text-blue-600" },
                    { val: "11m", label: "Avg Wait",      color: "text-green-600" },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "#F8F8F4" }}>
                      <div className={`text-[22px] font-black ${s.color}`}>{s.val}</div>
                      <div className="text-[10px] font-semibold text-[#888] mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────── */}
      <section id="how" className="py-20 sm:py-28" style={{ background: "#F2F2EE" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left: text */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <p className="text-[12px] font-bold text-primary uppercase tracking-widest mb-4">Simple Process</p>
              <h2 className="font-black text-[#0D0D0D] leading-tight mb-5" style={{ fontSize: "clamp(26px,5vw,44px)" }}>
                Choose the Right Care at the
                Perfect <span className="text-primary">Medical Facility</span>
              </h2>
              <p className="text-[15px] text-[#666] leading-relaxed mb-8">
                We are global leaders in healthcare queue technology, helping patients skip the wait in 50+ cities. Connect with us today and experience world-class care.
              </p>
              {/* Search bar */}
              <div ref={searchRef} className="relative max-w-[420px]">
                <form
                  onSubmit={e => { e.preventDefault(); handleSearchSubmit(); }}
                  className="flex items-center gap-2 bg-white border-2 border-black/10 rounded-full p-1.5 pl-4 shadow-sm focus-within:border-primary/50 focus-within:shadow-[0_0_0_3px_rgba(0,188,212,0.1)] transition-all duration-200"
                >
                  <Search size={16} className="text-[#aaa] shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => handleSearchChange(e.target.value)}
                    onFocus={() => searchQuery && setShowDropdown(true)}
                    placeholder="Search departments or hospitals..."
                    className="flex-1 bg-transparent text-[14px] text-[#0D0D0D] outline-none placeholder:text-[#bbb] min-w-0"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => { setSearchQuery(""); setShowDropdown(false); }}
                      className="text-[#bbb] hover:text-[#888] transition-colors shrink-0 px-1"
                    >
                      ✕
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-full bg-primary text-white text-[13px] font-bold shrink-0 hover:opacity-90 transition-opacity"
                  >
                    {isSignedIn ? "Search" : "Search"}
                  </button>
                </form>

                {/* Dropdown results */}
                {showDropdown && (
                  <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white rounded-2xl shadow-2xl border border-black/8 overflow-hidden z-50">
                    {searchResults.length > 0 ? (
                      <>
                        <div className="px-4 py-2.5 border-b border-black/5">
                          <p className="text-[11px] font-bold text-[#aaa] uppercase tracking-wider">Departments</p>
                        </div>
                        {searchResults.map((dept, i) => (
                          <button
                            key={dept.id ?? i}
                            type="button"
                            onClick={() => handleSelectResult(dept)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/5 hover:text-primary transition-colors text-left group"
                          >
                            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                              <Search size={13} className="text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-bold text-[#0D0D0D] group-hover:text-primary truncate">{dept.name}</p>
                              {dept.hospitals?.name && (
                                <p className="text-[11px] text-[#999]">{dept.hospitals.name}</p>
                              )}
                            </div>
                            <ArrowUpRight size={13} className="text-[#ccc] group-hover:text-primary ml-auto shrink-0" />
                          </button>
                        ))}
                        <div className="px-4 py-2.5 border-t border-black/5 bg-[#fafaf6]">
                          <button
                            type="button"
                            onClick={handleSearchSubmit}
                            className="text-[12px] font-bold text-primary hover:underline"
                          >
                            {isSignedIn ? "Book an appointment →" : "Sign in to book →"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="px-4 py-5 text-center">
                        <p className="text-[13px] text-[#888] mb-1">No departments found for <strong>&quot;{searchQuery}&quot;</strong></p>
                        <button
                          type="button"
                          onClick={handleSearchSubmit}
                          className="text-[12px] font-bold text-primary hover:underline"
                        >
                          {isSignedIn ? "Browse all departments →" : "Sign in to browse →"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>

            {/* Right: hospital image + floating card */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" custom={1}
              viewport={{ once: true }} className="relative">
              <div className="rounded-3xl overflow-hidden shadow-xl" style={{ height: "clamp(200px, 40vw, 380px)" }}>
                <Image src="/images/hospital.jpg" alt="Medical facility" fill className="object-cover" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 60%)" }} />
              </div>
              {/* Floating location card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5, ease: [0.16,1,0.3,1] }}
                viewport={{ once: true }}
                className="absolute bottom-6 left-6 bg-white rounded-2xl shadow-xl p-4 border border-black/5 max-w-[220px]">
                <div className="flex items-center gap-2 mb-1.5">
                  <MapPin size={14} className="text-primary" />
                  <span className="text-[12px] font-black text-[#0D0D0D]">Nearest Facility</span>
                </div>
                <p className="text-[11px] text-[#777] mb-2">City Medical Center, Block 4, Downtown</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-[11px] font-semibold text-green-600">Open · 8 doctors available</span>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Steps row below */}
          <div className="grid sm:grid-cols-3 gap-5 mt-12">
            {STEPS.map(({ step, icon: Icon, title, desc }, i) => (
              <motion.div key={step} variants={fadeUp} initial="hidden" whileInView="visible" custom={i}
                viewport={{ once: true, margin: "-60px" }}
                className="flex items-start gap-4 bg-white rounded-2xl p-5 border border-black/6 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon size={22} className="text-primary" />
                </div>
                <div>
                  <span className="text-[11px] font-black text-primary tracking-widest">{step}</span>
                  <h3 className="text-[15px] font-black text-[#0D0D0D] mb-1 mt-0.5">{title}</h3>
                  <p className="text-[13px] text-[#777] leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DOCTORS SECTION ────────────────────────────────── */}
      <section className="py-20 sm:py-28" style={{ background: "#FAFAF6" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8">

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            {/* Left: featured doctor card */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
              className="relative">
              <div className="rounded-3xl overflow-hidden relative" style={{ minHeight: "clamp(240px, 35vw, 300px)" }}>
                <Image
                  src="/images/doctor-patient.jpg"
                  alt="Doctor with patient"
                  fill
                  className="object-cover"
                />
                {/* Overlay gradient */}
                <div className="absolute bottom-0 left-0 right-0 h-40"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)" }} />
              </div>

              {/* Floating info card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5, ease: EXPO }}
                viewport={{ once: true }}
                className="absolute bottom-6 left-6 bg-white rounded-2xl shadow-xl p-4 border border-black/5 w-[200px]"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[11px] font-black">SM</div>
                  <div>
                    <p className="text-[12px] font-black text-[#0D0D0D]">Dr. Sarah M.</p>
                    <p className="text-[10px] text-[#888]">Cardiologist</p>
                  </div>
                </div>

                <p className="text-[10px] text-primary font-bold">Available Today</p>
              </motion.div>
            </motion.div>

            {/* Right: title + doctor list */}
            <div>
              <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-black text-[#0D0D0D] leading-tight" style={{ fontSize: "clamp(28px,4vw,44px)" }}>
                    Top Doctors, Ready<br />to <span className="text-primary">Serve You</span>
                  </h2>

                </div>
                <p className="text-[14px] text-[#777] leading-relaxed mb-8">
                  Our network of certified specialists are trained to diagnose, treat, and care for patients. They ensure health and well-being through preventative care and expert treatment.
                </p>
                <Link href={isSignedIn ? "/book-appointment" : "/sign-up"} className="no-underline">
                  <button className="flex items-center gap-2 px-7 py-3 rounded-full bg-primary text-white font-bold text-[14px] shadow-[0_4px_16px_rgba(0,188,212,0.3)] hover:-translate-y-0.5 transition-all duration-200 mb-8">
                    Book Now <ArrowUpRight size={15} />
                  </button>
                </Link>
              </motion.div>

              {/* Doctor cards list — real data */}
              <div className="space-y-3">
                {doctorsLoading ? (
                  [0,1,2].map(i => (
                    <div key={i} className="bg-white rounded-2xl p-4 border border-black/6 animate-pulse h-[80px]" />
                  ))
                ) : featuredDoctors.slice(0, 3).map((doc, i) => {
                  const initials = doc.name?.split(" ").filter(Boolean).slice(-2).map((w: string) => w[0]).join("") ?? "??";
                  const avatarColors = ["from-blue-100 to-blue-200","from-teal-100 to-teal-200","from-purple-100 to-purple-200"];
                  return (
                    <motion.div key={doc.id} variants={fadeUp} initial="hidden" whileInView="visible" custom={i}
                      viewport={{ once: true, margin: "-40px" }}
                      className={`bg-white rounded-2xl p-4 border-2 flex items-start gap-3 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${
                        i === 0 ? "border-primary/30" : "border-black/6"
                      }`}>
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColors[i % 3]} flex items-center justify-center text-[12px] font-black text-[#1e3a8a] shrink-0`}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-black text-[#0D0D0D] truncate">{doc.name}</p>
                        <p className="text-[11px] text-primary font-semibold mb-1">{doc.specialization}</p>
                        <p className="text-[11px] text-[#888] leading-relaxed line-clamp-2">
                          {doc.qualification}{doc.experience ? ` · ${doc.experience} yrs experience` : ""}
                        </p>
                      </div>

                    </motion.div>
                  );
                })}
                {!doctorsLoading && featuredDoctors.length === 0 && (
                  <p className="text-[13px] text-[#999] text-center py-6">No doctors found in the system yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BEST SPECIALISTS ───────────────────────────────── */}
      <section className="py-20 sm:py-28" style={{ background: "#F2F2EE" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="text-center mb-14">
            <h2 className="font-black text-[#0D0D0D] mb-4" style={{ fontSize: "clamp(28px,4vw,48px)" }}>Best Specialists</h2>
            <p className="text-[15px] text-[#777] max-w-[520px] mx-auto">
              We are global leaders in healthcare, serving patients in 50+ cities worldwide. Connect with us today and receive the best medical care.
            </p>
          </motion.div>

          {/* Real specialist cards */}
          {doctorsLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0,1,2].map(i => (
                <div key={i} className="bg-white rounded-3xl overflow-hidden border border-black/5 animate-pulse">
                  <div className="h-64 bg-gray-100" />
                  <div className="p-5 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                    <div className="h-3 bg-gray-100 rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : featuredDoctors.length === 0 ? (
            <p className="text-center text-[14px] text-[#999] py-10">No specialists found in the system yet.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {(() => {
                const imgs = ["/images/doctor-consult.jpg","/images/doctor-hero.jpg","/images/doctor-office.jpg","/images/doctor-patient.jpg","/images/medical-pro.jpg","/images/hospital.jpg"];
                return featuredDoctors.slice(0, 3).map((doc, i) => {
                  const initials = doc.name?.split(" ").filter(Boolean).slice(-2).map((w: string) => w[0]).join("") ?? "??";
                  return (
                    <motion.div key={doc.id} variants={fadeUp} initial="hidden" whileInView="visible" custom={i}
                      viewport={{ once: true, margin: "-60px" }}
                      className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-black/5 group">
                      {/* Image with initials overlay */}
                      <div className="relative h-64 overflow-hidden">
                        <Image src={imgs[i % imgs.length]} alt={doc.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 60%)" }} />

                        {/* Initials avatar overlay at bottom */}
                        <div className="absolute bottom-4 left-4 flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center text-[11px] font-black text-white">
                            {initials}
                          </div>
                          <div>
                            <p className="text-white text-[12px] font-black leading-tight">{doc.name}</p>
                            {doc.departments?.name && <p className="text-white/70 text-[10px]">{doc.departments.name}</p>}
                          </div>
                        </div>
                      </div>
                      {/* Info */}
                      <div className="p-5">
                        <p className="text-[13px] text-primary font-bold mb-2">{doc.specialization}</p>
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-[12px] font-bold text-[#0D0D0D] shrink-0">Qualification:</span>
                          <span className="text-[12px] text-[#666] line-clamp-1">{doc.qualification}</span>
                        </div>
                        {doc.experience > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-bold text-[#0D0D0D]">Experience:</span>
                            <span className="text-[12px] text-[#666]">{doc.experience} years</span>
                          </div>
                        )}
                        {doc.hospitals?.name && (
                          <p className="mt-2 text-[11px] text-[#aaa]">{doc.hospitals.name}</p>
                        )}
                      </div>
                    </motion.div>
                  );
                });
              })()}
            </div>
          )}

          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="flex justify-center mt-10">
            <Link href={isSignedIn ? "/book-appointment" : "/sign-up"} className="no-underline">
              <button className="flex items-center gap-2 px-7 py-3.5 rounded-full bg-primary text-white font-bold text-[14px] shadow-[0_4px_20px_rgba(0,188,212,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,188,212,0.4)] transition-all duration-200">
                Discover More Doctors <ArrowUpRight size={15} />
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── CTA BANNER ────────────────────────────────────── */}
      {!isSignedIn && (
        <section className="py-16 sm:py-24" style={{ background: "#FAFAF6" }}>
          <div className="max-w-5xl mx-auto px-5 sm:px-8">
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
              className="relative rounded-3xl overflow-hidden p-8 sm:p-14 text-center"
              style={{ background: "linear-gradient(135deg, #0097A7 0%, #0BC5EA 50%, #38BDF8 100%)" }}>
              {/* Decorative waves */}
              <svg className="absolute left-0 top-0 h-full opacity-20" viewBox="0 0 200 400" fill="none">
                <path d="M0 200 Q50 100 0 0 Q-50 100 0 200 Q50 300 0 400" stroke="white" strokeWidth="60" fill="none" />
              </svg>
              <div className="relative z-10">
                <h2 className="font-black text-white leading-tight mb-4" style={{ fontSize: "clamp(28px,4.5vw,52px)" }}>
                  Ready to Modernise<br />Your Hospital Experience?
                </h2>
                <p className="text-white/75 text-[15px] mb-8 max-w-[420px] mx-auto">
                  Join thousands of patients and hospitals already using MediQueue to eliminate waiting room chaos.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-[420px] mx-auto">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="flex-1 w-full px-5 py-3 rounded-full bg-white/20 border border-white/30 text-white placeholder:text-white/50 text-[14px] outline-none focus:bg-white/30 transition-colors"
                  />
                  <Link href="/sign-up" className="no-underline shrink-0">
                    <button className="px-6 py-3 rounded-full bg-white text-[#0097A7] font-black text-[14px] hover:bg-opacity-90 transition-all shadow-lg whitespace-nowrap">
                      Get Started Free
                    </button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── FOOTER ────────────────────────────────────────── */}
      <footer className="border-t pt-14 pb-8" style={{ background: "#FAFAF6", borderColor: "rgba(0,0,0,0.08)" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5 mb-12">
            {/* Brand */}
            <div className="sm:col-span-2">
              <div className="mb-4">
                <Link href="/" className="no-underline inline-block">
                  <Logo height={32} />
                </Link>
              </div>
              <p className="text-[14px] text-[#777] leading-[1.7] max-w-[280px] mb-5">
                The most trusted hospital queue management platform. Built to reduce wait anxiety and improve care outcomes.
              </p>

            </div>

            {/* Services */}
            <div>
              <p className="text-[11px] font-bold tracking-wider uppercase text-[#aaa] mb-4">Services</p>
              <ul className="space-y-2.5">
                {[
                  { href: "/join-queue",           label: "Queue Management" },
                  { href: "/book-appointment",     label: "Appointments" },
                  { href: "/digital-waiting-room", label: "Waiting Room" },
                  { href: "/medical-records",      label: "Medical Records" },
                ].map(({ href, label }) => (
                  <li key={label}>
                    <Link href={href} className="text-[14px] text-[#666] hover:text-primary transition-colors no-underline">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick Links */}
            <div>
              <p className="text-[11px] font-bold tracking-wider uppercase text-[#aaa] mb-4">Quick Links</p>
              <ul className="space-y-2.5">
                {[
                  { href: "/",        label: "Home" },
                  { href: "/sign-up", label: "Get Started" },
                  { href: "/sign-in", label: "Sign In" },
                  { href: "/admin",   label: "Admin Portal" },
                ].map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="text-[14px] text-[#666] hover:text-primary transition-colors no-underline">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>


          </div>

          <div className="pt-6 flex flex-wrap items-center justify-between gap-3" style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }}>
            <p className="text-[13px] text-[#aaa]">© {new Date().getFullYear()} MediQueue. All rights reserved.</p>
            <p className="text-[13px] text-[#bbb]">Built with care for modern healthcare</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

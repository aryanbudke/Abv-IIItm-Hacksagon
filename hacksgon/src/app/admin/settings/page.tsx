"use client";

import { useState } from "react";
import {
  Bell, Shield, Phone, Save, Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const sections = [
    {
      icon: Bell,
      title: "Notifications",
      desc: "Configure alert thresholds and notification channels",
      color: "text-amber-600",
      bg: "bg-amber-50",
      fields: [
        { label: "Queue Overload Threshold", key: "queue_threshold", type: "number", placeholder: "10", hint: "Alert when waiting patients exceed this number" },
        { label: "Alert Email", key: "alert_email", type: "email", placeholder: "admin@hospital.com", hint: "Receive system alerts at this address" },
      ],
    },
    {
      icon: Phone,
      title: "ElevenLabs AI Calling",
      desc: "AI voice agent configuration for automated patient calls",
      color: "text-primary",
      bg: "bg-primary/10",
      fields: [
        { label: "ElevenLabs Agent ID", key: "el_agent_id", type: "text", placeholder: "agent_xxx...", hint: "Your configured ElevenLabs agent ID" },
        { label: "Twilio Phone Number", key: "twilio_phone", type: "text", placeholder: "+12602503305", hint: "Outbound caller ID for AI calls" },
      ],
    },
    {
      icon: Shield,
      title: "Security",
      desc: "Access control and audit settings",
      color: "text-primary",
      bg: "bg-primary/10",
      fields: [
        { label: "Session Timeout (minutes)", key: "session_timeout", type: "number", placeholder: "60", hint: "Auto-logout inactive admin sessions after" },
      ],
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Platform configuration and preferences</p>
        </div>
        <Button
          onClick={handleSave}
          className={`gap-2 ${saved ? "bg-green-600 hover:bg-green-600" : ""}`}
        >
          {saved ? <><Check size={15} /> Saved!</> : <><Save size={15} /> Save Changes</>}
        </Button>
      </div>

      <div className="space-y-4 max-w-2xl">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title} className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${section.bg}`}>
                    <Icon size={17} className={section.color} />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground">{section.title}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">{section.desc}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4 space-y-4">
                {section.fields.map(field => (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">{field.label}</Label>
                    <Input
                      type={field.type}
                      placeholder={field.placeholder}
                      className="h-9 text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">{field.hint}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}

        {/* Environment info */}
        <Card className="border-border shadow-sm bg-muted">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Environment</p>
            <div className="space-y-2">
              {[
                { label: "Supabase", status: "Connected", color: "text-green-600", bg: "bg-green-50" },
                { label: "ElevenLabs", status: "Configured", color: "text-primary", bg: "bg-primary/10" },
                { label: "Twilio", status: "Active", color: "text-green-600", bg: "bg-green-50" },
                { label: "Clerk Auth", status: "Running", color: "text-green-600", bg: "bg-green-50" },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                  <Badge className={`${item.bg} ${item.color} border-transparent text-[10px] font-bold`}>
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

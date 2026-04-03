import { NextResponse } from "next/server";

const REQUIRED_CALL_ENV = [
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_AGENT_ID",
  "ELEVENLABS_PHONE_NUMBER_ID",
] as const;

export async function GET() {
  const missing = REQUIRED_CALL_ENV.filter(key => !process.env[key]);

  return NextResponse.json({
    configured: missing.length === 0,
    missing,
  });
}

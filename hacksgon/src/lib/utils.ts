import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateTokenNumber(hospitalId: string, date: string): number {
  const seed = (hospitalId + date).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return (seed % 9000) + 1000;
}

export function generatePatientId(): string {
  return `PT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
}

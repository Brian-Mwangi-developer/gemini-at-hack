import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

// Shallow-recursive equality: fast enough for UIMessage parts comparison.
export function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== "object" || typeof b !== "object") return false;
  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);
  if (aArr !== bArr) return false;
  if (aArr && bArr) {
    if ((a as unknown[]).length !== (b as unknown[]).length) return false;
    for (let i = 0; i < (a as unknown[]).length; i++) {
      if (!equal((a as unknown[])[i], (b as unknown[])[i])) return false;
    }
    return true;
  }
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!equal(aObj[key], bObj[key])) return false;
  }
  return true;
}


export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}


export const fetcher = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, {
    redirect: "follow",
    cache: "no-store",
    ...options
  });
  if (!res.ok) {
    let errorPayload;
    try {
      errorPayload = await res.json();
    } catch {
      errorPayload = { message: `Request failed with status ${res.status}` };
    }
    const error = new Error(
      errorPayload.message || "An error occurred while fetching the data.",
    );
    Object.assign(error, { info: errorPayload, status: res.status });
    throw error;
  }
  return res.json()
}
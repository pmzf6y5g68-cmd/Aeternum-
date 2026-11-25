import { NextResponse } from "next/server";

export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function jsonError(error: string, status = 400): NextResponse {
  return json({ error }, status);
}

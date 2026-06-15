import { NextResponse } from "next/server";
import { createLinkRow, findByCode } from "@/lib/db";

const CHARACTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateCode(): string {
  const values = new Uint8Array(6);
  crypto.getRandomValues(values);
  return Array.from(values)
    .map((v) => CHARACTERS[v % CHARACTERS.length])
    .join("");
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    const customAlias =
      typeof body?.customAlias === "string" ? body.customAlias.trim().toLowerCase() : "";

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    if (customAlias) {
      const validAlias = /^[a-z0-9-]+$/;
      if (!validAlias.test(customAlias) || customAlias.length < 2 || customAlias.length > 30) {
        return NextResponse.json({ error: "Invalid custom alias" }, { status: 400 });
      }

      const existing = await findByCode(customAlias);
      if (existing) {
        return NextResponse.json({ error: "Alias already taken" }, { status: 409 });
      }
    }

    const code = customAlias || generateCode();
    const base =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (request.headers.get("x-forwarded-host")
        ? `https://${request.headers.get("x-forwarded-host")}`
        : "");

    const row = await createLinkRow({
      code,
      url,
    });

    return NextResponse.json({
      shortUrl: `${base}/${code}`,
      originalUrl: row.url,
      shortCode: code,
      createdAt: row.createdAt,
    });
  } catch (error) {
    console.error("/api/shorten failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

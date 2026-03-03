import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";

export const dynamic = "force-dynamic";

function detectVersion(command: string): string {
  try {
    const raw = execSync(command, { encoding: "utf-8", timeout: 3000 }).trim();
    const match = raw.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : raw || "N/A";
  } catch {
    return "N/A";
  }
}

function getAppVersion(): string {
  try {
    const pkgPath = resolve(__dirname, "..", "..", "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version || process.env.NEXT_PUBLIC_APP_VERSION || "unknown";
  } catch {
    return process.env.NEXT_PUBLIC_APP_VERSION || "unknown";
  }
}

let cached: { app: string; babysitter: string } | null = null;

export async function GET() {
  if (!cached) {
    cached = {
      app: getAppVersion(),
      babysitter: detectVersion("babysitter --version"),
    };
  }
  return NextResponse.json(cached);
}

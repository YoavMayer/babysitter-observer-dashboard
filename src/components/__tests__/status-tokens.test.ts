/**
 * UX-R2 §13.3 semantic status color system — AC-38 (token presence + exact
 * values + COLUMN_SPECS token discipline) and AC-39 (CI-enforced WCAG
 * contrast guard). Owner gate 2026-07-05 run 01KWRR8XAHFCDEGCRBRFHFF44W:
 * 4-column taxonomy + color map (token values are final and carry the
 * measured ratios).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { COLUMN_SPECS } from "@/components/kanban/kanban-column";
import { GROUP_ORDER } from "@/components/kanban/column-model";

const GLOBALS_CSS = readFileSync(
  path.resolve(__dirname, "../../app/globals.css"),
  "utf-8"
);

/** §13.3 token table — dark theme (labels on #0a0a0b). */
const DARK_TOKENS: Record<string, string> = {
  "--status-attention": "#FFD700",
  "--status-attention-muted": "rgba(255, 215, 0, 0.15)",
  "--status-alive": "#00F0FF",
  "--status-alive-muted": "rgba(0, 240, 255, 0.12)",
  "--status-stalled": "#C9A86A",
  "--status-stalled-muted": "rgba(201, 168, 106, 0.14)",
  "--status-failed": "#FF3366",
  "--status-failed-muted": "rgba(255, 51, 102, 0.18)",
  "--status-ok": "#00FF88",
  "--status-ok-muted": "rgba(0, 255, 136, 0.15)",
  "--status-aged": "#9A9AA3",
  "--status-aged-muted": "rgba(154, 154, 163, 0.12)",
};

/** §13.3 token table — light theme (labels on #ffffff). */
const LIGHT_TOKENS: Record<string, string> = {
  // Live-verify 2026-07-05 (banner-segment-contrast-light): darkened from
  // #8a6d00 (4.12:1 on the composited error-muted banner tint) to #7e6400
  // (4.73:1 there, 5.66:1 on white) — §13.3 requires >=4.5:1 everywhere
  // the token labels text, including muted-tint surfaces.
  "--status-attention": "#7e6400",
  "--status-attention-muted": "rgba(212, 175, 0, 0.12)",
  "--status-alive": "#006E7A",
  "--status-alive-muted": "rgba(0, 200, 214, 0.10)",
  "--status-stalled": "#7A6431",
  "--status-stalled-muted": "rgba(122, 100, 49, 0.10)",
  "--status-failed": "#B01C47",
  "--status-failed-muted": "rgba(230, 41, 90, 0.12)",
  "--status-ok": "#00784A",
  "--status-ok-muted": "rgba(0, 204, 110, 0.12)",
  "--status-aged": "#63636C",
  "--status-aged-muted": "rgba(161, 161, 170, 0.10)",
};

/** Slice globals.css into the dark (:root) and light theme blocks. */
function themeBlock(theme: "dark" | "light"): string {
  const lightStart = GLOBALS_CSS.indexOf('[data-theme="light"]');
  expect(lightStart).toBeGreaterThan(-1);
  return theme === "dark"
    ? GLOBALS_CSS.slice(0, lightStart)
    : GLOBALS_CSS.slice(lightStart, GLOBALS_CSS.indexOf("@theme inline"));
}

/** Extract a custom property's declared value from a CSS block. */
function tokenValue(block: string, token: string): string | null {
  // Word-boundary guard: --status-attention must not match ...-muted.
  const match = block.match(
    new RegExp(`${token.replace(/[-]/g, "\\-")}\\s*:\\s*([^;]+);`)
  );
  return match ? match[1].trim() : null;
}

/** WCAG 2.x relative luminance of a #rrggbb color. */
function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  const channels = [0, 2, 4]
    .map((i) => parseInt(clean.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG contrast ratio between two #rrggbb colors. */
function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const LABEL_TOKENS = Object.keys(DARK_TOKENS).filter(
  (token) => !token.endsWith("-muted")
);

describe("UX-R2 §13.3 status tokens (AC-38)", () => {
  it("AC-38: the dark theme defines all 12 --status-* tokens with exactly the §13.3 values", () => {
    const block = themeBlock("dark");
    for (const [token, value] of Object.entries(DARK_TOKENS)) {
      expect(tokenValue(block, token), `dark ${token}`).toBe(value);
    }
  });

  it("AC-38: the light theme defines all 12 --status-* tokens with exactly the §13.3 values", () => {
    const block = themeBlock("light");
    for (const [token, value] of Object.entries(LIGHT_TOKENS)) {
      expect(tokenValue(block, token), `light ${token}`).toBe(value);
    }
  });

  it("AC-38: every --status-* token is exposed to Tailwind via @theme inline --color-status-*", () => {
    for (const token of Object.keys(DARK_TOKENS)) {
      const themed = `--color${token.slice(1)}: var(${token});`;
      expect(GLOBALS_CSS.includes(themed), themed).toBe(true);
    }
  });

  it("AC-38: COLUMN_SPECS header classes reference status tokens — no zinc hardcodes, no brand --primary, no alpha-diluted status text", () => {
    for (const key of GROUP_ORDER) {
      const headerClass = COLUMN_SPECS[key].headerClass;
      expect(headerClass, `${key} uses a status token`).toMatch(
        /^text-status-(attention|alive|stalled|failed|ok|aged)$/
      );
    }
    // Sweep every class string on the specs (headerClass, emptyClass, ...).
    const allClasses = GROUP_ORDER.flatMap((key) => {
      const spec = COLUMN_SPECS[key] as unknown as Record<string, unknown>;
      return Object.values(spec).filter((v): v is string => typeof v === "string");
    }).join(" ");
    expect(allClasses).not.toMatch(/text-zinc-/);
    expect(allClasses).not.toMatch(/text-primary/);
    expect(allClasses).not.toMatch(/text-(error|warning|success|info|status-[a-z]+)\/\d+/);
  });

  it("§13.3 red-is-terminal (static guard): no Stalled/Working/Needs-you spec class references error/failed red", () => {
    for (const key of ["needsyou", "waiting", "stalled"] as const) {
      const spec = COLUMN_SPECS[key] as unknown as Record<string, unknown>;
      const classes = Object.values(spec)
        .filter((v): v is string => typeof v === "string")
        .join(" ");
      expect(classes, `${key} never red`).not.toMatch(/text-(error|status-failed)/);
    }
  });
});

describe("UX-R2 §13.3 contrast guard (AC-39)", () => {
  it("AC-39: every dark label token clears 4.5:1 on the #0a0a0b background", () => {
    const block = themeBlock("dark");
    for (const token of LABEL_TOKENS) {
      const value = tokenValue(block, token);
      expect(value, `dark ${token} present`).toBeTruthy();
      const ratio = contrastRatio(value as string, "#0a0a0b");
      expect(ratio, `dark ${token} = ${value} → ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("AC-39: every light label token clears 4.5:1 on the #ffffff background", () => {
    const block = themeBlock("light");
    for (const token of LABEL_TOKENS) {
      const value = tokenValue(block, token);
      expect(value, `light ${token} present`).toBeTruthy();
      const ratio = contrastRatio(value as string, "#ffffff");
      expect(ratio, `light ${token} = ${value} → ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  // Live-verify 2026-07-05 (banner-segment-contrast-light): white-only checks
  // missed that --status-attention also labels text on composited muted tints.
  // Guard every light-theme surface the token actually sits on:
  //   #fce5eb = error-muted rgba(230,41,90,.12) over #fff (banner red segment)
  //   #faf5e0 = warning-muted rgba(212,175,0,.12) over #fff (NEEDS YOU panel,
  //             amber banner, run-list "Answer in terminal" badge)
  //   #f5edc5 = attention-muted over the warning-muted panel (option chips)
  //   #fbfbfb = background-secondary/40 over #fff (board column header)
  it("§13.3 live-verify guard: light --status-attention clears 4.5:1 on every composited surface it labels", () => {
    const block = themeBlock("light");
    const attention = tokenValue(block, "--status-attention");
    expect(attention, "light --status-attention present").toBeTruthy();
    const surfaces: Record<string, string> = {
      "error-muted banner segment": "#fce5eb",
      "warning-muted panel/badge": "#faf5e0",
      "attention-muted option chip on panel": "#f5edc5",
      "board column header": "#fbfbfb",
    };
    for (const [surface, bg] of Object.entries(surfaces)) {
      const ratio = contrastRatio(attention as string, bg);
      expect(
        ratio,
        `light --status-attention = ${attention} on ${surface} (${bg}) → ${ratio.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

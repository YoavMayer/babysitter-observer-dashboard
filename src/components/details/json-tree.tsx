"use client";

import { useState, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Clock,
  Hash,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/cn";
import type { TaskDetail } from "@/types";

/** Type guard for plain objects */
function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Unified copy button — size='sm' for inline JSON values, size='md' for metadata/findings */
function CopyButton({ value, size = "md", className: extraClass }: { value: string; size?: "sm" | "md"; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }).catch(() => {});
  };

  const sizeClasses = size === "sm"
    ? "h-4 w-4"
    : "min-h-[44px] min-w-[44px]";
  const iconClasses = size === "sm"
    ? "h-2.5 w-2.5"
    : "h-3 w-3";

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center justify-center rounded text-foreground-muted hover:text-primary hover:bg-primary-muted transition-all",
        sizeClasses,
        size === "sm" && "opacity-0 group-hover/json-row:opacity-100 ml-1",
        size === "md" && "shrink-0",
        extraClass,
      )}
      title="Copy"
    >
      {copied ? <Check className={cn(iconClasses, "text-success")} /> : <Copy className={iconClasses} />}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Primitive value renderer — neon brand colors                       */
/* ------------------------------------------------------------------ */

function PrimitiveValue({ value }: { value: unknown }) {
  if (value === null) {
    return <span className="text-foreground-muted italic">null</span>;
  }
  if (value === undefined) {
    return <span className="text-foreground-muted italic">undefined</span>;
  }
  if (typeof value === "string") {
    return <span className="text-success">&quot;{value}&quot;</span>;
  }
  if (typeof value === "number") {
    return <span className="text-warning">{String(value)}</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-primary">{String(value)}</span>;
  }
  // Fallback for anything unexpected
  return <span className="text-foreground-secondary">{String(value)}</span>;
}

/* ------------------------------------------------------------------ */
/*  Recursive JSON node                                                */
/* ------------------------------------------------------------------ */

interface JsonNodeProps {
  /** The key name to display (null for root or array elements) */
  keyName: string | null;
  /** The value to render */
  value: unknown;
  /** Whether to default to expanded */
  defaultExpanded?: boolean;
  /** Whether this is the last item in its parent (controls trailing comma) */
  isLast?: boolean;
}

function JsonNode({ keyName, value, defaultExpanded, isLast = true }: JsonNodeProps) {
  const isObject = value !== null && typeof value === "object" && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  // Determine default expanded state based on size thresholds
  const [expanded, setExpanded] = useState((): boolean => {
    if (defaultExpanded !== undefined) return defaultExpanded;
    if (isObject) {
      return Object.keys(value as Record<string, unknown>).length <= 10;
    }
    if (isArray) {
      return (value as unknown[]).length <= 5;
    }
    return true;
  });

  const toggle = () => setExpanded((prev) => !prev);

  // Key label prefix — neon cyan for keys
  const keyLabel = keyName !== null ? (
    <>
      <span className="text-secondary">{keyName}</span>
      <span className="text-foreground-muted">: </span>
    </>
  ) : null;

  // Leaf / primitive node
  if (!isExpandable) {
    const copyVal = typeof value === "string" ? value : JSON.stringify(value);
    return (
      <div className="group/json-row flex items-baseline py-px px-1 rounded hover:bg-background-secondary transition-colors">
        {keyLabel}
        <PrimitiveValue value={value} />
        {!isLast && <span className="text-foreground-muted">,</span>}
        <CopyButton value={copyVal} size="sm" />
      </div>
    );
  }

  // Object or Array node
  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);

  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";
  const itemCount = entries.length;
  const countLabel = isArray
    ? `${itemCount} item${itemCount !== 1 ? "s" : ""}`
    : `${itemCount} key${itemCount !== 1 ? "s" : ""}`;

  return (
    <div>
      {/* Toggle row */}
      <div
        className="flex items-baseline py-0.5 px-1 rounded cursor-pointer hover:bg-background-secondary transition-colors select-none"
        onClick={toggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 text-primary transition-transform duration-150 mr-1 relative top-[1px]",
            expanded && "rotate-90"
          )}
        />
        {keyLabel}
        <span className="text-foreground-muted">{openBracket}</span>
        {!expanded && (
          <>
            <span className="mx-1 text-xs leading-tight text-foreground-muted bg-background-tertiary px-1.5 py-0.5 rounded">
              {countLabel}
            </span>
            <span className="text-foreground-muted">{closeBracket}</span>
            {!isLast && <span className="text-foreground-muted">,</span>}
          </>
        )}
      </div>

      {/* Children */}
      {expanded && (
        <div className="animate-[fadeIn_100ms_ease-out]">
          <div className="pl-4 border-l border-primary/20 ml-1.5">
            {entries.map(([key, val], idx) => (
              <JsonNode
                key={key}
                keyName={isArray ? null : key}
                value={val}
                isLast={idx === entries.length - 1}
              />
            ))}
            {itemCount === 0 && (
              <div className="py-px px-1 text-foreground-muted italic">empty</div>
            )}
          </div>
          <div className="flex items-baseline py-px px-1">
            <span className="text-foreground-muted">{closeBracket}</span>
            {!isLast && <span className="text-foreground-muted">,</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Standalone JsonTreeView (generic, works with any data)             */
/* ------------------------------------------------------------------ */

interface JsonTreeViewProps {
  data: unknown;
  defaultExpanded?: boolean;
}

export function JsonTreeView({ data, defaultExpanded }: JsonTreeViewProps) {
  if (data === undefined || data === null) {
    return <span className="text-foreground-muted">{String(data ?? "null")}</span>;
  }
  return (
    <div className="font-mono text-xs">
      <JsonNode keyName={null} value={data} defaultExpanded={defaultExpanded} isLast />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Data categorization — splits an object into smart sections          */
/* ------------------------------------------------------------------ */

/** Known array keys that represent "findings"-style lists of strings */
const FINDINGS_KEYS = new Set([
  "findings",
  "issues",
  "recommendations",
  "errors",
  "warnings",
  "notes",
  "suggestions",
  "problems",
  "improvements",
  "todos",
  "comments",
  "messages",
]);

interface CategorizedData {
  status: string | null;
  score: number | null;
  passesQuality: boolean | null;
  booleans: Array<{ key: string; value: boolean }>;
  findings: Array<{ key: string; items: string[] }>;
  summary: string | null;
  taskId: string | null;
  metadata: Array<{ key: string; value: unknown }>;
}

function categorizeData(data: unknown): CategorizedData {
  const result: CategorizedData = {
    status: null,
    score: null,
    passesQuality: null,
    booleans: [],
    findings: [],
    summary: null,
    taskId: null,
    metadata: [],
  };

  if (!isRecord(data)) {
    return result;
  }

  const obj = data;
  const consumed = new Set<string>();

  // Status
  if ("status" in obj && typeof obj.status === "string") {
    result.status = obj.status;
    consumed.add("status");
  }

  // Score
  if ("score" in obj && typeof obj.score === "number") {
    result.score = obj.score;
    consumed.add("score");
  }

  // passesQuality
  if ("passesQuality" in obj && typeof obj.passesQuality === "boolean") {
    result.passesQuality = obj.passesQuality;
    consumed.add("passesQuality");
  }

  // Summary
  if ("summary" in obj && typeof obj.summary === "string") {
    result.summary = obj.summary;
    consumed.add("summary");
  }

  // TaskId
  if ("taskId" in obj && typeof obj.taskId === "string") {
    result.taskId = obj.taskId;
    consumed.add("taskId");
  }

  // Collect booleans and findings
  for (const [key, val] of Object.entries(obj)) {
    if (consumed.has(key)) continue;

    // Boolean fields (excluding passesQuality already consumed)
    if (typeof val === "boolean") {
      result.booleans.push({ key, value: val });
      consumed.add(key);
      continue;
    }

    // Findings: arrays of strings with recognized key names
    if (
      Array.isArray(val) &&
      val.length > 0 &&
      val.every((item) => typeof item === "string") &&
      FINDINGS_KEYS.has(key.toLowerCase())
    ) {
      result.findings.push({ key, items: val as string[] });
      consumed.add(key);
      continue;
    }
  }

  // If fewer than 2 booleans, move them back to metadata
  if (result.booleans.length < 2) {
    // Don't render boolean grid — push to metadata
    for (const b of result.booleans) {
      result.metadata.push({ key: b.key, value: b.value });
    }
    result.booleans = [];
  }

  // Everything else goes to metadata
  for (const [key, val] of Object.entries(obj)) {
    if (!consumed.has(key)) {
      result.metadata.push({ key, value: val });
    }
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Smart Summary Components                                            */
/* ------------------------------------------------------------------ */

/** SmartSectionHeader — reusable section header with consistent styling */
function SmartSectionHeader({ children, className: extraClass }: { children: React.ReactNode; className?: string }) {
  return (
    <h4 className={cn("text-xs font-medium text-foreground-muted tracking-wider uppercase pl-2 border-l-2 border-primary", extraClass)}>
      {children}
    </h4>
  );
}

/** Status pill — colored dot + text */
function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const isOk =
    normalized === "ok" ||
    normalized === "success" ||
    normalized === "resolved" ||
    normalized === "completed" ||
    normalized === "pass";
  const isError =
    normalized === "error" ||
    normalized === "failed" ||
    normalized === "fail" ||
    normalized === "rejected";
  const isPending =
    normalized === "pending" ||
    normalized === "waiting" ||
    normalized === "running" ||
    normalized === "requested";

  const dotColor = isOk
    ? "bg-success"
    : isError
      ? "bg-error"
      : isPending
        ? "bg-warning"
        : "bg-foreground-muted";

  const textColor = isOk
    ? "text-success"
    : isError
      ? "text-error"
      : isPending
        ? "text-warning"
        : "text-foreground-secondary";

  const bgColor = isOk
    ? "bg-success-muted"
    : isError
      ? "bg-error-muted"
      : isPending
        ? "bg-warning-muted"
        : "bg-background-tertiary";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium",
        bgColor,
        textColor
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full animate-pulse-dot", dotColor)}
      />
      {status}
    </span>
  );
}

/** Score bar — colored progress indicator */
function ScoreBar({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color =
    clamped < 50 ? "bg-error" : clamped < 80 ? "bg-warning" : "bg-success";
  const glowShadow =
    clamped < 50
      ? "shadow-progress-glow-error"
      : clamped < 80
        ? "shadow-progress-glow-warning"
        : "shadow-progress-glow-success";
  const textColor =
    clamped < 50
      ? "text-error"
      : clamped < 80
        ? "text-warning"
        : "text-success";

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <span className={cn("text-[11px] font-mono font-bold", textColor)}>
        {score}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-background-tertiary overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color, glowShadow)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs text-foreground-muted">/100</span>
    </div>
  );
}

/** Quality pass/fail badge */
function QualityBadge({ passes }: { passes: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium",
        passes
          ? "bg-success-muted text-success"
          : "bg-error-muted text-error"
      )}
    >
      {passes ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <XCircle className="h-3 w-3" />
      )}
      {passes ? "Pass" : "Fail"}
    </span>
  );
}

/** At-a-Glance Header Bar */
function AtAGlanceHeader({
  status,
  score,
  passesQuality,
  taskId,
}: {
  status: string | null;
  score: number | null;
  passesQuality: boolean | null;
  taskId: string | null;
}) {
  const hasAny =
    status !== null ||
    score !== null ||
    passesQuality !== null ||
    taskId !== null;
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-background-secondary/60 border border-border/50 px-3 py-2">
      {status !== null && <StatusPill status={status} />}
      {score !== null && <ScoreBar score={score} />}
      {passesQuality !== null && <QualityBadge passes={passesQuality} />}
      {taskId !== null && (
        <span className="flex items-center gap-1 text-[11px] text-foreground-muted font-mono">
          <Hash className="h-3 w-3" />
          <span title={taskId}>
            {taskId.length > 12
              ? taskId.slice(0, 6) + "\u2026" + taskId.slice(-4)
              : taskId}
          </span>
          <CopyButton value={taskId} />
        </span>
      )}
    </div>
  );
}

/** Boolean Flags Grid */
function BooleanFlagsGrid({
  booleans,
}: {
  booleans: Array<{ key: string; value: boolean }>;
}) {
  if (booleans.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <SmartSectionHeader>Flags</SmartSectionHeader>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {booleans.map(({ key, value }) => (
          <div
            key={key}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-colors",
              value
                ? "bg-success-muted/50 border-success/20 text-success"
                : "bg-background-tertiary/50 border-border/30 text-foreground-muted"
            )}
          >
            {value ? (
              <CheckCircle2 className="h-3 w-3 shrink-0" />
            ) : (
              <XCircle className="h-3 w-3 shrink-0" />
            )}
            <span className="truncate">{formatLabel(key)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Format a camelCase or snake_case key into a readable label */
function formatLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Single finding card with truncation + expand */
function FindingCard({
  index,
  text,
  isWarning,
}: {
  index: number;
  text: string;
  isWarning: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 120;
  const display = isLong && !expanded ? text.slice(0, 120) + "\u2026" : text;

  const Icon = isWarning ? AlertTriangle : Info;
  const iconColor = isWarning ? "text-warning" : "text-info";

  return (
    <div className="group/finding flex items-start gap-2 rounded-md bg-background-secondary/50 border border-border/40 px-3 py-2 transition-colors hover:border-border-hover/60">
      <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", iconColor)} />
      <div className="flex-1 min-w-0">
        <span className="text-[11px] text-foreground-muted font-mono mr-1.5">
          {index}.
        </span>
        <span className="text-xs text-foreground-secondary leading-relaxed">
          {display}
        </span>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="ml-1 text-xs text-primary hover:text-primary-hover transition-colors min-h-[44px] inline-flex items-center"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
      <span className="opacity-0 group-hover/finding:opacity-100 transition-opacity">
        <CopyButton value={text} />
      </span>
    </div>
  );
}

/** Findings / Issues Section */
function FindingsSection({
  findings,
}: {
  findings: Array<{ key: string; items: string[] }>;
}) {
  if (findings.length === 0) return null;

  const warningKeys = new Set([
    "issues",
    "errors",
    "warnings",
    "problems",
  ]);

  return (
    <>
      {findings.map(({ key, items }) => {
        const isWarning = warningKeys.has(key.toLowerCase());
        const Icon = isWarning ? AlertTriangle : Info;
        const iconColor = isWarning ? "text-warning" : "text-info";

        return (
          <div key={key} className="space-y-1.5">
            <SmartSectionHeader className="flex items-center gap-1.5">
              <Icon className={cn("h-3 w-3", iconColor)} />
              {formatLabel(key)}
              <span className="ml-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary-muted text-primary text-xs font-bold">
                {items.length}
              </span>
            </SmartSectionHeader>
            <div className="space-y-1">
              {items.map((item, i) => (
                <FindingCard
                  key={`${key}-${i}`}
                  index={i + 1}
                  text={item}
                  isWarning={isWarning}
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Summary Block — quote/info style card */
function SummaryBlock({ summary }: { summary: string }) {
  return (
    <div className="space-y-1.5">
      <SmartSectionHeader>Summary</SmartSectionHeader>
      <div className="rounded-md bg-background-secondary/50 border border-border/40 border-l-[3px] border-l-secondary px-3 py-2.5">
        <p className="text-xs text-foreground-secondary leading-relaxed">
          {summary}
        </p>
      </div>
    </div>
  );
}

/** Format a timestamp as relative time with full ISO on hover */
function formatRelativeTime(value: string): { relative: string; full: string } | null {
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;

  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let relative: string;
  if (seconds < 60) relative = `${seconds}s ago`;
  else if (minutes < 60) relative = `${minutes}m ago`;
  else if (hours < 24) relative = `${hours}h ago`;
  else relative = `${days}d ago`;

  return { relative, full: date.toISOString() };
}

/** Check if a string looks like an ISO timestamp */
function isTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) || /^\d{4}-\d{2}-\d{2} /.test(value);
}

/** Check if a string looks like an ID (long hex, uuid, etc.) */
function isIdLike(value: string): boolean {
  return /^[a-f0-9-]{16,}$/i.test(value) || /^[a-zA-Z0-9_-]{20,}$/.test(value);
}

/** Metadata Grid — compact 2-column key-value layout */
function MetadataGrid({
  metadata,
}: {
  metadata: Array<{ key: string; value: unknown }>;
}) {
  if (metadata.length === 0) return null;

  // Separate simple (primitive) values from complex (object/array) values
  const simpleEntries = metadata.filter(
    ({ value }) =>
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
  );
  const complexEntries = metadata.filter(
    ({ value }) =>
      typeof value === "object" && value !== null
  );

  return (
    <div className="space-y-1.5">
      <SmartSectionHeader>Metadata</SmartSectionHeader>
      {simpleEntries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-background-secondary/50 border border-border/40 px-3 py-2">
          {simpleEntries.map(({ key, value }) => (
            <MetadataRow key={key} label={key} value={value} />
          ))}
        </div>
      )}
      {complexEntries.map(({ key, value }) => (
        <div key={key} className="rounded-md bg-background-secondary/50 border border-border/40 px-3 py-2">
          <div className="text-xs text-foreground-muted uppercase tracking-wider mb-1">
            {formatLabel(key)}
          </div>
          <div className="font-mono text-xs">
            <JsonNode keyName={null} value={value} isLast />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Single metadata row */
function MetadataRow({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  const strVal = value === null ? "null" : String(value);

  // Timestamp formatting
  if (typeof value === "string" && isTimestamp(value)) {
    const rel = formatRelativeTime(value);
    if (rel) {
      return (
        <div className="flex items-baseline gap-2 py-0.5 min-w-0">
          <span className="text-xs text-foreground-muted uppercase tracking-wider shrink-0">
            {formatLabel(label)}
          </span>
          <span
            className="text-xs text-foreground-secondary font-mono flex items-center gap-1 truncate"
            title={rel.full}
          >
            <Clock className="h-2.5 w-2.5 shrink-0 text-foreground-muted" />
            {rel.relative}
          </span>
        </div>
      );
    }
  }

  // ID-like values — truncate + copy
  if (typeof value === "string" && isIdLike(value)) {
    const truncated =
      value.length > 16
        ? value.slice(0, 8) + "\u2026" + value.slice(-4)
        : value;
    return (
      <div className="flex items-baseline gap-2 py-0.5 min-w-0">
        <span className="text-xs text-foreground-muted uppercase tracking-wider shrink-0">
          {formatLabel(label)}
        </span>
        <span
          className="text-xs text-foreground-secondary font-mono truncate"
          title={value}
        >
          {truncated}
        </span>
        <CopyButton value={value} />
      </div>
    );
  }

  // Boolean in metadata (from the < 2 fallback)
  if (typeof value === "boolean") {
    return (
      <div className="flex items-baseline gap-2 py-0.5 min-w-0">
        <span className="text-xs text-foreground-muted uppercase tracking-wider shrink-0">
          {formatLabel(label)}
        </span>
        <span
          className={cn(
            "text-xs font-mono",
            value ? "text-success" : "text-error"
          )}
        >
          {String(value)}
        </span>
      </div>
    );
  }

  // Default
  return (
    <div className="flex items-baseline gap-2 py-0.5 min-w-0">
      <span className="text-xs text-foreground-muted uppercase tracking-wider shrink-0">
        {formatLabel(label)}
      </span>
      <span className="text-xs text-foreground-secondary font-mono truncate" title={strVal}>
        {strVal.length > 60 ? strVal.slice(0, 60) + "\u2026" : strVal}
      </span>
    </div>
  );
}

/** Collapsible Raw JSON section */
function CollapsibleRawJson({ data }: { data: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyAll = () => {
    try {
      const text = JSON.stringify(data, null, 2);
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }).catch(() => {});
    } catch {
      // JSON.stringify can throw on circular references
    }
  };

  return (
    <div className="space-y-0">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((p) => !p)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded((p) => !p); }
        }}
        className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md hover:bg-background-secondary/50 transition-colors group cursor-pointer select-none"
      >
        <ChevronDown
          className={cn(
            "h-3 w-3 text-primary transition-transform duration-150",
            !expanded && "-rotate-90"
          )}
        />
        <span className="text-xs font-medium text-foreground-muted tracking-wider uppercase">
          Raw JSON
        </span>
        {!expanded && (
          <span className="text-xs text-foreground-muted">
            (click to expand)
          </span>
        )}
        {expanded && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyAll();
            }}
            className="ml-auto inline-flex items-center gap-1 text-xs text-foreground-muted hover:text-primary transition-colors px-1.5 py-0.5 rounded"
            title="Copy all JSON"
          >
            {copied ? (
              <Check className="h-3 w-3 text-success" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            Copy All
          </button>
        )}
      </div>
      {expanded && (
        <div className="animate-[fadeIn_100ms_ease-out] rounded-md bg-background-secondary p-3 mt-1">
          <JsonTreeView data={data} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  JsonTree — Smart Data View (main export)                            */
/* ------------------------------------------------------------------ */

export function JsonTree({ task }: { task: TaskDetail | null }) {
  const [showInput, setShowInput] = useState(true);

  const activeData = showInput ? task?.input : task?.result;

  const categorized = useMemo(
    () => categorizeData(activeData),
    [activeData]
  );

  if (!task) {
    return (
      <div className="p-4 text-sm text-foreground-muted">
        Select a task to view data
      </div>
    );
  }

  const hasData = task.input || task.result;
  if (!hasData) {
    return (
      <div className="p-4 text-sm text-foreground-muted">
        No I/O data for this task
      </div>
    );
  }

  const isPrimitive =
    activeData === null ||
    activeData === undefined ||
    typeof activeData !== "object" ||
    Array.isArray(activeData);

  return (
    <div className="p-4">
      {/* 1. Input/Output Toggle */}
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setShowInput(true)}
          className={cn(
            "text-xs px-3 py-1 min-h-[44px] rounded transition-colors",
            showInput
              ? "bg-primary-muted text-primary"
              : "text-foreground-muted hover:text-foreground-secondary"
          )}
        >
          Input
        </button>
        <button
          type="button"
          onClick={() => setShowInput(false)}
          className={cn(
            "text-xs px-3 py-1 min-h-[44px] rounded transition-colors",
            !showInput
              ? "bg-primary-muted text-primary"
              : "text-foreground-muted hover:text-foreground-secondary"
          )}
        >
          Output
        </button>
      </div>

      <ScrollArea>
        {isPrimitive ? (
          /* For non-object data, just show the raw tree */
          <div className="rounded-md bg-background-secondary p-3">
            <JsonTreeView data={activeData} />
          </div>
        ) : (
          <div className="space-y-3">
            {/* 2. At-a-Glance Header Bar */}
            <AtAGlanceHeader
              status={categorized.status}
              score={categorized.score}
              passesQuality={categorized.passesQuality}
              taskId={categorized.taskId}
            />

            {/* 3. Boolean Flags Grid */}
            <BooleanFlagsGrid booleans={categorized.booleans} />

            {/* 4. Findings / Issues Section */}
            <FindingsSection findings={categorized.findings} />

            {/* 5. Summary Block */}
            {categorized.summary && (
              <SummaryBlock summary={categorized.summary} />
            )}

            {/* 6. Metadata Section */}
            <MetadataGrid metadata={categorized.metadata} />

            {/* 7. Collapsible Raw JSON */}
            <CollapsibleRawJson data={activeData} />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { ChevronRight, Copy, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/cn";
import type { TaskDetail } from "@/types";

/** Tiny copy button shown on hover — magenta hover glow */
function ValueCopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="opacity-0 group-hover/json-row:opacity-100 inline-flex items-center justify-center h-4 w-4 rounded text-foreground-muted hover:text-primary hover:bg-primary-muted transition-all ml-1"
      title="Copy value"
    >
      {copied ? <Check className="h-2.5 w-2.5 text-success" /> : <Copy className="h-2.5 w-2.5" />}
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
  const computeDefaultExpanded = useCallback((): boolean => {
    if (defaultExpanded !== undefined) return defaultExpanded;
    if (isObject) {
      return Object.keys(value as Record<string, unknown>).length <= 10;
    }
    if (isArray) {
      return (value as unknown[]).length <= 5;
    }
    return true;
  }, [defaultExpanded, isObject, isArray, value]);

  const [expanded, setExpanded] = useState(computeDefaultExpanded);

  const toggle = useCallback(() => setExpanded((prev) => !prev), []);

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
        <ValueCopyButton value={copyVal} />
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
        className="flex items-baseline py-px px-1 rounded cursor-pointer hover:bg-background-secondary transition-colors select-none"
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
            <span className="mx-1 text-[10px] leading-tight text-foreground-muted bg-background-tertiary px-1.5 py-0.5 rounded">
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
/*  JsonTree — drop-in replacement for the task data tab               */
/* ------------------------------------------------------------------ */

/** Extract a human-readable summary from a JSON object */
function summarizeData(data: unknown, label: "Input" | "Output"): string | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  const parts: string[] = [];

  // For output: look for common result patterns
  if (label === "Output") {
    if ("summary" in obj && typeof obj.summary === "string") {
      return obj.summary;
    }
    if ("score" in obj && typeof obj.score === "number") {
      parts.push(`Score: ${obj.score}/100`);
    }
    if ("status" in obj && typeof obj.status === "string") {
      parts.push(`Status: ${obj.status}`);
    }
    if ("filesCreated" in obj && Array.isArray(obj.filesCreated)) {
      parts.push(`${obj.filesCreated.length} file(s) created`);
    }
    if ("filesModified" in obj && Array.isArray(obj.filesModified)) {
      parts.push(`${obj.filesModified.length} file(s) modified`);
    }
    if ("fixesApplied" in obj && Array.isArray(obj.fixesApplied)) {
      parts.push(`${obj.fixesApplied.length} fix(es) applied`);
    }
    if ("issues" in obj && Array.isArray(obj.issues)) {
      parts.push(`${obj.issues.length} issue(s) found`);
    }
    if ("synced" in obj) parts.push(`Synced: ${obj.synced ? "yes" : "no"}`);
    if ("serverUp" in obj) parts.push(`Server: ${obj.serverUp ? "up" : "down"}`);
  }

  // For input: summarize key parameters
  if (label === "Input") {
    if ("requirements" in obj && Array.isArray(obj.requirements)) {
      parts.push(`${obj.requirements.length} requirement(s)`);
    }
    if ("observerSrcPath" in obj) parts.push("Source path provided");
    if ("iteration" in obj) parts.push(`Iteration ${obj.iteration}`);
    if ("spec" in obj) parts.push("Architecture spec included");
    if ("issues" in obj && Array.isArray(obj.issues)) {
      parts.push(`${obj.issues.length} issue(s) to address`);
    }
  }

  // Generic: count top-level keys
  const keyCount = Object.keys(obj).length;
  if (parts.length === 0) {
    parts.push(`${keyCount} field${keyCount !== 1 ? "s" : ""}`);
  }

  return parts.join(" · ");
}

export function JsonTree({ task }: { task: TaskDetail | null }) {
  const [showInput, setShowInput] = useState(true);

  if (!task) {
    return (
      <div className="p-4 text-sm text-foreground-muted">Select a task to view data</div>
    );
  }

  const hasData = task.input || task.result;
  if (!hasData) {
    return (
      <div className="p-4 text-sm text-foreground-muted">No I/O data for this task</div>
    );
  }

  const activeData = showInput ? task.input : task.result;
  const activeLabel = showInput ? "Input" as const : "Output" as const;
  const summary = summarizeData(activeData, activeLabel);

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setShowInput(true)}
          className={cn(
            "text-xs px-2 py-1 rounded transition-colors",
            showInput
              ? "bg-primary-muted text-primary"
              : "text-foreground-muted hover:text-foreground-secondary"
          )}
        >
          Input
        </button>
        <button
          onClick={() => setShowInput(false)}
          className={cn(
            "text-xs px-2 py-1 rounded transition-colors",
            !showInput
              ? "bg-primary-muted text-primary"
              : "text-foreground-muted hover:text-foreground-secondary"
          )}
        >
          Output
        </button>
      </div>

      {/* Summary line */}
      {summary && (
        <div className="mb-2 text-xs text-foreground-secondary bg-background-secondary/50 rounded-md px-3 py-2 border border-border/50">
          {summary}
        </div>
      )}

      <ScrollArea className="max-h-64">
        <div className="rounded-md bg-background-secondary p-3">
          <JsonTreeView data={activeData} />
        </div>
      </ScrollArea>
    </div>
  );
}

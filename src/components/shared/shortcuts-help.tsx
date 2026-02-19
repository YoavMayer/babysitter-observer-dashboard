"use client";
import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Kbd } from "./kbd";
import { X } from "lucide-react";
import { useKeyboard } from "@/hooks/use-keyboard";

const shortcuts = [
  { keys: ["j"], description: "Next item" },
  { keys: ["k"], description: "Previous item" },
  { keys: ["Enter"], description: "Open selected" },
  { keys: ["Esc"], description: "Go back / Close" },
  { keys: ["e"], description: "Toggle event stream" },
  { keys: ["n"], description: "Toggle notifications" },
  { keys: ["?"], description: "Show this help" },
  { keys: ["/"], description: "Focus search" },
  { keys: ["1"], description: "Agent tab" },
  { keys: ["2"], description: "Timing tab" },
  { keys: ["3"], description: "Logs tab" },
  { keys: ["4"], description: "Data tab" },
  { keys: ["5"], description: "Approval tab" },
  { keys: ["a"], description: "Approve request" },
  { keys: ["r"], description: "Reject request" },
];

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useKeyboard([
    { key: "?", action: () => setOpen(true), description: "Show shortcuts help" },
    { key: "Escape", action: () => setOpen(false), description: "Close shortcuts help" },
  ]);

  // Allow external components to open the shortcuts panel via custom event
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-shortcuts-help", handler);
    return () => window.removeEventListener("open-shortcuts-help", handler);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl p-6 shadow-glass w-full max-w-md"
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-sm font-medium text-foreground">Keyboard Shortcuts</Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded-md p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-foreground-muted hover:text-primary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="space-y-2">
            {shortcuts.map(({ keys, description }) => (
              <div key={description} className="flex items-center justify-between py-1">
                <span className="text-sm text-foreground-secondary">{description}</span>
                <div className="flex items-center gap-1">
                  {keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

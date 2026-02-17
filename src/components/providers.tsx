"use client";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { EventStreamProvider } from "@/components/providers/event-stream-provider";
import { ShortcutsHelp } from "@/components/shared/shortcuts-help";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <EventStreamProvider>
          {children}
          <ShortcutsHelp />
        </EventStreamProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

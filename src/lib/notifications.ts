// Browser-level notifications for new orders (admin/accountant)
// Uses the Notification API. Works while the browser is open in any tab,
// even when the tab is in the background or the screen is locked (OS-dependent).
// True out-of-browser push (closed browser) needs Web Push + VAPID + a push service —
// not implemented here.

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "default") {
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }
  return Notification.permission;
}

interface ShowOpts {
  title: string;
  body: string;
  tag?: string;
  onClick?: () => void;
}

export function showOrderNotification({ title, body, tag, onClick }: ShowOpts) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      tag: tag ?? "fresh-order",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      requireInteraction: false,
      silent: false,
    });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
    // Auto-close after 12s
    setTimeout(() => n.close(), 12_000);
  } catch (e) {
    console.warn("Notification failed", e);
  }
}

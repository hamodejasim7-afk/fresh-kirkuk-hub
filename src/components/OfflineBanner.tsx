import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export default function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (online) return null;

  return (
    <div
      dir="rtl"
      role="status"
      className="fixed top-0 inset-x-0 z-[110] flex items-center justify-center gap-2 bg-destructive px-3 py-2 text-xs font-medium text-destructive-foreground shadow-md"
    >
      <WifiOff className="h-4 w-4" />
      <span>أنت غير متصل بالإنترنت — بعض الميزات قد لا تعمل</span>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "fresh_pwa_install_dismissed";

export default function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    // already installed?
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS
      window.navigator.standalone === true;
    if (isStandalone) return;

    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (!isMobile) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setTimeout(() => setShow(true), 3000);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS Safari has no beforeinstallprompt — show informational banner anyway
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      const t = setTimeout(() => setShow(true), 3000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBIP);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShow(false);
  };

  if (!show) return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <div
      dir="rtl"
      className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-md rounded-2xl border bg-card p-4 shadow-2xl animate-in slide-in-from-bottom-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white">
          <Download className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-sm">ثبّت تطبيق فريش Fresh</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {isIOS
              ? 'اضغط على زر المشاركة ثم "إضافة إلى الشاشة الرئيسية" لتثبيت التطبيق.'
              : "أضف التطبيق إلى شاشتك الرئيسية للوصول السريع والعمل بدون إنترنت."}
          </p>
          <div className="mt-3 flex gap-2">
            {!isIOS && deferred && (
              <Button size="sm" onClick={install} className="bg-orange-500 hover:bg-orange-600">
                تثبيت الآن
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={dismiss}>
              لاحقاً
            </Button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="إغلاق"
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

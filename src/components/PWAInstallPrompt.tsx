import { useEffect, useState } from "react";
import { Download, X, Share, PlusSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "fresh_pwa_install_dismissed";
const IOS_DISMISS_KEY = "fresh_ios_install_guide_dismissed";

export default function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS
      window.navigator.standalone === true;

    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/chrome/i.test(ua);
    const isAndroid = /android/i.test(ua);

    if (isStandalone) return;

    // iOS Safari install guide
    if (isIOS && isSafari && !localStorage.getItem(IOS_DISMISS_KEY)) {
      const t = setTimeout(() => setShowIOS(true), 3000);
      return () => clearTimeout(t);
    }

    // Android install prompt
    if (!isAndroid) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setTimeout(() => setShowAndroid(true), 3000);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  const dismissAndroid = () => {
    setShowAndroid(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  const dismissIOS = () => {
    setShowIOS(false);
    localStorage.setItem(IOS_DISMISS_KEY, "1");
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShowAndroid(false);
  };

  if (showIOS) {
    return (
      <div
        dir="rtl"
        className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-md rounded-2xl border-2 border-orange-500 bg-white p-4 shadow-2xl animate-in slide-in-from-bottom-5"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white">
            <Share className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm text-orange-600">📱 لتثبيت التطبيق على iPhone</h3>
            <p className="mt-1 text-xs text-gray-700 leading-relaxed">
              اضغط <Share className="inline h-3 w-3 mx-0.5" /> في شريط Safari ← ثم اختر <PlusSquare className="inline h-3 w-3 mx-0.5" /> 'إضافة إلى الشاشة الرئيسية'
            </p>
          </div>
          <button
            onClick={dismissIOS}
            aria-label="إغلاق"
            className="shrink-0 rounded-full p-1 text-gray-500 hover:bg-orange-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  if (!showAndroid) return null;

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
            أضف التطبيق إلى شاشتك الرئيسية للوصول السريع والعمل بدون إنترنت.
          </p>
          <div className="mt-3 flex gap-2">
            {deferred && (
              <Button size="sm" onClick={install} className="bg-orange-500 hover:bg-orange-600">
                تثبيت الآن
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={dismissAndroid}>
              لاحقاً
            </Button>
          </div>
        </div>
        <button
          onClick={dismissAndroid}
          aria-label="إغلاق"
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

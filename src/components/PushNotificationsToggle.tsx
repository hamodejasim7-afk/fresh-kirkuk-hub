import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/contexts/StoreContext";
import {
  isPushSupported,
  getExistingPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";

/**
 * Admin-only toggle to enable Web Push background notifications on this device.
 * Super Admin → subscription has store_id = NULL (receives all stores).
 * Store Admin / Admin / Accountant → subscription tied to their current store.
 */
export function PushNotificationsToggle() {
  const { user, isSuperAdmin } = useAuth();
  const { currentStore } = useStore();
  const [supported] = useState(() => isPushSupported());
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    getExistingPushSubscription()
      .then((s) => setEnabled(!!s))
      .catch(() => setEnabled(false));
  }, [supported]);

  if (!user) return null;

  if (!supported) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
        <Smartphone className="h-3.5 w-3.5" />
        هذا المتصفح لا يدعم الإشعارات في الخلفية. على iPhone: ثبّت التطبيق على الشاشة الرئيسية (iOS 16.4+).
      </p>
    );
  }

  const targetStoreId = isSuperAdmin ? null : currentStore?.id ?? null;

  const enable = async () => {
    if (!isSuperAdmin && !targetStoreId) {
      toast.error("يرجى اختيار متجر أولاً");
      return;
    }
    setBusy(true);
    try {
      await subscribeToPush({ userId: user.id, storeId: targetStoreId });
      setEnabled(true);
      toast.success("✅ الإشعارات مفعّلة على هذا الجهاز");
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg === "PERMISSION_DENIED") {
        toast.error("تم رفض الإذن. فعّل الإشعارات يدوياً من إعدادات المتصفح.");
      } else if (msg === "PUSH_UNSUPPORTED") {
        toast.error("هذا المتصفح لا يدعم الإشعارات.");
      } else if (msg === "VAPID_PUBLIC_KEY_MISSING") {
        toast.error("لم يتم إعداد مفتاح VAPID في التطبيق.");
      } else {
        toast.error("تعذّر تفعيل الإشعارات: " + msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await unsubscribeFromPush();
      setEnabled(false);
      toast.success("تم إيقاف الإشعارات على هذا الجهاز");
    } catch (e: any) {
      toast.error("تعذّر إيقاف الإشعارات: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {enabled ? (
        <>
          <Button size="sm" variant="outline" onClick={disable} disabled={busy} className="gap-1">
            <BellOff className="h-3.5 w-3.5" />
            إيقاف إشعارات الطلبات
          </Button>
          <span className="text-xs text-primary">✅ الإشعارات مفعّلة على هذا الجهاز</span>
        </>
      ) : (
        <>
          <Button size="sm" onClick={enable} disabled={busy} className="gap-1">
            <Bell className="h-3.5 w-3.5" />
            {busy ? "جارٍ التفعيل..." : "تفعيل إشعارات الطلبات"}
          </Button>
          <span className="text-xs text-muted-foreground">
            تصلك الإشعارات حتى لو كان التطبيق مغلقاً (للأندرويد بعد تثبيت التطبيق على الشاشة الرئيسية).
          </span>
        </>
      )}
    </div>
  );
}

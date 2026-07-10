import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Gift, MapPin, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Customer } from "@/types/loyalty";
import { STAMPS_PER_GIFT } from "@/types/loyalty";
import freshLogo from "@/assets/fresh-logo.png";
import { useStoreBranding } from "@/hooks/useStoreBranding";
import { cn } from "@/lib/utils";


const FREE_DELIVERY_AT = 10; // 10 stamps = free delivery gift

export default function PublicCard() {
  const { phone } = useParams<{ phone: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!phone) return;
    const clean = phone.replace(/[^\d]/g, "");
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("phone", clean)
      .maybeSingle();
    if (!data) {
      setNotFound(true);
    } else {
      setCustomer(data as Customer);
      setNotFound(false);
    }
    setLoading(false);
  }, [phone]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--gradient-soft)] flex items-center justify-center p-4" dir="rtl">
        <Skeleton className="h-96 w-full max-w-md rounded-3xl" />
      </div>
    );
  }

  if (notFound || !customer) {
    return (
      <div className="min-h-screen bg-[var(--gradient-soft)] flex items-center justify-center p-4" dir="rtl">
        <Card className="p-8 rounded-3xl text-center max-w-md">
          <img src={freshLogo} alt="فريش" className="h-16 w-16 mx-auto mb-3" />
          <h1 className="text-xl font-extrabold">البطاقة غير موجودة</h1>
          <p className="text-muted-foreground text-sm mt-2">تواصل مع فريش لإصدار بطاقتك</p>
        </Card>
      </div>
    );
  }

  const stamps = customer.total_stamps;
  const remaining = Math.max(0, FREE_DELIVERY_AT - stamps);
  const { branding } = useStoreBranding(customer.store_id);
  const logo = branding?.logo_url || freshLogo;
  const storeName = branding?.name || "فريش Fresh";

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)] p-4" dir="rtl">
      <div className="max-w-md mx-auto py-6 space-y-4">
        <Card className="relative overflow-hidden rounded-3xl border-0 shadow-[var(--shadow-elegant)] bg-gradient-to-br from-primary via-primary to-primary-glow text-primary-foreground p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src={logo} alt={storeName} className="h-12 w-12 rounded-2xl bg-white/95 p-1.5 shadow-md object-contain" />
              <div>
                <p className="text-xs opacity-80">بطاقة الولاء</p>
                <p className="font-extrabold text-lg leading-tight">{storeName}</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-white/20 border-0 text-white gap-1 backdrop-blur">
              <Gift className="h-3.5 w-3.5" /> {customer.gift_count} هدية
            </Badge>

          </div>

          <div className="mt-6">
            <p className="text-2xl font-extrabold">{customer.full_name}</p>
            {customer.area && (
              <div className="flex items-center gap-1 text-sm opacity-90 mt-1">
                <MapPin className="h-3.5 w-3.5" /> {customer.area}
              </div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-5 gap-2 bg-white/15 rounded-2xl p-3 backdrop-blur">
            {Array.from({ length: STAMPS_PER_GIFT }).map((_, i) => {
              const filled = i < stamps;
              return (
                <div
                  key={i}
                  className={cn(
                    "aspect-square rounded-xl flex items-center justify-center transition-all",
                    filled ? "bg-white text-primary shadow-md" : "bg-white/20 text-white/40 scale-95",
                  )}
                >
                  <ShoppingCart className="h-5 w-5" />
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="font-bold text-lg">{stamps} / {STAMPS_PER_GIFT}</span>
            <span className="opacity-90 inline-flex items-center gap-1">
              <Truck className="h-4 w-4" />
              {remaining > 0 ? `متبقي ${remaining} طلبات للتوصيل المجاني` : "🎉 توصيل مجاني جاهز!"}
            </span>
          </div>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          يتم التحديث تلقائياً كل ٣٠ ثانية
        </p>
      </div>
    </div>
  );
}

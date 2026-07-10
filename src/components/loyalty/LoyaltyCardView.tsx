import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Gift, Download, Phone, MapPin } from "lucide-react";
import freshLogo from "@/assets/fresh-logo.png";
import type { Customer } from "@/types/loyalty";
import { STAMPS_PER_GIFT } from "@/types/loyalty";
import { cn } from "@/lib/utils";
import { buildCardUrl } from "@/config/constants";
import { useStoreBranding } from "@/hooks/useStoreBranding";


interface Props {
  customer: Customer;
  compact?: boolean;
}

export function LoyaltyCardView({ customer, compact }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const prevStamps = useRef<number>(customer.total_stamps);
  const [celebrate, setCelebrate] = useState(false);
  const { branding } = useStoreBranding(customer.store_id);
  const logo = branding?.logo_url || freshLogo;
  const storeName = branding?.name || "فريش Fresh";


  useEffect(() => {
    const payload = buildCardUrl(customer.phone);
    QRCode.toDataURL(payload, { width: 320, margin: 1, color: { dark: "#1e2c58", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [customer.qr_code]);

  useEffect(() => {
    if (customer.total_stamps === 0 && prevStamps.current > 0) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 2500);
      return () => clearTimeout(t);
    }
    prevStamps.current = customer.total_stamps;
  }, [customer.total_stamps]);

  const stamps = customer.total_stamps;
  const remaining = STAMPS_PER_GIFT - stamps;

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `fresh-loyalty-${customer.phone}.png`;
    a.click();
  };

  return (
    <Card className={cn(
      "relative overflow-hidden rounded-3xl border-0 shadow-[var(--shadow-elegant)] bg-gradient-to-br from-primary via-primary to-primary-glow text-primary-foreground",
      compact ? "p-4" : "p-6 md:p-8",
    )}>
      {celebrate && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-secondary/90 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="text-center animate-in zoom-in-50 duration-500">
            <Gift className="h-20 w-20 mx-auto text-primary drop-shadow-lg" />
            <p className="mt-3 text-2xl font-extrabold text-white">مبروك! حصلت على هدية 🎉</p>
            <p className="text-white/80 text-sm mt-1">تواصل مع فريش لاستلامها</p>
          </div>
        </div>
      )}

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

      <div className="mt-5">
        <p className="text-2xl md:text-3xl font-extrabold">{customer.full_name}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm opacity-90">
          <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{customer.phone}</span>
          {customer.area && (
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{customer.area}</span>
          )}
        </div>
      </div>

      {/* stamps grid */}
      <div className="mt-6 grid grid-cols-5 gap-2 md:gap-3 bg-white/15 rounded-2xl p-3 backdrop-blur">
        {Array.from({ length: STAMPS_PER_GIFT }).map((_, i) => {
          const filled = i < stamps;
          return (
            <div
              key={i}
              className={cn(
                "aspect-square rounded-xl flex items-center justify-center transition-all duration-300",
                filled
                  ? "bg-white text-primary shadow-md scale-100"
                  : "bg-white/20 text-white/40 scale-95",
              )}
            >
              <ShoppingCart className={cn("h-5 w-5 md:h-6 md:w-6", filled && "animate-in zoom-in-50")} />
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="font-bold">{stamps} / {STAMPS_PER_GIFT}</span>
        <span className="opacity-90">
          {remaining > 0 ? `متبقي ${remaining} طلبات للتوصيل المجاني` : "طلبية الهدية جاهزة!"}
        </span>
      </div>

      {/* QR */}
      {qrDataUrl && !compact && (
        <div className="mt-6 flex flex-col items-center bg-white rounded-2xl p-4">
          <img src={qrDataUrl} alt="QR" className="h-40 w-40" />
          <Button size="sm" variant="ghost" onClick={downloadQr} className="mt-2 text-secondary">
            <Download className="h-4 w-4" /> تحميل الباركود
          </Button>
        </div>
      )}
    </Card>
  );
}

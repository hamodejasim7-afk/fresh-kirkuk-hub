import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { findCustomerByPhone, findCustomerByQr } from "@/services/loyalty";
import type { Customer } from "@/types/loyalty";
import { LoyaltyCardView } from "@/components/loyalty/LoyaltyCardView";
import { toast } from "sonner";
import freshLogo from "@/assets/fresh-logo.png";
import { useStoreBranding } from "@/hooks/useStoreBranding";


export default function LoyaltyCardPage() {
  const { qr, phone: phoneParam } = useParams<{ qr?: string; phone?: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState<boolean>(!!qr || !!phoneParam);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!qr && !phoneParam) return;
    setLoading(true);
    const loader = phoneParam
      ? findCustomerByPhone(phoneParam)
      : findCustomerByQr(qr!);
    loader
      .then((c) => { setCustomer(c); if (!c) toast.error("البطاقة غير موجودة"); })
      .catch(() => toast.error("خطأ في تحميل البطاقة"))
      .finally(() => setLoading(false));
  }, [qr, phoneParam]);

  // realtime update while page is open
  useEffect(() => {
    if (!customer) return;
    const ch = supabase
      .channel(`customer-${customer.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "customers", filter: `id=eq.${customer.id}` },
        (payload) => setCustomer(payload.new as Customer),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [customer]);

  const searchByPhone = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    try {
      const c = await findCustomerByPhone(phone);
      if (!c) { toast.error("لم يتم العثور على بطاقة بهذا الرقم"); return; }
      setCustomer(c);
    } finally { setLoading(false); }
  };

  const { branding } = useStoreBranding(customer?.store_id ?? null);
  const headerLogo = branding?.logo_url || freshLogo;
  const headerName = branding?.name || "فريش";

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)]" dir="rtl">
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowRight className="h-4 w-4" /> رجوع</Link></Button>
          <div className="flex items-center gap-2 mr-auto">
            <img src={headerLogo} alt={headerName} className="h-8 w-8 object-contain" />
            <span className="font-extrabold">{headerName}</span>
          </div>
        </div>


        {loading && <Skeleton className="h-96 w-full rounded-3xl" />}

        {!loading && customer && <LoyaltyCardView customer={customer} />}

        {!loading && !customer && (
          <Card className="p-6 rounded-3xl space-y-4">
            <div>
              <h1 className="text-2xl font-extrabold">بطاقة الولاء</h1>
              <p className="text-sm text-muted-foreground">ابحث عن بطاقتك برقم الهاتف</p>
            </div>
            <div>
              <Label>رقم الهاتف</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="07XXXXXXXXX"
                  onKeyDown={(e) => { if (e.key === "Enter") searchByPhone(); }}
                />
                <Button onClick={searchByPhone}><Search className="h-4 w-4" /></Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

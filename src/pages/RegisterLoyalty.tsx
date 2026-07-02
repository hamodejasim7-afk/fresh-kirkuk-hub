import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Gift, ShoppingCart, Sparkles } from "lucide-react";
import { toast } from "sonner";
import freshLogo from "@/assets/fresh-logo.png";
import { createCustomer, findCustomerByPhone } from "@/services/loyalty";
import { LoyaltyCardView } from "@/components/loyalty/LoyaltyCardView";
import type { Customer } from "@/types/loyalty";

export default function RegisterLoyalty() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [saving, setSaving] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);

  const submit = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error("الاسم ورقم الهاتف مطلوبان");
      return;
    }
    setSaving(true);
    try {
      // If phone already has a card — surface it instead of failing
      const existing = await findCustomerByPhone(phone);
      if (existing) {
        toast.success("لديك بطاقة مسجلة مسبقاً");
        setCustomer(existing);
        return;
      }
      const c = await createCustomer({ full_name: name, phone, area });
      toast.success("تم إنشاء بطاقتك 🎉");
      setCustomer(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر إنشاء البطاقة");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)]" dir="rtl">
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/"><ArrowRight className="h-4 w-4" /> رجوع</Link>
          </Button>
          <div className="flex items-center gap-2 mr-auto">
            <img src={freshLogo} alt="فريش" className="h-8 w-8" />
            <span className="font-extrabold">فريش</span>
          </div>
        </div>

        {customer ? (
          <div className="space-y-3">
            <LoyaltyCardView customer={customer} />
            <Button className="w-full" onClick={() => navigate(`/loyalty/${customer.qr_code}`)}>
              فتح بطاقتي
            </Button>
          </div>
        ) : (
          <Card className="p-6 rounded-3xl space-y-5">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Gift className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-extrabold mt-3">سجّل بطاقة الولاء</h1>
              <p className="text-sm text-muted-foreground mt-1">
                اجمع 10 أختام واحصل على توصيل مجاني 🎁
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-primary/5">
                <ShoppingCart className="h-4 w-4 mx-auto text-primary" />
                <p className="mt-1">اطلب</p>
              </div>
              <div className="p-2 rounded-xl bg-primary/5">
                <Sparkles className="h-4 w-4 mx-auto text-primary" />
                <p className="mt-1">اجمع أختام</p>
              </div>
              <div className="p-2 rounded-xl bg-primary/5">
                <Gift className="h-4 w-4 mx-auto text-primary" />
                <p className="mt-1">استلم هدية</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label>الاسم الكامل *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="محمد أحمد" />
              </div>
              <div>
                <Label>رقم الهاتف *</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="07XXXXXXXXX" dir="ltr" />
              </div>
              <div>
                <Label>المنطقة (اختياري)</Label>
                <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="الحي / الشارع" />
              </div>
              <Button onClick={submit} disabled={saving} className="w-full h-12 text-base">
                {saving ? "جاري الإنشاء..." : "احصل على بطاقتي"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                لا يتطلب إنشاء حساب — رقم هاتفك يكفي
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

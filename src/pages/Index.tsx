import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ensureNotificationPermission, showOrderNotification } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import {
  ShoppingCart, Plus, Minus, Trash2, Phone, MapPin, User,
  Instagram, Facebook, LogIn, LayoutDashboard, Truck, Clock,
} from "lucide-react";
import { toast } from "sonner";
import freshLogo from "@/assets/fresh-logo.png";
import { formatIQD } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { useProducts, type DBProduct } from "@/hooks/useProducts";
import { orderCustomerSchema } from "@/lib/orderValidation";
import { useCategories } from "@/hooks/useCategories";
import { DELIVERY_FEE_IQD, STORE_PHONE, STORE_PHONE_TEL, STORE_LOCATION } from "@/lib/constants";

type CartItem = DBProduct & { qty: number };

const Index = () => {
  const { user, role, signOut } = useAuth();
  const { settings: storeSettings, loading } = useStoreSettings();
  const { products } = useProducts({ onlyAvailable: true });
  const { categories } = useCategories({ onlyActive: true });
  const [activeCat, setActiveCat] = useState<string>("الكل");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "", notes: "" });

  const allCategories = useMemo(
    () => ["الكل", ...categories.map((c) => c.name)],
    [categories]
  );

  // Load cart from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("fresh_cart");
    if (saved) {
      try { setCart(JSON.parse(saved)); } catch {}
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("fresh_cart", JSON.stringify(cart));
  }, [cart]);

  const filtered = useMemo(
    () => (activeCat === "الكل" ? products : products.filter((p) => p.category === activeCat)),
    [activeCat, products]
  );

  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  const subtotal = cart.reduce((s, i) => s + i.qty * i.price_iqd, 0);
  const deliveryFee = cart.length > 0 ? DELIVERY_FEE_IQD : 0;
  const totalPrice = subtotal + deliveryFee;

  const getCartQty = (id: string) => cart.find((i) => i.id === id)?.qty ?? 0;

  const addToCart = (p: DBProduct) => {
    setCart((prev) => {
      const found = prev.find((i) => i.id === p.id);
      if (found) return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { ...p, qty: 1 }];
    });
    // Small side toast (bottom-right) — won't cover the cart icon up top
    toast.success(`تمت إضافة ${p.name} ✓`, {
      position: "bottom-right",
      duration: 2200,
      className: "text-xs py-2",
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0)
    );
  };
  const removeItem = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id));

  const validateCustomer = () => {
    const parsed = orderCustomerSchema.safeParse(customer);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "تحقق من الحقول المطلوبة");
      return null;
    }
    return parsed.data;
  };

  const openOrderConfirmation = () => {
    if (cart.length === 0) {
      toast.error("السلة فارغة");
      return;
    }
    if (!storeSettings.is_open) {
      toast.error("المتجر مغلق حالياً، لا يمكن استلام الطلبات");
      return;
    }
    if (!validateCustomer()) return;
    setConfirmOpen(true);
  };

  const submitOrder = async () => {
    const validatedCustomer = validateCustomer();
    if (!validatedCustomer) return;

    const { data: latestSettings } = await supabase
      .from("store_settings")
      .select("is_open")
      .eq("id", true)
      .maybeSingle();

    if (latestSettings && !latestSettings.is_open) {
      toast.error("المتجر مغلق حالياً، لا يمكن استلام الطلبات");
      setConfirmOpen(false);
      return;
    }
    if (cart.length === 0) {
      toast.error("السلة فارغة");
      return;
    }

    setSubmitting(true);
    try {
      const orderId = crypto.randomUUID();

      const { error: orderErr } = await supabase
        .from("orders")
        .insert({
          id: orderId,
          customer_name: validatedCustomer.name,
          customer_phone: validatedCustomer.phone,
          customer_address: validatedCustomer.address,
          notes: validatedCustomer.notes || null,
          total_iqd: totalPrice,
          delivery_fee_iqd: deliveryFee,
          status: "new",
        });

      if (orderErr) throw orderErr;

      const items = cart.map((c) => ({
        order_id: orderId,
        product_name: c.name,
        category: c.category,
        unit: c.unit,
        price_iqd: c.price_iqd,
        quantity: c.qty,
      }));

      const { error: itemsErr } = await supabase.from("order_items").insert(items);
      if (itemsErr) throw itemsErr;

      toast.success("تم استلام طلبك! سنتصل بك قريباً.");
      setCart([]);
      setCustomer({ name: "", phone: "", address: "", notes: "" });
      setConfirmOpen(false);
      setCartOpen(false);
    } catch (err: any) {
      console.error("Order submit failed", {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        full: err,
      });
      const msg = String(err?.message ?? "");
      const details = String(err?.details ?? "");
      if (msg.includes("STORE_CLOSED")) {
        toast.error("المتجر مغلق حالياً");
      } else if (msg.includes("row-level security") || details.includes("row-level security")) {
        toast.error("هذه النسخة قديمة من الموقع، حدّث الصفحة وحاول مرة أخرى");
      } else {
        toast.error("فشل إرسال الطلب: " + (msg || details || "خطأ غير معروف"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={freshLogo} alt="شعار فريش Fresh - متجر كركوك" className="h-12 w-auto md:h-14" />
            <div className="hidden sm:block">
              <p className="text-xs text-muted-foreground">توصيل طازج إلى باب بيتك</p>
              <a href={`tel:${STORE_PHONE_TEL}`} className="text-sm font-semibold text-secondary hover:text-primary block" dir="ltr">
                📞 {STORE_PHONE}
              </a>
              <p className="text-xs text-muted-foreground">📍 {STORE_LOCATION}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user && (role === "admin" || role === "accountant") && (
              <Button asChild variant="default" size="sm" className="gap-1 shadow-md">
                <Link to="/admin">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">لوحة الإدارة</span>
                  <span className="sm:hidden">الإدارة</span>
                </Link>
              </Button>
            )}
            {user && role === "driver" && (
              <Button asChild variant="default" size="sm" className="gap-1 shadow-md">
                <Link to="/driver">
                  <Truck className="h-4 w-4" />
                  <span className="hidden sm:inline">لوحة السائق</span>
                  <span className="sm:hidden">السائق</span>
                </Link>
              </Button>
            )}
            {user ? (
              <Button onClick={signOut} variant="ghost" size="sm">خروج</Button>
            ) : (
              <Button asChild variant="ghost" size="sm" className="gap-1">
                <Link to="/auth">
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">دخول الموظفين</span>
                  <span className="sm:hidden">دخول</span>
                </Link>
              </Button>
            )}

            <Sheet open={cartOpen} onOpenChange={setCartOpen}>
              <SheetTrigger asChild>
                <Button variant="default" className="relative gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  <span className="hidden sm:inline">السلة</span>
                  {totalQty > 0 && (
                    <Badge className="absolute -top-2 -left-2 h-6 min-w-6 rounded-full bg-secondary px-1 text-secondary-foreground">
                      {totalQty}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-full flex-col sm:max-w-md">
                <SheetHeader>
                  <SheetTitle className="text-right">سلة التسوق</SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto py-4">
                  {cart.length === 0 ? (
                    <p className="py-12 text-center text-muted-foreground">السلة فارغة</p>
                  ) : (
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                          <div className="text-3xl">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} className="h-12 w-12 rounded object-cover" />
                            ) : (
                              <span>{item.emoji}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">{formatIQD(item.price_iqd)} / {item.unit}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(item.id, -1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-semibold">{item.qty}</span>
                            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(item.id, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeItem(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}

                      <div className="space-y-3 rounded-lg border bg-accent p-4">
                        <h3 className="font-semibold text-accent-foreground">معلومات الزبون</h3>
                        <div className="space-y-2">
                          <Label htmlFor="name" className="flex items-center gap-1"><User className="h-4 w-4" /> الاسم</Label>
                          <Input id="name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="اسمك الكامل" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone" className="flex items-center gap-1"><Phone className="h-4 w-4" /> رقم الهاتف</Label>
                          <Input id="phone" type="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="07XX XXX XXXX" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="address" className="flex items-center gap-1"><MapPin className="h-4 w-4" /> العنوان في كركوك</Label>
                          <Textarea id="address" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} placeholder="الحي، الشارع، أقرب نقطة دالة" rows={2} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="notes">ملاحظات (اختياري)</Label>
                          <Textarea id="notes" value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} rows={2} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {cart.length > 0 && (
                  <SheetFooter className="border-t pt-4 sm:flex-col sm:space-x-0">
                    <div className="mb-1 flex w-full items-center justify-between text-sm">
                      <span className="text-muted-foreground">المجموع الفرعي:</span>
                      <span className="font-semibold">{formatIQD(subtotal)}</span>
                    </div>
                    <div className="mb-3 flex w-full items-center justify-between text-sm">
                      <span className="text-muted-foreground">🚚 رسوم التوصيل:</span>
                      <span className="font-semibold">{formatIQD(deliveryFee)}</span>
                    </div>
                    <div className="mb-3 flex w-full items-center justify-between text-lg border-t pt-2">
                      <span className="font-semibold">المجموع الكلي:</span>
                      <span className="font-bold text-primary">{formatIQD(totalPrice)}</span>
                    </div>
                    <Button
                      onClick={openOrderConfirmation}
                      size="lg"
                      className="w-full"
                      disabled={submitting || loading || !storeSettings.is_open}
                    >
                      {loading
                        ? "جاري التحقق..."
                        : !storeSettings.is_open
                        ? "المتجر مغلق حالياً"
                        : submitting
                        ? "جاري الإرسال..."
                        : "تأكيد الطلب"}
                    </Button>
                  </SheetFooter>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>تأكيد بيانات الطلب</DialogTitle>
            <DialogDescription>
              راجع هذه المعلومات بسرعة قبل الإرسال النهائي.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-md border bg-accent/40 p-4 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">الاسم</p>
              <p className="font-medium text-foreground">{customer.name.trim()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">الهاتف</p>
              <p className="font-medium text-foreground" dir="ltr">{customer.phone.trim()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">العنوان</p>
              <p className="font-medium text-foreground">{customer.address.trim()}</p>
            </div>
            <div className="border-t pt-2 space-y-1">
              <p className="text-muted-foreground">المنتجات ({totalQty})</p>
              {cart.map((it) => (
                <div key={it.id} className="flex justify-between text-xs">
                  <span>{it.name} × {it.qty}</span>
                  <span>{formatIQD(it.price_iqd * it.qty)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">المجموع الفرعي</span><span>{formatIQD(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">🚚 رسوم التوصيل</span><span>{formatIQD(deliveryFee)}</span></div>
              <div className="flex justify-between font-bold text-primary text-base"><span>المجموع الكلي</span><span>{formatIQD(totalPrice)}</span></div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start sm:space-x-0">
            <Button type="button" onClick={submitOrder} disabled={submitting}>
              {submitting ? "جاري الإرسال..." : "تأكيد وإرسال"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              تعديل البيانات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Store closed banner */}
      {!storeSettings.is_open && (
        <div className="bg-destructive text-destructive-foreground">
          <div className="container mx-auto flex items-center justify-center gap-3 px-4 py-3 text-center">
            <Clock className="h-5 w-5 flex-shrink-0 animate-pulse" />
            <p className="text-sm font-semibold sm:text-base">
              {storeSettings.closed_message}
            </p>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden border-b" style={{ background: "var(--gradient-soft)" }}>
        <div className="container mx-auto grid gap-6 px-4 py-10 md:grid-cols-2 md:items-center md:py-16">
          <div className="space-y-4 text-center md:text-right">
            <h1 className="text-3xl font-bold leading-tight text-secondary md:text-5xl">
              فريش <span className="text-primary">Fresh</span><br />
              طازج كل يوم إلى باب بيتك
            </h1>
            <p className="text-base text-muted-foreground md:text-lg">
              خضار، لحوم، أسماك ودجاج طازج بأسعار الجملة. توصيل سريع داخل مدينة كركوك.
            </p>
            <div className="flex flex-wrap justify-center gap-3 md:justify-start">
              <Badge variant="secondary" className="px-3 py-1.5 text-sm">✓ توصيل سريع</Badge>
              <Badge variant="secondary" className="px-3 py-1.5 text-sm">✓ أسعار الجملة</Badge>
              <Badge variant="secondary" className="px-3 py-1.5 text-sm">✓ منتجات طازجة يومياً</Badge>
            </div>
          </div>
          <div className="flex justify-center">
            <img src={freshLogo} alt="فريش Fresh" className="w-full max-w-sm drop-shadow-xl" />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container mx-auto px-4 py-6">
        <div className="flex flex-wrap gap-2">
          {allCategories.map((c) => (
            <Button key={c} variant={activeCat === c ? "default" : "outline"} onClick={() => setActiveCat(c)} className="rounded-full">
              {c}
            </Button>
          ))}
        </div>
      </section>

      {/* Products */}
      <section className="container mx-auto px-4 pb-12">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((p) => (
            <Card key={p.id} className="group overflow-hidden transition-smooth hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)]">
              <div className="flex aspect-square items-center justify-center overflow-hidden bg-accent text-7xl">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span>{p.emoji ?? "📦"}</span>
                )}
              </div>
              <div className="space-y-2 p-3">
                <Badge variant="outline" className="text-xs">{p.category}</Badge>
                <h3 className="font-semibold leading-tight">{p.name}</h3>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold text-primary">{formatIQD(p.price_iqd)}</span>
                  <span className="text-xs text-muted-foreground">/ {p.unit}</span>
                </div>
                {getCartQty(p.id) === 0 ? (
                  <Button onClick={() => addToCart(p)} className="w-full gap-1" size="sm">
                    <Plus className="h-4 w-4" /> أضف للسلة
                  </Button>
                ) : (
                  <div className="flex items-center justify-between gap-1 rounded-md border bg-accent/30 p-1">
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(p.id, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="font-bold text-base">{getCartQty(p.id)}</span>
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(p.id, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-secondary text-secondary-foreground">
        <div className="container mx-auto grid gap-6 px-4 py-10 md:grid-cols-3">
          <div className="space-y-3">
            <img src={freshLogo} alt="فريش Fresh" className="h-14 w-auto bg-white/95 rounded-lg p-2" />
            <p className="text-sm opacity-80">طازج كل يوم - توصيل داخل مدينة كركوك</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">تواصل معنا</h3>
            <a href={`tel:${STORE_PHONE_TEL}`} className="flex items-center gap-2 text-sm opacity-90 hover:opacity-100" dir="ltr">
              <Phone className="h-4 w-4" /> {STORE_PHONE}
            </a>
            <p className="flex items-center gap-2 text-sm opacity-90"><MapPin className="h-4 w-4" /> {STORE_LOCATION}</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">تابعنا</h3>
            <div className="flex gap-3">
              <a href="#" aria-label="انستغرام" className="rounded-full bg-white/10 p-2 transition-smooth hover:bg-primary"><Instagram className="h-5 w-5" /></a>
              <a href="#" aria-label="فيسبوك" className="rounded-full bg-white/10 p-2 transition-smooth hover:bg-primary"><Facebook className="h-5 w-5" /></a>
              <a href="#" aria-label="تيك توك" className="rounded-full bg-white/10 p-2 transition-smooth hover:bg-primary">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.94a8.16 8.16 0 0 0 4.77 1.52V7a4.85 4.85 0 0 1-1.84-.31z"/></svg>
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs opacity-70">
          © {new Date().getFullYear()} فريش Fresh - جميع الحقوق محفوظة
        </div>
      </footer>
    </div>
  );
};

export default Index;

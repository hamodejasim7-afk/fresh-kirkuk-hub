import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ensureNotificationPermission, showOrderNotification } from "@/lib/notifications";
import { useStore } from "@/contexts/StoreContext";
import { Store as StoreIcon } from "lucide-react";
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
  Instagram, Facebook, LogIn, LayoutDashboard, Truck, Clock, Search, TrendingUp,
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
import { DELIVERY_FEE_IQD } from "@/lib/constants";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDeliveryZones } from "@/hooks/useDeliveryZones";

type CartItem = DBProduct & { qty: number };

const Index = () => {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const { settings: storeSettings, loading } = useStoreSettings();
  const { currentStore, loading: storeLoading, openSelector } = useStore();
  const storeId = currentStore?.id ?? null;
  const { products } = useProducts({ onlyAvailable: true, storeId });
  const { categories } = useCategories({ onlyActive: true, storeId });
  const [activeCat, setActiveCat] = useState<string>("الكل");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "", notes: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [lastOrder, setLastOrder] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("fresh_last_order");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackPhone, setTrackPhone] = useState("");
  const [trackOrders, setTrackOrders] = useState<any[]>([]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const { zones: deliveryZones } = useDeliveryZones({ onlyActive: true });
  const selectedZone = deliveryZones.find((z) => z.id === selectedZoneId) ?? null;

  const formatQty = (q: number) =>
    q % 1 === 0 ? String(q) : q.toFixed(2).replace(/\.?0+$/, "");

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
    const t = setTimeout(() => {
      localStorage.setItem("fresh_cart", JSON.stringify(cart));
    }, 300);
    return () => clearTimeout(t);
  }, [cart]);

  // Background new-order watcher for admin/accountant browsing the storefront
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const watcherInitRef = useRef(false);
  useEffect(() => {
    if (!user || (role !== "admin" && role !== "accountant")) return;

    ensureNotificationPermission().catch(() => {});

    const checkNew = async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, customer_name, total_iqd, created_at, status")
        .is("archived_at", null)
        .eq("status", "new")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!data) return;
      const ids = new Set(data.map((o) => o.id));
      if (!watcherInitRef.current) {
        seenOrderIdsRef.current = ids;
        watcherInitRef.current = true;
        return;
      }
      const fresh = data.filter((o) => !seenOrderIdsRef.current.has(o.id));
      fresh.forEach((o) => {
        toast.success(`🔔 طلب جديد — ${o.customer_name}`, {
          description: `المبلغ: ${formatIQD(o.total_iqd)}`,
          duration: 9000,
          action: { label: "افتح الإدارة", onClick: () => navigate("/admin") },
        });
        showOrderNotification({
          title: "فريش — طلب جديد وصل",
          body: `${o.customer_name} • ${formatIQD(o.total_iqd)}`,
          tag: `bg-order-${o.id}`,
          onClick: () => navigate("/admin"),
        });
      });
      seenOrderIdsRef.current = ids;
    };

    checkNew();
    const channel = supabase
      .channel("storefront-order-watch")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => checkNew())
      .subscribe();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") checkNew();
    }, 8000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  const filtered = useMemo(() => {
    let result = activeCat === "الكل"
      ? products
      : products.filter((p) => p.category === activeCat);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [activeCat, products, searchQuery]);

  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  const subtotal = cart.reduce((s, i) => s + i.qty * i.price_iqd, 0);
  const deliveryFee = cart.length > 0 ? (selectedZone ? selectedZone.price_iqd : DELIVERY_FEE_IQD) : 0;
  const totalPrice = subtotal + deliveryFee;

  const cartMap = useMemo(
    () => Object.fromEntries(cart.map((i) => [i.id, i.qty])),
    [cart]
  );
  const getCartQty = (id: string) => cartMap[id] ?? 0;

  const addToCart = (p: DBProduct, qty: number = 1) => {
    setCart((prev) => {
      const found = prev.find((i) => i.id === p.id);
      if (found) return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + qty } : i));
      return [...prev, { ...p, qty }];
    });
    const qtyLabel = qty === 0.5 ? "نصف كيلو" : qty === 0.25 ? "ربع كيلو" : `${qty}`;
    toast.success(`تمت إضافة ${qtyLabel} ${p.name} ✓`, {
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
  const setQty = (id: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.id !== id));
    } else {
      setCart((prev) => prev.map((i) => (i.id === id ? { ...i, qty } : i)));
    }
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

  const openWhatsApp = (orderId: string) => {
    const itemsList = cart
      .map((item) => `• ${item.name} × ${formatQty(item.qty)} ${item.unit} = ${formatIQD(item.price_iqd * item.qty)}`)
      .join("\n");
    const message = `🛒 *طلب جديد من ${currentStore?.name ?? "المتجر"}*
━━━━━━━━━━━━━━
👤 الاسم: ${customer.name}
📞 الهاتف: ${customer.phone}
📍 العنوان: ${customer.address}
${customer.notes ? `📝 ملاحظات: ${customer.notes}` : ""}
━━━━━━━━━━━━━━
${itemsList}
━━━━━━━━━━━━━━
🛵 رسوم التوصيل${selectedZone ? ` (${selectedZone.name})` : ""}: ${formatIQD(deliveryFee)}
💰 *المجموع الكلي: ${formatIQD(totalPrice)}*
━━━━━━━━━━━━━━
🔖 رقم الطلب: ${orderId.slice(0, 8).toUpperCase()}`;
    const waNumber = currentStore?.whatsapp?.trim();
    if (!waNumber) {
      toast.error("رقم واتساب المتجر غير متوفر");
      return;
    }
    const url = buildWhatsAppLink(waNumber, message);
    window.open(url, "_blank");
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
          delivery_zone_id: selectedZone?.id ?? null,
          delivery_zone_name: selectedZone?.name ?? null,
          status: "new",
          store_id: storeId,
        } as any);

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
      openWhatsApp(orderId);
      setLastOrder(cart);
      localStorage.setItem("fresh_last_order", JSON.stringify(cart));
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

  const trackOrder = async () => {
    if (!trackPhone.trim() || trackPhone.trim().length < 10) {
      toast.error("أدخل رقم هاتف صحيح");
      return;
    }
    setTrackLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, total_iqd, created_at, customer_name, order_items(product_name, quantity, price_iqd)")
        .eq("customer_phone", trackPhone.trim())
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      setTrackOrders(data ?? []);
    } catch {
      toast.error("تعذّر تحميل الطلبات");
    } finally {
      setTrackLoading(false);
    }
  };

  const statusLabel = (s: string) => ({
    new:        { text: "🆕 جديد — قيد المراجعة",  color: "bg-blue-100 text-blue-800" },
    confirmed:  { text: "✅ تم التأكيد",             color: "bg-green-100 text-green-800" },
    preparing:  { text: "👨‍🍳 قيد التحضير",           color: "bg-yellow-100 text-yellow-800" },
    delivering: { text: "🛵 خرج للتوصيل",            color: "bg-orange-100 text-orange-800" },
    delivered:  { text: "🏠 تم التوصيل",             color: "bg-emerald-100 text-emerald-800" },
    cancelled:  { text: "❌ ملغي",                   color: "bg-red-100 text-red-800" },
  } as Record<string, { text: string; color: string }>)[s] ?? { text: s, color: "bg-gray-100 text-gray-800" };

  const reorder = () => {
    if (!lastOrder.length) return;
    const updated = lastOrder.map((item) => {
      const currentProduct = products.find((p) => p.id === item.id);
      return currentProduct ? { ...currentProduct, qty: item.qty } : item;
    });
    setCart(updated);
    setCartOpen(true);
    toast.success("تمت إضافة الطلب السابق للسلة ✓", { position: "bottom-right" });
  };

  if (storeLoading) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        جاري التحميل...
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={currentStore?.logo_url || freshLogo} alt={`شعار ${currentStore?.name ?? "فريش Fresh"}`} className="h-12 w-auto md:h-14 object-contain" onError={(e) => { if (e.currentTarget.src !== freshLogo) e.currentTarget.src = freshLogo; }} />
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-foreground">{currentStore?.name ?? "فريش Fresh"}</p>
              {currentStore?.phone && (
                <a href={`tel:${currentStore.phone}`} className="text-sm font-semibold text-secondary hover:text-primary block" dir="ltr">
                  📞 {currentStore.phone}
                </a>
              )}
              {currentStore?.address && (
                <p className="text-xs text-muted-foreground">📍 {currentStore.address}</p>
              )}
            </div>
            {currentStore && (
              <Button variant="outline" size="sm" onClick={openSelector} className="gap-1 h-9">
                <StoreIcon className="h-4 w-4" />
                <span className="hidden sm:inline max-w-[120px] truncate">{currentStore.name}</span>
                <span className="text-xs text-muted-foreground">تغيير</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {user && (role?.trim().toLowerCase() === "admin" || role?.trim().toLowerCase() === "accountant") && (
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
                    <div className="py-8 text-center space-y-4">
                      <p className="text-muted-foreground">السلة فارغة</p>
                      {lastOrder.length > 0 && (
                        <div className="rounded-lg border bg-accent/40 p-4 text-right space-y-3">
                          <p className="text-sm font-semibold">🔄 آخر طلب:</p>
                          {lastOrder.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span>{item.name} × {formatQty(item.qty)} {item.unit}</span>
                              <span className="text-muted-foreground">{formatIQD(item.price_iqd * item.qty)}</span>
                            </div>
                          ))}
                          <Button onClick={reorder} className="w-full gap-2 mt-2">
                            🔄 اطلب مرة ثانية
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                     <div className="space-y-3">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                          <div className="text-3xl">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="h-12 w-12 rounded object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            ) : (
                              <span>{item.emoji}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">{formatIQD(item.price_iqd)} / {item.unit}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(item.id, item.qty - (item.allow_decimal !== false ? (item.qty > 1 ? 1 : 0.25) : 1))}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="min-w-[3rem] text-center font-semibold text-sm">{formatQty(item.qty)} {item.unit}</span>
                            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(item.id, item.qty + (item.allow_decimal !== false ? (item.qty >= 1 ? 1 : 0.25) : 1))}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeItem(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}

                      <Button
                        variant="destructive"
                        className="w-full gap-2"
                        onClick={() => {
                          setCart([]);
                          localStorage.removeItem("fresh_cart");
                          toast.success("تم تفريغ السلة ✓");
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        تفريغ السلة
                      </Button>

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
                          <Label htmlFor="zone" className="flex items-center gap-1"><Truck className="h-4 w-4" /> منطقة التوصيل</Label>
                          <Select value={selectedZoneId} onValueChange={setSelectedZoneId}>
                            <SelectTrigger id="zone">
                              <SelectValue placeholder={`اختر منطقتك (الافتراضي ${formatIQD(DELIVERY_FEE_IQD)})`} />
                            </SelectTrigger>
                            <SelectContent>
                              {deliveryZones.map((z) => (
                                <SelectItem key={z.id} value={z.id}>
                                  {z.name} — {formatIQD(z.price_iqd)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedZone ? (
                            <p className="text-xs text-muted-foreground">
                              سعر التوصيل: <span className="font-semibold text-foreground">{formatIQD(selectedZone.price_iqd)}</span>
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              إذا لم تكن منطقتك مدرجة، سيتم استخدام السعر الافتراضي {formatIQD(DELIVERY_FEE_IQD)}.
                            </p>
                          )}
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
        <DialogContent dir="rtl" className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle className="text-xl">تأكيد بيانات الطلب</DialogTitle>
            <DialogDescription className="text-base">
              راجع هذه المعلومات بعناية قبل الإرسال النهائي.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-md border bg-accent/40 p-3 text-lg">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">الاسم</p>
              <p className="text-base font-semibold text-foreground">{customer.name.trim()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">الهاتف</p>
              <p className="text-base font-semibold text-foreground" dir="ltr">{customer.phone.trim()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">العنوان</p>
              <p className="text-base font-semibold text-foreground">{customer.address.trim()}</p>
            </div>
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm text-muted-foreground">المنتجات ({totalQty})</p>
              {cart.map((it) => (
                <div key={it.id} className="flex justify-between text-sm font-medium">
                  <span>{it.name} × <span className="font-bold">{formatQty(it.qty)} {it.unit}</span></span>
                  <span className="font-bold">{formatIQD(it.price_iqd * it.qty)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">المجموع الفرعي</span><span className="font-semibold">{formatIQD(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">🚚 رسوم التوصيل{selectedZone ? ` (${selectedZone.name})` : ""}</span><span className="font-semibold">{formatIQD(deliveryFee)}</span></div>
              <div className="flex justify-between font-bold text-primary text-lg border-t pt-2"><span>المجموع الكلي</span><span>{formatIQD(totalPrice)}</span></div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start sm:space-x-0">
            <Button type="button" size="default" className="text-sm" onClick={submitOrder} disabled={submitting}>
              {submitting ? "جاري الإرسال..." : "تأكيد وإرسال"}
            </Button>
            <Button type="button" size="default" className="text-sm" variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
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
              {currentStore?.name ?? "فريش Fresh"}<br />
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
            <Button
              variant="outline"
              className="gap-2 mt-2"
              onClick={() => setTrackOpen(true)}
            >
              🔍 تتبع طلبك
            </Button>
          </div>
          <div className="flex justify-center">
            <img src={currentStore?.logo_url || freshLogo} alt={`شعار ${currentStore?.name ?? "فريش Fresh"}`} className="w-full max-w-sm drop-shadow-xl" onError={(e) => { if (e.currentTarget.src !== freshLogo) e.currentTarget.src = freshLogo; }} />
          </div>
        </div>
      </section>

      {/* Loyalty banner */}
      <section className="container mx-auto px-4 pt-4">
        <Link
          to="/register-loyalty"
          className="group flex items-center gap-4 rounded-2xl border-0 bg-gradient-to-l from-primary via-primary to-primary-glow p-4 text-primary-foreground shadow-md transition-all hover:shadow-lg"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <span className="text-2xl">🎁</span>
          </div>
          <div className="flex-1">
            <p className="text-sm opacity-90">بطاقة ولاء فريش</p>
            <p className="text-base font-extrabold leading-tight">اجمع 10 أختام واحصل على توصيل مجاني</p>
          </div>
          <span className="hidden sm:inline-block rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-primary group-hover:scale-105 transition">
            سجّل الآن
          </span>
        </Link>
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

      {/* Search */}
      <section className="container mx-auto px-4 pb-2">
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن منتج..."
            className="pr-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
            >
              ✕
            </button>
          )}
        </div>
      </section>

      {/* Products */}
      <section className="container mx-auto px-4 pb-12">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((p) => (
            <Card key={p.id} className="group overflow-hidden transition-smooth hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)]">
              <div className="flex aspect-square items-center justify-center overflow-hidden bg-accent text-7xl">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
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
                  <div className="flex gap-1">
                    {p.allow_decimal !== false ? (
                      <>
                        <Button onClick={() => addToCart(p, 0.5)} variant="outline" className="flex-1 text-xs h-8" size="sm">
                          ½
                        </Button>
                        <Button onClick={() => addToCart(p, 1)} className="flex-1 text-xs h-8" size="sm">
                          1 {p.unit}
                        </Button>
                        <Button onClick={() => addToCart(p, 2)} variant="outline" className="flex-1 text-xs h-8" size="sm">
                          2
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button onClick={() => addToCart(p, 1)} variant="outline" className="flex-1 text-xs h-8" size="sm">
                          1
                        </Button>
                        <Button onClick={() => addToCart(p, 2)} className="flex-1 text-xs h-8" size="sm">
                          2 {p.unit}
                        </Button>
                        <Button onClick={() => addToCart(p, 3)} variant="outline" className="flex-1 text-xs h-8" size="sm">
                          3
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 rounded-md border bg-accent/30 p-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive shrink-0"
                      onClick={() => removeItem(p.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    <input
                      type="number"
                      step={p.allow_decimal !== false ? "0.25" : "1"}
                      min={p.allow_decimal !== false ? "0.25" : "1"}
                      value={qtyInputs[p.id] ?? formatQty(getCartQty(p.id))}
                      onChange={(e) => {
                        setQtyInputs((prev) => ({ ...prev, [p.id]: e.target.value }));
                        const val = p.allow_decimal !== false
                          ? parseFloat(e.target.value)
                          : parseInt(e.target.value);
                        if (!isNaN(val) && val > 0) setQty(p.id, val);
                      }}
                      onBlur={() => setQtyInputs((prev) => {
                        const { [p.id]: _, ...rest } = prev;
                        return rest;
                      })}
                      className="w-full text-center text-sm font-bold bg-transparent border-none outline-none"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">
                      {p.unit}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
        {filtered.length === 0 && searchQuery && (
          <p className="py-16 text-center text-muted-foreground text-lg">
            لا توجد نتائج لـ "{searchQuery}"
          </p>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t bg-secondary text-secondary-foreground">
        <div className="container mx-auto grid gap-6 px-4 py-10 md:grid-cols-3">
          <div className="space-y-3">
            <img src={currentStore?.logo_url || freshLogo} alt={`شعار ${currentStore?.name ?? "فريش Fresh"}`} className="h-14 w-auto bg-white/95 rounded-lg p-2" onError={(e) => { if (e.currentTarget.src !== freshLogo) e.currentTarget.src = freshLogo; }} />
            <p className="text-sm font-semibold opacity-90">{currentStore?.name ?? "فريش Fresh"}</p>
            {currentStore?.address && (
              <p className="text-xs opacity-80">{currentStore.address}</p>
            )}
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">تواصل معنا</h3>
            {currentStore?.phone && (
              <a href={`tel:${currentStore.phone}`} className="flex items-center gap-2 text-sm opacity-90 hover:opacity-100" dir="ltr">
                <Phone className="h-4 w-4" /> {currentStore.phone}
              </a>
            )}
            {currentStore?.address && (
              <p className="flex items-center gap-2 text-sm opacity-90"><MapPin className="h-4 w-4" /> {currentStore.address}</p>
            )}
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">تابعنا</h3>
            <div className="flex gap-3">
              <a href="https://www.instagram.com/fresh.kirkuk/" target="_blank" rel="noopener noreferrer" aria-label="انستغرام" className="rounded-full bg-white/10 p-2 transition-smooth hover:bg-primary"><Instagram className="h-5 w-5" /></a>
              <a href="https://web.facebook.com/fresh.kirkuk" target="_blank" rel="noopener noreferrer" aria-label="فيسبوك" className="rounded-full bg-white/10 p-2 transition-smooth hover:bg-primary"><Facebook className="h-5 w-5" /></a>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs opacity-70">
          © {new Date().getFullYear()} {currentStore?.name ?? "فريش Fresh"} - جميع الحقوق محفوظة
        </div>
      </footer>

      {user && (role?.trim().toLowerCase() === "admin" || role?.trim().toLowerCase() === "accountant") && (
        <Link
          to="/report"
          aria-label="التقرير اليومي"
          className="fixed bottom-20 left-5 z-50 flex items-center gap-2 rounded-full bg-secondary px-4 py-3 text-secondary-foreground shadow-2xl hover:bg-secondary/90 transition-all hover:scale-105"
        >
          <TrendingUp className="h-5 w-5" />
          <span className="text-sm font-bold">تقرير اليوم</span>
        </Link>
      )}

      {/* Floating dashboard shortcut — always visible for staff */}
      {user && (role?.trim().toLowerCase() === "admin" || role?.trim().toLowerCase() === "accountant") && (
        <Link
          to="/admin"
          aria-label="فتح لوحة الإدارة"
          className="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-2xl hover:bg-primary/90 transition-all hover:scale-105"
        >
          <LayoutDashboard className="h-5 w-5" />
          <span className="text-sm font-bold">لوحة الإدارة</span>
        </Link>
      )}
      {user && role === "driver" && (
        <Link
          to="/driver"
          aria-label="فتح لوحة السائق"
          className="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-2xl hover:bg-primary/90 transition-all hover:scale-105"
        >
          <Truck className="h-5 w-5" />
          <span className="text-sm font-bold">لوحة السائق</span>
        </Link>
      )}

      {/* My loyalty card — visible for everyone */}
      <Link
        to="/loyalty"
        aria-label="بطاقتي"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-secondary px-4 py-3 text-secondary-foreground shadow-2xl hover:bg-secondary/90 transition-all hover:scale-105"
      >
        <span className="text-lg">🎁</span>
        <span className="text-sm font-bold">بطاقتي</span>
      </Link>



      <Dialog open={trackOpen} onOpenChange={(o) => { setTrackOpen(o); if (!o) { setTrackOrders([]); setTrackPhone(""); } }}>
        <DialogContent dir="rtl" className="sm:max-w-lg">
          <DialogHeader className="text-right">
            <DialogTitle className="text-xl">🔍 تتبع طلبك</DialogTitle>
            <DialogDescription>أدخل رقم هاتفك لمعرفة حالة طلباتك الأخيرة</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={trackPhone}
                onChange={(e) => setTrackPhone(e.target.value)}
                placeholder="07XX XXX XXXX"
                type="tel"
                dir="ltr"
                onKeyDown={(e) => e.key === "Enter" && trackOrder()}
              />
              <Button onClick={trackOrder} disabled={trackLoading}>
                {trackLoading ? "..." : "بحث"}
              </Button>
            </div>
            {trackOrders.length === 0 && !trackLoading && trackPhone && (
              <p className="text-center text-muted-foreground py-6">لا توجد طلبات لهذا الرقم</p>
            )}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {trackOrders.map((order) => {
                const sl = statusLabel(order.status);
                return (
                  <div key={order.id} className="rounded-lg border bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-mono">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${sl.color}`}>
                        {sl.text}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("ar-IQ", {
                        year: "numeric", month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                    {order.order_items && order.order_items.length > 0 && (
                      <ul className="text-sm space-y-1 border-t pt-2">
                        {order.order_items.map((it: any, idx: number) => (
                          <li key={idx} className="flex justify-between">
                            <span>{it.product_name} × {it.quantity}</span>
                            <span className="text-muted-foreground">{formatIQD(it.price_iqd * it.quantity)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex justify-between border-t pt-2 font-bold text-primary">
                      <span>المجموع</span>
                      <span>{formatIQD(order.total_iqd)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;

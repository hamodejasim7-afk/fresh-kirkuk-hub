import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { ShoppingCart, Plus, Minus, Trash2, Phone, MapPin, User, Instagram, Facebook } from "lucide-react";
import { toast } from "sonner";
import freshLogo from "@/assets/fresh-logo.png";

type Category = "الكل" | "خضار وفواكه" | "لحوم" | "أسماك" | "دجاج";

interface Product {
  id: string;
  name: string;
  category: Exclude<Category, "الكل">;
  price: number; // IQD per unit
  unit: string;
  emoji: string;
}

interface CartItem extends Product {
  qty: number;
}

const PRODUCTS: Product[] = [
  { id: "p1", name: "طماطم طازجة", category: "خضار وفواكه", price: 1500, unit: "كغم", emoji: "🍅" },
  { id: "p2", name: "خيار", category: "خضار وفواكه", price: 1250, unit: "كغم", emoji: "🥒" },
  { id: "p3", name: "بطاطا", category: "خضار وفواكه", price: 1000, unit: "كغم", emoji: "🥔" },
  { id: "p4", name: "بصل أحمر", category: "خضار وفواكه", price: 1250, unit: "كغم", emoji: "🧅" },
  { id: "p5", name: "تفاح أحمر", category: "خضار وفواكه", price: 3000, unit: "كغم", emoji: "🍎" },
  { id: "p6", name: "موز", category: "خضار وفواكه", price: 2500, unit: "كغم", emoji: "🍌" },
  { id: "p7", name: "لحم غنم طازج", category: "لحوم", price: 22000, unit: "كغم", emoji: "🥩" },
  { id: "p8", name: "لحم بقر مفروم", category: "لحوم", price: 18000, unit: "كغم", emoji: "🥩" },
  { id: "p9", name: "كباب جاهز", category: "لحوم", price: 20000, unit: "كغم", emoji: "🍢" },
  { id: "p10", name: "سمك كارب طازج", category: "أسماك", price: 9000, unit: "كغم", emoji: "🐟" },
  { id: "p11", name: "سمك زبيدي", category: "أسماك", price: 14000, unit: "كغم", emoji: "🐠" },
  { id: "p12", name: "روبيان", category: "أسماك", price: 25000, unit: "كغم", emoji: "🦐" },
  { id: "p13", name: "دجاج كامل طازج", category: "دجاج", price: 6500, unit: "حبة", emoji: "🍗" },
  { id: "p14", name: "صدور دجاج", category: "دجاج", price: 8500, unit: "كغم", emoji: "🍗" },
  { id: "p15", name: "أفخاذ دجاج", category: "دجاج", price: 7000, unit: "كغم", emoji: "🍗" },
];

const CATEGORIES: Category[] = ["الكل", "خضار وفواكه", "لحوم", "أسماك", "دجاج"];

const formatIQD = (n: number) => `${n.toLocaleString("ar-IQ")} د.ع`;

const Index = () => {
  const [activeCat, setActiveCat] = useState<Category>("الكل");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "" });

  const filtered = useMemo(
    () => (activeCat === "الكل" ? PRODUCTS : PRODUCTS.filter((p) => p.category === activeCat)),
    [activeCat]
  );

  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  const totalPrice = cart.reduce((s, i) => s + i.qty * i.price, 0);

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const found = prev.find((i) => i.id === p.id);
      if (found) return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { ...p, qty: 1 }];
    });
    toast.success(`تمت إضافة ${p.name} إلى السلة`);
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const removeItem = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id));

  const submitOrder = () => {
    if (!customer.name.trim() || !customer.phone.trim() || !customer.address.trim()) {
      toast.error("يرجى تعبئة الاسم ورقم الهاتف والعنوان");
      return;
    }
    if (cart.length === 0) {
      toast.error("السلة فارغة");
      return;
    }
    toast.success("تم استلام طلبك! سنتصل بك قريباً لتأكيد التوصيل.");
    setCart([]);
    setCustomer({ name: "", phone: "", address: "" });
    setCartOpen(false);
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
              <p className="text-sm font-semibold text-secondary">كركوك - العراق</p>
            </div>
          </div>

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
                        <div className="text-3xl">{item.emoji}</div>
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatIQD(item.price)} / {item.unit}
                          </p>
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
                        <Label htmlFor="name" className="flex items-center gap-1">
                          <User className="h-4 w-4" /> الاسم
                        </Label>
                        <Input
                          id="name"
                          value={customer.name}
                          onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                          placeholder="اسمك الكامل"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="flex items-center gap-1">
                          <Phone className="h-4 w-4" /> رقم الهاتف
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={customer.phone}
                          onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                          placeholder="07XX XXX XXXX"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address" className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" /> العنوان في كركوك
                        </Label>
                        <Textarea
                          id="address"
                          value={customer.address}
                          onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                          placeholder="الحي، الشارع، أقرب نقطة دالة"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <SheetFooter className="border-t pt-4 sm:flex-col sm:space-x-0">
                  <div className="mb-3 flex w-full items-center justify-between text-lg">
                    <span className="font-semibold">المجموع:</span>
                    <span className="font-bold text-primary">{formatIQD(totalPrice)}</span>
                  </div>
                  <Button onClick={submitOrder} size="lg" className="w-full">
                    تأكيد الطلب
                  </Button>
                </SheetFooter>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b" style={{ background: "var(--gradient-soft)" }}>
        <div className="container mx-auto grid gap-6 px-4 py-10 md:grid-cols-2 md:items-center md:py-16">
          <div className="space-y-4 text-center md:text-right">
            <h1 className="text-3xl font-bold leading-tight text-secondary md:text-5xl">
              فريش <span className="text-primary">Fresh</span>
              <br />
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
          {CATEGORIES.map((c) => (
            <Button
              key={c}
              variant={activeCat === c ? "default" : "outline"}
              onClick={() => setActiveCat(c)}
              className="rounded-full"
            >
              {c}
            </Button>
          ))}
        </div>
      </section>

      {/* Products */}
      <section className="container mx-auto px-4 pb-12">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((p) => (
            <Card
              key={p.id}
              className="group overflow-hidden transition-smooth hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)]"
              style={{ transition: "var(--transition-smooth)" }}
            >
              <div className="flex aspect-square items-center justify-center bg-accent text-7xl">
                {p.emoji}
              </div>
              <div className="space-y-2 p-3">
                <Badge variant="outline" className="text-xs">{p.category}</Badge>
                <h3 className="font-semibold leading-tight">{p.name}</h3>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold text-primary">{formatIQD(p.price)}</span>
                  <span className="text-xs text-muted-foreground">/ {p.unit}</span>
                </div>
                <Button onClick={() => addToCart(p)} className="w-full gap-1" size="sm">
                  <Plus className="h-4 w-4" /> أضف للسلة
                </Button>
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
            <p className="flex items-center gap-2 text-sm opacity-90"><Phone className="h-4 w-4" /> 07XX XXX XXXX</p>
            <p className="flex items-center gap-2 text-sm opacity-90"><MapPin className="h-4 w-4" /> كركوك - العراق</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">تابعنا</h3>
            <div className="flex gap-3">
              <a href="#" aria-label="انستغرام" className="rounded-full bg-white/10 p-2 transition-smooth hover:bg-primary">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" aria-label="فيسبوك" className="rounded-full bg-white/10 p-2 transition-smooth hover:bg-primary">
                <Facebook className="h-5 w-5" />
              </a>
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

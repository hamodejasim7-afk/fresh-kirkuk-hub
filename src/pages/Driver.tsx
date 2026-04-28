import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatIQD } from "@/lib/format";
import { toast } from "sonner";
import { LogOut, Phone, MapPin, ArrowRight, Truck, Bell, BellOff, PackageCheck, CheckCircle2 } from "lucide-react";
import freshLogo from "@/assets/fresh-logo.png";

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  notes: string | null;
  total_iqd: number;
  delivery_fee_iqd: number;
  status: string;
  driver_id: string | null;
  created_at: string;
}

interface OrderItem {
  id: string;
  order_id: string;
  product_name: string;
  unit: string | null;
  price_iqd: number;
  quantity: number;
}

const STATUS_LABEL: Record<string, string> = {
  assigned: "بانتظار الاستلام",
  on_the_way: "قيد التوصيل",
  delivered: "تم التسليم",
};

const Driver = () => {
  const { signOut, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Record<string, OrderItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [soundOn, setSoundOn] = useState<boolean>(() => localStorage.getItem("fresh_driver_sound") !== "0");
  const [hasNewFlash, setHasNewFlash] = useState(false);
  // Locally remembered "received amount" per order (read-only confirmation field)
  const [receivedAmount, setReceivedAmount] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem("fresh_driver_received") || "{}");
    } catch { return {}; }
  });
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => { localStorage.setItem("fresh_driver_sound", soundOn ? "1" : "0"); }, [soundOn]);
  useEffect(() => { localStorage.setItem("fresh_driver_received", JSON.stringify(receivedAmount)); }, [receivedAmount]);

  const playBeep = () => {
    if (!soundOn) return;
    try {
      // Driver-specific alert: distinct urgent two-tone "siren" pattern (different from admin's chime)
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const pattern = [
        { freq: 880,  start: 0.00, dur: 0.22 }, // A5
        { freq: 587,  start: 0.22, dur: 0.22 }, // D5 (down)
        { freq: 880,  start: 0.46, dur: 0.22 },
        { freq: 587,  start: 0.68, dur: 0.30 },
      ];
      pattern.forEach(({ freq, start, dur }) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square"; // sharper, more "alert" than triangle
        o.frequency.value = freq;
        o.connect(g); g.connect(ctx.destination);
        const t0 = ctx.currentTime + start;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.32, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.start(t0); o.stop(t0 + dur + 0.05);
      });
    } catch {}
  };

  const load = async (opts?: { silent?: boolean }) => {
    const { data: ordersData, error } = await supabase
      .from("orders")
      .select("*")
      .eq("driver_id", user!.id)
      .is("archived_at", null)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });

    if (error) {
      if (!opts?.silent) toast.error("فشل التحميل");
    } else {
      const next = ordersData ?? [];
      // Diff orders — only update state if something actually changed (no flash)
      setOrders((prev) => {
        if (prev.length === next.length) {
          let same = true;
          for (let i = 0; i < prev.length; i++) {
            const a = prev[i], b = next[i];
            if (a.id !== b.id || a.status !== b.status || a.driver_id !== b.driver_id) {
              same = false; break;
            }
          }
          if (same) return prev;
        }
        return next;
      });

      const ids = next.map((o) => o.id);
      if (ids.length > 0) {
        const { data: itemsData } = await supabase.from("order_items").select("*").in("order_id", ids);
        const grouped: Record<string, OrderItem[]> = {};
        (itemsData ?? []).forEach((it) => { (grouped[it.order_id] ||= []).push(it); });
        setItems((prev) => {
          const pk = Object.keys(prev), nk = Object.keys(grouped);
          if (pk.length === nk.length) {
            let same = true;
            for (const k of nk) {
              const a = prev[k], b = grouped[k];
              if (!a || a.length !== b.length) { same = false; break; }
              for (let i = 0; i < a.length; i++) {
                if (a[i].id !== b[i].id || a[i].quantity !== b[i].quantity) { same = false; break; }
              }
              if (!same) break;
            }
            if (same) return prev;
          }
          return grouped;
        });
      } else {
        setItems((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      }
    }
    if (!opts?.silent) setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    load();
    // Request browser notification permission once (so driver gets alerts in background tab)
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    const channel = supabase
      .channel("driver-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `driver_id=eq.${user.id}` },
        () => load({ silent: true }),
      )
      .subscribe();
    // Silent background polling — only when tab visible
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load({ silent: true });
    }, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Detect newly assigned orders → distinct driver beep + bold visual notification
  useEffect(() => {
    if (orders.length === 0) {
      knownIdsRef.current = new Set();
      return;
    }
    const currentIds = new Set(orders.map((o) => o.id));
    if (!initializedRef.current) {
      knownIdsRef.current = currentIds;
      initializedRef.current = true;
      return;
    }
    const newOnes = orders.filter((o) => !knownIdsRef.current.has(o.id));
    if (newOnes.length > 0) {
      playBeep();
      setHasNewFlash(true);
      setTimeout(() => setHasNewFlash(false), 10000);
      newOnes.forEach((o) => {
        toast(
          `🚚 طلب جديد مُعيَّن لك — ${o.customer_name}`,
          {
            description: `📍 ${o.customer_address} • ${o.customer_phone}`,
            duration: 12000,
            className: "border-primary bg-primary/10 text-primary-foreground font-bold",
            action: {
              label: "اعرض",
              onClick: () => {
                const el = document.getElementById(`drv-order-${o.id}`);
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
              },
            },
          },
        );
        // Browser-level notification when tab in background
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            const n = new Notification("فريش — طلب جديد لك 🚚", {
              body: `${o.customer_name} • ${o.customer_address}`,
              tag: `drv-${o.id}`,
              requireInteraction: false,
            });
            n.onclick = () => { window.focus(); n.close(); };
            setTimeout(() => n.close(), 12000);
          } catch {}
        }
      });
    }
    knownIdsRef.current = currentIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error("فشل التحديث");
    else if (status === "on_the_way") toast.success("تم استلام الطلب من المخزن ✅");
    else if (status === "delivered") toast.success("تم تسليم الطلب للزبون ✅");
  };

  return (
    <div dir="rtl" className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={freshLogo} alt="فريش Fresh" className="h-10 w-auto" />
            <div>
              <h1 className="text-lg font-bold text-secondary flex items-center gap-2">
                <Truck className="h-5 w-5" />لوحة السائق
                {hasNewFlash && (
                  <Badge className="animate-pulse bg-destructive text-destructive-foreground gap-1">
                    <Bell className="h-3 w-3" />طلب جديد!
                  </Badge>
                )}
              </h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSoundOn(!soundOn)} title={soundOn ? "إيقاف الصوت" : "تفعيل الصوت"}>
              {soundOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </Button>
            <Button asChild variant="outline" size="sm"><Link to="/"><ArrowRight className="h-4 w-4 ml-1" />المتجر</Link></Button>
            <Button onClick={signOut} variant="ghost" size="sm"><LogOut className="h-4 w-4 ml-1" />خروج</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <h2 className="text-xl font-bold mb-4">طلباتي ({orders.length})</h2>

        {loading ? (
          <p className="text-center py-12 text-muted-foreground">جاري التحميل...</p>
        ) : orders.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">لا توجد طلبات معينة لك حالياً</Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {orders.map((o) => {
              const isAssigned = o.status === "assigned";
              const isOnWay = o.status === "on_the_way";
              const isDelivered = o.status === "delivered";
              return (
                <Card key={o.id} id={`drv-order-${o.id}`} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-lg">{o.customer_name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleString("ar-IQ", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </div>
                    <Badge variant={isDelivered ? "outline" : "default"}>{STATUS_LABEL[o.status] ?? o.status}</Badge>
                  </div>

                  <div className="space-y-1 text-sm">
                    <a href={`tel:${o.customer_phone}`} className="flex items-center gap-2 text-primary hover:underline" dir="ltr">
                      <Phone className="h-4 w-4" />{o.customer_phone}
                    </a>
                    <p className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 shrink-0" /><span>{o.customer_address}</span></p>
                    {o.notes && <p className="text-muted-foreground border-r-2 border-primary pr-2">{o.notes}</p>}
                  </div>

                  <div className="border-t pt-2 space-y-1">
                    {(items[o.id] ?? []).map((it) => (
                      <div key={it.id} className="flex justify-between text-sm">
                        <span>{it.product_name} × {it.quantity} {it.unit}</span>
                        <span>{formatIQD(it.price_iqd * Number(it.quantity))}</span>
                      </div>
                    ))}
                    {o.delivery_fee_iqd > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground pt-1">
                        <span>🚚 رسوم التوصيل</span>
                        <span>{formatIQD(o.delivery_fee_iqd)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-xs text-muted-foreground">المبلغ المطلوب</span>
                    <span className="font-bold text-primary text-lg">{formatIQD(o.total_iqd)}</span>
                  </div>

                  {/* Driver action buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      onClick={() => updateStatus(o.id, "on_the_way")}
                      disabled={!isAssigned}
                      variant={isAssigned ? "default" : "outline"}
                      className="gap-1"
                    >
                      <PackageCheck className="h-4 w-4" />
                      {isAssigned ? "استلام الطلب" : "تم الاستلام ✓"}
                    </Button>
                    <Button
                      onClick={() => updateStatus(o.id, "delivered")}
                      disabled={!isOnWay}
                      variant={isOnWay ? "default" : "outline"}
                      className="gap-1 bg-primary"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {isDelivered ? "تم التوصيل ✓" : "تم التوصيل"}
                    </Button>
                  </div>

                  {/* Received amount field — driver confirms only */}
                  {(isOnWay || isDelivered) && (
                    <div className="space-y-1 pt-1 border-t">
                      <Label htmlFor={`amt-${o.id}`} className="text-xs">المبلغ المستلم من الزبون</Label>
                      <div className="flex gap-2">
                        <Input
                          id={`amt-${o.id}`}
                          inputMode="numeric"
                          dir="ltr"
                          value={receivedAmount[o.id] ?? String(o.total_iqd)}
                          onChange={(e) =>
                            setReceivedAmount((prev) => ({ ...prev, [o.id]: e.target.value.replace(/[^\d]/g, "") }))
                          }
                          placeholder={String(o.total_iqd)}
                        />
                        <span className="self-center text-xs text-muted-foreground">د.ع</span>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Driver;

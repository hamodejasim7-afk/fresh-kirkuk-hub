import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatIQD } from "@/lib/format";
import { toast } from "sonner";
import { LogOut, Phone, MapPin, ArrowRight, Truck, Bell, BellOff } from "lucide-react";
import freshLogo from "@/assets/fresh-logo.png";

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  notes: string | null;
  total_iqd: number;
  status: string;
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

const DRIVER_STATUSES: Record<string, string> = {
  assigned: "معين",
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
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => { localStorage.setItem("fresh_driver_sound", soundOn ? "1" : "0"); }, [soundOn]);

  const playBeep = () => {
    if (!soundOn) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = [
        { freq: 1046, start: 0.0, dur: 0.18 },
        { freq: 1318, start: 0.18, dur: 0.18 },
        { freq: 1568, start: 0.36, dur: 0.34 },
      ];
      notes.forEach(({ freq, start, dur }) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.value = freq;
        o.connect(g);
        g.connect(ctx.destination);
        const t0 = ctx.currentTime + start;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.start(t0);
        o.stop(t0 + dur + 0.05);
      });
    } catch {}
  };

  const load = async () => {
    setLoading(true);
    const { data: ordersData, error } = await supabase
      .from("orders")
      .select("*")
      .eq("driver_id", user!.id)
      .is("archived_at", null)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("فشل التحميل");
    } else {
      setOrders(ordersData ?? []);
      const ids = (ordersData ?? []).map((o) => o.id);
      if (ids.length > 0) {
        const { data: itemsData } = await supabase.from("order_items").select("*").in("order_id", ids);
        const grouped: Record<string, OrderItem[]> = {};
        (itemsData ?? []).forEach((it) => { (grouped[it.order_id] ||= []).push(it); });
        setItems(grouped);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel("driver-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `driver_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Detect newly assigned orders → beep + visual flash
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
      setTimeout(() => setHasNewFlash(false), 8000);
      toast.success(`🔔 تم تعيين ${newOnes.length} طلب جديد لك!`, { duration: 6000 });
      const original = document.title;
      document.title = `🔔 طلب جديد! — ${original}`;
      setTimeout(() => { document.title = original; }, 8000);
    }
    knownIdsRef.current = currentIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error("فشل التحديث");
    else toast.success("تم التحديث");
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSoundOn(!soundOn)}
              title={soundOn ? "إيقاف الصوت" : "تفعيل الصوت"}
            >
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
            {orders.map((o) => (
              <Card key={o.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{o.customer_name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleString("ar-IQ", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                  <Badge>{DRIVER_STATUSES[o.status] ?? o.status}</Badge>
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
                </div>

                <div className="flex items-center justify-between border-t pt-2">
                  <span className="font-bold text-primary text-lg">{formatIQD(o.total_iqd)}</span>
                  <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                    <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(DRIVER_STATUSES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Driver;

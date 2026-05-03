import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatIQD } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingUp, ShoppingBag, Package, XCircle } from "lucide-react";

interface OrderItemLite {
  product_name: string;
  quantity: number;
  price_iqd: number;
}
interface OrderLite {
  id: string;
  status: string;
  total_iqd: number;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  order_items: OrderItemLite[] | null;
}

const DailyReport = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || (role !== "admin" && role !== "accountant")) {
      navigate("/");
      return;
    }
    const load = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("orders")
        .select("id, status, total_iqd, created_at, customer_name, customer_phone, order_items(product_name, quantity, price_iqd)")
        .gte("created_at", today.toISOString())
        .order("created_at", { ascending: false });
      setOrders((data as OrderLite[]) ?? []);
      setLoading(false);
    };
    load();
  }, [user, role, navigate]);

  const delivered = orders.filter((o) => o.status === "delivered");
  const cancelled = orders.filter((o) => o.status === "cancelled");
  const totalRevenue = delivered.reduce((s, o) => s + Number(o.total_iqd), 0);

  const productCount: Record<string, number> = {};
  orders.forEach((o) => {
    o.order_items?.forEach((it) => {
      productCount[it.product_name] = (productCount[it.product_name] ?? 0) + Number(it.quantity);
    });
  });
  const topProducts = Object.entries(productCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const statusLabel: Record<string, { text: string; color: string }> = {
    new:        { text: "🆕 جديد",        color: "bg-blue-100 text-blue-800" },
    confirmed:  { text: "✅ مؤكد",         color: "bg-green-100 text-green-800" },
    preparing:  { text: "👨‍🍳 تحضير",       color: "bg-yellow-100 text-yellow-800" },
    delivering: { text: "🛵 توصيل",        color: "bg-orange-100 text-orange-800" },
    delivered:  { text: "🏠 تم التوصيل",   color: "bg-emerald-100 text-emerald-800" },
    cancelled:  { text: "❌ ملغي",         color: "bg-red-100 text-red-800" },
  };

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">جاري تحميل التقرير...</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">📊 التقرير اليومي</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("ar-IQ", {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
              })}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/admin")} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            الإدارة
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1"><TrendingUp className="h-4 w-4" /> إجمالي المبيعات</p>
            <p className="text-2xl font-bold text-primary">{formatIQD(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">الطلبات الموصّلة فقط</p>
          </Card>
          <Card className="p-4 space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1"><ShoppingBag className="h-4 w-4" /> طلبات اليوم</p>
            <p className="text-2xl font-bold">{orders.length}</p>
            <p className="text-xs text-muted-foreground">إجمالي الطلبات</p>
          </Card>
          <Card className="p-4 space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1"><Package className="h-4 w-4" /> موصّلة</p>
            <p className="text-2xl font-bold text-emerald-600">{delivered.length}</p>
            <p className="text-xs text-muted-foreground">تم التوصيل</p>
          </Card>
          <Card className="p-4 space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1"><XCircle className="h-4 w-4" /> ملغية</p>
            <p className="text-2xl font-bold text-destructive">{cancelled.length}</p>
            <p className="text-xs text-muted-foreground">طلبات ملغاة</p>
          </Card>
        </div>

        {/* Top Products */}
        {topProducts.length > 0 && (
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              🏆 أكثر المنتجات طلباً
            </h2>
            <div className="space-y-2">
              {topProducts.map(([name, qty], i) => (
                <div key={name} className="flex items-center justify-between rounded-md border bg-accent/30 p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      {i + 1}
                    </span>
                    <span className="font-medium">{name}</span>
                  </div>
                  <Badge variant="secondary">{qty} وحدة</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Orders List */}
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            📦 طلبات اليوم ({orders.length})
          </h2>
          {orders.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">لا توجد طلبات اليوم بعد</p>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => {
                const sl = statusLabel[o.status] ?? { text: o.status, color: "bg-gray-100 text-gray-800" };
                return (
                  <div key={o.id} className="rounded-lg border bg-card p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-semibold">{o.customer_name}</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">{o.customer_phone}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${sl.color}`}>
                          {sl.text}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(o.created_at).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm border-t pt-2">
                      <span className="text-muted-foreground">{o.order_items?.length ?? 0} منتج</span>
                      <span className="font-bold text-primary">{formatIQD(o.total_iqd)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default DailyReport;

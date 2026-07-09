import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatIQD } from "@/lib/format";
import { toast } from "sonner";
import {
  Printer, RotateCcw, Calendar, TrendingUp, Users, Package, LogOut, ArrowRight, UserPlus,
  MessageCircle, Settings, Bell, BellOff, Store, PowerOff, Download, Archive, Undo2, Trash2, FileSpreadsheet, Gift,
} from "lucide-react";
import freshLogo from "@/assets/fresh-logo.png";
import { buildOrderWhatsAppText, buildWhatsAppLink } from "@/lib/whatsapp";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { ProductsPanel } from "@/components/ProductsPanel";
import { BulkPriceUpdate } from "@/components/BulkPriceUpdate";
import { CategoriesPanel } from "@/components/CategoriesPanel";
import { PricingPanel } from "@/components/PricingPanel";
import { DeliveryZonesPanel } from "@/components/DeliveryZonesPanel";
import { STORE_PHONE, STORE_PHONE_TEL, STORE_LOCATION } from "@/lib/constants";
import { exportOrdersToExcel } from "@/lib/exportExcel";
import { ensureNotificationPermission, showOrderNotification } from "@/lib/notifications";
import { formatIQD as fmt } from "@/lib/format";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { PermissionsDialog } from "@/components/PermissionsDialog";
import { LoyaltyPanel } from "@/components/loyalty/LoyaltyPanel";

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
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  delivery_zone_id: string | null;
  delivery_zone_name: string | null;
  delivery_area_id: string | null;
  store_id: string;
  customer_id: string | null;
  stamp_added: boolean;
  created_by: string | null;
}

interface OrderItem {
  id: string;
  order_id: string;
  product_name: string;
  category: string | null;
  unit: string | null;
  price_iqd: number;
  quantity: number;
  created_at: string;
}

interface Driver {
  id: string;
  full_name: string | null;
  phone: string | null;
}

interface Staff {
  id: string;
  full_name: string | null;
  phone: string | null;
  roles: ("admin" | "driver" | "accountant")[];
}

const STATUS_LABEL: Record<string, string> = {
  new: "جديد",
  assigned: "معين لسائق",
  on_the_way: "قيد التوصيل",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new: "default",
  assigned: "secondary",
  on_the_way: "secondary",
  delivered: "outline",
  cancelled: "destructive",
};

const Admin = () => {
  const { signOut, user, role } = useAuth();
  const isAdmin = role === "admin";
  const { perms } = useStaffPermissions();
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Record<string, OrderItem[]>>({});
  const [archivedOrders, setArchivedOrders] = useState<Order[]>([]);
  const [archivedItems, setArchivedItems] = useState<Record<string, OrderItem[]>>({});
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  // Visual flash for incoming new orders
  const [hasNewFlash, setHasNewFlash] = useState(false);

  // Store WhatsApp settings (saved per-browser)
  const [storePhone, setStorePhone] = useState<string>(() => localStorage.getItem("fresh_store_phone") ?? "");
  const [autoSend, setAutoSend] = useState<boolean>(() => localStorage.getItem("fresh_auto_wa") === "1");
  const [soundOn, setSoundOn] = useState<boolean>(() => localStorage.getItem("fresh_sound") !== "0");
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => { localStorage.setItem("fresh_store_phone", storePhone); }, [storePhone]);
  useEffect(() => { localStorage.setItem("fresh_auto_wa", autoSend ? "1" : "0"); }, [autoSend]);
  useEffect(() => { localStorage.setItem("fresh_sound", soundOn ? "1" : "0"); }, [soundOn]);

  const playBeep = () => {
    if (!soundOn) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Pleasant 3-tone notification chime: C6 → E6 → G6
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
      // Repeat once after a short pause for stronger alert
      setTimeout(() => {
        try {
          const ctx2 = new (window.AudioContext || (window as any).webkitAudioContext)();
          const o = ctx2.createOscillator();
          const g = ctx2.createGain();
          o.type = "triangle";
          o.frequency.value = 1318;
          o.connect(g);
          g.connect(ctx2.destination);
          g.gain.setValueAtTime(0.0001, ctx2.currentTime);
          g.gain.exponentialRampToValueAtTime(0.3, ctx2.currentTime + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx2.currentTime + 0.4);
          o.start();
          o.stop(ctx2.currentTime + 0.45);
        } catch {}
      }, 900);
    } catch {}
  };

  const sendOrderToWhatsApp = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      toast.error("الطلب غير موجود بعد، أعد المحاولة");
      return;
    }
    if (!storePhone.trim()) {
      toast.error("أدخل رقم المتجر في الإعدادات أولاً");
      return;
    }
    const text = buildOrderWhatsAppText(order, items[orderId] ?? []);
    const url = buildWhatsAppLink(storePhone, text);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const loadData = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);

    // Active orders only (not archived)
    const { data: ordersData, error: ordersErr } = await supabase
      .from("orders")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    if (ordersErr) {
      if (!opts?.silent) toast.error("فشل تحميل الطلبات");
      console.error(ordersErr);
    } else {
      // Smooth diff: only update state if something actually changed (avoids re-render flash)
      setOrders((prev) => {
        const next = ordersData ?? [];
        if (prev.length === next.length) {
          let same = true;
          for (let i = 0; i < prev.length; i++) {
            const a = prev[i], b = next[i];
            if (a.id !== b.id || a.status !== b.status || a.driver_id !== b.driver_id || a.updated_at !== b.updated_at) {
              same = false; break;
            }
          }
          if (same) return prev;
        }
        return next;
      });

      const ids = (ordersData ?? []).map((o) => o.id);
      if (ids.length > 0) {
        const { data: itemsData } = await supabase
          .from("order_items")
          .select("*")
          .in("order_id", ids);
        const grouped: Record<string, OrderItem[]> = {};
        (itemsData ?? []).forEach((it) => {
          (grouped[it.order_id] ||= []).push(it);
        });
        // Diff: only update items state if changed (avoid re-render flash)
        setItems((prev) => {
          const prevKeys = Object.keys(prev);
          const nextKeys = Object.keys(grouped);
          if (prevKeys.length === nextKeys.length) {
            let same = true;
            for (const k of nextKeys) {
              const a = prev[k], b = grouped[k];
              if (!a || a.length !== b.length) { same = false; break; }
              for (let i = 0; i < a.length; i++) {
                if (a[i].id !== b[i].id || a[i].quantity !== b[i].quantity || a[i].price_iqd !== b[i].price_iqd) {
                  same = false; break;
                }
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

    // All staff (admins + drivers + accountants)
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("user_id, role");
    const rolesByUser = new Map<string, ("admin" | "driver" | "accountant")[]>();
    (rolesData ?? []).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as "admin" | "driver" | "accountant");
      rolesByUser.set(r.user_id, arr);
    });
    const allIds = Array.from(rolesByUser.keys());

    if (allIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", allIds);
      const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
      const staffList: Staff[] = allIds.map((id) => ({
        id,
        full_name: profMap.get(id)?.full_name ?? null,
        phone: profMap.get(id)?.phone ?? null,
        roles: rolesByUser.get(id) ?? [],
      }));
      // Diff staff
      setStaff((prev) => {
        if (prev.length === staffList.length) {
          const sig = (s: Staff) => `${s.id}|${s.full_name}|${s.phone}|${[...s.roles].sort().join(",")}`;
          const a = prev.map(sig).sort().join(";");
          const b = staffList.map(sig).sort().join(";");
          if (a === b) return prev;
        }
        return staffList;
      });
      const nextDrivers = staffList
        .filter((s) => s.roles.includes("driver"))
        .map((s) => ({ id: s.id, full_name: s.full_name, phone: s.phone }));
      setDrivers((prev) => {
        if (prev.length === nextDrivers.length) {
          const sig = (d: Driver) => `${d.id}|${d.full_name}|${d.phone}`;
          const a = prev.map(sig).sort().join(";");
          const b = nextDrivers.map(sig).sort().join(";");
          if (a === b) return prev;
        }
        return nextDrivers;
      });
    } else {
      setStaff((prev) => (prev.length === 0 ? prev : []));
      setDrivers((prev) => (prev.length === 0 ? prev : []));
    }

    if (!opts?.silent) setLoading(false);
  };

  useEffect(() => {
    loadData();

    // Ask the user for notification permission once (admin/accountant)
    ensureNotificationPermission().catch(() => {});

    // Realtime updates for orders, items, roles, profiles — silent (no loading flash)
    const channel = supabase
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadData({ silent: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => loadData({ silent: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => loadData({ silent: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadData({ silent: true }))
      .subscribe();

    // Fallback silent polling every 5s (skipped when tab hidden) in case realtime drops
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") loadData({ silent: true });
    }, 5000);

    // Reload immediately when tab becomes visible again
    const onVisible = () => {
      if (document.visibilityState === "visible") loadData({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect newly arrived orders → beep + browser notification + toast (smooth, no full reload)
  useEffect(() => {
    if (orders.length === 0) return;
    const currentIds = new Set(orders.map((o) => o.id));

    if (!initializedRef.current) {
      knownIdsRef.current = currentIds;
      initializedRef.current = true;
      return;
    }

    const newOnes = orders.filter((o) => !knownIdsRef.current.has(o.id));
    if (newOnes.length > 0) {
      playBeep();
      // Subtle pulsing badge in header for 8 seconds (no page-wide flash)
      setHasNewFlash(true);
      setTimeout(() => setHasNewFlash(false), 8000);

      // In-app toast with click-to-jump
      newOnes.forEach((o) => {
        const its = items[o.id] ?? [];
        const summary = its.length > 0
          ? its.map((it) => `${it.product_name}×${it.quantity}`).join(" • ")
          : "طلب جديد";
        toast.success(`🔔 ${o.customer_name} — ${fmt(o.total_iqd)}`, {
          description: summary,
          duration: 9000,
          action: {
            label: "فتح",
            onClick: () => {
              const el = document.getElementById(`order-row-${o.id}`);
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
            },
          },
        });
        // Browser-level notification (works in background tab / locked screen while browser open)
        showOrderNotification({
          title: "فريش — طلب جديد وصل",
          body: `${o.customer_name} • ${fmt(o.total_iqd)}\n${summary}`,
          tag: `order-${o.id}`,
          onClick: () => {
            const el = document.getElementById(`order-row-${o.id}`);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
          },
        });
      });

      if (autoSend && storePhone.trim()) {
        // Wait briefly so order_items load too
        setTimeout(() => {
          newOnes.forEach((o) => {
            const text = buildOrderWhatsAppText(o, items[o.id] ?? []);
            window.open(buildWhatsAppLink(storePhone, text), "_blank", "noopener,noreferrer");
          });
        }, 600);
      }
    }
    knownIdsRef.current = currentIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error("فشل التحديث");
    else toast.success("تم تحديث الحالة");
  };

  const assignDriver = async (orderId: string, driverId: string) => {
    const newStatus = driverId ? "assigned" : "new";
    const { error } = await supabase
      .from("orders")
      .update({ driver_id: driverId || null, status: newStatus })
      .eq("id", orderId);
    if (error) toast.error("فشل تعيين السائق");
    else toast.success("تم تعيين السائق");
  };

  // Stats (today, this month, this year) — based on created_at of active orders
  const stats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    const acc = { today: 0, todayCount: 0, month: 0, monthCount: 0, year: 0, yearCount: 0, all: 0, allCount: orders.length };
    for (const o of orders) {
      const t = new Date(o.created_at).getTime();
      if (o.status === "cancelled") continue;
      acc.all += o.total_iqd;
      if (t >= startOfYear) { acc.year += o.total_iqd; acc.yearCount++; }
      if (t >= startOfMonth) { acc.month += o.total_iqd; acc.monthCount++; }
      if (t >= startOfDay) { acc.today += o.total_iqd; acc.todayCount++; }
    }
    return acc;
  }, [orders]);

  const printReport = () => {
    window.print();
  };

  const loadArchive = async () => {
    const { data: ordersData, error } = await supabase
      .from("orders")
      .select("*")
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("فشل تحميل الأرشيف");
      return;
    }
    setArchivedOrders(ordersData ?? []);
    const ids = (ordersData ?? []).map((o) => o.id);
    if (ids.length > 0) {
      const { data: itemsData } = await supabase
        .from("order_items").select("*").in("order_id", ids);
      const grouped: Record<string, OrderItem[]> = {};
      (itemsData ?? []).forEach((it) => { (grouped[it.order_id] ||= []).push(it); });
      setArchivedItems(grouped);
    } else {
      setArchivedItems({});
    }
  };

  const exportOrdersCSV = (ordersList: Order[], itemsMap: Record<string, OrderItem[]>, filename: string) => {
    if (ordersList.length === 0) {
      toast.error("لا توجد طلبات للتصدير");
      return;
    }
    const escape = (v: any) => {
      const s = String(v ?? "");
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const headers = ["رقم الطلب","التاريخ","الاسم","الهاتف","العنوان","الحالة","المجموع IQD","ملاحظات","المنتجات"];
    const rows = ordersList.map((o) => {
      const its = itemsMap[o.id] ?? [];
      const itsStr = its.map((it) => `${it.product_name} x${it.quantity} (${it.price_iqd})`).join(" | ");
      return [
        o.id, new Date(o.created_at).toLocaleString("ar-IQ"),
        o.customer_name, o.customer_phone, o.customer_address,
        STATUS_LABEL[o.status] ?? o.status, o.total_iqd, o.notes ?? "", itsStr,
      ].map(escape).join(",");
    });
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تنزيل الملف");
  };

  const restoreOrder = async (id: string) => {
    const { error } = await supabase
      .from("orders").update({ archived_at: null }).eq("id", id);
    if (error) {
      toast.error("فشل الاستعادة: " + error.message);
    } else {
      toast.success("تم استعادة الطلب");
      loadArchive();
      loadData();
    }
  };

  const resetSales = async () => {
    console.log("resetSales called");
    toast.info("جاري التصفير...");
    // Backup XLSX first (auto)
    const today = new Date().toISOString().slice(0, 10);
    try {
      exportOrdersToExcel(orders, items, `fresh-backup-${today}.xlsx`);
    } catch (e) {
      console.error(e);
    }

    // Try to archive all non-archived orders
    const { data: ordersToArchive, error: fetchError } = await supabase
      .from("orders")
      .select("id")
      .is("archived_at", null);

    if (fetchError) {
      toast.error("فشل جلب الطلبات: " + fetchError.message);
      return;
    }

    if (!ordersToArchive || ordersToArchive.length === 0) {
      toast.info("لا توجد طلبات لأرشفتها");
      return;
    }

    const ids = ordersToArchive.map((o) => o.id);

    const { error } = await supabase
      .from("orders")
      .update({ archived_at: new Date().toISOString() })
      .in("id", ids);

    if (error) {
      toast.error("فشل التصفير: " + error.message);
      console.error("Archive error:", error);
    } else {
      toast.success(`تم أرشفة ${ids.length} طلب بنجاح ✓`);
      loadData();
      loadArchive();
    }
  };

  // Permanently delete entire archive (admin only) — exports XLSX first, then hard DELETE
  const purgeArchive = async () => {
    if (!isAdmin) {
      toast.error("هذه العملية للمدير فقط");
      return;
    }
    // Fetch latest archive directly (don't rely on state)
    const { data: archOrders, error: fetchErr } = await supabase
      .from("orders")
      .select("*")
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false });
    if (fetchErr) {
      toast.error("فشل تحميل الأرشيف: " + fetchErr.message);
      return;
    }
    if (!archOrders || archOrders.length === 0) {
      toast.error("لا يوجد أرشيف لتصفيره");
      return;
    }
    const ids = archOrders.map((o) => o.id);
    const { data: archItems } = await supabase
      .from("order_items").select("*").in("order_id", ids);
    const itemsMap: Record<string, OrderItem[]> = {};
    (archItems ?? []).forEach((it) => { (itemsMap[it.order_id] ||= []).push(it as any); });

    // Step 1: Export Excel report (mandatory before deletion)
    const today = new Date().toISOString().slice(0, 10);
    try {
      exportOrdersToExcel(archOrders as any, itemsMap, `fresh-archive-FINAL-${today}.xlsx`);
    } catch (e) {
      console.error(e);
      toast.error("فشل تصدير التقرير — تم إلغاء التصفير");
      return;
    }
    toast.info(`تم حفظ تقرير Excel (${archOrders.length} طلب)... جاري الحذف النهائي`);

    // Step 2: Hard DELETE order_items first (no FK cascade configured)
    const { error: delItemsErr } = await supabase
      .from("order_items")
      .delete()
      .in("order_id", ids);
    if (delItemsErr) {
      toast.error("فشل حذف عناصر الأرشيف: " + delItemsErr.message);
      return;
    }
    // Step 3: Hard DELETE orders
    const { error: delErr } = await supabase
      .from("orders")
      .delete()
      .in("id", ids);
    if (delErr) {
      toast.error("فشل حذف الأرشيف: " + delErr.message);
      return;
    }
    toast.success(`✅ تم تصفير الأرشيف نهائياً (${ids.length} طلب محذوف) — Excel محفوظ`);
    setArchivedOrders([]);
    setArchivedItems({});
  };

  return (
    <div dir="rtl" className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-card print:hidden">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={freshLogo} alt="فريش Fresh" className="h-10 w-auto" />
            <div>
              <h1 className="text-lg font-bold text-secondary flex items-center gap-2">
                لوحة الإدارة
                <Badge variant={isAdmin ? "default" : "secondary"} className="text-[10px]">
                  {isAdmin ? "مدير" : "محاسب"}
                </Badge>
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
            <a
              href={`tel:${STORE_PHONE_TEL}`}
              className="hidden md:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              dir="ltr"
            >
              📞 {STORE_PHONE}
            </a>
            <span className="hidden md:inline text-xs text-muted-foreground">📍 {STORE_LOCATION}</span>
            <Button asChild variant="outline" size="sm">
              <Link to="/"><ArrowRight className="h-4 w-4 ml-1" />المتجر</Link>
            </Button>
            <Button onClick={signOut} variant="ghost" size="sm">
              <LogOut className="h-4 w-4 ml-1" />خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Calendar />} label="مبيعات اليوم" value={formatIQD(stats.today)} sub={`${stats.todayCount} طلب`} />
          <StatCard icon={<TrendingUp />} label="مبيعات الشهر" value={formatIQD(stats.month)} sub={`${stats.monthCount} طلب`} />
          <StatCard icon={<TrendingUp />} label="مبيعات السنة" value={formatIQD(stats.year)} sub={`${stats.yearCount} طلب`} />
          <StatCard icon={<Package />} label="إجمالي نشط" value={formatIQD(stats.all)} sub={`${stats.allCount} طلب`} />
        </div>

        {/* Store open/closed control — admin only */}
        {isAdmin && <StoreStatusCard />}

        {/* WhatsApp / notifications settings — admin only (system settings hidden from accountant) */}
        {isAdmin && (
          <Card className="p-4 print:hidden">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4" />إعدادات الإشعارات والواتساب
            </h3>
            <div className="grid gap-3 md:grid-cols-3 items-end">
              <div className="space-y-1">
                <Label htmlFor="store-phone">رقم واتساب المتجر</Label>
                <Input
                  id="store-phone"
                  value={storePhone}
                  onChange={(e) => setStorePhone(e.target.value)}
                  placeholder="07XX XXX XXXX"
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">عراقي: يكفي 07XXXXXXXXX</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSend}
                  onChange={(e) => setAutoSend(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm">فتح واتساب تلقائياً عند كل طلب جديد</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={soundOn}
                  onChange={(e) => setSoundOn(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm flex items-center gap-1">
                  {soundOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                  صوت تنبيه عند الطلب الجديد
                </span>
              </label>
            </div>
            <NotificationPermissionRow />
            <p className="text-xs text-muted-foreground mt-3">
              💡 الإرسال يفتح واتساب ويب/التطبيق برسالة جاهزة فيها كل تفاصيل الطلب — مجاني تماماً.
              للفتح التلقائي اسمح للمتصفح بفتح النوافذ المنبثقة لهذا الموقع.
            </p>
          </Card>
        )}

        {/* Accountant: minimal notifications row only (system settings hidden) */}
        {!isAdmin && (
          <Card className="p-4 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4" />التنبيهات
              </h3>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={soundOn}
                    onChange={(e) => setSoundOn(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  صوت تنبيه عند الطلب الجديد
                </label>
                <NotificationPermissionRow inline />
              </div>
            </div>
          </Card>
        )}

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {(isAdmin || perms.view_reports) && (
            <Button onClick={printReport} variant="outline" className="gap-2">
              <Printer className="h-4 w-4" />طباعة التقرير
            </Button>
          )}

          {(isAdmin || perms.view_reports) && (
            <Button
              onClick={() => exportOrdersToExcel(orders, items, `fresh-active-${new Date().toISOString().slice(0,10)}.xlsx`)}
              variant="outline" className="gap-2" disabled={orders.length === 0}
            >
              <FileSpreadsheet className="h-4 w-4" />تصدير Excel
            </Button>
          )}

          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2" disabled={orders.length === 0}>
                  <RotateCcw className="h-4 w-4" />تصفير المبيعات
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>تأكيد تصفير المبيعات</AlertDialogTitle>
                  <AlertDialogDescription>
                    سيتم أرشفة جميع الطلبات الحالية ({orders.length} طلب) وإعادة تصفير العدادات.
                    <br />✅ <strong>سيتم تنزيل نسخة احتياطية Excel تلقائياً</strong> قبل التصفير.
                    <br />📦 الطلبات تُحفظ في تبويب "الأرشيف" ويمكن استعادتها لاحقاً.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={resetSales} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    نعم، صفّر المبيعات
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <Tabs defaultValue="orders" onValueChange={(v) => { if (v === "archive") loadArchive(); }}>
          <TabsList className="print:hidden flex-wrap h-auto">
            {(isAdmin || perms.manage_orders) && (
              <TabsTrigger value="orders">الطلبات ({orders.length})</TabsTrigger>
            )}
            {(isAdmin || perms.manage_pricing) && (
              <TabsTrigger value="pricing">التسعير</TabsTrigger>
            )}
            {(isAdmin || perms.manage_pricing) && (
              <TabsTrigger value="delivery-zones">أسعار التوصيل</TabsTrigger>
            )}
            {(isAdmin || perms.manage_products) && (
              <TabsTrigger value="products">المنتجات</TabsTrigger>
            )}
            {(isAdmin || perms.manage_categories) && (
              <TabsTrigger value="categories">الفئات</TabsTrigger>
            )}
            {(isAdmin || perms.view_reports) && (
              <TabsTrigger value="archive" className="gap-1"><Archive className="h-3.5 w-3.5" />الأرشيف</TabsTrigger>
            )}
            {(isAdmin || perms.manage_drivers) && (
              <TabsTrigger value="staff">الموظفون ({staff.length})</TabsTrigger>
            )}
            {(isAdmin || perms.manage_drivers) && (
              <TabsTrigger value="drivers">السواق ({drivers.length})</TabsTrigger>
            )}
            <TabsTrigger value="loyalty" className="gap-1"><Gift className="h-3.5 w-3.5" />بطاقة الولاء</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="mt-4">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الزبون</TableHead>
                      <TableHead className="text-right">الهاتف</TableHead>
                      <TableHead className="text-right">العنوان</TableHead>
                      <TableHead className="text-right">المنتجات</TableHead>
                      <TableHead className="text-right">المجموع</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right print:hidden">السائق</TableHead>
                      <TableHead className="text-right print:hidden">إجراءات</TableHead>
                      <TableHead className="text-right print:hidden">واتساب</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
                    ) : orders.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">لا توجد طلبات نشطة</TableCell></TableRow>
                    ) : (
                      orders.map((o) => (
                        <TableRow key={o.id} id={`order-row-${o.id}`}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(o.created_at).toLocaleString("ar-IQ", { dateStyle: "short", timeStyle: "short" })}
                          </TableCell>
                          <TableCell className="font-medium">{o.customer_name}</TableCell>
                          <TableCell dir="ltr" className="text-right">{o.customer_phone}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={o.customer_address}>{o.customer_address}</TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="link" size="sm" className="h-auto p-0">
                                  {(items[o.id]?.length ?? 0)} منتج
                                </Button>
                              </DialogTrigger>
                              <DialogContent dir="rtl">
                                <DialogHeader>
                                  <DialogTitle>تفاصيل الطلب</DialogTitle>
                                  <DialogDescription>{o.customer_name} — {o.customer_phone}</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-2">
                                  {(items[o.id] ?? []).map((it) => (
                                    <div key={it.id} className="flex justify-between border-b pb-1">
                                      <span>{it.product_name} × {it.quantity} {it.unit}</span>
                                      <span className="font-semibold">{formatIQD(it.price_iqd * Number(it.quantity))}</span>
                                    </div>
                                  ))}
                                  {o.delivery_fee_iqd > 0 && (
                                    <div className="flex justify-between text-sm pt-1">
                                      <span>🚚 رسوم التوصيل{o.delivery_zone_name ? ` (${o.delivery_zone_name})` : ""}</span>
                                      <span className="font-semibold">{formatIQD(o.delivery_fee_iqd)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between pt-2 font-bold text-primary">
                                    <span>المجموع الكلي</span>
                                    <span>{formatIQD(o.total_iqd)}</span>
                                  </div>
                                  {o.notes && (
                                    <p className="text-sm text-muted-foreground border-t pt-2">ملاحظات: {o.notes}</p>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                          <TableCell className="font-bold text-primary whitespace-nowrap">{formatIQD(o.total_iqd)}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[o.status] ?? "default"}>{STATUS_LABEL[o.status] ?? o.status}</Badge>
                          </TableCell>
                          <TableCell className="print:hidden">
                            <Select value={o.driver_id ?? "none"} onValueChange={(v) => assignDriver(o.id, v === "none" ? "" : v)}>
                              <SelectTrigger className="w-[140px]"><SelectValue placeholder="اختر سائق" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">بدون سائق</SelectItem>
                                {drivers.map((d) => (
                                  <SelectItem key={d.id} value={d.id}>{d.full_name || "سائق"}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="print:hidden">
                            <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>{v}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="print:hidden">
                            <Button
                              size="sm"
                              onClick={() => sendOrderToWhatsApp(o.id)}
                              className="gap-1 bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90"
                              title="إرسال الطلب إلى رقم المتجر على واتساب"
                            >
                              <MessageCircle className="h-4 w-4" />إرسال
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="pricing" className="mt-4">
            <PricingPanel />
          </TabsContent>

          <TabsContent value="delivery-zones" className="mt-4">
            <DeliveryZonesPanel />
          </TabsContent>

          <TabsContent value="products" className="mt-4 space-y-4">
            {(role?.trim().toLowerCase() === "admin" || role?.trim().toLowerCase() === "accountant") && (
              <BulkPriceUpdate />
            )}
            <ProductsPanel />
          </TabsContent>

          <TabsContent value="categories" className="mt-4">
            <CategoriesPanel />
          </TabsContent>

          <TabsContent value="archive" className="mt-4">
            <Card className="p-4">
              {isAdmin && archivedOrders.length > 0 && (
                <div className="mb-3 flex justify-end">
                  <PurgeArchiveButton
                    count={archivedOrders.length}
                    onConfirm={purgeArchive}
                  />
                </div>
              )}
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <Archive className="h-4 w-4" />الطلبات المؤرشفة ({archivedOrders.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">آخر 500 طلب مؤرشف — يمكن الاستعادة أو التصدير</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={loadArchive} variant="outline" size="sm">تحديث</Button>
                  <Button
                    onClick={() => exportOrdersToExcel(archivedOrders, archivedItems, `fresh-archive-${new Date().toISOString().slice(0,10)}.xlsx`)}
                    variant="outline" size="sm" className="gap-1"
                    disabled={archivedOrders.length === 0}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />تصدير Excel
                  </Button>
                </div>
              </div>
              {archivedOrders.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground text-sm">لا توجد طلبات مؤرشفة</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>الزبون</TableHead>
                        <TableHead>الهاتف</TableHead>
                        <TableHead>المجموع</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>أُرشف في</TableHead>
                        <TableHead>إجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archivedOrders.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="text-xs">{new Date(o.created_at).toLocaleDateString("ar-IQ")}</TableCell>
                          <TableCell className="font-medium">{o.customer_name}</TableCell>
                          <TableCell dir="ltr" className="text-xs">{o.customer_phone}</TableCell>
                          <TableCell>{formatIQD(o.total_iqd)}</TableCell>
                          <TableCell><Badge variant={STATUS_VARIANT[o.status] ?? "outline"}>{STATUS_LABEL[o.status] ?? o.status}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {o.archived_at ? new Date(o.archived_at).toLocaleDateString("ar-IQ") : "-"}
                          </TableCell>
                          <TableCell>
                            <Button onClick={() => restoreOrder(o.id)} size="sm" variant="outline" className="gap-1">
                              <Undo2 className="h-3.5 w-3.5" />استعادة
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="staff" className="mt-4">
            <StaffPanel staff={staff} reload={loadData} currentUserId={user?.id ?? ""} isAdmin={isAdmin} />
          </TabsContent>

          <TabsContent value="drivers" className="mt-4">
            <DriversPanel drivers={drivers} reload={loadData} />
          </TabsContent>
          <TabsContent value="loyalty" className="mt-4">
            <LoyaltyPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

// Double-confirmation button for permanently purging the archive
const PurgeArchiveButton = ({ count, onConfirm }: { count: number; onConfirm: () => void }) => {
  const [step, setStep] = useState<"closed" | "first" | "second">("closed");
  const [confirmText, setConfirmText] = useState("");

  const reset = () => {
    setStep("closed");
    setConfirmText("");
  };

  return (
    <>
      <Button
        size="sm"
        variant="destructive"
        className="gap-1"
        disabled={count === 0}
        onClick={() => setStep("first")}
      >
        <Archive className="h-4 w-4" />تصفير الأرشيف بالكامل
      </Button>

      <AlertDialog open={step === "first"} onOpenChange={(o) => !o && reset()}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ تحذير: حذف نهائي للأرشيف</AlertDialogTitle>
            <AlertDialogDescription>
              ستقوم بحذف <strong>{count} طلب مؤرشف</strong> نهائياً ولا يمكن التراجع.
              <br />✅ سيتم تنزيل تقرير Excel كامل تلقائياً قبل الحذف.
              <br />⛔ بعد الحذف لن تتمكن من استعادة هذه الطلبات أبداً.
              <br /><br />هل تريد المتابعة للخطوة الثانية من التأكيد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={reset}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => setStep("second")}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              متابعة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={step === "second"} onOpenChange={(o) => !o && reset()}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد نهائي</AlertDialogTitle>
            <AlertDialogDescription>
              للتأكيد النهائي، اكتب كلمة <strong>تصفير</strong> في الحقل أدناه ثم اضغط حذف.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="اكتب: تصفير"
            className="my-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={reset}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText.trim() !== "تصفير"}
              onClick={() => { onConfirm(); reset(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              نعم، احذف الأرشيف نهائياً
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const StatCard = ({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) => (
  <Card className="p-4">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-secondary mt-1">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </div>
      <div className="text-primary opacity-70">{icon}</div>
    </div>
  </Card>
);

const DriversPanel = ({ drivers, reload }: { drivers: Driver[]; reload: () => void }) => {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const grantDriver = async () => {
    if (!email.trim()) return;
    setBusy(true);

    // Find user by email through profiles -> auth (we can't query auth.users from client).
    // Workaround: ask admin to enter the user_id from the user's profile after they signed up.
    // Simpler approach: lookup via RPC. For now we look up using profiles table is not enough (no email).
    // We'll require the admin to use the user's UID from the auth section, or list signups on profiles.
    toast.info("لإضافة سائق: اطلب منه إنشاء حساب من صفحة الدخول، ثم أدخل بريده هنا.");

    // Use RPC-less approach: call edge would be ideal. As a pragmatic path, attempt to find via profiles where full_name matches email isn't right.
    // We'll fallback: accept the user_id directly.
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-semibold mb-2 flex items-center gap-2"><UserPlus className="h-4 w-4" />إضافة سائق</h3>
        <p className="text-sm text-muted-foreground mb-3">
          الخطوات: 1) اطلب من السائق إنشاء حساب من <Link to="/auth" className="text-primary underline">صفحة الدخول</Link>.
          2) انسخ معرّف المستخدم (User ID) من قسم Lovable Cloud → Users.
          3) ألصقه أدناه لمنحه صلاحية سائق.
        </p>
        <GrantRoleForm onDone={reload} />
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2">
          <Users className="h-4 w-4" />
          <h3 className="font-semibold">السواق المسجلون</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-right">الهاتف</TableHead>
              <TableHead className="text-right">المعرّف</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drivers.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">لا يوجد سواق بعد</TableCell></TableRow>
            ) : (
              drivers.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.full_name || "—"}</TableCell>
                  <TableCell dir="ltr" className="text-right">{d.phone || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground" dir="ltr">{d.id}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

const GrantRoleForm = ({ onDone }: { onDone: () => void }) => {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"driver" | "admin">("driver");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId.trim(), role });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "هذا الدور ممنوح مسبقاً" : "فشل: " + error.message);
    } else {
      toast.success("تم منح الصلاحية");
      setUserId("");
      onDone();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 space-y-1">
          <Label htmlFor="uid">معرّف المستخدم (User ID)</Label>
          <Input id="uid" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" dir="ltr" />
        </div>
        <div className="space-y-1">
          <Label>الدور</Label>
          <Select value={role} onValueChange={(v) => setRole(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="driver">سائق</SelectItem>
              <SelectItem value="admin">مدير</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={busy}>{busy ? "..." : "منح الصلاحية"}</Button>
    </form>
  );
};

const StaffPanel = ({
  staff,
  reload,
  currentUserId,
  isAdmin,
}: {
  staff: Staff[];
  reload: () => void;
  currentUserId: string;
  isAdmin: boolean;
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"driver" | "admin" | "accountant">("driver");
  const [busy, setBusy] = useState(false);
  const [permsTarget, setPermsTarget] = useState<{ id: string; name: string } | null>(null);

  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("الإيميل وكلمة السر مطلوبان");
      return;
    }
    if (password.length < 6) {
      toast.error("كلمة السر يجب أن تكون 6 أحرف فأكثر");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("create-staff", {
      body: {
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        phone: phone.trim(),
        role,
      },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "فشل إنشاء الحساب");
      return;
    }
    const roleLabel = role === "admin" ? "المدير" : role === "accountant" ? "المحاسب" : "السائق";
    toast.success(`تم إنشاء حساب ${roleLabel} بنجاح`);
    setEmail("");
    setPassword("");
    setFullName("");
    setPhone("");
    reload();
  };

  const removeStaff = async (id: string) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("delete-staff", {
      body: { user_id: id },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "فشل الحذف");
      return;
    }
    toast.success("تم حذف الموظف");
    reload();
  };

  // Swap a staff member's role between driver and accountant (admin or accountant can do this)
  const swapRole = async (s: Staff, target: "driver" | "accountant") => {
    if (s.roles.includes("admin")) {
      toast.error("لا يمكن تعديل دور المدير من هنا");
      return;
    }
    // Get current changeable role row (driver or accountant). If the user already has the target, no-op.
    const current = s.roles.find((r) => r === "driver" || r === "accountant");
    if (!current) {
      toast.error("لا يوجد دور قابل للتعديل لهذا الموظف");
      return;
    }
    if (current === target) {
      toast.info("الموظف لديه هذا الدور بالفعل");
      return;
    }
    setBusy(true);
    // Update the row in user_roles where user_id matches and role = current
    const { error } = await supabase
      .from("user_roles")
      .update({ role: target })
      .eq("user_id", s.id)
      .eq("role", current);
    setBusy(false);
    if (error) {
      toast.error("فشل تعديل الدور: " + error.message);
      return;
    }
    toast.success(`تم تغيير الدور إلى ${target === "accountant" ? "محاسب" : "سائق"}`);
    reload();
  };

  const generatePassword = () => {
    const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let p = "";
    for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setPassword(p);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4" />إضافة موظف جديد (إنشاء حساب كامل)
        </h3>
        <form onSubmit={createStaff} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="staff-name">الاسم الكامل</Label>
            <Input
              id="staff-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="اسم الموظف"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="staff-phone">رقم الهاتف</Label>
            <Input
              id="staff-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XX XXX XXXX"
              dir="ltr"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="staff-email">الإيميل *</Label>
            <Input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@example.com"
              dir="ltr"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="staff-password">كلمة السر المؤقتة *</Label>
            <div className="flex gap-2">
              <Input
                id="staff-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 أحرف على الأقل"
                dir="ltr"
                required
              />
              <Button type="button" variant="outline" onClick={generatePassword}>
                توليد
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label>الدور *</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "driver" | "admin" | "accountant")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="driver">سائق توصيل</SelectItem>
                {isAdmin && <SelectItem value="accountant">محاسب</SelectItem>}
                {isAdmin && <SelectItem value="admin">مدير</SelectItem>}
              </SelectContent>
            </Select>
            {!isAdmin && (
              <p className="text-[10px] text-muted-foreground">المحاسب يستطيع إنشاء سائقين فقط</p>
            )}
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={busy} className="w-full gap-2">
              <UserPlus className="h-4 w-4" />
              {busy ? "جاري الإنشاء..." : "إنشاء الحساب"}
            </Button>
          </div>
        </form>
        <p className="text-xs text-muted-foreground mt-3">
          💡 شارك الإيميل وكلمة السر مع الموظف ليدخل من صفحة الدخول. ينصح بتغيير كلمة السر بعد أول دخول.
        </p>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2">
          <Users className="h-4 w-4" />
          <h3 className="font-semibold">جميع الموظفين ({staff.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">الأدوار</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                    لا يوجد موظفون بعد
                  </TableCell>
                </TableRow>
              ) : (
                staff.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name || "—"}</TableCell>
                    <TableCell dir="ltr" className="text-right">{s.phone || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {s.roles.map((r) => (
                          <Badge
                            key={r}
                            variant={r === "admin" ? "default" : r === "accountant" ? "outline" : "secondary"}
                          >
                            {r === "admin" ? "مدير" : r === "accountant" ? "محاسب" : "سائق"}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        if (s.id === currentUserId) {
                          return <span className="text-xs text-muted-foreground">(أنت)</span>;
                        }
                        const isAdminRow = s.roles.includes("admin");
                        // Role-edit eligibility: target is a single driver/accountant (not admin), and user is admin or accountant
                        const canEditRole =
                          !isAdminRow &&
                          s.roles.some((r) => r === "driver" || r === "accountant");
                        // Delete: admins delete anyone (not self); accountants delete only pure drivers
                        const isPureDriver =
                          s.roles.length > 0 && s.roles.every((r) => r === "driver");
                        const canDelete = isAdmin || (!isAdmin && isPureDriver);
                        if (!canEditRole && !canDelete) {
                          return <span className="text-xs text-muted-foreground">—</span>;
                        }
                        const currentSwap = s.roles.find((r) => r === "driver" || r === "accountant");
                        const target: "driver" | "accountant" = currentSwap === "driver" ? "accountant" : "driver";
                        return (
                          <div className="flex gap-1 flex-wrap">
                            {isAdmin && !isAdminRow && (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={busy}
                                onClick={() => setPermsTarget({ id: s.id, name: s.full_name || "موظف" })}
                              >
                                صلاحيات
                              </Button>
                            )}
                            {canEditRole && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline" disabled={busy}>
                                    تعديل الدور
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent dir="rtl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>تغيير دور الموظف</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      سيتم تغيير دور <strong>{s.full_name || "هذا الموظف"}</strong> من
                                      <Badge variant="secondary" className="mx-1">
                                        {currentSwap === "accountant" ? "محاسب" : "سائق"}
                                      </Badge>
                                      إلى
                                      <Badge variant="secondary" className="mx-1">
                                        {target === "accountant" ? "محاسب" : "سائق"}
                                      </Badge>
                                      .<br />سيتم تحديث ما يراه فوراً عند تحديث صفحته.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => swapRole(s, target)}>
                                      نعم، غيّر الدور
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            {canDelete && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive" disabled={busy}>
                                    حذف
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent dir="rtl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>تأكيد حذف الموظف</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      سيتم حذف حساب {s.full_name || "هذا الموظف"} نهائياً ولن يستطيع الدخول للنظام.
                                      إذا كان سائقاً، ستُلغى ربط طلباته الحالية.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => removeStaff(s.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      نعم، احذف
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {permsTarget && (
        <PermissionsDialog
          open={!!permsTarget}
          onOpenChange={(o) => !o && setPermsTarget(null)}
          userId={permsTarget.id}
          userName={permsTarget.name}
        />
      )}
    </div>
  );
};

const StoreStatusCard = () => {
  const { settings, loading } = useStoreSettings();
  const [message, setMessage] = useState(settings.closed_message);
  const [saving, setSaving] = useState(false);
  const [editingMsg, setEditingMsg] = useState(false);

  useEffect(() => {
    if (!editingMsg) setMessage(settings.closed_message);
  }, [settings.closed_message, editingMsg]);

  const toggleStore = async (next: boolean) => {
    setSaving(true);
    const { error } = await supabase
      .from("store_settings")
      .update({ is_open: next })
      .eq("id", true);
    setSaving(false);
    if (error) {
      toast.error("فشل تحديث حالة المتجر: " + error.message);
    } else {
      toast.success(next ? "تم فتح المتجر ✅" : "تم إغلاق المتجر 🔒");
    }
  };

  const saveMessage = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("store_settings")
      .update({ closed_message: message.trim() || "المتجر مغلق مؤقتاً" })
      .eq("id", true);
    setSaving(false);
    if (error) {
      toast.error("فشل حفظ الرسالة");
    } else {
      toast.success("تم حفظ الرسالة");
      setEditingMsg(false);
    }
  };

  const isOpen = settings.is_open;

  return (
    <Card
      className={`p-4 print:hidden border-2 ${
        isOpen ? "border-primary/30 bg-primary/5" : "border-destructive/40 bg-destructive/5"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-full ${
              isOpen ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
            }`}
          >
            {isOpen ? <Store className="h-5 w-5" /> : <PowerOff className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-semibold">حالة المتجر</h3>
            <p className="text-sm text-muted-foreground">
              {isOpen
                ? "المتجر مفتوح ويستقبل الطلبات حالياً"
                : "المتجر مغلق — لا يمكن للزبائن إرسال طلبات جديدة"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-sm font-bold ${isOpen ? "text-primary" : "text-destructive"}`}
          >
            {isOpen ? "مفتوح" : "مغلق"}
          </span>
          <Switch
            checked={isOpen}
            disabled={loading || saving}
            onCheckedChange={toggleStore}
            aria-label="تبديل حالة المتجر"
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label className="text-xs text-muted-foreground">
          الرسالة التي ستظهر للزبائن عند الإغلاق:
        </Label>
        {editingMsg ? (
          <div className="space-y-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              maxLength={300}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveMessage} disabled={saving}>
                حفظ الرسالة
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingMsg(false);
                  setMessage(settings.closed_message);
                }}
              >
                إلغاء
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <p className="flex-1 text-sm bg-background/60 rounded-md px-3 py-2 border">
              {settings.closed_message}
            </p>
            <Button size="sm" variant="outline" onClick={() => setEditingMsg(true)}>
              تعديل
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};

// Small row to show/request browser notification permission
const NotificationPermissionRow = ({ inline = false }: { inline?: boolean }) => {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    typeof window === "undefined" || !("Notification" in window) ? "unsupported" : Notification.permission,
  );

  const request = async () => {
    const p = await ensureNotificationPermission();
    setPerm(p);
    if (p === "granted") {
      toast.success("تم تفعيل إشعارات المتصفح ✅");
    } else if (p === "denied") {
      toast.error("تم رفض الإشعارات. فعّلها يدوياً من إعدادات المتصفح.");
    }
  };

  if (perm === "unsupported") {
    return <p className={`text-xs text-muted-foreground ${inline ? "" : "mt-2"}`}>متصفحك لا يدعم إشعارات النظام.</p>;
  }

  if (perm === "granted") {
    return (
      <p className={`text-xs text-primary flex items-center gap-1 ${inline ? "" : "mt-2"}`}>
        <Bell className="h-3.5 w-3.5" />إشعارات المتصفح مفعّلة — ستصلك حتى لو كان التبويب في الخلفية.
      </p>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${inline ? "" : "mt-3"}`}>
      <Button size="sm" variant="outline" onClick={request} className="gap-1">
        <Bell className="h-3.5 w-3.5" />تفعيل إشعارات المتصفح
      </Button>
      <span className="text-xs text-muted-foreground">لاستقبال تنبيهات الطلبات حتى لو كان التبويب في الخلفية.</span>
    </div>
  );
};

export default Admin;

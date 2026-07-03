import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import QRCode from "qrcode";
import {
  UserPlus, Search, ShoppingBag, Users, BarChart3, Trash2, Pencil, Eye, Gift, ScanLine,
  MessageCircle, Download, Zap,
} from "lucide-react";
import { useCustomers } from "@/hooks/useCustomers";
import {
  createCustomer, deleteCustomer, updateCustomer,
  findCustomerByPhone, findCustomerByQr, registerLoyaltyOrder, getLoyaltyStats,
} from "@/services/loyalty";
import type { Customer } from "@/types/loyalty";
import { LoyaltyCardView } from "@/components/loyalty/LoyaltyCardView";
import { QRScanner } from "@/components/loyalty/QRScanner";
import { useAuth } from "@/contexts/AuthContext";


export function LoyaltyPanel() {
  const { customers, loading, reload } = useCustomers();
  const { user } = useAuth();
  const [tab, setTab] = useState("new");

  return (
    <Card className="p-4 md:p-6 rounded-3xl">
      <div className="flex items-center gap-2 mb-4">
        <Gift className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-extrabold">بطاقة الولاء</h2>
        <Badge variant="secondary" className="mr-auto">{customers.length} زبون</Badge>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="new" className="gap-1"><UserPlus className="h-4 w-4" />زبون جديد</TabsTrigger>
          <TabsTrigger value="register" className="gap-1"><ShoppingBag className="h-4 w-4" />تسجيل طلبية</TabsTrigger>
          <TabsTrigger value="list" className="gap-1"><Users className="h-4 w-4" />قائمة الزبائن</TabsTrigger>
          <TabsTrigger value="stats" className="gap-1"><BarChart3 className="h-4 w-4" />إحصائيات</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-4">
          <NewCustomerTab onCreated={reload} />
        </TabsContent>
        <TabsContent value="register" className="mt-4">
          <RegisterOrderTab userId={user?.id ?? null} />
        </TabsContent>
        <TabsContent value="list" className="mt-4">
          <CustomerListTab customers={customers} loading={loading} onChange={reload} />
        </TabsContent>
        <TabsContent value="stats" className="mt-4">
          <StatsTab />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

/* ---------------- New customer ---------------- */
function NewCustomerTab({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Customer | null>(null);

  const submit = async () => {
    setSaving(true);
    try {
      const c = await createCustomer({ full_name: name, phone, area });
      toast.success("تم إنشاء بطاقة الولاء");
      setCreated(c);
      setName(""); setPhone(""); setArea("");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الإنشاء");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4 rounded-2xl">
        <div className="space-y-3">
          <div>
            <Label>الاسم الكامل</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="محمد أحمد" />
          </div>
          <div>
            <Label>رقم الهاتف</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="07XXXXXXXXX" />
          </div>
          <div>
            <Label>المنطقة (اختياري)</Label>
            <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="الحي / الشارع" />
          </div>
          <Button onClick={submit} disabled={saving || !name || !phone} className="w-full">
            <UserPlus className="h-4 w-4" /> إنشاء البطاقة
          </Button>
        </div>
      </Card>
      <div>
        {created ? <LoyaltyCardView customer={created} /> : (
          <Card className="p-6 rounded-2xl h-full flex items-center justify-center text-muted-foreground">
            ستظهر البطاقة هنا بعد الإنشاء
          </Card>
        )}
      </div>
    </div>
  );
}

/* ---------------- Register order ---------------- */
function RegisterOrderTab({ userId }: { userId: string | null }) {
  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async (q: string) => {
    const value = q.trim();
    if (!value) return;
    setBusy(true);
    try {
      const byPhone = await findCustomerByPhone(value);
      const c = byPhone ?? await findCustomerByQr(value);
      if (!c) { toast.error("لا يوجد زبون بهذا الرقم/الباركود"); setCustomer(null); return; }
      setCustomer(c);
    } catch {
      toast.error("خطأ في البحث");
    } finally { setBusy(false); }
  };

  const onScan = async (text: string) => {
    setQuery(text);
    setBusy(true);
    try {
      const c = await findCustomerByQr(text);
      if (!c) { toast.error("باركود غير معروف"); setCustomer(null); return; }
      setCustomer(c);
      toast.success(`تم فتح ملف ${c.full_name}`);
    } finally { setBusy(false); }
  };

  const addOrder = async () => {
    if (!customer) return;
    setBusy(true);
    try {
      await registerLoyaltyOrder(customer, userId);
      // wait a tick for the trigger + realtime to push the update
      const refreshed = await findCustomerByPhone(customer.phone);
      if (refreshed) setCustomer(refreshed);
      const newStamps = refreshed?.total_stamps ?? customer.total_stamps + 1;
      toast.success(`✓ ${customer.full_name} — أختامه الآن ${newStamps}/10`);
    } catch (e) {
      console.error("[addOrder] failed", e);
      toast.error(e instanceof Error ? e.message : "فشل تسجيل الطلبية");
    } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4 rounded-2xl space-y-3">
        <div>
          <Label>بحث بالاسم أو الهاتف</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") search(query); }}
              placeholder="07XXXXXXXXX"
              inputMode="tel"
            />
            <Button variant="outline" onClick={() => search(query)} disabled={busy}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="pt-1">
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><ScanLine className="h-3.5 w-3.5" /> أو امسح باركود الزبون</p>
          <QRScanner onScan={onScan} />
        </div>
      </Card>

      <div>
        {customer ? (
          <div className="space-y-3">
            <LoyaltyCardView customer={customer} compact />
            <Button onClick={addOrder} disabled={busy} className="w-full h-12 text-base">
              <ShoppingBag className="h-5 w-5" /> إضافة طلبية وإضافة ختم
            </Button>
          </div>
        ) : (
          <Card className="p-6 rounded-2xl h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <p>ابحث عن زبون أو امسح باركوده</p>
            <ManualOrderDialog onDone={(c) => setCustomer(c)} userId={userId} />
          </Card>
        )}
      </div>
    </div>
  );
}

/* ---------------- Manual quick order (offline / phone-in) ---------------- */
function ManualOrderDialog({ onDone, userId }: { onDone: (c: Customer) => void; userId: string | null }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!phone.trim()) return;
    setBusy(true);
    try {
      let c = await findCustomerByPhone(phone);
      if (!c) {
        if (name.trim().length < 2) {
          toast.error("زبون جديد — اكتب اسمه أيضاً");
          return;
        }
        c = await createCustomer({ full_name: name, phone });
        toast.success("تم إنشاء البطاقة");
      }
      await registerLoyaltyOrder(c, userId);
      const refreshed = await findCustomerByPhone(c.phone);
      if (refreshed) onDone(refreshed);
      toast.success("تم تسجيل الطلبية اليدوية ✓");
      setOpen(false);
      setPhone(""); setName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التسجيل");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="gap-2">
          <Zap className="h-4 w-4" /> إضافة طلبية يدوية
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader><DialogTitle>طلبية يدوية (خارج الموقع)</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>رقم الهاتف *</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="07XXXXXXXXX" dir="ltr" />
          </div>
          <div>
            <Label>الاسم (لو زبون جديد)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اختياري إذا كان مسجّل" />
          </div>
          <Button onClick={submit} disabled={busy || !phone} className="w-full">
            تسجيل الطلبية وإضافة ختم
          </Button>
          <p className="text-xs text-muted-foreground">
            إن كان الرقم غير مسجّل، سيتم إنشاء بطاقة جديدة تلقائياً.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Customer list ---------------- */
const cardLinkFor = (c: Customer) => `${window.location.origin}/card/${c.phone}`;

const sendWhatsAppCard = (c: Customer) => {
  const text = `مرحباً ${c.full_name} 👋\nهذه بطاقة ولاء فريش الخاصة بك:\n${cardLinkFor(c)}\nاجمع 10 أختام واحصل على توصيل مجاني 🎁`;
  // international phone: replace leading 0 with 964
  const intl = c.phone.replace(/^0/, "964").replace(/\D/g, "");
  const url = `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) window.location.href = url;
};

const downloadCustomerQr = async (c: Customer) => {
  try {
    const dataUrl = await QRCode.toDataURL(cardLinkFor(c), {
      width: 512, margin: 2, color: { dark: "#1e2c58", light: "#ffffff" },
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `fresh-loyalty-${c.phone}.png`;
    a.click();
  } catch {
    toast.error("تعذّر إنشاء الباركود");
  }
};

function CustomerListTab({ customers, loading, onChange }:
  { customers: Customer[]; loading: boolean; onChange: () => void }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "stamps" | "gifts">("recent");
  const [view, setView] = useState<Customer | null>(null);
  const [edit, setEdit] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = customers;
    if (term) {
      list = list.filter((c) =>
        c.full_name.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        (c.area ?? "").toLowerCase().includes(term));
    }
    return [...list].sort((a, b) => {
      if (sort === "stamps") return b.total_stamps - a.total_stamps;
      if (sort === "gifts") return b.gift_count - a.gift_count;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [customers, q, sort]);

  const remove = async (c: Customer) => {
    try {
      await deleteCustomer(c.id);
      toast.success("تم حذف الزبون");
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحذف");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث..." className="pr-9" />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="recent">الأحدث</option>
          <option value="stamps">الأكثر أختاماً</option>
          <option value="gifts">الأكثر هدايا</option>
        </select>
      </div>

      <Card className="overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>المنطقة</TableHead>
                <TableHead>الأختام</TableHead>
                <TableHead>الهدايا</TableHead>
                <TableHead className="text-left">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا يوجد زبائن</TableCell></TableRow>
              )}
              {!loading && filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.full_name}</TableCell>
                  <TableCell dir="ltr" className="text-right">{c.phone}</TableCell>
                  <TableCell>{c.area ?? "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{c.total_stamps}/10</Badge></TableCell>
                  <TableCell><Badge className="bg-primary/10 text-primary border-0">{c.gift_count}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => setView(c)} title="عرض البطاقة"><Eye className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => sendWhatsAppCard(c)} title="إرسال الرابط واتساب" className="text-green-600">
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => downloadCustomerQr(c)} title="تحميل الباركود PNG">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEdit(c)} title="تعديل"><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>حذف الزبون؟</AlertDialogTitle>
                            <AlertDialogDescription>سيتم حذف {c.full_name} نهائياً.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(c)}>حذف</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>بطاقة الولاء</DialogTitle></DialogHeader>
          {view && <LoyaltyCardView customer={view} />}
        </DialogContent>
      </Dialog>

      <EditCustomerDialog customer={edit} onClose={() => setEdit(null)} onSaved={onChange} />
    </div>
  );
}

function EditCustomerDialog({ customer, onClose, onSaved }:
  { customer: Customer | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [saving, setSaving] = useState(false);

  const open = !!customer;
  // hydrate on open
  useMemo(() => {
    if (customer) {
      setName(customer.full_name); setPhone(customer.phone); setArea(customer.area ?? "");
    }
  }, [customer]);

  const save = async () => {
    if (!customer) return;
    setSaving(true);
    try {
      await updateCustomer(customer.id, { full_name: name, phone, area });
      toast.success("تم التحديث");
      onSaved(); onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التحديث");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>تعديل الزبون</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>الهاتف</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></div>
          <div><Label>المنطقة</Label><Input value={area} onChange={(e) => setArea(e.target.value)} /></div>
          <Button onClick={save} disabled={saving} className="w-full">حفظ</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Stats ---------------- */
function StatsTab() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getLoyaltyStats>> | null>(null);
  const [loading, setLoading] = useState(true);

  useMemo(() => {
    getLoyaltyStats().then((s) => { setStats(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const items = [
    { label: "عدد الزبائن", value: stats?.customerCount ?? 0, icon: Users },
    { label: "إجمالي الطلبات", value: stats?.orderCount ?? 0, icon: ShoppingBag },
    { label: "الهدايا المكتملة", value: stats?.giftsTotal ?? 0, icon: Gift },
    { label: "طلبات اليوم", value: stats?.todayOrders ?? 0, icon: BarChart3 },
    { label: "طلبات الشهر", value: stats?.monthOrders ?? 0, icon: BarChart3 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {items.map((it) => (
        <Card key={it.label} className="p-4 rounded-2xl">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm">{it.label}</span>
            <it.icon className="h-4 w-4" />
          </div>
          <p className="text-2xl font-extrabold mt-2">
            {loading ? <Skeleton className="h-7 w-16" /> : it.value.toLocaleString("ar-IQ")}
          </p>
        </Card>
      ))}
    </div>
  );
}

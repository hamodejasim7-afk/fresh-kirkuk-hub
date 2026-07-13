import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Store as StoreIcon, Plus, Pencil, Power, PowerOff, Archive, Wand2 } from "lucide-react";
import { StoreSetupWizard } from "@/components/store-setup/StoreSetupWizard";
import { BrandingUploader } from "@/components/fresh/BrandingUploader";

interface StoreRow {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_url: string | null;
  icon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  opening_time: string | null;
  closing_time: string | null;
  minimum_order: number | null;
  free_delivery_over: number | null;
  delivery_enabled: boolean | null;
  is_open: boolean | null;
  sort_order: number | null;
  status: string;
  created_at: string | null;
}

type StatusFilter = "all" | "active" | "inactive" | "archived" | "pending" | "deleted";
type SortKey = "sort_order" | "name" | "created_at";

const STATUS_LABEL: Record<string, string> = {
  active: "نشط",
  inactive: "متوقف",
  archived: "مؤرشف",
  pending: "قيد المراجعة",
  deleted: "محذوف",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  inactive: "secondary",
  archived: "outline",
  pending: "secondary",
  deleted: "destructive",
};

const emptyForm = (): Partial<StoreRow> => ({
  name: "",
  slug: "",
  logo_url: "",
  cover_url: "",
  icon_url: "",
  primary_color: "",
  secondary_color: "",
  phone: "",
  whatsapp: "",
  address: "",
  latitude: null,
  longitude: null,
  opening_time: "",
  closing_time: "",
  minimum_order: 0,
  free_delivery_over: 0,
  delivery_enabled: true,
  is_open: true,
  sort_order: 0,
  status: "active",
});

export function StoresPanel() {
  const [rows, setRows] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("sort_order");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StoreRow | null>(null);
  const [form, setForm] = useState<Partial<StoreRow>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [confirm, setConfirm] = useState<{ store: StoreRow; action: "deactivate" | "archive" } | null>(null);
  const [setupStore, setSetupStore] = useState<StoreRow | null>(null);
  const [postCreatePrompt, setPostCreatePrompt] = useState<StoreRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (error) toast.error("فشل تحميل المتاجر");
    else setRows((data ?? []) as StoreRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== "all") list = list.filter((s) => s.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((s) => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q));
    const sorted = [...list].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name, "ar");
      if (sortKey === "created_at") return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
    return sorted;
  }, [rows, search, statusFilter, sortKey]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (s: StoreRow) => {
    setEditing(s);
    setForm({ ...s });
    setDialogOpen(true);
  };

  const validate = (f: Partial<StoreRow>): string | null => {
    if (!f.name?.trim()) return "اسم المتجر مطلوب";
    if (!f.slug?.trim()) return "المعرّف (slug) مطلوب";
    if (!/^[a-z0-9][a-z0-9-]*$/.test(f.slug.trim())) return "المعرّف يجب أن يكون أحرفاً إنجليزية صغيرة وأرقاماً وشرطات فقط";
    if (f.slug.trim() !== f.slug.trim().toLowerCase()) return "المعرّف يجب أن يكون بأحرف صغيرة";
    // uniqueness
    const dup = rows.some((r) => r.slug === f.slug!.trim() && r.id !== editing?.id);
    if (dup) return "المعرّف مستخدم من قبل، اختر معرّفاً آخر";
    return null;
  };

  const save = async () => {
    const err = validate(form);
    if (err) { toast.error(err); return; }
    setSaving(true);
    const payload = {
      name: form.name!.trim(),
      slug: form.slug!.trim().toLowerCase(),
      logo_url: form.logo_url || null,
      cover_url: form.cover_url || null,
      icon_url: form.icon_url || null,
      primary_color: form.primary_color || null,
      secondary_color: form.secondary_color || null,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      address: form.address || null,
      latitude: form.latitude ?? null,
      longitude: form.longitude ?? null,
      opening_time: form.opening_time || null,
      closing_time: form.closing_time || null,
      minimum_order: form.minimum_order ?? 0,
      free_delivery_over: form.free_delivery_over ?? 0,
      delivery_enabled: form.delivery_enabled ?? true,
      is_open: form.is_open ?? true,
      sort_order: form.sort_order ?? 0,
      status: form.status || "active",
    };
    let res;
    let createdRow: StoreRow | null = null;
    if (editing) {
      res = await supabase.from("stores").update(payload).eq("id", editing.id);
    } else {
      const insertRes = await supabase.from("stores").insert(payload).select("*").maybeSingle();
      res = insertRes;
      createdRow = (insertRes.data as StoreRow) ?? null;
    }
    setSaving(false);
    if (res.error) { toast.error("فشل الحفظ: " + res.error.message); return; }
    toast.success(editing ? "تم تحديث المتجر" : "تم إنشاء المتجر");
    setDialogOpen(false);
    load();
    if (!editing && createdRow) setPostCreatePrompt(createdRow);
  };

  const setStatus = async (s: StoreRow, status: string) => {
    const { error } = await supabase.from("stores").update({ status }).eq("id", s.id);
    if (error) { toast.error("فشل التحديث"); return; }
    toast.success("تم تحديث الحالة");
    load();
  };

  const activate = (s: StoreRow) => setStatus(s, "active");

  const confirmAction = async () => {
    if (!confirm) return;
    const status = confirm.action === "archive" ? "archived" : "inactive";
    await setStatus(confirm.store, status);
    setConfirm(null);
  };

  return (
    <div dir="rtl" className="space-y-4">
      <Card className="p-4 flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end flex-1">
          <div className="flex-1 min-w-[200px]">
            <Label>بحث باسم المتجر</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="اكتب اسم المتجر..." />
          </div>
          <div className="min-w-[160px]">
            <Label>الحالة</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="inactive">متوقف</SelectItem>
                <SelectItem value="archived">مؤرشف</SelectItem>
                <SelectItem value="pending">قيد المراجعة</SelectItem>
                <SelectItem value="deleted">محذوف</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <Label>الترتيب</Label>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sort_order">حسب ترتيب العرض</SelectItem>
                <SelectItem value="name">حسب الاسم</SelectItem>
                <SelectItem value="created_at">الأحدث أولاً</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={openCreate} size="lg" className="gap-2">
          <Plus className="h-5 w-5" /> إضافة متجر
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الشعار</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>المعرّف</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>واتساب</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>مفتوح</TableHead>
                <TableHead>الترتيب</TableHead>
                <TableHead>تاريخ الإنشاء</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">جارٍ التحميل...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">لا توجد متاجر</TableCell></TableRow>
              ) : filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    {s.logo_url ? (
                      <img src={s.logo_url} alt={s.name} className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center"><StoreIcon className="h-5 w-5 text-muted-foreground" /></div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="font-mono text-xs">{s.slug}</TableCell>
                  <TableCell>{s.phone || "—"}</TableCell>
                  <TableCell>{s.whatsapp || "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{s.address || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[s.status] ?? "secondary"}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.is_open ? "default" : "outline"}>{s.is_open ? "مفتوح" : "مغلق"}</Badge>
                  </TableCell>
                  <TableCell>{s.sort_order ?? 0}</TableCell>
                  <TableCell className="text-xs">{s.created_at ? new Date(s.created_at).toLocaleDateString("ar") : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => openEdit(s)} className="gap-1"><Pencil className="h-3.5 w-3.5" />تعديل</Button>
                      <Button size="sm" variant="default" onClick={() => setSetupStore(s)} className="gap-1"><Wand2 className="h-3.5 w-3.5" />إعداد</Button>
                      {s.status !== "active" ? (
                        <Button size="sm" variant="outline" onClick={() => activate(s)} className="gap-1"><Power className="h-3.5 w-3.5" />تفعيل</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setConfirm({ store: s, action: "deactivate" })} className="gap-1"><PowerOff className="h-3.5 w-3.5" />إيقاف</Button>
                      )}
                      {s.status !== "archived" && (
                        <Button size="sm" variant="outline" onClick={() => setConfirm({ store: s, action: "archive" })} className="gap-1"><Archive className="h-3.5 w-3.5" />أرشفة</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل متجر" : "إضافة متجر جديد"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="اسم المتجر *"><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="المعرّف (slug) *"><Input value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="fresh-market" /></Field>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 p-3 border rounded-md bg-muted/30">
              <BrandingUploader storeId={editing?.id ?? null} kind="logo" value={form.logo_url} onChange={(url) => setForm({ ...form, logo_url: url ?? "" })} />
              <BrandingUploader storeId={editing?.id ?? null} kind="cover" value={form.cover_url} onChange={(url) => setForm({ ...form, cover_url: url ?? "" })} />
              <BrandingUploader storeId={editing?.id ?? null} kind="icon" value={form.icon_url} onChange={(url) => setForm({ ...form, icon_url: url ?? "" })} />
            </div>
            <Field label="رابط الشعار (يدوي)"><Input value={form.logo_url ?? ""} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} /></Field>
            <Field label="رابط الغلاف (يدوي)"><Input value={form.cover_url ?? ""} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} /></Field>
            <Field label="رابط الأيقونة (يدوي)"><Input value={form.icon_url ?? ""} onChange={(e) => setForm({ ...form, icon_url: e.target.value })} /></Field>
            <Field label="اللون الأساسي"><Input value={form.primary_color ?? ""} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} placeholder="#22c55e" /></Field>
            <Field label="اللون الثانوي"><Input value={form.secondary_color ?? ""} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} placeholder="#0ea5e9" /></Field>
            <Field label="الهاتف"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="واتساب"><Input value={form.whatsapp ?? ""} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Field>
            <Field label="العنوان" className="md:col-span-2"><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="خط العرض (latitude)"><Input type="number" step="any" value={form.latitude ?? ""} onChange={(e) => setForm({ ...form, latitude: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
            <Field label="خط الطول (longitude)"><Input type="number" step="any" value={form.longitude ?? ""} onChange={(e) => setForm({ ...form, longitude: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
            <Field label="وقت الفتح"><Input type="time" value={form.opening_time ?? ""} onChange={(e) => setForm({ ...form, opening_time: e.target.value })} /></Field>
            <Field label="وقت الإغلاق"><Input type="time" value={form.closing_time ?? ""} onChange={(e) => setForm({ ...form, closing_time: e.target.value })} /></Field>
            <Field label="الحد الأدنى للطلب"><Input type="number" value={form.minimum_order ?? 0} onChange={(e) => setForm({ ...form, minimum_order: Number(e.target.value) })} /></Field>
            <Field label="توصيل مجاني فوق"><Input type="number" value={form.free_delivery_over ?? 0} onChange={(e) => setForm({ ...form, free_delivery_over: Number(e.target.value) })} /></Field>
            <Field label="ترتيب العرض"><Input type="number" value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></Field>
            <Field label="الحالة">
              <Select value={form.status ?? "active"} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="inactive">متوقف</SelectItem>
                  <SelectItem value="archived">مؤرشف</SelectItem>
                  <SelectItem value="pending">قيد المراجعة</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-center gap-3">
              <Switch checked={!!form.delivery_enabled} onCheckedChange={(v) => setForm({ ...form, delivery_enabled: v })} />
              <Label>تفعيل التوصيل</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={!!form.is_open} onCheckedChange={(v) => setForm({ ...form, is_open: v })} />
              <Label>مفتوح الآن</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === "archive" ? "تأكيد الأرشفة" : "تأكيد الإيقاف"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "archive"
                ? `سيتم أرشفة المتجر "${confirm?.store.name}". لن يتم حذف أي بيانات ويمكنك إعادة تفعيله لاحقاً.`
                : `سيتم إيقاف المتجر "${confirm?.store.name}". يمكنك إعادة تفعيله لاحقاً.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction}>تأكيد</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Post-create prompt: offer to open the setup wizard */}
      <AlertDialog open={!!postCreatePrompt} onOpenChange={(o) => !o && setPostCreatePrompt(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تم إنشاء المتجر</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد بدء معالج الإعداد لمتجر "{postCreatePrompt?.name}" الآن؟ يمكنك تعيين مدير، مناطق التوصيل، الفئات والمنتجات.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>لاحقاً</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (postCreatePrompt) setSetupStore(postCreatePrompt); setPostCreatePrompt(null); }}>
              بدء الإعداد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {setupStore && (
        <StoreSetupWizard
          open={!!setupStore}
          storeId={setupStore.id}
          storeName={setupStore.name}
          onClose={() => { setSetupStore(null); load(); }}
        />
      )}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1 block">{label}</Label>
      {children}
    </div>
  );
}

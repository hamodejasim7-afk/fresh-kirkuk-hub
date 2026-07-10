import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Check, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, UserPlus, MapPin, Tag, Package, ClipboardCheck,
} from "lucide-react";
import { CategoriesPanel } from "@/components/CategoriesPanel";
import { ProductsPanel } from "@/components/ProductsPanel";

interface Props {
  open: boolean;
  storeId: string;
  storeName: string;
  onClose: () => void;
}

interface Profile { id: string; full_name: string | null; phone: string | null; store_id: string | null; }
interface DeliveryArea { id: string; name: string; fee_iqd: number; sort_order: number; is_active: boolean; }

const STEPS = [
  { key: "admin",     title: "تعيين مدير المتجر", icon: UserPlus },
  { key: "areas",     title: "مناطق التوصيل",    icon: MapPin },
  { key: "categories",title: "الفئات",           icon: Tag },
  { key: "products",  title: "المنتجات",         icon: Package },
  { key: "summary",   title: "الملخص",           icon: ClipboardCheck },
];

export function StoreSetupWizard({ open, storeId, storeName, onClose }: Props) {
  const [step, setStep] = useState(0);

  // Step 1 — admin assignment
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>("");
  const [assignedAdmin, setAssignedAdmin] = useState<Profile | null>(null);
  const [assigning, setAssigning] = useState(false);

  // Step 2 — delivery areas
  const [areas, setAreas] = useState<DeliveryArea[]>([]);
  const [areaForm, setAreaForm] = useState({ id: "", name: "", fee_iqd: "0", sort_order: "0", is_active: true });
  const [savingArea, setSavingArea] = useState(false);

  // Counts for summary
  const [catCount, setCatCount] = useState(0);
  const [prodCount, setProdCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    void loadProfiles();
    void loadAreas();
    void loadCounts();
    // Check if this store already has an assigned admin.
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("store_id", storeId).limit(1).maybeSingle();
      if (data) setAssignedAdmin(data as Profile);
      else setAssignedAdmin(null);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, storeId]);

  const loadProfiles = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, phone, store_id")
      .order("full_name", { ascending: true });
    setProfiles((data ?? []) as Profile[]);
  };

  const loadAreas = async () => {
    const { data } = await supabase
      .from("delivery_areas")
      .select("*")
      .eq("store_id", storeId)
      .order("sort_order", { ascending: true });
    setAreas((data ?? []) as DeliveryArea[]);
  };

  const loadCounts = async () => {
    const [{ count: cc }, { count: pc }] = await Promise.all([
      supabase.from("categories").select("id", { count: "exact", head: true }).eq("store_id", storeId),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId),
    ]);
    setCatCount(cc ?? 0);
    setProdCount(pc ?? 0);
  };

  const assignAdmin = async () => {
    if (!selectedAdminId) { toast.error("اختر مستخدماً"); return; }
    setAssigning(true);
    // Update profile.store_id, then ensure user_roles has 'admin' for that user.
    const { error: pErr } = await supabase
      .from("profiles").update({ store_id: storeId }).eq("id", selectedAdminId);
    if (pErr) { setAssigning(false); toast.error("فشل التعيين: " + pErr.message); return; }
    const { data: existingRoles } = await supabase
      .from("user_roles").select("role").eq("user_id", selectedAdminId);
    const hasAdmin = (existingRoles ?? []).some((r: any) => r.role === "admin");
    if (!hasAdmin) {
      const { error: rErr } = await supabase.from("user_roles").insert({ user_id: selectedAdminId, role: "admin" });
      if (rErr) { setAssigning(false); toast.error("فشل تعيين الدور: " + rErr.message); return; }
    }
    const chosen = profiles.find((p) => p.id === selectedAdminId) ?? null;
    setAssignedAdmin(chosen);
    setAssigning(false);
    toast.success("تم تعيين مدير المتجر");
  };

  const resetAreaForm = () => setAreaForm({ id: "", name: "", fee_iqd: "0", sort_order: "0", is_active: true });

  const saveArea = async () => {
    if (!areaForm.name.trim()) { toast.error("اسم المنطقة مطلوب"); return; }
    setSavingArea(true);
    const payload = {
      name: areaForm.name.trim(),
      fee_iqd: Number(areaForm.fee_iqd) || 0,
      sort_order: Number(areaForm.sort_order) || 0,
      is_active: areaForm.is_active,
      store_id: storeId,
    };
    const { error } = areaForm.id
      ? await supabase.from("delivery_areas").update(payload).eq("id", areaForm.id)
      : await supabase.from("delivery_areas").insert(payload);
    setSavingArea(false);
    if (error) { toast.error("فشل الحفظ: " + error.message); return; }
    toast.success(areaForm.id ? "تم التحديث" : "تمت الإضافة");
    resetAreaForm();
    loadAreas();
  };

  const editArea = (a: DeliveryArea) =>
    setAreaForm({ id: a.id, name: a.name, fee_iqd: String(a.fee_iqd), sort_order: String(a.sort_order), is_active: a.is_active });

  const toggleArea = async (a: DeliveryArea) => {
    const { error } = await supabase.from("delivery_areas").update({ is_active: !a.is_active }).eq("id", a.id);
    if (error) return toast.error(error.message);
    loadAreas();
  };

  const removeArea = async (a: DeliveryArea) => {
    if (!confirm(`حذف "${a.name}"؟`)) return;
    const { error } = await supabase.from("delivery_areas").delete().eq("id", a.id);
    if (error) return toast.error("فشل الحذف: " + error.message);
    toast.success("تم الحذف");
    loadAreas();
  };

  const canGoNext = useMemo(() => true, []);

  const next = () => {
    if (step < STEPS.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      if (STEPS[nextStep].key === "summary") loadCounts();
    }
  };
  const back = () => step > 0 && setStep(step - 1);

  const finish = () => {
    toast.success("تم إعداد المتجر بنجاح");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إعداد المتجر — {storeName}</DialogTitle>
          <DialogDescription>خطوات سريعة لتجهيز المتجر للانطلاق</DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 overflow-x-auto py-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <button
                key={s.key}
                onClick={() => setStep(i)}
                className={`flex items-center gap-2 px-3 py-2 rounded-full border text-sm shrink-0 transition ${
                  active ? "bg-primary text-primary-foreground border-primary"
                  : done ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-muted/40 text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                <span>{i + 1}. {s.title}</span>
              </button>
            );
          })}
        </div>

        <div className="min-h-[300px] py-2">
          {/* Step 1 */}
          {STEPS[step].key === "admin" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">اختر مستخدماً موجوداً ليصبح مدير هذا المتجر. لن يتم إنشاء حساب جديد.</p>
              {assignedAdmin && (
                <Card className="p-4 bg-emerald-50 border-emerald-200">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-emerald-800">المدير الحالي</div>
                      <div className="font-semibold">{assignedAdmin.full_name || "بدون اسم"}</div>
                      {assignedAdmin.phone && <div className="text-xs text-muted-foreground" dir="ltr">{assignedAdmin.phone}</div>}
                    </div>
                    <Badge className="bg-emerald-600">مُعيَّن</Badge>
                  </div>
                </Card>
              )}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                <div>
                  <Label>اختر المستخدم</Label>
                  <Select value={selectedAdminId} onValueChange={setSelectedAdminId}>
                    <SelectTrigger><SelectValue placeholder="ابحث/اختر مستخدماً" /></SelectTrigger>
                    <SelectContent>
                      {profiles.length === 0 && <div className="p-3 text-sm text-muted-foreground">لا يوجد مستخدمون</div>}
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {(p.full_name || "بدون اسم")}{p.phone ? ` — ${p.phone}` : ""}
                          {p.store_id ? " (معيّن لمتجر)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={assignAdmin} disabled={!selectedAdminId || assigning} size="lg" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  {assigning ? "جارٍ التعيين..." : "تعيين"}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {STEPS[step].key === "areas" && (
            <div className="space-y-4">
              <Card className="p-4 space-y-3">
                <div className="font-semibold flex items-center gap-2">
                  {areaForm.id ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {areaForm.id ? "تعديل منطقة" : "منطقة جديدة"}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <Label>اسم المنطقة</Label>
                    <Input value={areaForm.name} onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>سعر التوصيل (د.ع)</Label>
                    <Input type="number" value={areaForm.fee_iqd} onChange={(e) => setAreaForm({ ...areaForm, fee_iqd: e.target.value })} />
                  </div>
                  <div>
                    <Label>الترتيب</Label>
                    <Input type="number" value={areaForm.sort_order} onChange={(e) => setAreaForm({ ...areaForm, sort_order: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={areaForm.is_active} onCheckedChange={(v) => setAreaForm({ ...areaForm, is_active: v })} />
                  <Label>مفعّلة</Label>
                  <div className="flex-1" />
                  {areaForm.id && <Button variant="outline" onClick={resetAreaForm}>إلغاء</Button>}
                  <Button onClick={saveArea} disabled={savingArea} className="gap-1">
                    <Plus className="h-4 w-4" /> {areaForm.id ? "تحديث" : "إضافة"}
                  </Button>
                </div>
              </Card>

              <Card className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الاسم</TableHead>
                      <TableHead>السعر</TableHead>
                      <TableHead>الترتيب</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {areas.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">لا توجد مناطق بعد</TableCell></TableRow>
                    ) : areas.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell>{Number(a.fee_iqd).toLocaleString()}</TableCell>
                        <TableCell>{a.sort_order}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch checked={a.is_active} onCheckedChange={() => toggleArea(a)} />
                            <span className="text-xs">{a.is_active ? "مفعّلة" : "متوقفة"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => editArea(a)} className="gap-1"><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="outline" onClick={() => removeArea(a)} className="gap-1 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {/* Step 3 — reuse CategoriesPanel scoped to this store */}
          {STEPS[step].key === "categories" && (
            <CategoriesPanel storeId={storeId} />
          )}

          {/* Step 4 — reuse ProductsPanel scoped to this store */}
          {STEPS[step].key === "products" && (
            <ProductsPanel storeId={storeId} />
          )}

          {/* Step 5 */}
          {STEPS[step].key === "summary" && (
            <div className="space-y-3">
              <SummaryRow ok label="تم إنشاء المتجر" value={storeName} />
              <SummaryRow ok={!!assignedAdmin} label="تعيين مدير المتجر" value={assignedAdmin?.full_name || (assignedAdmin ? "مُعيَّن" : "غير مُعيَّن")} />
              <SummaryRow ok={areas.length > 0} label="مناطق التوصيل" value={`${areas.length} منطقة`} />
              <SummaryRow ok={catCount > 0} label="الفئات المضافة" value={`${catCount} فئة`} />
              <SummaryRow ok={prodCount > 0} label="المنتجات المضافة" value={`${prodCount} منتج`} />
            </div>
          )}
        </div>

        <DialogFooter className="flex-row-reverse justify-between sm:justify-between gap-2">
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={back} className="gap-1">
                <ChevronRight className="h-4 w-4" /> السابق
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button onClick={next} disabled={!canGoNext} className="gap-1">
                التالي <ChevronLeft className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={finish} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                <Check className="h-4 w-4" /> إنهاء
              </Button>
            )}
          </div>
          <Button variant="ghost" onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <Card className={`p-3 flex items-center justify-between ${ok ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
      <div className="flex items-center gap-2">
        <span className={`h-6 w-6 rounded-full inline-flex items-center justify-center text-white text-xs ${ok ? "bg-emerald-600" : "bg-amber-500"}`}>
          {ok ? "✓" : "!"}
        </span>
        <span className="font-medium">{label}</span>
      </div>
      <span className="text-sm text-muted-foreground">{value}</span>
    </Card>
  );
}

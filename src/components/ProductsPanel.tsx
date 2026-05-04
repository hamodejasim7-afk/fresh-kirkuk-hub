import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProducts, type DBProduct } from "@/hooks/useProducts";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Upload, Package } from "lucide-react";
import { toast } from "sonner";
import { formatIQD } from "@/lib/format";
import { useCategories } from "@/hooks/useCategories";

const UNITS = ["كغم", "حبة", "ربطة", "علبة", "لتر"];

interface FormState {
  name: string;
  category: string;
  price_iqd: string;
  unit: string;
  emoji: string;
  image_url: string;
  is_available: boolean;
  stock_qty: string;
  sort_order: string;
  allow_decimal: boolean;
}

const emptyForm: FormState = {
  name: "",
  category: "",
  price_iqd: "",
  unit: "كغم",
  emoji: "🥬",
  image_url: "",
  is_available: true,
  stock_qty: "",
  sort_order: "0",
  allow_decimal: true,
};

export const ProductsPanel = () => {
  const { products, loading, reload } = useProducts();
  const { categories } = useCategories({ onlyActive: true });
  const categoryNames = categories.map((c) => c.name);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DBProduct | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("الكل");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        category: editing.category,
        price_iqd: String(editing.price_iqd),
        unit: editing.unit,
        emoji: editing.emoji ?? "",
        image_url: editing.image_url ?? "",
        is_available: editing.is_available,
        stock_qty: editing.stock_qty != null ? String(editing.stock_qty) : "",
        sort_order: String(editing.sort_order),
        allow_decimal: (editing as any).allow_decimal !== false,
      });
    } else {
      setForm({ ...emptyForm, sort_order: String(products.length + 1) });
    }
  }, [editing, products.length]);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (p: DBProduct) => { setEditing(p); setOpen(true); };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("product-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
      toast.success("تم رفع الصورة");
    } catch (e: any) {
      toast.error("فشل رفع الصورة: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("اسم المنتج مطلوب");
    const price = Number(form.price_iqd);
    if (!Number.isFinite(price) || price < 0) return toast.error("السعر غير صالح");

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category: form.category,
      price_iqd: Math.round(price),
      unit: form.unit,
      emoji: form.emoji.trim() || null,
      image_url: form.image_url.trim() || null,
      is_available: form.is_available,
      stock_qty: form.stock_qty.trim() === "" ? null : Number(form.stock_qty),
      sort_order: Number(form.sort_order) || 0,
      allow_decimal: form.allow_decimal,
    };

    const { error } = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);

    setSaving(false);
    if (error) return toast.error("فشل الحفظ: " + error.message);
    toast.success(editing ? "تم تحديث المنتج" : "تمت إضافة المنتج");
    setOpen(false);
    reload();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error("فشل الحذف: " + error.message);
    toast.success("تم حذف المنتج");
    reload();
  };

  const toggleAvailable = async (p: DBProduct) => {
    const { error } = await supabase
      .from("products")
      .update({ is_available: !p.is_available })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    reload();
  };

  const visible = filterCat === "الكل" ? products : products.filter((p) => p.category === filterCat);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">المنتجات ({products.length})</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="الكل">كل الفئات</SelectItem>
              {categoryNames.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openNew} className="gap-1">
            <Plus className="h-4 w-4" /> منتج جديد
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-muted-foreground">جاري التحميل...</p>
      ) : visible.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">لا توجد منتجات</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <Card key={p.id} className="flex items-center gap-3 p-3">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-accent text-3xl">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <span>{p.emoji ?? "📦"}</span>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{p.name}</p>
                  {!p.is_available && <Badge variant="destructive" className="text-[10px]">مخفي</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{p.category} • {p.unit}</p>
                <p className="font-bold text-primary">{formatIQD(p.price_iqd)}</p>
              </div>
              <div className="flex flex-col gap-1">
                <Switch
                  checked={p.is_available}
                  onCheckedChange={() => toggleAvailable(p)}
                  aria-label="متوفّر"
                />
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir="rtl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>حذف "{p.name}"؟</AlertDialogTitle>
                        <AlertDialogDescription>
                          لا يمكن التراجع عن هذا الإجراء.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(p.id)} className="bg-destructive text-destructive-foreground">
                          حذف
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل منتج" : "منتج جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>اسم المنتج</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: طماطم طازجة" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>الفئة</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categoryNames.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>الوحدة</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>السعر (د.ع)</Label>
                <Input type="number" inputMode="numeric" value={form.price_iqd} onChange={(e) => setForm({ ...form, price_iqd: e.target.value })} placeholder="1500" />
              </div>
              <div className="space-y-1">
                <Label>المخزون (اختياري)</Label>
                <Input type="number" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} placeholder="غير محدود" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>الإيموجي</Label>
                <Input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} placeholder="🍅" />
              </div>
              <div className="space-y-1">
                <Label>ترتيب العرض</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>صورة المنتج (اختياري)</Label>
              <div className="flex items-center gap-2">
                {form.image_url && (
                  <img src={form.image_url} alt="معاينة" className="h-16 w-16 rounded-lg object-cover" />
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f);
                  }}
                />
                <Button type="button" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="gap-1">
                  <Upload className="h-4 w-4" />
                  {uploading ? "جاري الرفع..." : "رفع صورة"}
                </Button>
                {form.image_url && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, image_url: "" })}>
                    إزالة
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">إذا تم رفع صورة، ستظهر بدلاً من الإيموجي.</p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>متوفّر للبيع</Label>
                <p className="text-xs text-muted-foreground">عند الإيقاف، يختفي من المتجر</p>
              </div>
              <Switch
                checked={form.is_available}
                onCheckedChange={(v) => setForm({ ...form, is_available: v })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>يقبل كميات مجزأة (نصف، ربع...)</Label>
                <p className="text-xs text-muted-foreground">أوقفه للمنتجات التي تُباع بالقطعة فقط (علبة، حبة، ربطة)</p>
              </div>
              <Switch
                checked={form.allow_decimal}
                onCheckedChange={(v) => setForm({ ...form, allow_decimal: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

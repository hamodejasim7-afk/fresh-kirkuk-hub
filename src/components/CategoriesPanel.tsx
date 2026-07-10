import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_STORE_ID } from "@/config/constants";
import { useCategories, type Category } from "@/hooks/useCategories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

export const CategoriesPanel = ({ storeId }: { storeId?: string } = {}) => {
  const { categories, loading, reload } = useCategories({ storeId });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", sort_order: "0", is_active: true });
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", sort_order: String(categories.length + 1), is_active: true });
    setOpen(true);
  };
  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({ name: c.name, sort_order: String(c.sort_order), is_active: c.is_active });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("اسم الفئة مطلوب");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
      store_id: storeId ?? DEFAULT_STORE_ID,
    };
    const { error } = editing
      ? await supabase.from("categories").update(payload).eq("id", editing.id)
      : await supabase.from("categories").insert(payload);
    setSaving(false);
    if (error) return toast.error("فشل الحفظ: " + error.message);
    toast.success(editing ? "تم تحديث الفئة" : "تمت إضافة الفئة");
    setOpen(false);
    reload();
  };

  const remove = async (c: Category) => {
    // Check if any products use this category
    const { count } = await supabase
      .from("products").select("id", { count: "exact", head: true }).eq("category", c.name);
    if ((count ?? 0) > 0) {
      return toast.error(`لا يمكن الحذف — ${count} منتج يستخدم هذه الفئة`);
    }
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) return toast.error("فشل الحذف: " + error.message);
    toast.success("تم حذف الفئة");
    reload();
  };

  const toggleActive = async (c: Category) => {
    const { error } = await supabase
      .from("categories").update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) return toast.error(error.message);
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">الفئات ({categories.length})</h2>
        </div>
        <Button onClick={openNew} className="gap-1">
          <Plus className="h-4 w-4" /> فئة جديدة
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-muted-foreground">جاري التحميل...</p>
      ) : categories.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">لا توجد فئات بعد</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Card key={c.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{c.name}</p>
                  {!c.is_active && <span className="text-xs text-muted-foreground">(مخفية)</span>}
                </div>
                <p className="text-xs text-muted-foreground">ترتيب: {c.sort_order}</p>
              </div>
              <div className="flex items-center gap-1">
                <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} aria-label="مفعّلة" />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
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
                      <AlertDialogTitle>حذف "{c.name}"؟</AlertDialogTitle>
                      <AlertDialogDescription>لا يمكن التراجع. تأكد أنه لا توجد منتجات تستخدم هذه الفئة.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove(c)} className="bg-destructive text-destructive-foreground">
                        حذف
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل فئة" : "فئة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>اسم الفئة</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: ألبان وأجبان" />
            </div>
            <div className="space-y-1">
              <Label>ترتيب العرض</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>مفعّلة</Label>
                <p className="text-xs text-muted-foreground">الفئات غير المفعّلة لا تظهر للزبائن</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={save} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

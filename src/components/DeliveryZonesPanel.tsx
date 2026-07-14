import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Truck } from "lucide-react";
import { useDeliveryZones, type DeliveryZone } from "@/hooks/useDeliveryZones";
import { useStoreScope } from "@/hooks/useStoreScope";
import { formatIQD } from "@/lib/format";

export function DeliveryZonesPanel() {
  const { storeId, ready } = useStoreScope();
  const { zones, loading } = useDeliveryZones({ storeId });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryZone | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<string>("2000");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState<string>("0");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setEditing(null);
    setName("");
    setPrice("2000");
    setIsActive(true);
    setSortOrder("0");
  };

  const startEdit = (z: DeliveryZone) => {
    setEditing(z);
    setName(z.name);
    setPrice(String(z.fee_iqd));
    setIsActive(z.is_active);
    setSortOrder(String(z.sort_order));
    setOpen(true);
  };

  const save = async () => {
    if (!storeId) { toast.error("اختر متجراً أولاً"); return; }
    const trimmed = name.trim();
    const priceNum = Number(price);
    const sortNum = Number(sortOrder) || 0;
    if (!trimmed) { toast.error("اسم المنطقة مطلوب"); return; }
    if (!Number.isFinite(priceNum) || priceNum < 0) { toast.error("سعر التوصيل غير صحيح"); return; }

    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("delivery_areas")
          .update({ name: trimmed, fee_iqd: priceNum, is_active: isActive, sort_order: sortNum })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("تم تحديث المنطقة");
      } else {
        const { error } = await supabase
          .from("delivery_areas")
          .insert({ store_id: storeId, name: trimmed, fee_iqd: priceNum, is_active: isActive, sort_order: sortNum });
        if (error) throw error;
        toast.success("تمت إضافة المنطقة");
      }
      setOpen(false);
      reset();
    } catch (err: any) {
      toast.error("فشل الحفظ: " + (err?.message ?? "خطأ غير معروف"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (z: DeliveryZone) => {
    const { error } = await supabase.from("delivery_areas").delete().eq("id", z.id);
    if (error) { toast.error("فشل الحذف: " + error.message); return; }
    toast.success("تم حذف المنطقة");
  };

  if (ready && !storeId) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        اختر متجراً من الأعلى لإدارة مناطق التوصيل الخاصة به.
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">أسعار التوصيل</h2>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={reset}>
              <Plus className="h-4 w-4" />
              إضافة منطقة
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "تعديل المنطقة" : "إضافة منطقة جديدة"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="zone-name">اسم المنطقة</Label>
                <Input id="zone-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: حي النصر" />
              </div>
              <div>
                <Label htmlFor="zone-price">سعر التوصيل (دينار)</Label>
                <Input id="zone-price" type="number" inputMode="numeric" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="zone-sort">ترتيب العرض</Label>
                <Input id="zone-sort" type="number" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              </div>
              <div className="flex items-center justify-between border rounded-md p-2">
                <Label htmlFor="zone-active" className="cursor-pointer">مفعّلة</Label>
                <Switch id="zone-active" checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
              <Button onClick={save} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">المنطقة</TableHead>
              <TableHead className="text-right">السعر</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">الترتيب</TableHead>
              <TableHead className="text-right">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">جاري التحميل...</TableCell></TableRow>
            )}
            {!loading && zones.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">لا توجد مناطق بعد</TableCell></TableRow>
            )}
            {zones.map((z) => (
              <TableRow key={z.id}>
                <TableCell className="font-medium">{z.name}</TableCell>
                <TableCell>{formatIQD(z.fee_iqd)}</TableCell>
                <TableCell>
                  <span className={z.is_active ? "text-green-600" : "text-muted-foreground"}>
                    {z.is_active ? "مفعّلة" : "متوقفة"}
                  </span>
                </TableCell>
                <TableCell>{z.sort_order}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => startEdit(z)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>حذف منطقة التوصيل؟</AlertDialogTitle>
                          <AlertDialogDescription>
                            سيتم حذف "{z.name}". الطلبات السابقة لن تتأثر.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(z)} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
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

      <p className="text-xs text-muted-foreground">
        هذه المناطق تُعرض للزبائن عند اختيار هذا المتجر فقط.
      </p>
    </Card>
  );
}

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Save, Plus, DollarSign, Search } from "lucide-react";
import { toast } from "sonner";
import { formatIQD } from "@/lib/format";

const UNITS = ["كغم", "حبة", "ربطة", "علبة", "لتر"];

export const PricingPanel = () => {
  const { products, reload: reloadProducts } = useProducts();
  const { categories } = useCategories({ onlyActive: true });

  // Local edited prices: id -> string
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("الكل");
  const [search, setSearch] = useState("");

  // Add new product dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newP, setNewP] = useState({ name: "", category: "", price_iqd: "", unit: "كغم", emoji: "📦" });
  const [adding, setAdding] = useState(false);

  // Reset edits when products reload from server
  useEffect(() => {
    setEdits({});
  }, [products]);

  const visible = useMemo(() => {
    let list = products;
    if (filterCat !== "الكل") list = list.filter((p) => p.category === filterCat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, filterCat, search]);

  const dirty = Object.keys(edits).filter((id) => {
    const p = products.find((x) => x.id === id);
    if (!p) return false;
    return edits[id] !== "" && Number(edits[id]) !== p.price_iqd;
  });

  const setPrice = (id: string, value: string) => {
    setEdits((e) => ({ ...e, [id]: value }));
  };

  const saveAll = async () => {
    if (dirty.length === 0) {
      toast.info("لا توجد تعديلات للحفظ");
      return;
    }
    setSaving(true);
    let okCount = 0;
    let failCount = 0;
    for (const id of dirty) {
      const newPrice = Math.round(Number(edits[id]));
      if (!Number.isFinite(newPrice) || newPrice < 0) {
        failCount++;
        continue;
      }
      const { error } = await supabase.from("products").update({ price_iqd: newPrice }).eq("id", id);
      if (error) failCount++;
      else okCount++;
    }
    setSaving(false);
    if (okCount > 0) toast.success(`تم حفظ ${okCount} سعر`);
    if (failCount > 0) toast.error(`فشل حفظ ${failCount}`);
    setEdits({});
    reloadProducts();
  };

  const cancelEdits = () => setEdits({});

  const openAdd = () => {
    setNewP({
      name: "",
      category: categories[0]?.name ?? "",
      price_iqd: "",
      unit: "كغم",
      emoji: "📦",
    });
    setAddOpen(true);
  };

  const addProduct = async () => {
    if (!newP.name.trim()) return toast.error("اسم المنتج مطلوب");
    if (!newP.category) return toast.error("اختر الفئة");
    const price = Number(newP.price_iqd);
    if (!Number.isFinite(price) || price < 0) return toast.error("السعر غير صالح");
    setAdding(true);
    const { error } = await supabase.from("products").insert({
      name: newP.name.trim(),
      category: newP.category,
      price_iqd: Math.round(price),
      unit: newP.unit,
      emoji: newP.emoji.trim() || null,
      is_available: true,
      sort_order: products.length + 1,
    });
    setAdding(false);
    if (error) return toast.error("فشل الإضافة: " + error.message);
    toast.success("تمت إضافة المنتج");
    setAddOpen(false);
    reloadProducts();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">قائمة التسعير</h2>
          {dirty.length > 0 && (
            <Badge variant="secondary">{dirty.length} تعديل غير محفوظ</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث..."
              className="w-40 pr-8"
            />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="الكل">كل الفئات</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openAdd} variant="outline" className="gap-1">
            <Plus className="h-4 w-4" /> منتج جديد
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المنتج</TableHead>
                <TableHead className="text-right">الفئة</TableHead>
                <TableHead className="text-right">الوحدة</TableHead>
                <TableHead className="text-right">السعر الحالي</TableHead>
                <TableHead className="text-right w-44">السعر الجديد</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    لا توجد منتجات
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((p) => {
                  const edited = edits[p.id];
                  const isDirty = edited !== undefined && edited !== "" && Number(edited) !== p.price_iqd;
                  return (
                    <TableRow key={p.id} className={isDirty ? "bg-primary/5" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{p.emoji ?? "📦"}</span>
                          <span>{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.unit}</TableCell>
                      <TableCell className="font-semibold">{formatIQD(p.price_iqd)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={edited ?? ""}
                          onChange={(e) => setPrice(p.id, e.target.value)}
                          placeholder={String(p.price_iqd)}
                          className={isDirty ? "border-primary" : ""}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Sticky save bar */}
      {dirty.length > 0 && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-lg">
          <p className="text-sm">
            <strong>{dirty.length}</strong> تعديل غير محفوظ
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={cancelEdits} disabled={saving}>إلغاء</Button>
            <Button onClick={saveAll} disabled={saving} className="gap-1">
              <Save className="h-4 w-4" />
              {saving ? "جاري الحفظ..." : "حفظ كل التعديلات"}
            </Button>
          </div>
        </div>
      )}

      {/* Add product dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader><DialogTitle>إضافة منتج جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>اسم المنتج</Label>
              <Input value={newP.name} onChange={(e) => setNewP({ ...newP, name: e.target.value })} placeholder="مثال: خيار طازج" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>الفئة</Label>
                <Select value={newP.category} onValueChange={(v) => setNewP({ ...newP, category: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>الوحدة</Label>
                <Select value={newP.unit} onValueChange={(v) => setNewP({ ...newP, unit: v })}>
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
                <Input type="number" value={newP.price_iqd} onChange={(e) => setNewP({ ...newP, price_iqd: e.target.value })} placeholder="1500" />
              </div>
              <div className="space-y-1">
                <Label>الإيموجي</Label>
                <Input value={newP.emoji} onChange={(e) => setNewP({ ...newP, emoji: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              💡 لإضافة صورة أو مخزون، استخدم تبويب "المنتجات".
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button onClick={addProduct} disabled={adding}>{adding ? "جاري الإضافة..." : "إضافة"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

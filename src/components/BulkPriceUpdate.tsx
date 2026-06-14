import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useProducts } from "@/hooks/useProducts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, ImageIcon, FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";
import { formatIQD } from "@/lib/format";

interface ParsedItem { name: string; price: number; }
interface UpdateRow { name: string; oldPrice: number; newPrice: number; }
interface Summary {
  updated: UpdateRow[];
  disabled: string[];
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const BulkPriceUpdate = () => {
  const { products, reload } = useProducts();
  const [processing, setProcessing] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const applyItems = async (items: ParsedItem[]) => {
    const valid = items
      .map((i) => ({ name: String(i.name ?? "").trim(), price: Number(i.price) }))
      .filter((i) => i.name && Number.isFinite(i.price) && i.price >= 0);

    if (valid.length === 0) {
      toast.warning("لم يتم العثور على منتجات مطابقة");
      return;
    }

    const byNorm = new Map(valid.map((i) => [normalize(i.name), i]));
    const updated: UpdateRow[] = [];
    const matchedIds = new Set<string>();

    for (const p of products) {
      const match = byNorm.get(normalize(p.name));
      if (match) {
        matchedIds.add(p.id);
        const newPrice = Math.round(match.price);
        if (newPrice !== p.price_iqd) {
          const { error } = await supabase
            .from("products")
            .update({ price_iqd: newPrice, is_available: true })
            .eq("id", p.id);
          if (!error) updated.push({ name: p.name, oldPrice: p.price_iqd, newPrice });
        } else if (!p.is_available) {
          await supabase.from("products").update({ is_available: true }).eq("id", p.id);
        }
      }
    }

    const toDisable = products.filter((p) => !matchedIds.has(p.id) && p.is_available);
    for (const p of toDisable) {
      await supabase.from("products").update({ is_available: false }).eq("id", p.id);
    }

    if (updated.length === 0 && matchedIds.size === 0) {
      toast.warning("لم يتم العثور على منتجات مطابقة");
    } else {
      toast.success(`تم تحديث ${updated.length} منتج`);
    }

    setSummary({ updated, disabled: toDisable.map((p) => p.name) });
    reload();
  };

  const handleExcel = async (file: File) => {
    setProcessing(true);
    setSummary(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

      if (rows.length === 0) {
        toast.error("الملف فارغ");
        return;
      }

      const first = rows[0];
      const keys = Object.keys(first);
      const nameKey = keys.find((k) => /اسم\s*المنتج|name/i.test(k));
      const priceKey = keys.find((k) => /السعر|price/i.test(k));
      if (!nameKey || !priceKey) {
        toast.error("تأكد من وجود عمود اسم المنتج والسعر");
        return;
      }

      const items: ParsedItem[] = rows.map((r) => ({
        name: String(r[nameKey] ?? ""),
        price: Number(String(r[priceKey] ?? "").toString().replace(/[^\d.]/g, "")),
      }));

      await applyItems(items);
    } catch (e: any) {
      toast.error("فشل قراءة الملف: " + (e?.message ?? e));
    } finally {
      setProcessing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleImage = async (file: File) => {
    setProcessing(true);
    setSummary(null);
    try {
      const base64 = await toBase64(file);
      const { data, error } = await supabase.functions.invoke("parse-price-image", {
        body: { imageBase64: base64, mediaType: file.type },
      });
      if (error) throw error;
      if (!data?.items || !Array.isArray(data.items)) {
        throw new Error(data?.error ?? "no items");
      }
      await applyItems(data.items as ParsedItem[]);
    } catch (e: any) {
      console.error(e);
      toast.error("تعذّر قراءة الصورة، حاول مرة أخرى");
    } finally {
      setProcessing(false);
      if (imgRef.current) imgRef.current.value = "";
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h3 className="text-lg font-bold">تحديث الأسعار تلقائياً 🤖</h3>
        <p className="text-xs text-muted-foreground mt-1">
          ارفع صورة قائمة الأسعار أو ملف Excel/CSV. سيتم تحديث الأسعار للمنتجات المطابقة وإخفاء المنتجات غير الموجودة في القائمة.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          ref={imgRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); }}
        />
        <Button
          variant="outline"
          disabled={processing}
          onClick={() => imgRef.current?.click()}
          className="gap-2"
        >
          <ImageIcon className="h-4 w-4" />
          📷 رفع صورة قائمة الأسعار
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleExcel(f); }}
        />
        <Button
          variant="outline"
          disabled={processing}
          onClick={() => fileRef.current?.click()}
          className="gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          📊 رفع ملف Excel أو CSV
        </Button>
      </div>

      {processing && (
        <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>جاري المعالجة...</span>
        </div>
      )}

      {summary && !processing && (
        <div className="space-y-3 border-t pt-3">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-md bg-green-100 dark:bg-green-900/30 px-3 py-1 font-medium">
              ✅ تم تحديث {summary.updated.length} منتج
            </span>
            <span className="rounded-md bg-red-100 dark:bg-red-900/30 px-3 py-1 font-medium">
              ⛔ تم إيقاف {summary.disabled.length} منتج غير موجود في القائمة
            </span>
          </div>

          {summary.updated.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">اسم المنتج</TableHead>
                    <TableHead className="text-right">السعر القديم</TableHead>
                    <TableHead className="text-right">السعر الجديد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.updated.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-muted-foreground line-through">{formatIQD(r.oldPrice)}</TableCell>
                      <TableCell className="font-bold text-primary">{formatIQD(r.newPrice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {summary.disabled.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">عرض المنتجات الموقوفة ({summary.disabled.length})</summary>
              <ul className="mt-2 list-disc pr-5 space-y-0.5 text-muted-foreground">
                {summary.disabled.map((n) => <li key={n}>{n}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </Card>
  );
};

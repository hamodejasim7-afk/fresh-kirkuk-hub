import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStores } from "@/hooks/useStores";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { formatIQD } from "@/lib/format";

interface SourceProduct {
  id: string;
  name: string;
  category: string;
  price_iqd: number;
  unit: string;
  emoji: string | null;
  image_url: string | null;
  allow_decimal: boolean | null;
  sort_order: number;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCopied?: () => void;
}

export const CopyProductsDialog = ({ open, onOpenChange, onCopied }: Props) => {
  const { stores } = useStores({ onlyActive: false });
  const [sourceId, setSourceId] = useState<string>("");
  const [targetId, setTargetId] = useState<string>("");
  const [sourceProducts, setSourceProducts] = useState<SourceProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copying, setCopying] = useState(false);
  const [result, setResult] = useState<{ copied: number; skipped: string[]; targetName: string } | null>(null);

  // reset on close
  useEffect(() => {
    if (!open) {
      setSourceId(""); setTargetId(""); setSourceProducts([]);
      setSelected(new Set()); setResult(null);
    }
  }, [open]);

  // fetch source products
  useEffect(() => {
    if (!sourceId) { setSourceProducts([]); setSelected(new Set()); return; }
    setLoadingProducts(true);
    supabase
      .from("products")
      .select("id, name, category, price_iqd, unit, emoji, image_url, allow_decimal, sort_order")
      .eq("store_id", sourceId)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error("فشل تحميل المنتجات: " + error.message);
        setSourceProducts((data ?? []) as SourceProduct[]);
        setSelected(new Set());
        setLoadingProducts(false);
      });
  }, [sourceId]);

  const targetStores = useMemo(
    () => stores.filter((s) => s.id !== sourceId),
    [stores, sourceId],
  );

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    setSelected((s) =>
      s.size === sourceProducts.length ? new Set() : new Set(sourceProducts.map((p) => p.id)),
    );
  };

  const canCopy = !!sourceId && !!targetId && sourceId !== targetId && selected.size > 0 && !copying;

  const handleCopy = async () => {
    if (!canCopy) return;
    setCopying(true);
    setResult(null);
    try {
      const { data: existing, error: exErr } = await supabase
        .from("products")
        .select("name")
        .eq("store_id", targetId);
      if (exErr) throw exErr;
      const existingNames = new Set((existing ?? []).map((r: any) => String(r.name).trim()));

      const picks = sourceProducts.filter((p) => selected.has(p.id));
      const skipped: string[] = [];
      const rows = picks
        .filter((p) => {
          if (existingNames.has(p.name.trim())) { skipped.push(p.name); return false; }
          return true;
        })
        .map((p) => ({
          name: p.name,
          category: p.category,
          price_iqd: p.price_iqd,
          unit: p.unit,
          emoji: p.emoji,
          image_url: p.image_url,
          allow_decimal: p.allow_decimal ?? true,
          sort_order: p.sort_order,
          store_id: targetId,
          is_available: true,
          stock_qty: null,
        }));

      let copied = 0;
      if (rows.length > 0) {
        const { error: insErr, count } = await supabase
          .from("products")
          .insert(rows as any, { count: "exact" });
        if (insErr) throw insErr;
        copied = count ?? rows.length;
      }

      const targetName = stores.find((s) => s.id === targetId)?.name ?? "";
      setResult({ copied, skipped, targetName });
      if (copied > 0) toast.success(`تم نسخ ${copied} منتج إلى متجر ${targetName} بنجاح ✓`);
      if (rows.length === 0 && skipped.length > 0) toast.warning("جميع المنتجات المحددة موجودة مسبقاً");
      onCopied?.();
    } catch (e: any) {
      toast.error("فشل النسخ: " + (e?.message ?? e));
    } finally {
      setCopying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>نسخ منتجات بين المتاجر</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>المتجر المصدر</Label>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger><SelectValue placeholder="اختر متجراً" /></SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>المتجر الهدف</Label>
              <Select value={targetId} onValueChange={setTargetId} disabled={!sourceId}>
                <SelectTrigger><SelectValue placeholder="اختر متجراً" /></SelectTrigger>
                <SelectContent>
                  {targetStores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
            <div className="flex items-center justify-between border-b p-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={sourceProducts.length > 0 && selected.size === sourceProducts.length}
                  onCheckedChange={toggleAll}
                  disabled={sourceProducts.length === 0}
                />
                <span className="text-sm font-medium">
                  {sourceId ? `اختر المنتجات (${selected.size}/${sourceProducts.length})` : "اختر المتجر المصدر أولاً"}
                </span>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {loadingProducts ? (
                <div className="flex items-center justify-center gap-2 p-6 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> جاري التحميل...
                </div>
              ) : sourceProducts.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  {sourceId ? "لا توجد منتجات في هذا المتجر" : "—"}
                </p>
              ) : (
                <ul className="divide-y">
                  {sourceProducts.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 p-2">
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={() => toggle(p.id)}
                      />
                      <span className="text-xl">{p.emoji ?? "📦"}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.category} • {p.unit}</p>
                      </div>
                      <span className="text-sm font-bold text-primary">{formatIQD(p.price_iqd)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {result && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">
                تم نسخ {result.copied} منتج إلى متجر {result.targetName} بنجاح ✓
              </p>
              {result.skipped.length > 0 && (
                <div>
                  <p className="text-muted-foreground">تم تخطي {result.skipped.length} منتج موجود مسبقاً:</p>
                  <ul className="mt-1 list-disc pr-5 text-muted-foreground">
                    {result.skipped.map((n) => (
                      <li key={n}>المنتج "{n}" موجود مسبقاً في المتجر الهدف</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
          <Button onClick={handleCopy} disabled={!canCopy} className="gap-2">
            {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            نسخ المنتجات المحددة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

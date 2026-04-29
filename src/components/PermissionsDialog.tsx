import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { DEFAULT_PERMISSIONS, type StaffPermissions } from "@/hooks/useStaffPermissions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

const PERMISSION_LABELS: Record<keyof StaffPermissions, { title: string; desc: string }> = {
  manage_orders: { title: "إدارة الطلبات", desc: "تأكيد، تعيين سائق، تحديث حالة الطلب" },
  manage_pricing: { title: "تعديل الأسعار", desc: "تعديل أسعار المنتجات وأجور التوصيل" },
  manage_products: { title: "إدارة المنتجات", desc: "إضافة، تعديل، حذف المنتجات" },
  manage_categories: { title: "إدارة الفئات", desc: "إنشاء، تعديل، حذف فئات المنتجات" },
  manage_drivers: { title: "إدارة موظفي التوصيل", desc: "إنشاء سائقين وتعديل أدوارهم" },
  view_reports: { title: "عرض/تصدير التقارير", desc: "الوصول للتقارير اليومية والشهرية والسنوية وتصديرها Excel" },
};

export const PermissionsDialog = ({ open, onOpenChange, userId, userName }: Props) => {
  const [perms, setPerms] = useState<StaffPermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("staff_permissions")
        .select("manage_orders, manage_pricing, manage_products, manage_categories, manage_drivers, view_reports")
        .eq("user_id", userId)
        .maybeSingle();
      if (!active) return;
      setPerms(data ? (data as StaffPermissions) : DEFAULT_PERMISSIONS);
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [open, userId]);

  const toggle = (key: keyof StaffPermissions) =>
    setPerms((p) => ({ ...p, [key]: !p[key] }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("staff_permissions")
      .upsert(
        { user_id: userId, ...perms },
        { onConflict: "user_id" },
      );
    setSaving(false);
    if (error) {
      toast.error("فشل حفظ الصلاحيات: " + error.message);
      return;
    }
    toast.success("تم حفظ الصلاحيات وتطبيقها فوراً");
    onOpenChange(false);
  };

  const setAll = (value: boolean) =>
    setPerms({
      manage_orders: value,
      manage_pricing: value,
      manage_products: value,
      manage_categories: value,
      manage_drivers: value,
      view_reports: value,
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            صلاحيات: {userName}
          </DialogTitle>
          <DialogDescription>
            فعِّل أو عطِّل كل صلاحية على حدة. التغييرات تُطبَّق فوراً على الموظف بدون تسجيل خروج.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">جاري التحميل...</p>
        ) : (
          <>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setAll(true)}>
                تفعيل الكل
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAll(false)}>
                تعطيل الكل
              </Button>
            </div>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {(Object.keys(PERMISSION_LABELS) as (keyof StaffPermissions)[]).map((key) => (
                <div
                  key={key}
                  className="flex items-start justify-between gap-3 p-3 rounded-md border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <Label htmlFor={`perm-${key}`} className="font-semibold cursor-pointer">
                      {PERMISSION_LABELS[key].title}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {PERMISSION_LABELS[key].desc}
                    </p>
                  </div>
                  <Switch
                    id={`perm-${key}`}
                    checked={perms[key]}
                    onCheckedChange={() => toggle(key)}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        <DialogFooter className="flex-row gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving ? "جاري الحفظ..." : "حفظ الصلاحيات"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

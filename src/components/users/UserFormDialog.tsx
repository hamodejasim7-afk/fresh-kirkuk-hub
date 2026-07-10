import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type CreatableRole =
  | "super_admin"
  | "store_admin"
  | "accountant"
  | "employee"
  | "driver"
  | "cashier"
  | "inventory_manager";

const ROLE_LABEL: Record<CreatableRole, string> = {
  super_admin: "مدير عام",
  store_admin: "مدير متجر",
  accountant: "محاسب",
  employee: "موظف",
  driver: "سائق",
  cashier: "أمين صندوق",
  inventory_manager: "مدير مخزون",
};

interface StoreOpt { id: string; name: string }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSuperAdmin: boolean;
  callerStoreId: string | null;
  onCreated: () => void;
}

export function UserFormDialog({ open, onOpenChange, isSuperAdmin, callerStoreId, onCreated }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<CreatableRole>(isSuperAdmin ? "employee" : "employee");
  const [storeId, setStoreId] = useState<string | null>(isSuperAdmin ? null : callerStoreId);
  const [stores, setStores] = useState<StoreOpt[]>([]);
  const [saving, setSaving] = useState(false);

  const allowedRoles: CreatableRole[] = isSuperAdmin
    ? ["super_admin", "store_admin", "accountant", "employee", "driver", "cashier", "inventory_manager"]
    : ["employee", "driver", "cashier", "inventory_manager"];

  useEffect(() => {
    if (!open) return;
    setEmail(""); setPassword(""); setFullName(""); setPhone("");
    setRole("employee");
    setStoreId(isSuperAdmin ? null : callerStoreId);
    if (isSuperAdmin) {
      supabase.from("stores").select("id, name").order("name").then(({ data }) => {
        setStores((data ?? []) as StoreOpt[]);
      });
    }
  }, [open, isSuperAdmin, callerStoreId]);

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      toast.error("الإيميل مطلوب وكلمة السر 6 أحرف فأكثر");
      return;
    }
    // Super admins have no store; other roles require a store
    if (role !== "super_admin" && !storeId) {
      toast.error("اختر المتجر");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("create-staff", {
      body: {
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName.trim(),
        phone: phone.trim(),
        role,
        store_id: role === "super_admin" ? null : storeId,
      },
    });
    setSaving(false);
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? error?.message ?? "فشل إنشاء الحساب");
      return;
    }
    toast.success("تم إنشاء المستخدم");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>إنشاء مستخدم جديد</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>الإيميل</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></div>
          <div><Label>كلمة السر</Label><Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" /></div>
          <div><Label>الاسم الكامل</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div><Label>الهاتف</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div>
            <Label>الدور</Label>
            <Select value={role} onValueChange={(v) => setRole(v as CreatableRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {allowedRoles.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {role !== "super_admin" && (
            <div>
              <Label>المتجر</Label>
              {isSuperAdmin ? (
                <Select value={storeId ?? ""} onValueChange={(v) => setStoreId(v || null)}>
                  <SelectTrigger><SelectValue placeholder="اختر متجراً" /></SelectTrigger>
                  <SelectContent>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={callerStoreId ?? ""} disabled />
              )}
              {!isSuperAdmin && (
                <p className="text-xs text-muted-foreground mt-1">يُنشأ المستخدم داخل متجرك تلقائياً</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>إلغاء</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "..." : "إنشاء"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserPlus, KeyRound, Ban, Power, Store as StoreIcon, ShieldCheck, Copy } from "lucide-react";
import { UserFormDialog } from "@/components/users/UserFormDialog";
import { PermissionsDialog } from "@/components/PermissionsDialog";
import { ROLE_LABEL_AR } from "@/lib/roleLabels";

interface UserRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  store_id: string | null;
  store_name?: string | null;
  roles: string[];
}


const ROLE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  super_admin: "destructive",
  store_admin: "default",
  admin: "outline",
  accountant: "secondary",
  employee: "secondary",
  driver: "secondary",
  cashier: "secondary",
  inventory_manager: "secondary",
};

export function UsersPanel() {
  const { user, isSuperAdmin, isStoreAdmin, storeId: callerStoreId } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [permsTarget, setPermsTarget] = useState<{ id: string; name: string } | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; name: string; action: "suspend" | "activate" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Profiles are RLS-scoped: super_admin sees all, store_admin sees own-store.
    const [{ data: profiles, error: pErr }, { data: rolesData }, { data: storesData }] =
      await Promise.all([
        supabase.from("profiles").select("id, full_name, phone, store_id"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("stores").select("id, name"),
      ]);
    if (pErr) {
      toast.error("فشل تحميل المستخدمين");
      setLoading(false);
      return;
    }
    const storeMap = new Map((storesData ?? []).map((s) => [s.id, s.name]));
    setStores((storesData ?? []) as { id: string; name: string }[]);
    const roleMap = new Map<string, string[]>();
    for (const r of rolesData ?? []) {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    }
    const rowsOut: UserRow[] = (profiles ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      phone: p.phone,
      store_id: p.store_id,
      store_name: p.store_id ? (storeMap.get(p.store_id) ?? null) : null,
      roles: roleMap.get(p.id) ?? [],
    }));
    setRows(rowsOut);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = rows;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((r) =>
      (r.full_name ?? "").toLowerCase().includes(q) ||
      (r.phone ?? "").includes(q) ||
      r.id.toLowerCase().includes(q),
    );
    if (roleFilter !== "all") list = list.filter((r) => r.roles.includes(roleFilter));
    if (storeFilter !== "all") {
      if (storeFilter === "__none__") list = list.filter((r) => !r.store_id);
      else list = list.filter((r) => r.store_id === storeFilter);
    }
    return list.sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "ar"));
  }, [rows, search, roleFilter, storeFilter]);

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("update-user-status", { body });
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? error?.message ?? "فشل التنفيذ");
      return null;
    }
    return data as Record<string, unknown>;
  };

  const doSuspend = async (id: string) => {
    const res = await invoke({ user_id: id, action: "suspend" });
    if (res) { toast.success("تم إيقاف المستخدم"); load(); }
  };
  const doActivate = async (id: string) => {
    const res = await invoke({ user_id: id, action: "activate" });
    if (res) { toast.success("تم تفعيل المستخدم"); load(); }
  };
  const doReset = async (id: string) => {
    const res = await invoke({ user_id: id, action: "reset_password" });
    if (res && res.action_link) setResetLink(String(res.action_link));
    else if (res) toast.success("تم إرسال طلب إعادة تعيين كلمة السر");
  };
  const doAssignStore = async (id: string, store_id: string | null) => {
    const res = await invoke({ user_id: id, action: "assign_store", store_id });
    if (res) { toast.success("تم تحديث المتجر"); load(); }
  };

  return (
    <div dir="rtl" className="space-y-4">
      <Card className="p-4 flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end flex-1">
          <div className="flex-1 min-w-[200px]">
            <Label>بحث بالاسم أو الهاتف</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="اكتب للبحث..." />
          </div>
          <div className="min-w-[160px]">
            <Label>الدور</Label>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {Object.entries(ROLE_LABEL_AR).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isSuperAdmin && (
            <div className="min-w-[160px]">
              <Label>المتجر</Label>
              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="__none__">بدون متجر</SelectItem>
                  {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <Button size="lg" onClick={() => setCreateOpen(true)} className="gap-2">
          <UserPlus className="h-5 w-5" /> مستخدم جديد
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>الأدوار</TableHead>
                <TableHead>المتجر</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">جارٍ التحميل...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا يوجد مستخدمون</TableCell></TableRow>
              ) : filtered.map((r) => {
                const isSelf = r.id === user?.id;
                const targetPrivileged = r.roles.some((x) =>
                  ["super_admin","store_admin","admin","accountant"].includes(x),
                );
                const canManage = isSuperAdmin || (isStoreAdmin && r.store_id === callerStoreId && !targetPrivileged);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.full_name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.phone || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.roles.length === 0
                          ? <span className="text-xs text-muted-foreground">—</span>
                          : r.roles.map((role) => (
                              <Badge key={role} variant={ROLE_VARIANT[role] ?? "secondary"}>
                                {ROLE_LABEL_AR[role] ?? role}
                              </Badge>
                            ))}
                      </div>
                    </TableCell>
                    <TableCell>{r.store_name || (r.store_id ? r.store_id.slice(0,8) : "—")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        <Button
                          size="sm" variant="outline"
                          disabled={!canManage || isSelf}
                          onClick={() => doReset(r.id)}
                          className="gap-1"
                        ><KeyRound className="h-3.5 w-3.5" />إعادة تعيين</Button>
                        <Button
                          size="sm" variant="outline"
                          disabled={!canManage || isSelf}
                          onClick={() => setConfirm({ id: r.id, name: r.full_name || r.id, action: "suspend" })}
                          className="gap-1"
                        ><Ban className="h-3.5 w-3.5" />إيقاف</Button>
                        <Button
                          size="sm" variant="outline"
                          disabled={!canManage || isSelf}
                          onClick={() => doActivate(r.id)}
                          className="gap-1"
                        ><Power className="h-3.5 w-3.5" />تفعيل</Button>
                        {isSuperAdmin && (
                          <Select
                            value={r.store_id ?? ""}
                            onValueChange={(v) => doAssignStore(r.id, v === "__none__" ? null : v)}
                          >
                            <SelectTrigger className="h-8 w-[130px]"><StoreIcon className="h-3.5 w-3.5 ml-1" /><SelectValue placeholder="متجر" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">بدون</SelectItem>
                              {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                        {isSuperAdmin && (
                          <Button
                            size="sm" variant="outline"
                            onClick={() => setPermsTarget({ id: r.id, name: r.full_name || r.id })}
                            className="gap-1"
                          ><ShieldCheck className="h-3.5 w-3.5" />الصلاحيات</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <UserFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        isSuperAdmin={isSuperAdmin}
        callerStoreId={callerStoreId}
        onCreated={load}
      />

      {permsTarget && (
        <PermissionsDialog
          open={!!permsTarget}
          onOpenChange={(o) => !o && setPermsTarget(null)}
          userId={permsTarget.id}
          userName={permsTarget.name}
        />
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الإيقاف</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم إيقاف حساب <strong>{confirm?.name}</strong>. لن يستطيع تسجيل الدخول حتى تفعيله مرة أخرى.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (confirm) doSuspend(confirm.id);
              setConfirm(null);
            }}>تأكيد الإيقاف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!resetLink} onOpenChange={(o) => !o && setResetLink(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>رابط إعادة تعيين كلمة السر</AlertDialogTitle>
            <AlertDialogDescription>
              انسخ الرابط أدناه وأرسله للمستخدم (صالح لفترة محدودة):
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="p-3 bg-muted rounded text-xs break-all font-mono">{resetLink}</div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => {
              if (resetLink) {
                navigator.clipboard.writeText(resetLink);
                toast.success("تم النسخ");
              }
            }} className="gap-1"><Copy className="h-4 w-4" />نسخ</Button>
            <AlertDialogAction onClick={() => setResetLink(null)}>إغلاق</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

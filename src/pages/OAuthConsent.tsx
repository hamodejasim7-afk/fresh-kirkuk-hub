import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import freshLogo from "@/assets/fresh-logo.png";

// Typed wrapper around the beta supabase.auth.oauth namespace.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("لم يُرجع خادم التفويض عنوان إعادة توجيه.");
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main dir="rtl" className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 text-center">
          <p className="text-destructive">تعذّر تحميل طلب التفويض: {error}</p>
        </Card>
      </main>
    );
  }
  if (!details) {
    return (
      <main dir="rtl" className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </main>
    );
  }

  const clientName = details.client?.name ?? "تطبيق خارجي";

  return (
    <main dir="rtl" className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div className="flex flex-col items-center gap-2">
          <img src={freshLogo} alt="فريش Fresh" className="h-16 w-auto" />
        </div>
        <h1 className="text-xl font-bold text-center">ربط {clientName} بحسابك</h1>
        <p className="text-sm text-muted-foreground text-center">
          سيتمكن {clientName} من استخدام أدوات فريش نيابةً عنك (قراءة الطلبات، الزبائن، والمنتجات حسب صلاحياتك).
        </p>
        <div className="flex gap-2 pt-2">
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
            موافقة
          </Button>
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
            رفض
          </Button>
        </div>
      </Card>
    </main>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import freshLogo from "@/assets/fresh-logo.png";

const Auth = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rawNext = params.get("next");
  // Only allow same-origin relative paths as return targets.
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;
  const { user, role, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");

  useEffect(() => {
    if (!loading && user) {
      if (next) navigate(next, { replace: true });
      else if (role === "admin") navigate("/admin", { replace: true });
      else if (role === "driver") navigate("/driver", { replace: true });
      else navigate("/", { replace: true });
    }
  }, [user, role, loading, navigate, next]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "بيانات الدخول غير صحيحة" : error.message);
    } else {
      toast.success("تم تسجيل الدخول");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        emailRedirectTo: `${window.location.origin}${next ?? "/"}`,
        data: { full_name: signupName, phone: signupPhone },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("already") ? "هذا البريد مسجل مسبقاً" : error.message);
    } else {
      toast.success("تم إنشاء الحساب! اطلب من المدير تعيين دور (سائق/مدير).");
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center p-4" style={{ background: "var(--gradient-soft)" }}>
      <Card className="w-full max-w-md p-6 shadow-[var(--shadow-elegant)]">
        <Link to="/" className="flex flex-col items-center gap-2 mb-6">
          <img src={freshLogo} alt="فريش Fresh" className="h-20 w-auto" />
          <p className="text-sm text-muted-foreground">دخول الموظفين والسواق</p>
        </Link>

        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">تسجيل الدخول</TabsTrigger>
            <TabsTrigger value="signup">حساب جديد</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="li-email">البريد الإلكتروني</Label>
                <Input id="li-email" type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="li-pass">كلمة المرور</Label>
                <Input id="li-pass" type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "..." : "دخول"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="su-name">الاسم الكامل</Label>
                <Input id="su-name" required value={signupName} onChange={(e) => setSignupName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-phone">رقم الهاتف</Label>
                <Input id="su-phone" required value={signupPhone} onChange={(e) => setSignupPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-email">البريد الإلكتروني</Label>
                <Input id="su-email" type="email" required value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-pass">كلمة المرور (6 أحرف فأكثر)</Label>
                <Input id="su-pass" type="password" required minLength={6} value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "..." : "إنشاء حساب"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                بعد إنشاء الحساب، سيقوم المدير بمنحك صلاحية (مدير أو سائق).
              </p>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-primary hover:underline">
            العودة للمتجر
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default Auth;

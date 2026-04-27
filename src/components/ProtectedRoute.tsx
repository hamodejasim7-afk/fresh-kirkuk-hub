import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

type RoleReq = "admin" | "driver" | "accountant" | "admin_or_accountant";

interface Props {
  children: ReactNode;
  requireRole?: RoleReq;
}

const ProtectedRoute = ({ children, requireRole }: Props) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (requireRole) {
    const ok =
      requireRole === "admin_or_accountant"
        ? role === "admin" || role === "accountant"
        : role === requireRole;
    if (!ok) return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

export default ProtectedRoute;

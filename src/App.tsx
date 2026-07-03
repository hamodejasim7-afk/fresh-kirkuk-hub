import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Admin from "./pages/Admin.tsx";
import Driver from "./pages/Driver.tsx";
import NotFound from "./pages/NotFound.tsx";
import DailyReport from "@/pages/DailyReport";
import LoyaltyCard from "@/pages/LoyaltyCard";
import PublicCard from "@/pages/PublicCard";
import RegisterLoyalty from "@/pages/RegisterLoyalty";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import OfflineBanner from "@/components/OfflineBanner";
import { registerPWA } from "@/pwa/register";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    registerPWA();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <OfflineBanner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireRole="admin_or_accountant">
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/driver"
                element={
                  <ProtectedRoute requireRole="driver">
                    <Driver />
                  </ProtectedRoute>
                }
              />
              <Route path="/report" element={<DailyReport />} />
              <Route path="/loyalty" element={<LoyaltyCard />} />
              <Route path="/loyalty/qr/:qr" element={<LoyaltyCard />} />
              <Route path="/loyalty/phone/:phone" element={<LoyaltyCard />} />
              <Route path="/loyalty/:qr" element={<LoyaltyCard />} />
              <Route path="/card/:phone" element={<PublicCard />} />
              <Route path="/register-loyalty" element={<RegisterLoyalty />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <PWAInstallPrompt />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

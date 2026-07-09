import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Store as StoreIcon } from "lucide-react";
import { useStore } from "@/contexts/StoreContext";

export const StoreSelector = () => {
  const { activeStores, loading, selectStore } = useStore();

  return (
    <div dir="rtl" className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold">اختر متجرك</h1>
          <p className="text-muted-foreground">اختر المتجر الذي تريد الطلب منه</p>
        </div>

        {loading ? (
          <p className="py-12 text-center text-muted-foreground">جاري التحميل...</p>
        ) : activeStores.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            لا توجد متاجر متاحة حالياً
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {activeStores.map((s) => (
              <Card key={s.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  {s.logo_url ? (
                    <img
                      src={s.logo_url}
                      alt={`شعار ${s.name}`}
                      className="h-16 w-16 rounded-xl object-cover border"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center">
                      <StoreIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg truncate">{s.name}</h3>
                      {s.is_open ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">مفتوح</Badge>
                      ) : (
                        <Badge variant="secondary">مغلق</Badge>
                      )}
                    </div>
                    {s.address && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{s.address}</span>
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  className="h-12 w-full text-base"
                  onClick={() => selectStore(s.id)}
                >
                  الدخول إلى {s.name}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

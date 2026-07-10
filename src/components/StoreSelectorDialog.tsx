import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Store as StoreIcon } from "lucide-react";
import { useStore } from "@/contexts/StoreContext";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Embedded store-selector modal. Auto-opens when no store is selected.
 * Application layout stays mounted behind a dimmed backdrop.
 */
export const StoreSelectorDialog = () => {
  const { activeStores, loading, currentStore, isSelectorOpen, selectStore, closeSelector } = useStore();
  const queryClient = useQueryClient();

  const handlePick = (id: string) => {
    selectStore(id);
    // Refresh dependent queries without navigating or reloading.
    queryClient.invalidateQueries();
  };

  return (
    <Dialog
      open={isSelectorOpen}
      onOpenChange={(open) => {
        if (!open) closeSelector();
      }}
    >
      <DialogContent
        dir="rtl"
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        // Prevent dismissal if no store is selected yet.
        onInteractOutside={(e) => { if (!currentStore) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (!currentStore) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">اختر متجرك</DialogTitle>
          <DialogDescription>اختر المتجر الذي تريد الطلب منه</DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-10 text-center text-muted-foreground">جاري التحميل...</p>
        ) : activeStores.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">لا توجد متاجر متاحة حالياً</Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {activeStores.map((s) => {
              const isCurrent = currentStore?.id === s.id;
              return (
                <Card key={s.id} className={`p-4 flex flex-col gap-3 ${isCurrent ? "ring-2 ring-primary" : ""}`}>
                  <div className="flex items-center gap-3">
                    {s.logo_url ? (
                      <img
                        src={s.logo_url}
                        alt={`شعار ${s.name}`}
                        className="h-14 w-14 rounded-xl object-cover border"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center">
                        <StoreIcon className="h-7 w-7 text-muted-foreground" />
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
                    className="h-11 w-full text-base"
                    variant={isCurrent ? "secondary" : "default"}
                    onClick={() => handlePick(s.id)}
                  >
                    {isCurrent ? "المتجر الحالي" : "دخول"}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

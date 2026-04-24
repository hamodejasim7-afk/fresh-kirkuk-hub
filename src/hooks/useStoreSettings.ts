import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StoreSettings {
  is_open: boolean;
  closed_message: string;
}

const DEFAULTS: StoreSettings = {
  is_open: true,
  closed_message: "المتجر مغلق مؤقتاً — سنعود قريباً إن شاء الله 🌿",
};

export const useStoreSettings = () => {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from("store_settings")
        .select("is_open, closed_message")
        .eq("id", true)
        .maybeSingle();
      if (active && data) setSettings(data as StoreSettings);
      if (active) setLoading(false);
    };

    load();

    const channel = supabase
      .channel("store-settings-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "store_settings" },
        (payload) => {
          const row = payload.new as Partial<StoreSettings> | null;
          if (row && typeof row.is_open === "boolean") {
            setSettings({
              is_open: row.is_open,
              closed_message: row.closed_message ?? DEFAULTS.closed_message,
            });
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { settings, loading };
};

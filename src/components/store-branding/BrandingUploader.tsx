import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Kind = "logo" | "cover" | "icon";

interface Props {
  storeId: string | null; // required for real uploads; disabled if null
  kind: Kind;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  label?: string;
}

const KIND_LABEL: Record<Kind, string> = {
  logo: "الشعار",
  cover: "الغلاف",
  icon: "الأيقونة",
};

/**
 * Uploads to the "fresh" bucket at stores/{storeId}/{kind}-{ts}.{ext}
 * - Deletes the previous object (if it belongs to this bucket) after a successful upload.
 * - Persists the resulting public URL via onChange(url).
 * - Preview is shown before the parent saves the form.
 */
export function BrandingUploader({ storeId, kind, value, onChange, label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const disabled = !storeId;

  const handleFile = async (file: File) => {
    if (!storeId) {
      toast.error("احفظ المتجر أولاً قبل رفع الصور");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("الملف يجب أن يكون صورة");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("الحجم الأقصى 5 ميغابايت");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `stores/${storeId}/${kind}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("fresh")
      .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (upErr) {
      setUploading(false);
      toast.error("فشل الرفع: " + upErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from("fresh").getPublicUrl(path);
    const newUrl = pub.publicUrl;

    // Delete previous object if it was in our bucket
    if (value && value.includes("/fresh/")) {
      const prevPath = value.split("/fresh/")[1]?.split("?")[0];
      if (prevPath) {
        await supabase.storage.from("fresh").remove([prevPath]);
      }
    }
    onChange(newUrl);
    setUploading(false);
    toast.success("تم الرفع");
  };

  const clear = async () => {
    if (value && value.includes("/fresh/")) {
      const prevPath = value.split("/fresh/")[1]?.split("?")[0];
      if (prevPath) await supabase.storage.from("fresh").remove([prevPath]);
    }
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <Label>{label ?? KIND_LABEL[kind]}</Label>
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded border bg-muted overflow-hidden flex items-center justify-center">
          {value ? (
            <img src={value} alt={KIND_LABEL[kind]} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-muted-foreground">لا توجد صورة</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className="gap-1"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            رفع
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={clear} className="gap-1">
              <X className="h-4 w-4" />
              حذف
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
      {disabled && <p className="text-xs text-muted-foreground">احفظ المتجر أولاً لتفعيل الرفع</p>}
    </div>
  );
}

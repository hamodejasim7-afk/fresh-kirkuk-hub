import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

interface Props {
  onScan: (text: string) => void;
}

export function QRScanner({ onScan }: Props) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerId = "qr-scanner-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    stoppedRef.current = false;
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          if (stoppedRef.current) return;
          stoppedRef.current = true;
          scanner.stop().catch(() => {}).finally(() => {
            scanner.clear();
            setActive(false);
            onScan(decoded);
          });
        },
        () => {},
      )
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "تعذّر فتح الكاميرا");
        setActive(false);
      });

    return () => {
      stoppedRef.current = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().catch(() => {}).finally(() => s.clear());
        scannerRef.current = null;
      }
    };
  }, [active, onScan]);

  if (!active) {
    return (
      <div>
        <Button onClick={() => { setError(null); setActive(true); }} className="w-full gap-2">
          <Camera className="h-4 w-4" /> مسح باركود الزبون
        </Button>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div id={containerId} className="rounded-2xl overflow-hidden bg-black min-h-[280px]" />
      <Button variant="outline" onClick={() => setActive(false)} className="w-full gap-2">
        <X className="h-4 w-4" /> إيقاف المسح
      </Button>
    </div>
  );
}

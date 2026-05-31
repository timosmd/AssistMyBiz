import { useCallback, useState } from "react";
import { ScanPanel } from "@/features/scanner/ScanPanel";
import { ReceiptForm } from "@/features/receipts/ReceiptForm";
import { ReceiptList } from "@/features/receipts/ReceiptList";

export function BelegeView() {
  const [reloadKey, setReloadKey] = useState(0);
  const [scanned, setScanned] = useState<{ relative_path: string; file_kind: string } | null>(null);

  // Stabil halten, damit ScanPanel den Event-Listener nicht bei jedem Render neu abonniert.
  const handleScanned = useCallback((f: { relative_path: string; file_kind: string }) => setScanned(f), []);

  return (
    <div className="space-y-6">
      <ScanPanel onScanned={handleScanned} />
      <ReceiptForm
        initialDatei={scanned}
        onSaved={() => { setReloadKey((k) => k + 1); setScanned(null); }}
      />
      <ReceiptList reloadKey={reloadKey} />
    </div>
  );
}

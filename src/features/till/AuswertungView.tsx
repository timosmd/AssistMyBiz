import { Dashboard } from "@/features/dashboard/Dashboard";
import { ExportPanel } from "@/features/export/ExportPanel";

export function AuswertungView() {
  return (
    <div className="space-y-6">
      <Dashboard />
      <ExportPanel />
    </div>
  );
}

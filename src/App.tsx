import { Routes, Route } from "react-router-dom";
import { Cockpit } from "@/routes/Cockpit";
import { ChecklistsPlaceholder } from "@/routes/modules/ChecklistsPlaceholder";
import { TillModule } from "@/routes/till/TillModule";
import { InventoryModule } from "@/routes/inventory/InventoryModule";
import { ShiftsPlaceholder } from "@/routes/modules/ShiftsPlaceholder";
import { BugReportFab } from "@/features/bugreport/BugReportFab";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Cockpit />} />
        <Route path="/checklists" element={<ChecklistsPlaceholder />} />
        <Route path="/till" element={<TillModule />} />
        <Route path="/inventory" element={<InventoryModule />} />
        <Route path="/shifts" element={<ShiftsPlaceholder />} />
      </Routes>
      {import.meta.env.DEV && <BugReportFab />}
    </>
  );
}

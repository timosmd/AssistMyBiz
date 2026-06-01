import { Routes, Route } from "react-router-dom";
import { Cockpit } from "@/routes/Cockpit";
import { ChecklistModule } from "@/routes/checklists/ChecklistModule";
import { TillModule } from "@/routes/till/TillModule";
import { InventoryModule } from "@/routes/inventory/InventoryModule";
import { ShiftModule } from "@/routes/shifts/ShiftModule";
import { BugReportFab } from "@/features/bugreport/BugReportFab";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Cockpit />} />
        <Route path="/checklists" element={<ChecklistModule />} />
        <Route path="/till" element={<TillModule />} />
        <Route path="/inventory" element={<InventoryModule />} />
        <Route path="/shifts" element={<ShiftModule />} />
      </Routes>
      {import.meta.env.DEV && <BugReportFab />}
    </>
  );
}

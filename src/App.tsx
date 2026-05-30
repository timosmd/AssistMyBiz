import { Routes, Route } from "react-router-dom";
import { Cockpit } from "@/routes/Cockpit";
import { ChecklistsPlaceholder } from "@/routes/modules/ChecklistsPlaceholder";
import { TillPlaceholder } from "@/routes/modules/TillPlaceholder";
import { InventoryPlaceholder } from "@/routes/modules/InventoryPlaceholder";
import { ShiftsPlaceholder } from "@/routes/modules/ShiftsPlaceholder";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Cockpit />} />
      <Route path="/checklists" element={<ChecklistsPlaceholder />} />
      <Route path="/till" element={<TillPlaceholder />} />
      <Route path="/inventory" element={<InventoryPlaceholder />} />
      <Route path="/shifts" element={<ShiftsPlaceholder />} />
    </Routes>
  );
}

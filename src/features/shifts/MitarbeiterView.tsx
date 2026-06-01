import { useState } from "react";
import { EmployeeForm } from "./EmployeeForm";
import { EmployeeList } from "./EmployeeList";

export function MitarbeiterView() {
  const [reloadKey, setReloadKey] = useState(0);
  return (
    <div className="space-y-6">
      <EmployeeForm onSaved={() => setReloadKey((k) => k + 1)} />
      <EmployeeList reloadKey={reloadKey} />
    </div>
  );
}

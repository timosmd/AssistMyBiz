import { useState } from "react";
import { BugReportModal } from "./BugReportModal";

export function BugReportFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="group fixed bottom-0 right-0 z-40 h-24 w-24">
        <button type="button" aria-label="Bug melden" onClick={() => setOpen(true)}
          className={
            "absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full " +
            "bg-primary text-lg text-primary-foreground shadow-lg opacity-0 transition-opacity " +
            "duration-200 group-hover:opacity-100 focus-visible:opacity-100"
          }>
          🐞
        </button>
      </div>
      {open && <BugReportModal onClose={() => setOpen(false)} />}
    </>
  );
}

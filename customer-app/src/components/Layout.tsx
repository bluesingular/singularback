import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { SessionGapOverlay } from "./SessionGapOverlay";

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAF8]">
      <SessionGapOverlay />
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { useUIStore } from "../../store/ui.store";

export default function AppShell() {
    const { sidebarOpen, setSidebarOpen } = useUIStore();

    return (
        <div className="flex h-screen bg-[var(--bg-base)] overflow-hidden">
            <Sidebar />

            {/* Mobile overlay */}
            {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <Navbar />
                <main className="flex-1 overflow-y-auto p-6 page-enter">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

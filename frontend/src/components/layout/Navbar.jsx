import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUIStore } from "../../store/ui.store";
import { useAuthStore } from "../../store/auth.store";
import { MdMenu, MdSearch, MdNotifications, MdDarkMode, MdLightMode, MdLock, MdLogout, MdKeyboardCommandKey } from "react-icons/md";

const PAGE_TITLES = {
    "/dashboard": "Dashboard",
    "/devices": "Devices",
    "/device-catalog": "Device Catalog",
    "/employees": "Employees",
    "/departments": "Departments",
    "/software": "Software",
    "/licenses": "Licenses",
    "/tickets": "Tickets",
    "/inventory": "Inventory",
    "/spare-parts": "Spare Parts",
    "/reports/assets": "Assets Inventory Report",
    "/reports/warranty": "Warranty Status Report",
    "/reports/licenses": "License Utilization Report",
    "/reports/tickets": "Tickets Summary Report",
    "/users": "Users Management",
};

export default function Navbar() {
    const { toggleSidebar, theme, toggleTheme } = useUIStore();
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        function handler(e) {
            if (menuRef.current && !menuRef.current.contains(e.target)) setUserMenuOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const currentPath = "/" + location.pathname.split("/")[1];
    const pageTitle = PAGE_TITLES[location.pathname] ?? PAGE_TITLES[currentPath] ?? "IT Assets";

    function handleLogout() {
        logout();
        navigate("/login");
    }

    return (
        <header
            className="h-16 bg-[var(--bg-surface)] border-b border-[var(--border-color)]
      flex items-center px-4 gap-4 shrink-0 z-10"
        >
            {/* Hamburger */}
            <button
                onClick={toggleSidebar}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-2)]
          hover:text-[var(--text-primary)] transition-colors"
            >
                <MdMenu className="text-xl" />
            </button>

            {/* Page title */}
            <h1 className="text-lg font-semibold text-[var(--text-primary)] hidden sm:block">{pageTitle}</h1>

            <div className="flex-1" />

            {/* Search */}
            <div
                className="hidden md:flex items-center gap-2 bg-[var(--bg-surface-2)] rounded-lg
        px-3 py-2 w-64 cursor-pointer hover:ring-1 hover:ring-blue-400 transition-all"
            >
                <MdSearch className="text-[var(--text-muted)] text-lg shrink-0" />
                <span className="text-sm text-[var(--text-muted)] flex-1">Search anything</span>
                <div className="flex items-center gap-0.5 text-[var(--text-muted)]">
                    <MdKeyboardCommandKey className="text-xs" />
                    <span className="text-xs">K</span>
                </div>
            </div>

            {/* Theme toggle */}
            <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-2)]
          hover:text-[var(--text-primary)] transition-colors"
            >
                {theme === "light" ? <MdDarkMode className="text-xl" /> : <MdLightMode className="text-xl" />}
            </button>

            {/* Notifications */}
            <button
                className="relative p-2 rounded-lg text-[var(--text-muted)]
        hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)] transition-colors"
            >
                <MdNotifications className="text-xl" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {/* User menu */}
            <div className="relative" ref={menuRef}>
                <button
                    onClick={() => setUserMenuOpen((o) => !o)}
                    className="flex items-center gap-2 p-1.5 rounded-lg
            hover:bg-[var(--bg-surface-2)] transition-colors"
                >
                    <div
                        className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center
            text-white text-sm font-semibold"
                    >
                        {user?.full_name?.[0]?.toUpperCase() ?? "U"}
                    </div>
                    <span
                        className="hidden md:block text-sm font-medium text-[var(--text-primary)]
            max-w-[120px] truncate"
                    >
                        {user?.full_name ?? "User"}
                    </span>
                </button>

                {/* Dropdown */}
                {userMenuOpen && (
                    <div
                        className="absolute right-0 top-full mt-2 w-52 bg-[var(--bg-surface)]
            border border-[var(--border-color)] rounded-xl shadow-xl py-1 z-50"
                    >
                        <div className="px-4 py-2 border-b border-[var(--border-color)]">
                            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{user?.full_name}</p>
                            <p className="text-xs text-[var(--text-muted)] truncate">{user?.email}</p>
                        </div>
                        <MenuAction
                            icon={MdLock}
                            label="Change password"
                            onClick={() => {
                                navigate("/change-password");
                                setUserMenuOpen(false);
                            }}
                        />
                        <div className="border-t border-[var(--border-color)] mt-1 pt-1">
                            <MenuAction icon={MdLogout} label="Sign out" danger onClick={handleLogout} />
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
}

function MenuAction({ icon: Icon, label, onClick, danger }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors
        ${danger ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)]"}`}
        >
            <Icon className="text-base shrink-0" />
            {label}
        </button>
    );
}

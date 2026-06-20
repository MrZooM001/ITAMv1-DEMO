import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { useUIStore } from "../../store/ui.store";
import { useAuthStore } from "../../store/auth.store";
import {
    MdDashboard,
    MdDevices,
    MdPeople,
    MdBusiness,
    MdConfirmationNumber,
    MdInventory2,
    MdBuild,
    MdPeopleAlt,
    MdKeyboardArrowDown,
    MdKeyboardArrowRight,
    MdComputer,
    MdSecurity,
    MdCategory,
    MdDomain,
    MdRouter,
} from "react-icons/md";
import { TbReportAnalytics } from "react-icons/tb";
import { RiComputerLine } from "react-icons/ri";

const NAV_GROUPS = [
    {
        label: "MAIN",
        items: [{ label: "Dashboard", icon: MdDashboard, to: "/dashboard" }],
    },
    {
        label: "ASSETS",
        items: [
            { label: "Devices", icon: MdDevices, to: "/devices" },
            { label: "Device Catalog", icon: MdCategory, to: "/device-catalog" },
            { label: "Employees", icon: MdPeople, to: "/employees" },
            { label: "Departments", icon: MdBusiness, to: "/departments" },
            { label: "Software", icon: RiComputerLine, to: "/software", comingSoon: true },
            { label: "Licenses", icon: MdSecurity, to: "/licenses", comingSoon: true },
        ],
    },
    {
        label: "MAINTENANCE",
        items: [
            { label: "Tickets", icon: MdConfirmationNumber, to: "/tickets" },
            { label: "Inventory", icon: MdInventory2, to: "/inventory", comingSoon: true },
            { label: "Spare Parts", icon: MdBuild, to: "/spare-parts", comingSoon: true },
        ],
    },
    {
        label: "REPORTS",
        collapsible: true,
        items: [
            { label: "Assets inventory", icon: TbReportAnalytics, to: "/reports/assets", comingSoon: true },
            { label: "Warranty status", icon: TbReportAnalytics, to: "/reports/warranty", comingSoon: true },
            { label: "License utilization", icon: TbReportAnalytics, to: "/reports/licenses", comingSoon: true },
            { label: "Tickets summary", icon: TbReportAnalytics, to: "/reports/tickets", comingSoon: true },
        ],
    },
    {
        label: "ADMIN",
        roles: ["admin", "super_admin"],
        items: [{ label: "Users", icon: MdPeopleAlt, to: "/users" }],
    },
    {
        label: "PLATFORM",
        roles: ["super_admin"],
        platformOnly: true,
        items: [
            { label: "Tenants", icon: MdDomain, to: "/tenants" },
            { label: "Network Discovery", icon: MdRouter, to: "/network" },
        ],
    },
];

// Role badge colors
const ROLE_COLOR = {
    super_admin: "bg-red-900/40 text-red-300",
    admin: "bg-purple-900/40 text-purple-300",
    technician: "bg-blue-900/40 text-blue-300",
    viewer: "bg-gray-700 text-gray-400",
};
const ROLE_COLOR_LIGHT = {
    super_admin: "bg-red-100 text-red-700",
    admin: "bg-purple-100 text-purple-700",
    technician: "bg-blue-100 text-blue-700",
    viewer: "bg-gray-100 text-gray-600",
};

function NavItem({ item }) {
    if (item.comingSoon) {
        return (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--text-muted)] opacity-60 select-none">
                <item.icon className="text-lg shrink-0 text-[var(--text-muted)]" />
                <span className="truncate flex-1">{item.label}</span>
                <span className="text-[9px] font-semibold tracking-wide bg-[var(--bg-surface-2)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-full uppercase shrink-0">Soon</span>
            </div>
        );
    }

    return (
        <NavLink
            to={item.to}
            className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group
        ${isActive ? "bg-blue-600 text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]"}`
            }
        >
            {({ isActive }) => (
                <>
                    <item.icon className={`text-lg shrink-0 ${isActive ? "text-white" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"}`} />
                    <span className="truncate">{item.label}</span>
                </>
            )}
        </NavLink>
    );
}

function NavGroup({ group }) {
    const location = useLocation();
    const user = useAuthStore((s) => s.user);
    const isPlatformAdmin = useAuthStore((s) => s.isPlatformAdmin);

    if (group.roles && !group.roles.includes(user?.role)) return null;
    // PLATFORM group: the backend never tells the client whether it's the
    // platform tenant (no slug/flag on UserResponse, by design). isPlatformAdmin
    // is discovered empirically at login by probing a platform-only endpoint —
    // see Login.jsx and store/auth.store.js. This hides the nav item for
    // convenience; the backend's require_platform_super_admin guard is the
    // actual enforcement on every request regardless.
    if (group.platformOnly && !isPlatformAdmin) return null;

    const isAnyActive = group.items.some((item) => location.pathname.startsWith(item.to));
    const [open, setOpen] = useState(!group.collapsible || isAnyActive);

    return (
        <div className="mb-1">
            <button
                onClick={() => group.collapsible && setOpen((o) => !o)}
                className={`w-full flex items-center justify-between px-3 mb-1 ${group.collapsible ? "cursor-pointer" : "cursor-default"}`}
            >
                <span className="text-[10px] font-semibold tracking-widest text-[var(--text-muted)] uppercase">{group.label}</span>
                {group.collapsible &&
                    (open ? <MdKeyboardArrowDown className="text-[var(--text-muted)] text-sm" /> : <MdKeyboardArrowRight className="text-[var(--text-muted)] text-sm" />)}
            </button>
            {open && (
                <div className="space-y-0.5">
                    {group.items.map((item) => (
                        <NavItem key={item.to} item={item} />
                    ))}
                </div>
            )}
        </div>
    );
}

function UserFooter() {
    const user = useAuthStore((s) => s.user);
    const theme = useUIStore((s) => s.theme);
    const roleColor = theme === "dark" ? (ROLE_COLOR[user?.role] ?? ROLE_COLOR.viewer) : (ROLE_COLOR_LIGHT[user?.role] ?? ROLE_COLOR_LIGHT.viewer);

    return (
        <div className="border-t border-[var(--border-color)] p-3">
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--bg-surface-2)] transition-colors">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                    {user?.full_name?.[0]?.toUpperCase() ?? "U"}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{user?.full_name ?? "User"}</p>
                    <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${roleColor}`}>{user?.role?.replace("_", " ") ?? "viewer"}</span>
                </div>
            </div>
        </div>
    );
}

export default function Sidebar() {
    const sidebarOpen = useUIStore((s) => s.sidebarOpen);

    return (
        <aside
            className={`
        fixed top-0 left-0 z-30 h-full flex flex-col transition-all duration-300 ease-in-out
        bg-[var(--bg-surface)] border-r border-[var(--border-color)]
        ${sidebarOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full"}
        lg:relative lg:translate-x-0
        ${sidebarOpen ? "lg:w-64" : "lg:w-0 lg:overflow-hidden lg:border-0"}
      `}
        >
            {/* Logo */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-color)]">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                    <MdComputer className="text-white text-lg" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--text-primary)] truncate">IT Assets</p>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">Management System</p>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
                {NAV_GROUPS.map((group) => (
                    <NavGroup key={group.label} group={group} />
                ))}
            </nav>

            <UserFooter />
        </aside>
    );
}

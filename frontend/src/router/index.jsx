import { createBrowserRouter, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import AppShell from "../components/layout/AppShell";
import PrivateRoute from "./PrivateRoute";
import RoleRoute from "./RoleRoute";

// ── Lazy pages ─────────────────────────────────────────────
const Dashboard = lazy(() => import("../pages/dashboard"));
const Login = lazy(() => import("../pages/auth/Login"));
const TenantList = lazy(() => import("../pages/tenants"));
const TenantDetail = lazy(() => import("../pages/tenants/TenantDetail"));
const NetworkDiscovery = lazy(() => import("../pages/network"));
const NotFound = lazy(() => import("../pages/NotFound"));
const DeviceList = lazy(() => import("../pages/devices"));
const DeviceDetail = lazy(() => import("../pages/devices/DeviceDetail"));
const DepartmentList = lazy(() => import("../pages/departments"));
const DepartmentDetail = lazy(() => import("../pages/departments/DepartmentDetail"));
const EmployeeList = lazy(() => import("../pages/employees"));
const EmployeeDetail = lazy(() => import("../pages/employees/EmployeeDetail"));
const TicketList = lazy(() => import("../pages/tickets"));
const TicketDetail = lazy(() => import("../pages/tickets/TicketDetail"));
const UserList = lazy(() => import("../pages/users"));
const UserDetail = lazy(() => import("../pages/users/UserDetail"));
const ChangePassword = lazy(() => import("../pages/users/ChangePassword"));
const DeviceCatalog = lazy(() => import("../pages/device-catalog"));
// const SparePartList  = lazy(() => import("../pages/spare-parts"));
// const SoftwareList   = lazy(() => import("../pages/software"));
// const LicenseList    = lazy(() => import("../pages/licenses"));
// const AssetsReport   = lazy(() => import("../pages/reports/AssetsReport"));
// const WarrantyReport = lazy(() => import("../pages/reports/WarrantyReport"));
// const LicensesReport = lazy(() => import("../pages/reports/LicensesReport"));
// const TicketsReport  = lazy(() => import("../pages/reports/TicketsReport"));

// ── Suspense fallback ──────────────────────────────────────
function PageLoader() {
    return (
        <div className="flex h-full min-h-[400px] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-400">Loading...</p>
            </div>
        </div>
    );
}

function wrap(Component) {
    return (
        <Suspense fallback={<PageLoader />}>
            <Component />
        </Suspense>
    );
}

// ── Router ─────────────────────────────────────────────────
export const router = createBrowserRouter([
    { path: "/login", element: wrap(Login) },

    {
        path: "/",
        element: (
            <PrivateRoute>
                <AppShell />
            </PrivateRoute>
        ),
        children: [
            { index: true, element: <Navigate to="/dashboard" replace /> },
            { path: "dashboard", element: wrap(Dashboard) },
            { path: "devices", element: wrap(DeviceList) },
            { path: "devices/:id", element: wrap(DeviceDetail) },
            { path: "employees", element: wrap(EmployeeList) },
            { path: "employees/:id", element: wrap(EmployeeDetail) },
            { path: "departments", element: wrap(DepartmentList) },
            { path: "departments/:id", element: wrap(DepartmentDetail) },
            { path: "tickets", element: wrap(TicketList) },
            { path: "tickets/:id", element: wrap(TicketDetail) },
            { path: "users", element: wrap(UserList) },
            { path: "users/:id", element: wrap(UserDetail) },
            { path: "change-password", element: wrap(ChangePassword) },
            { path: "device-catalog", element: wrap(DeviceCatalog) },
            // ── Platform super-admin only ───────────────────
            {
                path: "tenants",
                element: (
                    <RoleRoute minRole="super_admin" platformOnly>
                        {wrap(TenantList)}
                    </RoleRoute>
                ),
            },
            {
                path: "tenants/:id",
                element: (
                    <RoleRoute minRole="super_admin" platformOnly>
                        {wrap(TenantDetail)}
                    </RoleRoute>
                ),
            },
            {
                path: "network",
                element: (
                    <RoleRoute minRole="super_admin" platformOnly>
                        {wrap(NetworkDiscovery)}
                    </RoleRoute>
                ),
            },
            // { path: "inventory",       element: wrap(InventoryList) },
            // { path: "spare-parts",     element: wrap(SparePartList) },
            // { path: "software",        element: wrap(SoftwareList) },
            // { path: "licenses",        element: wrap(LicenseList) },
            // { path: "reports/assets",  element: wrap(AssetsReport) },
            // { path: "reports/warranty",element: wrap(WarrantyReport) },
            // { path: "reports/licenses",element: wrap(LicensesReport) },
            // { path: "reports/tickets", element: wrap(TicketsReport) },
        ],
    },

    { path: "*", element: wrap(NotFound) },
]);

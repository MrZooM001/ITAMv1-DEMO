import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";

const ROLE_HIERARCHY = {
    super_admin: 4,
    admin: 3,
    technician: 2,
    viewer: 1,
};

/**
 * @param {string}  minRole       — minimum role required (default: "viewer")
 * @param {boolean} platformOnly  — if true, also requires the store's isPlatformAdmin flag.
 *                                  That flag is NOT sent by the backend (it deliberately never
 *                                  exposes a platform/slug indicator on UserResponse) — it's
 *                                  discovered empirically at login by probing a platform-only
 *                                  endpoint and caching whether it succeeded. See Login.jsx.
 */
export default function RoleRoute({ children, minRole = "viewer", platformOnly = false }) {
    const user = useAuthStore((s) => s.user);
    const isPlatformAdmin = useAuthStore((s) => s.isPlatformAdmin);

    if (!user) return <Navigate to="/login" replace />;

    const userLevel = ROLE_HIERARCHY[user.role] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;

    if (userLevel < requiredLevel) {
        return <Navigate to="/dashboard" replace />;
    }

    // Client-side convenience only — the backend's require_platform_super_admin
    // dependency is the real enforcement on every request regardless of this.
    if (platformOnly && !isPlatformAdmin) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

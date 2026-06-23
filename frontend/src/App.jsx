import { useEffect, useState } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { useAuthStore } from "./store/auth.store";
import { useUIStore } from "./store/ui.store";

const BASE_URL = import.meta.env.VITE_API_URL;

function FullPageSpinner() {
    return (
        <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[var(--text-muted)]">Verifying session...</p>
            </div>
        </div>
    );
}

function AuthInitializer({ children }) {
    // Read once at mount — not reactive on purpose
    const token = useAuthStore.getState().token;
    const { setAuth, logout } = useAuthStore.getState();

    // Restore persisted theme class on <html>
    useEffect(() => {
        useUIStore.getState().initTheme();
    }, []);

    // If no token → show app immediately, PrivateRoute handles redirect
    const [ready, setReady] = useState(!token);

    useEffect(() => {
        if (!token) return;

        async function verify() {
            try {
                const res = await fetch(`${BASE_URL}/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error("invalid");
                const user = await res.json();
                setAuth(user, token, useAuthStore.getState().refreshToken);
            } catch {
                logout();
            } finally {
                setReady(true);
            }
        }

        verify();
    }, []); // runs once on mount only

    if (!ready) return <FullPageSpinner />;
    return children;
}

export default function App() {
    return (
        <AuthInitializer>
            <RouterProvider router={router} />
        </AuthInitializer>
    );
}

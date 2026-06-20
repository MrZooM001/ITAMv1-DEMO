import { useNavigate } from "react-router-dom";
import { MdArrowBack } from "react-icons/md";

export default function NotFound() {
    const navigate = useNavigate();
    return (
        <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center text-center p-8">
            <p className="text-8xl font-bold text-[var(--bg-surface-2)]">404</p>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-4">Page not found</h1>
            <p className="text-[var(--text-muted)] text-sm mt-2 mb-6">The page you're looking for doesn't exist or has been moved.</p>
            <button
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700
          text-white text-sm font-medium rounded-lg transition-colors"
            >
                <MdArrowBack className="text-base" />
                Back to Dashboard
            </button>
        </div>
    );
}

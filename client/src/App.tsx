import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Layout } from "./components/layout/Layout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { WorldPage } from "./pages/WorldPage";
import { MarketplacePage } from "./pages/MarketplacePage";
import { MyLandPage } from "./pages/MyLandPage";
import { LandEditorPage } from "./pages/LandEditorPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AdminPage } from "./pages/AdminPage";

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-light dark:bg-surface-dark">
      <div className="text-center">
        <span className="text-4xl animate-bounce inline-block">🏝️</span>
        <p className="mt-2 text-sm text-slate-400 font-bold">Loading Pixel Estates...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, requireOnboarded = true }: { children: React.ReactNode; requireOnboarded?: boolean }) {
  const { me, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!me) return <Navigate to="/login" replace />;
  if (requireOnboarded && !me.hasOnboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { me, loading, isAdmin } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!me) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/world" replace />;
  return <>{children}</>;
}

export default function App() {
  const { me, loading } = useAuth();

  if (loading) return <FullScreenLoader />;

  return (
    <Routes>
      <Route path="/login" element={me ? <Navigate to="/world" replace /> : <LoginPage />} />
      <Route path="/register" element={me ? <Navigate to="/world" replace /> : <RegisterPage />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute requireOnboarded={false}>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/world"
        element={
          <ProtectedRoute>
            <Layout>
              <WorldPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/marketplace"
        element={
          <ProtectedRoute>
            <Layout>
              <MarketplacePage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-land"
        element={
          <ProtectedRoute>
            <Layout>
              <MyLandPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-land/:plotId/decorate"
        element={
          <ProtectedRoute>
            <Layout>
              <LandEditorPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/transactions"
        element={
          <ProtectedRoute>
            <Layout>
              <TransactionsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Layout>
              <SettingsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <Layout>
              <AdminPage />
            </Layout>
          </AdminRoute>
        }
      />

      <Route path="/" element={<Navigate to={me ? "/world" : "/login"} replace />} />
      <Route path="*" element={<Navigate to={me ? "/world" : "/login"} replace />} />
    </Routes>
  );
}

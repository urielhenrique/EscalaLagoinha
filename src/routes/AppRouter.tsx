import { Suspense, lazy, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { RouteFallback } from "../components/ui/RouteFallback";
import { PrivateRoute } from "./PrivateRoute";
import { PublicRoute } from "./PublicRoute";

const LoginPage = lazy(() =>
  import("../pages/LoginPage").then((module) => ({
    default: module.LoginPage,
  })),
);
const LandingPage = lazy(() =>
  import("../pages/LandingPage").then((module) => ({
    default: module.LandingPage,
  })),
);
const InstitutionalPage = lazy(() =>
  import("../pages/InstitutionalPage").then((module) => ({
    default: module.InstitutionalPage,
  })),
);
const OnboardingChurchPage = lazy(() =>
  import("../pages/OnboardingChurchPage").then((module) => ({
    default: module.OnboardingChurchPage,
  })),
);
const InvitePage = lazy(() =>
  import("../pages/InvitePage").then((module) => ({
    default: module.InvitePage,
  })),
);
const RegisterPage = lazy(() =>
  import("../pages/RegisterPage").then((module) => ({
    default: module.RegisterPage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import("../pages/ForgotPasswordPage").then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import("../pages/ResetPasswordPage").then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const PendingApprovalPage = lazy(() =>
  import("../pages/PendingApprovalPage").then((module) => ({
    default: module.PendingApprovalPage,
  })),
);
const DashboardPage = lazy(() =>
  import("../pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const MySchedulesPage = lazy(() =>
  import("../pages/MySchedulesPage").then((module) => ({
    default: module.MySchedulesPage,
  })),
);
const MyAvailabilityPage = lazy(() =>
  import("../pages/MyAvailabilityPage").then((module) => ({
    default: module.MyAvailabilityPage,
  })),
);
const MyProfilePage = lazy(() =>
  import("../pages/MyProfilePage").then((module) => ({
    default: module.MyProfilePage,
  })),
);
const AdminSchedulesPage = lazy(() =>
  import("../pages/AdminSchedulesPage").then((module) => ({
    default: module.AdminSchedulesPage,
  })),
);
const EventsPage = lazy(() =>
  import("../pages/EventsPage").then((module) => ({
    default: module.EventsPage,
  })),
);
const SwapRequestPage = lazy(() =>
  import("../pages/SwapRequestPage").then((module) => ({
    default: module.SwapRequestPage,
  })),
);
const MySwapRequestsPage = lazy(() =>
  import("../pages/MySwapRequestsPage").then((module) => ({
    default: module.MySwapRequestsPage,
  })),
);
const ReceivedSwapRequestsPage = lazy(() =>
  import("../pages/ReceivedSwapRequestsPage").then((module) => ({
    default: module.ReceivedSwapRequestsPage,
  })),
);
const SwapHistoryPage = lazy(() =>
  import("../pages/SwapHistoryPage").then((module) => ({
    default: module.SwapHistoryPage,
  })),
);
const NotificationsPage = lazy(() =>
  import("../pages/NotificationsPage").then((module) => ({
    default: module.NotificationsPage,
  })),
);
const RankingPage = lazy(() =>
  import("../pages/RankingPage").then((module) => ({
    default: module.RankingPage,
  })),
);
const IAInsightsPage = lazy(() =>
  import("../pages/IAInsightsPage").then((module) => ({
    default: module.IAInsightsPage,
  })),
);
const CheckInPage = lazy(() =>
  import("../pages/CheckInPage").then((module) => ({
    default: module.CheckInPage,
  })),
);
const AttendanceManagePage = lazy(() =>
  import("../pages/AttendanceManagePage").then((module) => ({
    default: module.AttendanceManagePage,
  })),
);
const AuditLogsPage = lazy(() =>
  import("../pages/AuditLogsPage").then((module) => ({
    default: module.AuditLogsPage,
  })),
);
const ReportsPage = lazy(() =>
  import("../pages/ReportsPage").then((module) => ({
    default: module.ReportsPage,
  })),
);
const ApproveVolunteersPage = lazy(() =>
  import("../pages/ApproveVolunteersPage").then((module) => ({
    default: module.ApproveVolunteersPage,
  })),
);
const MasterAdminPage = lazy(() =>
  import("../pages/MasterAdminPage").then((module) => ({
    default: module.MasterAdminPage,
  })),
);
const ChurchManagementPage = lazy(() =>
  import("../pages/ChurchManagementPage").then((module) => ({
    default: module.ChurchManagementPage,
  })),
);
const ChurchSettingsPage = lazy(() =>
  import("../pages/ChurchSettingsPage").then((module) => ({
    default: module.ChurchSettingsPage,
  })),
);
const ChurchBrandingPage = lazy(() =>
  import("../pages/ChurchBrandingPage").then((module) => ({
    default: module.ChurchBrandingPage,
  })),
);
const MultiUnitDashboardPage = lazy(() =>
  import("../pages/MultiUnitDashboardPage").then((module) => ({
    default: module.MultiUnitDashboardPage,
  })),
);
const HelpCenterPage = lazy(() =>
  import("../pages/HelpCenterPage").then((module) => ({
    default: module.HelpCenterPage,
  })),
);
const FeedbackPage = lazy(() =>
  import("../pages/FeedbackPage").then((module) => ({
    default: module.FeedbackPage,
  })),
);
const TrainingModePage = lazy(() =>
  import("../pages/TrainingModePage").then((module) => ({
    default: module.TrainingModePage,
  })),
);
const StrategicDashboardPage = lazy(() =>
  import("../pages/StrategicDashboardPage").then((module) => ({
    default: module.StrategicDashboardPage,
  })),
);

function withSuspense(node: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{node}</Suspense>;
}

function withShell(node: ReactNode) {
  return <AppShell>{withSuspense(node)}</AppShell>;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={withSuspense(<LandingPage />)} />
      <Route
        path="/institucional"
        element={withSuspense(<InstitutionalPage />)}
      />
      <Route
        path="/onboarding"
        element={withSuspense(<OnboardingChurchPage />)}
      />
      <Route path="/convite" element={withSuspense(<InvitePage />)} />

      <Route element={<PublicRoute />}>
        <Route path="/login" element={withSuspense(<LoginPage />)} />
        <Route path="/cadastro" element={withSuspense(<RegisterPage />)} />
        <Route
          path="/recuperar-senha"
          element={withSuspense(<ForgotPasswordPage />)}
        />
        <Route
          path="/redefinir-senha"
          element={withSuspense(<ResetPasswordPage />)}
        />
      </Route>

      <Route
        path="/aguardando-aprovacao"
        element={withSuspense(<PendingApprovalPage />)}
      />

      <Route element={<PrivateRoute />}>
        <Route path="/dashboard" element={withShell(<DashboardPage />)} />
        <Route
          path="/minhas-escalas"
          element={withShell(<MySchedulesPage />)}
        />
        <Route
          path="/minha-disponibilidade"
          element={withShell(<MyAvailabilityPage />)}
        />
        <Route path="/meu-perfil" element={withShell(<MyProfilePage />)} />
        <Route
          path="/gestao-escalas"
          element={withShell(<AdminSchedulesPage />)}
        />
        <Route path="/eventos" element={withShell(<EventsPage />)} />
        <Route
          path="/trocas/solicitar"
          element={withShell(<SwapRequestPage />)}
        />
        <Route
          path="/trocas/minhas"
          element={withShell(<MySwapRequestsPage />)}
        />
        <Route
          path="/trocas/recebidas"
          element={withShell(<ReceivedSwapRequestsPage />)}
        />
        <Route
          path="/trocas/historico"
          element={withShell(<SwapHistoryPage />)}
        />
        <Route
          path="/notificacoes"
          element={withShell(<NotificationsPage />)}
        />
        <Route path="/ranking" element={withShell(<RankingPage />)} />
        <Route path="/ia-insights" element={withShell(<IAInsightsPage />)} />
        <Route path="/check-in" element={withShell(<CheckInPage />)} />
        <Route path="/ajuda" element={withShell(<HelpCenterPage />)} />
        <Route path="/ajuda/feedback" element={withShell(<FeedbackPage />)} />
        <Route path="/treinamento" element={withShell(<TrainingModePage />)} />
        <Route
          path="/painel-estrategico"
          element={withShell(<StrategicDashboardPage />)}
        />
      </Route>

      <Route
        element={
          <PrivateRoute
            allowedProfiles={["ADMIN", "MASTER_ADMIN", "MASTER_PLATFORM_ADMIN"]}
          />
        }
      >
        <Route
          path="/aprovacao-voluntarios"
          element={withShell(<ApproveVolunteersPage />)}
        />
        <Route path="/presenca" element={withShell(<AttendanceManagePage />)} />
        <Route path="/auditoria" element={withShell(<AuditLogsPage />)} />
        <Route path="/relatorios" element={withShell(<ReportsPage />)} />
        <Route
          path="/igreja/configuracoes"
          element={withShell(<ChurchSettingsPage />)}
        />
      </Route>

      <Route
        element={
          <PrivateRoute
            allowedProfiles={["MASTER_ADMIN", "MASTER_PLATFORM_ADMIN"]}
          />
        }
      >
        <Route path="/master-admin" element={withShell(<MasterAdminPage />)} />
        <Route
          path="/igreja/branding"
          element={withShell(<ChurchBrandingPage />)}
        />
        <Route
          path="/multi-unidade"
          element={withShell(<MultiUnitDashboardPage />)}
        />
      </Route>

      <Route
        element={<PrivateRoute allowedProfiles={["MASTER_PLATFORM_ADMIN"]} />}
      >
        <Route path="/igrejas" element={withShell(<ChurchManagementPage />)} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

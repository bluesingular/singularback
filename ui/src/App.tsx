import { Navigate, Outlet, Route, Routes, useLocation, useParams } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Layout } from "./components/Layout";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { authApi } from "./api/auth";
import { healthApi } from "./api/health";
import { companiesApi } from "./api/companies";
import { Dashboard } from "./pages/Dashboard";
import { Companies } from "./pages/Companies";
import { Agents } from "./pages/Agents";
import { AgentDetail } from "./pages/AgentDetail";
import { Projects } from "./pages/Projects";
import { ProjectDetail } from "./pages/ProjectDetail";
import { ProjectWorkspaceDetail } from "./pages/ProjectWorkspaceDetail";
import { Issues } from "./pages/Issues";
import { IssueDetail } from "./pages/IssueDetail";
import { Routines } from "./pages/Routines";
import { RoutineDetail } from "./pages/RoutineDetail";
import { ExecutionWorkspaceDetail } from "./pages/ExecutionWorkspaceDetail";
import { Goals } from "./pages/Goals";
import { GoalDetail } from "./pages/GoalDetail";
import { Approvals } from "./pages/Approvals";
import { ApprovalDetail } from "./pages/ApprovalDetail";
import { Costs } from "./pages/Costs";
import { Activity } from "./pages/Activity";
import { Inbox } from "./pages/Inbox";
import { CompanySettings } from "./pages/CompanySettings";
import { CompanySkills } from "./pages/CompanySkills";
import { CompanyExport } from "./pages/CompanyExport";
import { CompanyImport } from "./pages/CompanyImport";
import { DesignGuide } from "./pages/DesignGuide";
import { InstanceGeneralSettings } from "./pages/InstanceGeneralSettings";
import { InstanceSettings } from "./pages/InstanceSettings";
import { InstanceExperimentalSettings } from "./pages/InstanceExperimentalSettings";
import { PluginManager } from "./pages/PluginManager";
import { PluginSettings } from "./pages/PluginSettings";
import { AdapterManager } from "./pages/AdapterManager";
import { PluginPage } from "./pages/PluginPage";
import { IssueChatUxLab } from "./pages/IssueChatUxLab";
import { RunTranscriptUxLab } from "./pages/RunTranscriptUxLab";
import { OrgChart } from "./pages/OrgChart";
import { NewAgent } from "./pages/NewAgent";
import { AuthPage } from "./pages/Auth";
import { BoardClaimPage } from "./pages/BoardClaim";
import { CliAuthPage } from "./pages/CliAuth";
import { InviteLandingPage } from "./pages/InviteLanding";
import { NotFoundPage } from "./pages/NotFound";
import { lazy, Suspense } from "react";
const SingularDashboard = lazy(() => import("./pages/singular/Dashboard"));
const Team = lazy(() => import("./pages/singular/Team"));
const AgentProfile = lazy(() => import("./pages/singular/AgentProfile"));
const TrustCentre = lazy(() => import("./pages/singular/TrustCentre"));
const TaskThread = lazy(() => import("./pages/singular/TaskThread"));
const MissionsArchive = lazy(() => import('./pages/singular/MissionsArchive').then(m => ({ default: m.MissionsArchive })));
const ConsoleCEO     = lazy(() => import("./pages/singular/ConsoleCEO").then(m => ({ default: m.ConsoleCEO })));
const Reports = lazy(() => import("./pages/singular/Reports").then(m => ({ default: m.Reports })));
const Contacts       = lazy(() => import("./pages/singular/Contacts").then(m => ({ default: m.Contacts })));
const Settings = lazy(() => import("./pages/singular/Settings").then(m => ({ default: m.Settings })));
const SingularPreview = lazy(() => import("./pages/singular/Preview").then(m => ({ default: m.SingularPreview })));
const AssistantInstallation = lazy(() => import("./pages/singular/AssistantInstallation").then(m => ({ default: m.AssistantInstallation })));
const Signup = lazy(() => import("./pages/singular/Signup").then(m => ({ default: m.Signup })));
const CataloguePacks = lazy(() => import("./pages/singular/CataloguePacks").then(m => ({ default: m.CataloguePacks })));
const PaymentSuccess = lazy(() => import("./pages/singular/PaymentSuccess").then(m => ({ default: m.PaymentSuccess })));
const ConfigAgent    = lazy(() => import("./pages/singular/ConfigAgent").then(m => ({ default: m.ConfigAgent })));
const AdminLayout       = lazy(() => import("./pages/singular/admin/AdminLayout").then(m => ({ default: m.AdminLayout })));
const AdminHealth       = lazy(() => import("./pages/singular/admin/AdminHealth").then(m => ({ default: m.AdminHealth })));
const AdminTenants      = lazy(() => import("./pages/singular/admin/AdminTenants").then(m => ({ default: m.AdminTenants })));
const VoiceAgent        = lazy(() => import("./pages/singular/VoiceAgent"));
const DocumentStudio    = lazy(() => import("./pages/singular/DocumentStudio"));
const FinancialPulsePage = lazy(() => import("./pages/singular/FinancialPulse"));
const CeoHealth         = lazy(() => import("./pages/singular/CeoHealth"));
const CalendarBriefing  = lazy(() => import("./pages/singular/CalendarBriefing"));
const AdminTenantDetail = lazy(() => import("./pages/singular/admin/AdminTenantDetail").then(m => ({ default: m.AdminTenantDetail })));
const AdminSkills       = lazy(() => import("./pages/singular/admin/AdminSkills").then(m => ({ default: m.AdminSkills })));
const AdminSkillEditor  = lazy(() => import("./pages/singular/admin/AdminSkillEditor").then(m => ({ default: m.AdminSkillEditor })));
const AdminApiKeys      = lazy(() => import("./pages/singular/admin/AdminApiKeys").then(m => ({ default: m.AdminApiKeys })));
const AdminQualityGates = lazy(() => import("./pages/singular/admin/AdminQualityGates").then(m => ({ default: m.AdminQualityGates })));
const AdminIntegrations = lazy(() => import("./pages/singular/admin/AdminIntegrations").then(m => ({ default: m.AdminIntegrations })));
const AdminWebhooks     = lazy(() => import("./pages/singular/admin/AdminWebhooks").then(m => ({ default: m.AdminWebhooks })));
const AdminLlmModels   = lazy(() => import("./pages/singular/admin/AdminLlmModels").then(m => ({ default: m.AdminLlmModels })));
const AdminBilling     = lazy(() => import("./pages/singular/admin/AdminBilling").then(m => ({ default: m.AdminBilling })));
const AdminMembers     = lazy(() => import("./pages/singular/admin/AdminMembers").then(m => ({ default: m.AdminMembers })));
const AdminTrustConfig = lazy(() => import("./pages/singular/admin/AdminTrustConfig").then(m => ({ default: m.AdminTrustConfig })));
const AdminNotifications = lazy(() => import("./pages/singular/admin/AdminNotifications").then(m => ({ default: m.AdminNotifications })));
const AdminGdpr        = lazy(() => import("./pages/singular/admin/AdminGdpr").then(m => ({ default: m.AdminGdpr })));
const AdminSkillPerformance    = lazy(() => import("./pages/singular/admin/AdminSkillPerformance").then(m => ({ default: m.AdminSkillPerformance })));
const AdminBehavioralAnomalies = lazy(() => import("./pages/singular/admin/AdminBehavioralAnomalies").then(m => ({ default: m.AdminBehavioralAnomalies })));
const AdminVarianceMetrics     = lazy(() => import("./pages/singular/admin/AdminVarianceMetrics").then(m => ({ default: m.AdminVarianceMetrics })));
const AdminPackInstaller       = lazy(() => import("./pages/singular/admin/AdminPackInstaller").then(m => ({ default: m.AdminPackInstaller })));
import { queryKeys } from "./lib/queryKeys";
import { useCompany } from "./context/CompanyContext";
import { useDialog } from "./context/DialogContext";
import { loadLastInboxTab } from "./lib/inbox";
import { shouldRedirectCompanylessRouteToOnboarding } from "./lib/onboarding-route";

function BootstrapPendingPage({ hasActiveInvite = false }: { hasActiveInvite?: boolean }) {
  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">Instance setup required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {hasActiveInvite
            ? "No instance admin exists yet. A bootstrap invite is already active. Check your Paperclip startup logs for the first admin invite URL, or run this command to rotate it:"
            : "No instance admin exists yet. Run this command in your Paperclip environment to generate the first admin invite URL:"}
        </p>
        <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
{`pnpm paperclipai auth bootstrap-ceo`}
        </pre>
      </div>
    </div>
  );
}

function CloudAccessGate() {
  const location = useLocation();
  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data as
        | { deploymentMode?: "local_trusted" | "authenticated"; bootstrapStatus?: "ready" | "bootstrap_pending" }
        | undefined;
      return data?.deploymentMode === "authenticated" && data.bootstrapStatus === "bootstrap_pending"
        ? 2000
        : false;
    },
    refetchIntervalInBackground: true,
  });

  const isAuthenticatedMode = healthQuery.data?.deploymentMode === "authenticated";
  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    enabled: isAuthenticatedMode,
    retry: false,
  });

  if (healthQuery.isLoading || (isAuthenticatedMode && sessionQuery.isLoading)) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Loading...</div>;
  }

  if (healthQuery.error) {
    return (
      <div className="mx-auto max-w-xl py-10 text-sm text-destructive">
        {healthQuery.error instanceof Error ? healthQuery.error.message : "Failed to load app state"}
      </div>
    );
  }

  if (isAuthenticatedMode && healthQuery.data?.bootstrapStatus === "bootstrap_pending") {
    return <BootstrapPendingPage hasActiveInvite={healthQuery.data.bootstrapInviteActive} />;
  }

  if (isAuthenticatedMode && !sessionQuery.data) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/auth?next=${next}`} replace />;
  }

  return <Outlet />;
}

function boardRoutes() {
  return (
    <>
      <Route index element={<SingularIndexRedirect />} />
      <Route path="catalogue" element={<Suspense fallback={null}><CataloguePacks /></Suspense>} />
      <Route path="installation" element={<Suspense fallback={null}><AssistantInstallation /></Suspense>} />
      <Route path="dashboard" element={<Suspense fallback={null}><SingularDashboard /></Suspense>} />
      <Route path="team" element={<Suspense fallback={null}><Team /></Suspense>} />
      <Route path="team/:slug" element={<Suspense fallback={null}><AgentProfile /></Suspense>} />
      <Route path="team/:slug/config" element={<Suspense fallback={null}><ConfigAgent /></Suspense>} />
      <Route path="trust" element={<Suspense fallback={null}><TrustCentre /></Suspense>} />
      <Route path="tasks/:taskId" element={<Suspense fallback={null}><TaskThread /></Suspense>} />
      <Route path="console" element={<Suspense fallback={null}><ConsoleCEO /></Suspense>} />
      <Route path="missions/archive" element={<Suspense fallback={null}><MissionsArchive /></Suspense>} />
      <Route path="reports" element={<Suspense fallback={null}><Reports /></Suspense>} />
      <Route path="contacts" element={<Suspense fallback={null}><Contacts /></Suspense>} />
      <Route path="voice" element={<Suspense fallback={null}><VoiceAgent /></Suspense>} />
      <Route path="documents" element={<Suspense fallback={null}><DocumentStudio /></Suspense>} />
      <Route path="financial-pulse" element={<Suspense fallback={null}><FinancialPulsePage /></Suspense>} />
      <Route path="ceo-health" element={<Suspense fallback={null}><CeoHealth /></Suspense>} />
      <Route path="meeting-briefing" element={<Suspense fallback={null}><CalendarBriefing /></Suspense>} />
      <Route path="settings" element={<Suspense fallback={null}><Settings /></Suspense>} />
      {/* Approvals surfaced within the Singular layout so navigation stays consistent */}
      <Route path="approbations" element={<Navigate to="/approvals/pending" replace />} />
      <Route path="approvals" element={<Navigate to="/approvals/pending" replace />} />
      <Route path="approvals/pending" element={<Approvals />} />
      <Route path="approvals/all" element={<Approvals />} />
      <Route path="approvals/:approvalId" element={<ApprovalDetail />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="onboarding" element={<OnboardingRoutePage />} />
      <Route path="companies" element={<Companies />} />
      <Route path="company/settings" element={<CompanySettings />} />
      <Route path="company/export/*" element={<CompanyExport />} />
      <Route path="company/import" element={<CompanyImport />} />
      <Route path="skills/*" element={<CompanySkills />} />
      <Route path="settings" element={<LegacySettingsRedirect />} />
      <Route path="settings/*" element={<LegacySettingsRedirect />} />
      <Route path="plugins/:pluginId" element={<PluginPage />} />
      <Route path="org" element={<OrgChart />} />
      <Route path="agents" element={<Navigate to="/agents/all" replace />} />
      <Route path="agents/all" element={<Agents />} />
      <Route path="agents/active" element={<Agents />} />
      <Route path="agents/paused" element={<Agents />} />
      <Route path="agents/error" element={<Agents />} />
      <Route path="agents/new" element={<NewAgent />} />
      <Route path="agents/:agentId" element={<AgentDetail />} />
      <Route path="agents/:agentId/:tab" element={<AgentDetail />} />
      <Route path="agents/:agentId/runs/:runId" element={<AgentDetail />} />
      <Route path="projects" element={<Projects />} />
      <Route path="projects/:projectId" element={<ProjectDetail />} />
      <Route path="projects/:projectId/overview" element={<ProjectDetail />} />
      <Route path="projects/:projectId/issues" element={<ProjectDetail />} />
      <Route path="projects/:projectId/issues/:filter" element={<ProjectDetail />} />
      <Route path="projects/:projectId/workspaces/:workspaceId" element={<ProjectWorkspaceDetail />} />
      <Route path="projects/:projectId/workspaces" element={<ProjectDetail />} />
      <Route path="projects/:projectId/configuration" element={<ProjectDetail />} />
      <Route path="projects/:projectId/budget" element={<ProjectDetail />} />
      <Route path="issues" element={<Issues />} />
      <Route path="issues/all" element={<Navigate to="/issues" replace />} />
      <Route path="issues/active" element={<Navigate to="/issues" replace />} />
      <Route path="issues/backlog" element={<Navigate to="/issues" replace />} />
      <Route path="issues/done" element={<Navigate to="/issues" replace />} />
      <Route path="issues/recent" element={<Navigate to="/issues" replace />} />
      <Route path="issues/:issueId" element={<IssueDetail />} />
      <Route path="routines" element={<Routines />} />
      <Route path="routines/:routineId" element={<RoutineDetail />} />
      <Route path="execution-workspaces/:workspaceId" element={<ExecutionWorkspaceDetail />} />
      <Route path="execution-workspaces/:workspaceId/configuration" element={<ExecutionWorkspaceDetail />} />
      <Route path="execution-workspaces/:workspaceId/runtime-logs" element={<ExecutionWorkspaceDetail />} />
      <Route path="execution-workspaces/:workspaceId/issues" element={<ExecutionWorkspaceDetail />} />
      <Route path="goals" element={<Goals />} />
      <Route path="goals/:goalId" element={<GoalDetail />} />
      <Route path="approvals" element={<Navigate to="/approvals/pending" replace />} />
      <Route path="approvals/pending" element={<Approvals />} />
      <Route path="approvals/all" element={<Approvals />} />
      <Route path="approvals/:approvalId" element={<ApprovalDetail />} />
      <Route path="costs" element={<Costs />} />
      <Route path="activity" element={<Activity />} />
      <Route path="inbox" element={<InboxRootRedirect />} />
      <Route path="inbox/mine" element={<Inbox />} />
      <Route path="inbox/recent" element={<Inbox />} />
      <Route path="inbox/unread" element={<Inbox />} />
      <Route path="inbox/all" element={<Inbox />} />
      <Route path="inbox/new" element={<Navigate to="/inbox/mine" replace />} />
      <Route path="design-guide" element={<DesignGuide />} />
      <Route path="tests/ux/chat" element={<IssueChatUxLab />} />
      <Route path="tests/ux/runs" element={<RunTranscriptUxLab />} />
      <Route path="instance/settings/adapters" element={<AdapterManager />} />
      <Route path=":pluginRoutePath" element={<PluginPage />} />
      <Route path="*" element={<NotFoundPage scope="board" />} />
    </>
  );
}

function InboxRootRedirect() {
  return <Navigate to={`/inbox/${loadLastInboxTab()}`} replace />;
}

function LegacySettingsRedirect() {
  const location = useLocation();
  return <Navigate to={`/instance/settings/general${location.search}${location.hash}`} replace />;
}

function OnboardingRoutePage() {
  const { companies } = useCompany();
  const { openOnboarding } = useDialog();
  const { companyPrefix } = useParams<{ companyPrefix?: string }>();
  const matchedCompany = companyPrefix
    ? companies.find((company) => company.issuePrefix.toUpperCase() === companyPrefix.toUpperCase()) ?? null
    : null;

  const title = matchedCompany
    ? `Add another agent to ${matchedCompany.name}`
    : companies.length > 0
      ? "Create another company"
      : "Create your first company";
  const description = matchedCompany
    ? "Run onboarding again to add an agent and a starter task for this company."
    : companies.length > 0
      ? "Run onboarding again to create another company and seed its first agent."
      : "Get started by creating a company and your first agent.";

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-4">
          <Button
            onClick={() =>
              matchedCompany
                ? openOnboarding({ initialStep: 2, companyId: matchedCompany.id })
                : openOnboarding()
            }
          >
            {matchedCompany ? "Add Agent" : "Start Onboarding"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SingularIndexRedirect() {
  const { selectedCompanyId } = useCompany();
  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-state", selectedCompanyId],
    queryFn: () => companiesApi.getOnboardingState(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return null;
  }

  if (!data.packInstalled) {
    return <Navigate to="installation" replace />;
  }

  return <Navigate to="dashboard" replace />;
}

function CompanyRootRedirect() {
  const { companies, selectedCompany, loading } = useCompany();
  const location = useLocation();

  if (loading) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Loading...</div>;
  }

  const targetCompany = selectedCompany ?? companies[0] ?? null;
  if (!targetCompany) {
    if (
      shouldRedirectCompanylessRouteToOnboarding({
        pathname: location.pathname,
        hasCompanies: false,
      })
    ) {
      return <Navigate to="/onboarding" replace />;
    }
    return <NoCompaniesStartPage />;
  }

  return <Navigate to={`/${targetCompany.issuePrefix}/dashboard`} replace />;
}

function UnprefixedBoardRedirect() {
  const location = useLocation();
  const { companies, selectedCompany, loading } = useCompany();

  if (loading) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Loading...</div>;
  }

  const targetCompany = selectedCompany ?? companies[0] ?? null;
  if (!targetCompany) {
    if (
      shouldRedirectCompanylessRouteToOnboarding({
        pathname: location.pathname,
        hasCompanies: false,
      })
    ) {
      return <Navigate to="/onboarding" replace />;
    }
    return <NoCompaniesStartPage />;
  }

  return (
    <Navigate
      to={`/${targetCompany.issuePrefix}${location.pathname}${location.search}${location.hash}`}
      replace
    />
  );
}

function NoCompaniesStartPage() {
  const { openOnboarding } = useDialog();

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">Create your first company</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Get started by creating a company.
        </p>
        <div className="mt-4">
          <Button onClick={() => openOnboarding()}>New Company</Button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <>
      <Routes>
        <Route path="preview/*" element={<SingularPreview />} />
        <Route path="auth" element={<AuthPage />} />
        <Route path="inscription" element={<Suspense fallback={null}><Signup /></Suspense>} />
        <Route path="succes-paiement" element={<Suspense fallback={null}><PaymentSuccess /></Suspense>} />
        <Route path="board-claim/:token" element={<BoardClaimPage />} />
        <Route path="cli-auth/:id" element={<CliAuthPage />} />
        <Route path="invite/:token" element={<InviteLandingPage />} />

        <Route element={<CloudAccessGate />}>
          <Route index element={<CompanyRootRedirect />} />
          <Route path="onboarding" element={<OnboardingRoutePage />} />
          <Route path="instance" element={<Navigate to="/instance/settings/general" replace />} />
          <Route path="instance/admin" element={<Suspense fallback={null}><AdminLayout /></Suspense>}>
            <Route index element={<Suspense fallback={null}><AdminHealth /></Suspense>} />
            <Route path="tenants" element={<Suspense fallback={null}><AdminTenants /></Suspense>} />
            <Route path="tenants/:companyId" element={<Suspense fallback={null}><AdminTenantDetail /></Suspense>} />
            <Route path="skills" element={<Suspense fallback={null}><AdminSkills /></Suspense>} />
            <Route path="skills/:skillType/versions/:versionId" element={<Suspense fallback={null}><AdminSkillEditor /></Suspense>} />
            <Route path="api-keys" element={<Suspense fallback={null}><AdminApiKeys /></Suspense>} />
            <Route path="quality-gates" element={<Suspense fallback={null}><AdminQualityGates /></Suspense>} />
            <Route path="integrations" element={<Suspense fallback={null}><AdminIntegrations /></Suspense>} />
            <Route path="webhooks" element={<Suspense fallback={null}><AdminWebhooks /></Suspense>} />
            <Route path="llm-models" element={<Suspense fallback={null}><AdminLlmModels /></Suspense>} />
            <Route path="billing" element={<Suspense fallback={null}><AdminBilling /></Suspense>} />
            <Route path="members" element={<Suspense fallback={null}><AdminMembers /></Suspense>} />
            <Route path="trust" element={<Suspense fallback={null}><AdminTrustConfig /></Suspense>} />
            <Route path="notifications" element={<Suspense fallback={null}><AdminNotifications /></Suspense>} />
            <Route path="gdpr" element={<Suspense fallback={null}><AdminGdpr /></Suspense>} />
            <Route path="skill-performance" element={<Suspense fallback={null}><AdminSkillPerformance /></Suspense>} />
            <Route path="packs" element={<Suspense fallback={null}><AdminPackInstaller /></Suspense>} />
            <Route path="anomalies" element={<Suspense fallback={null}><AdminBehavioralAnomalies /></Suspense>} />
            <Route path="variance" element={<Suspense fallback={null}><AdminVarianceMetrics /></Suspense>} />
          </Route>
          <Route path="instance/settings" element={<Layout />}>
            <Route index element={<Navigate to="general" replace />} />
            <Route path="general" element={<InstanceGeneralSettings />} />
            <Route path="heartbeats" element={<InstanceSettings />} />
            <Route path="experimental" element={<InstanceExperimentalSettings />} />
            <Route path="plugins" element={<PluginManager />} />
            <Route path="plugins/:pluginId" element={<PluginSettings />} />
            <Route path="adapters" element={<AdapterManager />} />
          </Route>
          <Route path="companies" element={<UnprefixedBoardRedirect />} />
          <Route path="issues" element={<UnprefixedBoardRedirect />} />
          <Route path="issues/:issueId" element={<UnprefixedBoardRedirect />} />
          <Route path="routines" element={<UnprefixedBoardRedirect />} />
          <Route path="routines/:routineId" element={<UnprefixedBoardRedirect />} />
          <Route path="skills/*" element={<UnprefixedBoardRedirect />} />
          <Route path="settings" element={<LegacySettingsRedirect />} />
          <Route path="settings/*" element={<LegacySettingsRedirect />} />
          <Route path="agents" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/new" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/:agentId" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/:agentId/:tab" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/:agentId/runs/:runId" element={<UnprefixedBoardRedirect />} />
          <Route path="projects" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/overview" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/issues" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/issues/:filter" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/workspaces" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/workspaces/:workspaceId" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/configuration" element={<UnprefixedBoardRedirect />} />
          <Route path="execution-workspaces/:workspaceId" element={<UnprefixedBoardRedirect />} />
          <Route path="execution-workspaces/:workspaceId/configuration" element={<UnprefixedBoardRedirect />} />
          <Route path="execution-workspaces/:workspaceId/runtime-logs" element={<UnprefixedBoardRedirect />} />
          <Route path="execution-workspaces/:workspaceId/issues" element={<UnprefixedBoardRedirect />} />
          <Route path="tests/ux/chat" element={<UnprefixedBoardRedirect />} />
          <Route path="tests/ux/runs" element={<UnprefixedBoardRedirect />} />
          <Route path=":companyPrefix" element={<Layout />}>
            {boardRoutes()}
          </Route>
          <Route path="*" element={<NotFoundPage scope="global" />} />
        </Route>
      </Routes>
      <OnboardingWizard />
    </>
  );
}

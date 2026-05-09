import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LoginPage } from "./auth/LoginPage";
import { Layout } from "./components/Layout";
import TableauDeBord from "./pages/TableauDeBord";
import MonEquipe from "./pages/MonEquipe";
import CentreDeConfiance from "./pages/CentreDeConfiance";
import Approbations from "./pages/Approbations";
import ConsoleCEO from "./pages/ConsoleCEO";
import Rapports from "./pages/Rapports";
import Contacts from "./pages/Contacts";
import Parametres from "./pages/Parametres";

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function Guard() {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-[#1A9E68] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="tableau-de-bord" replace />} />
        <Route path="tableau-de-bord" element={<TableauDeBord />} />
        <Route path="mon-equipe" element={<MonEquipe />} />
        <Route path="centre-de-confiance" element={<CentreDeConfiance />} />
        <Route path="approbations" element={<Approbations />} />
        <Route path="console-ceo" element={<ConsoleCEO />} />
        <Route path="rapports" element={<Rapports />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="parametres" element={<Parametres />} />
        <Route path="*" element={<Navigate to="tableau-de-bord" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Guard />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

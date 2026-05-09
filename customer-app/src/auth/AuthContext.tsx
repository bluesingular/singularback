import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { authApi, type MeResponse, type MeCompany } from "../api/client";

interface AuthState {
  loading: boolean;
  user: MeResponse["user"] | null;
  companies: MeCompany[];
  activeCompany: MeCompany | null;
  companyId: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchCompany: (company: MeCompany) => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const COMPANY_KEY = "singular_active_company_id";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    user: null,
    companies: [],
    activeCompany: null,
    companyId: null,
  });

  const applyMe = useCallback((me: MeResponse) => {
    const savedId = localStorage.getItem(COMPANY_KEY);
    const found =
      me.companies.find((c) => c.id === savedId) ?? me.companies[0] ?? null;

    setState({
      loading: false,
      user: me.user,
      companies: me.companies,
      activeCompany: found,
      companyId: found?.id ?? null,
    });

    if (found) localStorage.setItem(COMPANY_KEY, found.id);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await authApi.me();
      applyMe(me);
    } catch {
      setState({ loading: false, user: null, companies: [], activeCompany: null, companyId: null });
    }
  }, [applyMe]);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email: string, password: string) => {
    await authApi.login(email, password);
    await refresh();
  };

  const logout = async () => {
    await authApi.logout();
    localStorage.removeItem(COMPANY_KEY);
    setState({ loading: false, user: null, companies: [], activeCompany: null, companyId: null });
  };

  const switchCompany = (company: MeCompany) => {
    localStorage.setItem(COMPANY_KEY, company.id);
    setState((s) => ({ ...s, activeCompany: company, companyId: company.id }));
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, switchCompany, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

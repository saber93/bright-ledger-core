import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "owner"
  | "accountant"
  | "cashier"
  | "sales_manager"
  | "inventory_manager"
  | "store_manager"
  | "staff";

export interface CompanyContext {
  id: string;
  name: string;
  currency: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  companyId: string | null;
  company: CompanyContext | null;
  roles: AppRole[];
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setCompanyId: (id: string) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [contextLoading, setContextLoading] = useState(false);
  const [companyId, setCompanyIdState] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyContext | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const loading = sessionLoading || contextLoading;

  // Bootstrap: subscribe FIRST, then fetch session.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (!s?.user) {
        setSessionLoading(false);
        setContextLoading(false);
        setCompanyIdState(null);
        setCompany(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (!data.session?.user) {
        setSessionLoading(false);
        setContextLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // When user changes, load default company + memberships
  useEffect(() => {
    if (!user) return;
    setContextLoading(true);
    void loadCompanyContext(user.id).finally(() => {
      setContextLoading(false);
      setSessionLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function loadCompanyContext(userId: string) {
    // Find profile + default company
    const { data: profile } = await supabase
      .from("profiles")
      .select("default_company_id")
      .eq("user_id", userId)
      .maybeSingle();

    let cid = profile?.default_company_id ?? null;

    if (!cid) {
      const { data: members } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", userId)
        .limit(1);
      cid = members?.[0]?.company_id ?? null;
    }

    if (!cid) return;
    setCompanyIdState(cid);

    const [{ data: companyRow }, { data: roleRows }] = await Promise.all([
      supabase.from("companies").select("id, name, currency").eq("id", cid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId).eq("company_id", cid),
    ]);

    if (companyRow) setCompany(companyRow as CompanyContext);
    if (roleRows) setRoles(roleRows.map((r) => r.role as AppRole));
  }

  async function refresh() {
    if (user) await loadCompanyContext(user.id);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setSessionLoading(false);
    setContextLoading(false);
    setCompanyIdState(null);
    setCompany(null);
    setRoles([]);
  }

  function setCompanyId(id: string) {
    setCompanyIdState(id);
    if (user) void loadCompanyContext(user.id);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        companyId,
        company,
        roles,
        signOut,
        refresh,
        setCompanyId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useHasRole(role: AppRole | AppRole[]) {
  const { roles } = useAuth();
  const list = Array.isArray(role) ? role : [role];
  return list.some((r) => roles.includes(r));
}

'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { UserRole } from '@pressly/types';
import { api, setToken, getToken } from '@/lib/api';

export interface NewsroomUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  locale: string;
}

interface AuthState {
  user: NewsroomUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<NewsroomUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from an existing token.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api<NewsroomUser>('/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api<{ token: string; user: NewsroomUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    setUser(res.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

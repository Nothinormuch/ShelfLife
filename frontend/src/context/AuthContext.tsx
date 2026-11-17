import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Store } from '../api/types';
import { apiFetch } from '../api/client';

interface AuthContextType {
  user: User | null;
  store: Store | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (storeName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('shelflife_access_token');
    const savedUser = localStorage.getItem('shelflife_user');
    const savedStore = localStorage.getItem('shelflife_store');

    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
        if (savedStore) setStore(JSON.parse(savedStore));
      } catch (e) {
        // bad local storage data
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Login failed');
    }

    const data = await res.json();
    localStorage.setItem('shelflife_access_token', data.accessToken);
    localStorage.setItem('shelflife_refresh_token', data.refreshToken);
    localStorage.setItem('shelflife_user', JSON.stringify(data.user));
    if (data.store) localStorage.setItem('shelflife_store', JSON.stringify(data.store));

    setToken(data.accessToken);
    setUser(data.user);
    setStore(data.store || null);
  };

  const register = async (storeName: string, email: string, password: string) => {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ storeName, email, password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Registration failed');
    }

    const data = await res.json();
    localStorage.setItem('shelflife_access_token', data.accessToken);
    localStorage.setItem('shelflife_refresh_token', data.refreshToken);
    localStorage.setItem('shelflife_user', JSON.stringify(data.user));
    localStorage.setItem('shelflife_store', JSON.stringify(data.store));

    setToken(data.accessToken);
    setUser(data.user);
    setStore(data.store);
  };

  const logout = () => {
    localStorage.removeItem('shelflife_access_token');
    localStorage.removeItem('shelflife_refresh_token');
    localStorage.removeItem('shelflife_user');
    localStorage.removeItem('shelflife_store');
    setToken(null);
    setUser(null);
    setStore(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        store,
        token,
        isAuthenticated: !!token,
        login,
        register,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

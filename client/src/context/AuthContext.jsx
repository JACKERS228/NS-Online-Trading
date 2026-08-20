import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { formatCurrencyValue } from '../utils/formatters';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [nation, setNation] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('ns_trading_token') || null);
  const [loading, setLoading] = useState(true);
  const [useNationalCurrency, setUseNationalCurrency] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Fetch nation profile on token change
  const refreshProfile = useCallback(async () => {
    const savedToken = localStorage.getItem('ns_trading_token');
    if (!savedToken) {
      setNation(null);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${savedToken}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setNation(data.nation);
      } else {
        localStorage.removeItem('ns_trading_token');
        setToken(null);
        setNation(null);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // Login or Register
  const registerOrLogin = useCallback(async ({ nationName, pin, currencyName, currencySymbol, usdExchangeRate }) => {
    try {
      const res = await fetch('/api/auth/register-or-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nationName, pin, currencyName, currencySymbol, usdExchangeRate })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('ns_trading_token', data.token);
      setToken(data.token);
      setNation(data.nation);
      setAuthModalOpen(false);
      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Update Currency Settings
  const updateCurrencySettings = useCallback(async ({ currencyName, currencySymbol, usdExchangeRate }) => {
    try {
      const res = await fetch('/api/auth/update-currency', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currencyName, currencySymbol, usdExchangeRate })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update currency');
      }

      await refreshProfile();
      return data;
    } catch (err) {
      throw err;
    }
  }, [token, refreshProfile]);

  // Reset Sandbox
  const resetSandbox = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/reset-sandbox', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset sandbox');
      }

      await refreshProfile();
      return data;
    } catch (err) {
      throw err;
    }
  }, [token, refreshProfile]);

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem('ns_trading_token');
    setToken(null);
    setNation(null);
  }, []);

  // High-performance currency formatter helper
  const formatMoney = useCallback((usdAmount, options = {}) => {
    const isUSD = options.forceUSD || !useNationalCurrency || !nation;
    return formatCurrencyValue(usdAmount, {
      rate: nation ? (Number(nation.usd_exchange_rate) || 1.0) : 1.0,
      symbol: nation ? nation.currency_symbol : '$',
      currencyName: nation ? nation.currency_name : '',
      forceUSD: isUSD,
      showSymbol: options.showSymbol !== false,
      maximumFractionDigits: options.maximumFractionDigits || 2,
      compact: options.compact || false
    });
  }, [useNationalCurrency, nation]);

  const formatRawUSD = useCallback((usdAmount) => {
    return formatMoney(usdAmount, { forceUSD: true });
  }, [formatMoney]);

  const contextValue = useMemo(() => ({
    nation,
    token,
    loading,
    useNationalCurrency,
    setUseNationalCurrency,
    authModalOpen,
    setAuthModalOpen,
    registerOrLogin,
    updateCurrencySettings,
    resetSandbox,
    logout,
    refreshProfile,
    formatMoney,
    formatRawUSD
  }), [
    nation,
    token,
    loading,
    useNationalCurrency,
    authModalOpen,
    registerOrLogin,
    updateCurrencySettings,
    resetSandbox,
    logout,
    refreshProfile,
    formatMoney,
    formatRawUSD
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

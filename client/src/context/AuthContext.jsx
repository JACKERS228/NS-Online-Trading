import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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
        // Token invalid or expired
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
  const registerOrLogin = async ({ nationName, pin, currencyName, currencySymbol, usdExchangeRate }) => {
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
  };

  // Update Currency Settings
  const updateCurrencySettings = async ({ currencyName, currencySymbol, usdExchangeRate }) => {
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
  };

  // Reset Sandbox
  const resetSandbox = async () => {
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
  };

  // Logout
  const logout = () => {
    localStorage.removeItem('ns_trading_token');
    setToken(null);
    setNation(null);
  };

  // Currency Formatter helper
  const formatMoney = useCallback((usdAmount, options = {}) => {
    const amount = Number(usdAmount) || 0;
    const { 
      forceUSD = false, 
      showSymbol = true, 
      maximumFractionDigits = 2, 
      compact = false 
    } = options;

    if (forceUSD || !useNationalCurrency || !nation) {
      // Format as USD Benchmark
      const formatted = new Intl.NumberFormat('en-US', {
        notation: compact && Math.abs(amount) >= 1000000 ? 'compact' : 'standard',
        minimumFractionDigits: Math.abs(amount) < 1 ? 2 : 2,
        maximumFractionDigits: Math.abs(amount) < 0.01 ? 4 : maximumFractionDigits
      }).format(amount);

      return showSymbol ? `$${formatted} USD` : `$${formatted}`;
    }

    // Convert to National Currency
    const rate = nation.usd_exchange_rate || 1.0;
    const nationalVal = amount * rate;
    const symbol = nation.currency_symbol || '¤';

    const formatted = new Intl.NumberFormat('en-US', {
      notation: compact && Math.abs(nationalVal) >= 1000000 ? 'compact' : 'standard',
      minimumFractionDigits: Math.abs(nationalVal) < 1 ? 2 : 2,
      maximumFractionDigits: Math.abs(nationalVal) < 0.01 ? 4 : maximumFractionDigits
    }).format(nationalVal);

    return showSymbol ? `${symbol}${formatted} ${nation.currency_name || ''}`.trim() : `${symbol}${formatted}`;
  }, [useNationalCurrency, nation]);

  const formatRawUSD = (usdAmount) => {
    return formatMoney(usdAmount, { forceUSD: true });
  };

  return (
    <AuthContext.Provider value={{
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
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

import React, { useState, useEffect } from 'react';
import { supabase, getCurrentUserProfile } from '@/api/supabaseClient';
import { AuthContext } from '@/lib/authContextValue';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings] = useState({ id: 'revex' });

  useEffect(() => {
    checkUserAuth();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        getCurrentUserProfile().then((u) => {
          setUser(u);
          setIsAuthenticated(true);
          setAuthChecked(true);
        });
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setAuthChecked(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const checkAppState = async () => {
    // Kept for compatibility with existing call sites; Supabase has no
    // separate "app public settings" step.
    await checkUserAuth();
  };

  const logout = async (shouldRedirect = true) => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) window.location.href = '/login';
  };

  const checkUserAuth = async (showLoader = true) => {
    try {
      if (showLoader) setIsLoadingAuth(true);
      const currentUser = await getCurrentUserProfile();
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        return currentUser;
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return null;
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      setAuthError({ type: 'unknown', message: error.message || 'An unexpected error occurred' });
      return null;
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

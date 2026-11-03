import React, { useState, useEffect, useRef } from 'react';
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
  const requestVersion = useRef(0);
  const activeUserId = useRef(null);

  useEffect(() => {
    checkUserAuth();
    let timer;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      clearTimeout(timer);
      requestVersion.current += 1;
      if (session?.user) {
        const changedAccount = activeUserId.current !== session.user.id;
        activeUserId.current = session.user.id;
        if (changedAccount) {
          setUser(null);
          setIsAuthenticated(false);
          setIsLoadingAuth(true);
        }
        // Leave the auth callback before making further Supabase requests.
        timer = setTimeout(() => { void checkUserAuth(changedAccount); }, 0);
      } else {
        activeUserId.current = null;
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthError(null);
        setAuthChecked(true);
      }
    });
    return () => {
      clearTimeout(timer);
      requestVersion.current += 1;
      sub.subscription.unsubscribe();
    };
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
    const version = ++requestVersion.current;
    try {
      if (showLoader) setIsLoadingAuth(true);
      const currentUser = await getCurrentUserProfile();
      if (version !== requestVersion.current) return null;
      setAuthError(null);
      if (currentUser) {
        activeUserId.current = currentUser.id;
        setUser(currentUser);
        setIsAuthenticated(true);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        return currentUser;
      } else {
        activeUserId.current = null;
        setUser(null);
        setIsAuthenticated(false);
      }
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return null;
    } catch (error) {
      if (version !== requestVersion.current) return null;
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
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

import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const OFFLINE_USER_KEY = "cliente-vivo-offline-user";

interface OfflineUser {
  id: string;
  email: string;
}

// Save user info for offline access
const saveUserForOffline = (user: User | null) => {
  if (user) {
    const offlineUser: OfflineUser = {
      id: user.id,
      email: user.email || "",
    };
    localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify(offlineUser));
  }
};

// Get cached user for offline mode
const getCachedUser = (): OfflineUser | null => {
  try {
    const cached = localStorage.getItem(OFFLINE_USER_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error("Error reading cached user:", error);
  }
  return null;
};

// Clear cached user on logout
const clearCachedUser = () => {
  localStorage.removeItem(OFFLINE_USER_KEY);
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsOfflineMode(false);
        
        // Save user for offline access
        if (session?.user) {
          saveUserForOffline(session.user);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSession(session);
        setUser(session.user);
        setIsOfflineMode(false);
        saveUserForOffline(session.user);
        setLoading(false);
      } else if (!navigator.onLine) {
        // If offline and no session, try to use cached user
        const cachedUser = getCachedUser();
        if (cachedUser) {
          // Create a minimal user object for offline mode
          setUser({ id: cachedUser.id, email: cachedUser.email } as User);
          setIsOfflineMode(true);
          console.log("Offline mode: using cached user");
        }
        setLoading(false);
      } else {
        setLoading(false);
      }
    }).catch(() => {
      // If network error, try offline mode
      if (!navigator.onLine) {
        const cachedUser = getCachedUser();
        if (cachedUser) {
          setUser({ id: cachedUser.id, email: cachedUser.email } as User);
          setIsOfflineMode(true);
          console.log("Offline mode: using cached user (after error)");
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, whatsapp?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          whatsapp: whatsapp || null
        }
      }
    });
    return { data, error };
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth?mode=reset`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      clearCachedUser();
    }
    return { error };
  };

  return {
    user,
    session,
    loading,
    isOfflineMode,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
  };
};

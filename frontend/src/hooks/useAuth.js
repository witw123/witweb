/**
 * Custom hook for authentication
 */
import { useState, useEffect } from 'react';
import * as authService from '../services/authService';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const data = await authService.login(username, password);
    setUser(data.profile);
    return data;
  };

  const register = async (userData) => {
    const data = await authService.register(userData);
    setUser(data.profile);
    return data;
  };

  const updateProfile = async (profileData) => {
    const data = await authService.updateProfile(profileData);
    setUser(data);
    return data;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return {
    user,
    loading,
    isAuthenticated: authService.isAuthenticated(),
    login,
    register,
    updateProfile,
    logout,
  };
}

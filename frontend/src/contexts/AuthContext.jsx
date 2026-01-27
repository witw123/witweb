import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if token exists and validate (optional: call /api/profile)
    const storedToken = localStorage.getItem("token");
    const storedProfile = localStorage.getItem("profile");

    if (storedToken) {
      setToken(storedToken);
      if (storedProfile) {
        try {
          setUser(JSON.parse(storedProfile));
        } catch (e) {
          console.error("Failed to parse profile", e);
        }
      }
    }
    setLoading(false);
  }, []);

  const login = (newToken, profile) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("profile", JSON.stringify(profile));
    setToken(newToken);
    setUser(profile);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("profile");
    setToken(null);
    setUser(null);
  };

  const updateProfile = (newProfile) => {
    localStorage.setItem("profile", JSON.stringify(newProfile));
    setUser(newProfile);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateProfile, loading, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

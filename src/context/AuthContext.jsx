import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("sentinel_user");
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch {}
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    // Mock auth — replace with real API call
    if (email && password) {
      const userData = {
        id: "u_001",
        email,
        name: email.split("@")[0],
        role: email.includes("admin") ? "Admin" : "Analyst",
        avatar: email[0].toUpperCase(),
        token: "mock_jwt_" + Date.now(),
      };
      setUser(userData);
      localStorage.setItem("sentinel_user", JSON.stringify(userData));
      return { success: true };
    }
    return { success: false, error: "Invalid credentials" };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("sentinel_user");
  };

  const hasRole = (role) => {
    const hierarchy = { Viewer: 0, Analyst: 1, Admin: 2 };
    return hierarchy[user?.role] >= hierarchy[role];
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

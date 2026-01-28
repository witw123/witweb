import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

import AdminEditor from "../pages/AdminEditor";
import BlogList from "../pages/BlogList";
import Forum from "../pages/Forum";
import BlogPost from "../pages/BlogPost";
import Favorites from "../pages/Favorites";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Profile from "../pages/Profile";
import AIAdmin from "../pages/AIAdmin";
import Layout from "../layouts/Layout";
import Studio from "../pages/Studio";
import AdminLayout from "../layouts/AdminLayout";
import Dashboard from "../pages/admin/Dashboard";
import UserManagement from "../pages/admin/UserManagement";
import BlogManagement from "../pages/admin/BlogManagement";

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function Router() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Layout><BlogList /></Layout>} />
      <Route path="/post/:slug" element={<Layout><BlogPost /></Layout>} />
      <Route path="/favorites" element={<RequireAuth><Layout><Favorites /></Layout></RequireAuth>} />
      <Route path="/studio" element={<Layout><Studio /></Layout>} />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <Layout>
              <AdminEditor />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <Layout>
              <Profile />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/forum"
        element={
          <Layout>
            <Forum />
          </Layout>
        }
      />
      <Route
        path="/admin/ai"
        element={
          <RequireAuth>
            <AdminLayout>
              <AIAdmin />
            </AdminLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <RequireAuth>
            <AdminLayout>
              <Dashboard />
            </AdminLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireAuth>
            <AdminLayout>
              <UserManagement />
            </AdminLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/blogs"
        element={
          <RequireAuth>
            <AdminLayout>
              <BlogManagement />
            </AdminLayout>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

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

// Layouts could be imported here if we had them
// import MainLayout from "../layouts/MainLayout";

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <div>Loading...</div>; // Or a fancy spinner

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

import Layout from "../layouts/Layout";

import Studio from "../pages/Studio";

export default function Router() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<BlogList />} />
        <Route path="/forum" element={<Forum />} />
        <Route path="/post/:slug" element={<BlogPost />} />
        <Route path="/studio" element={<Studio />} />
        <Route
          path="/favorites"
          element={
            <RequireAuth>
              <Favorites />
            </RequireAuth>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminEditor />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

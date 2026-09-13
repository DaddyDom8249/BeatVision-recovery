import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import Layout from "@/components/Layout";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import CreateProject from "@/pages/CreateProject";
import ProjectWorkflow from "@/pages/ProjectWorkflow";
import PersistentAnimationPage from "@/pages/PersistentAnimationPage";
import Settings from "@/pages/Settings";
import "@/App.css";

function PersistentAnimationLauncher() {
  const location = useLocation();
  const match = location.pathname.match(/^\/project\/([^/]+)$/);
  if (!match) return null;
  return <a href={`/project/${encodeURIComponent(match[1])}/animation`} className="fixed bottom-5 right-5 z-50 btn-gold inline-flex items-center gap-2 shadow-lg" data-testid="persistent-animation-launcher">Persistent Animation</a>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: "#121212",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#F5F5F5",
              fontFamily: "Manrope, sans-serif",
            },
          }}
        />
        <Routes>
          <Route path="/" element={<Layout><Landing /></Layout>} />
          <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
          <Route path="/new" element={<Layout><CreateProject /></Layout>} />
          <Route path="/project/:id" element={<Layout><ProjectWorkflow /></Layout>} />
          <Route path="/project/:id/animation" element={<PersistentAnimationPage />} />
          <Route path="/settings" element={<Layout><Settings /></Layout>} />
        </Routes>
        <PersistentAnimationLauncher />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

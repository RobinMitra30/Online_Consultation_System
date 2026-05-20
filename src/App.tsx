/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router';
import { AuthProvider, useAuth } from './components/auth-provider';
import { Navbar } from './components/navbar';
import LandingPage from './pages/landing';
import LoginPage from './pages/login';
import QuestionnairePage from './pages/questionnaire';
import BookingPage from './pages/booking';
import DashboardPage from './pages/dashboard';
import AdminDashboardPage from './pages/admin-dashboard';
import { Button } from './components/ui/button';

import DoctorSignupPage from './pages/doctor/signup';
import DoctorLoginPage from './pages/doctor/login';
import DoctorDashboardPage from './pages/doctor/dashboard';
import { Toaster } from 'sonner';

function ProtectedRoute({ children, requireAdmin, requireDoctor }: { children: React.ReactNode, requireAdmin?: boolean, requireDoctor?: boolean }) {
  const { user, appUser, loading } = useAuth();
  
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user || !appUser) return <Navigate to="/login" />;
  if (requireAdmin && appUser.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h1 className="text-3xl font-bold text-destructive mb-4">Access Denied</h1>
        <p className="text-muted-foreground mb-6">You do not have permission to access the Admin Dashboard.</p>
        <Link to="/dashboard">
          <Button variant="outline">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }
  if (requireDoctor && appUser.role !== 'doctor') {
    return <Navigate to="/" />;
  }
  
  return <>{children}</>;
}


export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" closeButton richColors />
      <BrowserRouter>
        <div className="min-h-screen bg-background text-foreground font-sans">
          <Navbar />
          <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/doctor/signup" element={<DoctorSignupPage />} />
              <Route path="/doctor/login" element={<DoctorLoginPage />} />
              <Route 
                path="/questionnaire" 
                element={
                  <ProtectedRoute>
                    <QuestionnairePage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/book" 
                element={
                  <ProtectedRoute>
                    <BookingPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/doctor/dashboard" 
                element={
                  <ProtectedRoute requireDoctor>
                    <DoctorDashboardPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminDashboardPage />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}


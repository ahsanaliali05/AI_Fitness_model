// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Workout from './pages/Workout';
import Diet from './pages/Diet';
import Chatbot from './pages/Chatbot';
import Progress from './pages/Progress';
import ProfileSetup from './pages/ProfileSetup';
import Gyms from './pages/Gyms';
import WorkoutPlan from './pages/WorkoutPlan';
import TrainerBooking from './pages/TrainerBooking';
import api from './api';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      let token = null;
      if (Capacitor.isNativePlatform()) {
        const { value } = await Preferences.get({ key: 'token' });
        token = value;
      } else {
        token = localStorage.getItem('token');
      }

      if (!token) {
        setIsAuthenticated(false);
        return;
      }

      try {
        await api.get('/api/user/me');
        setIsAuthenticated(true);
      } catch {
        // Token invalid – clear it
        if (Capacitor.isNativePlatform()) {
          await Preferences.remove({ key: 'token' });
        } else {
          localStorage.removeItem('token');
        }
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return <div className="flex justify-center items-center h-screen bg-black text-green-500">Loading...</div>;
  }

  return (
    <BrowserRouter>
      {!isAuthenticated ? (
        <div className="bg-black min-h-screen">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </div>
      ) : (
        <>
          <Navbar />
          <main className="container mx-auto px-4 py-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/workout" element={<Workout />} />
              <Route path="/diet" element={<Diet />} />
              <Route path="/chat" element={<Chatbot />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/profile-setup" element={<ProfileSetup />} />
              <Route path="/gyms" element={<Gyms />} />
              <Route path="/workout-plan" element={<WorkoutPlan />} />
              <Route path="/trainers" element={<TrainerBooking />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </>
      )}
    </BrowserRouter>
  );
}

export default App;

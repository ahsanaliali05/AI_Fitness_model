// src/pages/Login.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { FiLogIn, FiMail, FiLock } from 'react-icons/fi';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    console.log('📤 Login attempt:', { email });

    try {
      console.log('📡 Sending login request to /api/auth/login');
      const res = await api.post('/api/auth/login', { email, password });
      const token = res.data.access_token;
      console.log('✅ Login successful, token received (first 20 chars):', token.substring(0, 20) + '...');

      // Store token depending on platform
      if (Capacitor.isNativePlatform()) {
        console.log('📱 Native platform detected, saving token to Preferences');
        await Preferences.set({ key: 'token', value: token });
        // Verify it was saved
        const { value: savedToken } = await Preferences.get({ key: 'token' });
        console.log('🔍 Verification - Token saved:', savedToken ? 'YES' : 'NO');
      } else {
        console.log('🌐 Web platform, saving token to localStorage');
        localStorage.setItem('token', token);
        console.log('🔍 Verification - Token saved:', localStorage.getItem('token') ? 'YES' : 'NO');
      }

      console.log('🚀 Redirecting to dashboard...');
      window.location.href = '/';
    } catch (err) {
      console.error('❌ Login error:', err.response?.status, err.response?.data || err.message);
      setError(err.response?.data?.detail || 'Login failed. Check email/password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8 border border-gray-100">
        <div className="text-center mb-8">
          <FiLogIn size={48} className="text-green-600 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-800 mt-3">Welcome Back</h1>
          <p className="text-gray-500">Login to your AI Fitness account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <FiMail /> Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <FiLock /> Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="input-field"
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="text-center text-gray-500 mt-6">
          Don't have an account? <Link to="/register" className="text-green-600 hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}

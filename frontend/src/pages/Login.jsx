import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { FiLogIn, FiMail, FiLock } from 'react-icons/fi';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('token', res.data.access_token);
      window.location.href = '/';
    } catch (err) {
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
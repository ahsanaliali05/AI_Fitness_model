import axios from 'axios';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

// Hardcoded backend URL for mobile app
const API_BASE_URL = 'https://ai-fitness-backend-w99e.onrender.com';

console.log('🚀 API Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor – adds token from the correct storage
api.interceptors.request.use(async (config) => {
  let token = null;

  if (Capacitor.isNativePlatform()) {
    // Native (APK) – use Capacitor Preferences
    const { value } = await Preferences.get({ key: 'token' });
    token = value;
  } else {
    // Web browser – use localStorage
    token = localStorage.getItem('token');
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;  // ✅ fixed missing token
  }
  return config;
});

export default api;

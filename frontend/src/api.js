import axios from 'axios';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const API_BASE_URL = 'https://ai-fitness-backend-w99e.onrender.com';
console.log('🚀 API Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  console.log('📡 Request to:', config.url);
  let token = null;
  if (Capacitor.isNativePlatform()) {
    const { value } = await Preferences.get({ key: 'token' });
    token = value;
    console.log('🔑 Token from Preferences:', token ? 'present' : 'MISSING');
  } else {
    token = localStorage.getItem('token');
    console.log('🔑 Token from localStorage:', token ? 'present' : 'MISSING');
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('✅ Authorization header added');
  } else {
    console.log('❌ No token, request may fail');
  }
  return config;
});

api.interceptors.response.use(
  response => {
    console.log('✅ Response from', response.config.url, 'status:', response.status);
    return response;
  },
  error => {
    console.error('❌ API Error:', error.response?.status, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;

import axios from 'axios';

let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn;
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
});

api.interceptors.request.use(
  async (config) => {
    if (_getToken) {
      try {
        const token = await _getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        // proceed without auth header
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;

import axios from 'axios';
import { useAuth } from '../contexts/auth';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true
});

// Intercept 401 responses: clear auth state so the Protected route redirects to /login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      useAuth.getState().clear();
    }
    return Promise.reject(error);
  }
);

export function csrfHeaders(csrfToken?: string) {
  return csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
}

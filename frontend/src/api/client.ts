import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true
});

export function csrfHeaders(csrfToken?: string) {
  return csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
}

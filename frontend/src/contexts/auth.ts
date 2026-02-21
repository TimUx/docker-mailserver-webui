import { create } from 'zustand';

type User = { id: number; email: string; is_admin: boolean };

type AuthState = {
  user?: User;
  csrfToken?: string;
  setAuth: (user: User, csrfToken: string) => void;
  clear: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  user: undefined,
  csrfToken: undefined,
  setAuth: (user, csrfToken) => set({ user, csrfToken }),
  clear: () => set({ user: undefined, csrfToken: undefined })
}));

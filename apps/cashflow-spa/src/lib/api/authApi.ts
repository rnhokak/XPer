import { http } from "./http";

export type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export const authApi = {
  me: async () => {
    return http.get("api/auth/me").json<{ user: AuthUser }>().then((res) => res.user);
  },
};

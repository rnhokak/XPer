import { useQuery } from "@tanstack/react-query";
import { authApi, type AuthUser } from "@/lib/api/authApi";

export const useMe = () => {
  return useQuery<AuthUser>({
    queryKey: ["auth", "me"],
    queryFn: authApi.me,
    retry: false,
    staleTime: 60_000,
  });
};

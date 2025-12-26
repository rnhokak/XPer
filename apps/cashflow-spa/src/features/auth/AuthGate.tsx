import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ApiError } from "@/lib/api/http";
import { useMe } from "./useMe";
import { Skeleton } from "@/components/ui/skeleton";

const buildRedirectUrl = (path: string) => `/auth/login?redirect=${encodeURIComponent(path)}`;

export const AuthGate = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { data, isLoading, error } = useMe();

  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) {
      const target = `${location.pathname}${location.search}` || "/app/cashflow";
      window.location.href = buildRedirectUrl(target);
    }
  }, [error, location.pathname, location.search]);

  if (isLoading && !data) {
    return (
      <div className="app-shell min-h-screen">
        <div className="mx-auto max-w-md px-4 py-10">
          <div className="space-y-3">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

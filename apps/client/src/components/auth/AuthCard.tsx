import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  description?: string;
  children: ReactNode;
}

// Styled wrapper to keep auth pages consistent and polished
export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <Card className="relative w-full max-w-md overflow-hidden border-0 bg-white/80 shadow-xl ring-1 ring-black/5 backdrop-blur">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-sky-500 to-indigo-500" />
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-semibold tracking-tight">{title}</CardTitle>
        {description ? <CardDescription className="text-sm">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

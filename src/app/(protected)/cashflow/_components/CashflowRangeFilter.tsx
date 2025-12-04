"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = { value: string };

export function CashflowRangeFilter({ value }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateRange = (next: string) => {
    const params = new URLSearchParams(searchParams ?? undefined);
    if (next === "all") {
      params.delete("range");
    } else {
      params.set("range", next);
    }
    const qs = params.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    startTransition(() => router.replace(url));
  };

  if (!mounted) {
    return (
      <div className="h-10 w-[160px] animate-pulse rounded-md border bg-muted/50" aria-hidden="true" />
    );
  }

  return (
    <Select value={value} onValueChange={updateRange}>
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder="Range" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="today">Today</SelectItem>
        <SelectItem value="week">This week</SelectItem>
        <SelectItem value="month">This month</SelectItem>
        <SelectItem value="all">All time</SelectItem>
      </SelectContent>
    </Select>
  );
}

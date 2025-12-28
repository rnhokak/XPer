"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { normalizeRangeShift } from "@/lib/cashflow/utils";

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

  const currentShift = normalizeRangeShift(searchParams?.get("shift"));

  const updateRange = (next: string) => {
    const params = new URLSearchParams(searchParams ?? undefined);
    params.set("range", next);
    params.delete("shift");
    const qs = params.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    startTransition(() => router.replace(url));
  };

  const updateShift = (delta: number) => {
    const nextShift = currentShift + delta;
    const params = new URLSearchParams(searchParams ?? undefined);
    params.set("range", value);
    if (nextShift === 0) {
      params.delete("shift");
    } else {
      params.set("shift", String(nextShift));
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
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => updateShift(-1)}>
        Prev
      </Button>
      <Select value={value} onValueChange={updateRange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">This week</SelectItem>
          <SelectItem value="month">This month</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={() => updateShift(1)}>
        Next
      </Button>
    </div>
  );
}

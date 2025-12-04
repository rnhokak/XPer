"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DebtQuickCreateForm } from "./DebtQuickCreateForm";

type Partner = { id: string; name: string; type: string | null };
type Account = { id: string; name: string; currency: string; type?: string | null; is_default?: boolean | null };
type Category = { id: string; name: string; type: "income" | "expense" };

type Props = {
  partners: Partner[];
  accounts: Account[];
  categories: Category[];
  defaultAccountId?: string | null;
  defaultCurrency: string;
};

export function DebtQuickAddDialog({ partners, accounts, categories, defaultAccountId, defaultCurrency }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Thêm nhanh khoản vay</p>
          <p className="text-xs text-muted-foreground">Mở modal để nhập thông tin và ghi nhận cashflow.</p>
        </div>
        <DialogTrigger asChild>
          <Button variant="default">Thêm khoản vay</Button>
        </DialogTrigger>
      </div>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Khoản vay mới</DialogTitle>
          <DialogDescription>Nhập thông tin, hệ thống sẽ tạo transaction cashflow tự động.</DialogDescription>
        </DialogHeader>
        <DebtQuickCreateForm
          partners={partners}
          accounts={accounts}
          categories={categories}
          defaultAccountId={defaultAccountId}
          defaultCurrency={defaultCurrency}
        />
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import {
  isMyAccount,
  isPartnerAccount,
  isOtherAccount,
} from "@/lib/cashflow/accountBalance";
import { type CashflowAccount } from "@/hooks/useCashflowTransactions";
import { Wallet, Users, Layers, Globe } from "lucide-react";

type Props = {
  accounts: CashflowAccount[];
  value: string;
  onChange: (value: string) => void;
};

export function CashflowAccountFilter({ accounts, value, onChange }: Props) {
  const { myAccounts, partnerAccounts, otherAccounts } = useMemo(() => {
    return {
      myAccounts: accounts.filter((a) => isMyAccount(a.type)),
      partnerAccounts: accounts.filter((a) => isPartnerAccount(a.type)),
      otherAccounts: accounts.filter((a) => isOtherAccount(a.type)),
    };
  }, [accounts]);

  // Selected account label for header display
  const selectedAccount = useMemo(() => {
    if (value === "my" || value === "partner" || value === "other" || value === "all") {
      return null;
    }
    return accounts.find((a) => a.id === value);
  }, [accounts, value]);

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full sm:w-[230px] bg-white text-xs sm:text-sm font-medium h-9 shadow-sm border-slate-200">
          <div className="flex items-center gap-2 truncate">
            {value === "my" && <Wallet className="h-4 w-4 text-emerald-600 shrink-0" />}
            {value === "partner" && <Users className="h-4 w-4 text-blue-600 shrink-0" />}
            {value === "other" && <Layers className="h-4 w-4 text-purple-600 shrink-0" />}
            {value === "all" && <Globe className="h-4 w-4 text-slate-600 shrink-0" />}
            {selectedAccount && <Wallet className="h-4 w-4 text-primary shrink-0" />}
            <span className="truncate">
              {value === "my" && "Tất cả TK của tôi"}
              {value === "partner" && "Tất cả đối tác"}
              {value === "other" && "Tất cả TK khác"}
              {value === "all" && "Tất cả mọi tài khoản"}
              {selectedAccount && selectedAccount.name}
            </span>
          </div>
        </SelectTrigger>
        <SelectContent className="max-h-[360px] min-w-[240px]">
          <SelectGroup>
            <SelectLabel className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              Bộ lọc chung
            </SelectLabel>
            <SelectItem value="my">
              <div className="flex items-center gap-2 font-medium text-emerald-700">
                <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                <span>Tất cả TK của tôi (Mặc định)</span>
              </div>
            </SelectItem>
            <SelectItem value="partner">
              <div className="flex items-center gap-2 font-medium text-blue-700">
                <Users className="h-3.5 w-3.5 text-blue-600" />
                <span>Tất cả đối tác ({partnerAccounts.length})</span>
              </div>
            </SelectItem>
            <SelectItem value="other">
              <div className="flex items-center gap-2 font-medium text-purple-700">
                <Layers className="h-3.5 w-3.5 text-purple-600" />
                <span>Tất cả TK khác ({otherAccounts.length})</span>
              </div>
            </SelectItem>
            <SelectItem value="all">
              <div className="flex items-center gap-2 text-slate-700">
                <Globe className="h-3.5 w-3.5 text-slate-500" />
                <span>Tất cả mọi tài khoản</span>
              </div>
            </SelectItem>
          </SelectGroup>

          {myAccounts.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase mt-2">
                Tài khoản của tôi ({myAccounts.length})
              </SelectLabel>
              {myAccounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span>{acc.name}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">{acc.currency}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          )}

          {partnerAccounts.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase mt-2">
                Đối tác ({partnerAccounts.length})
              </SelectLabel>
              {partnerAccounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span>{acc.name}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">{acc.currency}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          )}

          {otherAccounts.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase mt-2">
                Tài khoản khác ({otherAccounts.length})
              </SelectLabel>
              {otherAccounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span>{acc.name}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">{acc.currency}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

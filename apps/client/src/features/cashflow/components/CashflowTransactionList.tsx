import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CircleAlert, Clock3 } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { type CategoryFocus } from "@/lib/validation/categories";
import { useQueryClient } from "@/lib/query";
import db from "@/lib/db";
import { useCashflowTransactions, type CashflowTransaction, useUpdateTransaction, useDeleteTransaction } from "@/hooks/useCashflowTransactions";
import { CashflowTransactionDetailDialog } from "./CashflowTransactionDetailDialog";

import {
  isMyAccount,
  isPartnerAccount,
  isOtherAccount,
} from "@/lib/cashflow/accountBalance";

type Category = {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer" | "debt";
  parent_id: string | null;
  category_focus: CategoryFocus | null;
};
type Account = { id: string; name: string; currency: string; type?: string | null };

const formatNumber = (value: number, currency?: string) => {
  const isVnd = currency?.toUpperCase() === "VND";
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: isVnd ? 0 : 2,
    minimumFractionDigits: isVnd ? 0 : 2,
  });
};

const formatDateTime = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toIsoStringWithOffset = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const typeBadgeBaseClasses = "rounded-full px-2 py-0.5 text-xs font-semibold inline-flex items-center gap-1";

export const isTxPositive = (tx: CashflowTransaction) => {
  if (typeof tx.flow_type === "boolean") return tx.flow_type;
  return tx.type === "income";
};

export const getTxBadgeInfo = (tx: CashflowTransaction) => {
  const isPos = isTxPositive(tx);
  if (tx.type === "transfer") {
    return {
      label: isPos ? "Chuyển đến (+)" : "Chuyển đi (-)",
      classes: isPos ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200",
    };
  }
  if (tx.type === "income") {
    return {
      label: "Thu nhập (+)",
      classes: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    };
  }
  return {
    label: "Chi phí (-)",
    classes: "bg-red-50 text-red-700 border border-red-200",
  };
};

export function CashflowTransactionList({
  transactions: initialTransactions,
  categories,
  accounts,
  range,
  shift,
  customRange,
  accountFilter = "my",
}: {
  transactions: CashflowTransaction[];
  categories: Category[];
  accounts: Account[];
  range: string;
  shift: number;
  customRange?: { from: string; to: string };
  accountFilter?: string;
}) {
  const queryClient = useQueryClient();
  const { data: transactions = initialTransactions, isFetching } = useCashflowTransactions(
    range,
    shift,
    initialTransactions,
    customRange
  );
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();
  const [selected, setSelected] = useState<CashflowTransaction | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const getCategoryName = (transaction: CashflowTransaction) =>
    transaction.category?.name ??
    (transaction.category?.id ? categories.find((category) => category.id === transaction.category?.id)?.name : undefined) ??
    "Uncategorized";

  useEffect(() => {
    let isMounted = true;
    const checkPendingStatus = async () => {
      const pendingItems = transactions.filter((tx) => tx.pending);
      if (pendingItems.length === 0) return;

      const pendingOps = await db.pending.toArray();
      const pendingIds = new Set(
        pendingOps.map((op) => op.body?.__localId || op.body?.id).filter(Boolean)
      );

      const hasResolvedItems = pendingItems.some((tx) => !pendingIds.has(tx.id));
      if (hasResolvedItems && isMounted) {
        queryClient.setQueriesData<CashflowTransaction[]>(
          { queryKey: ["cashflow-transactions"] },
          (prev) => {
            if (!Array.isArray(prev)) return prev;
            return prev.map((tx) =>
              tx.pending && !pendingIds.has(tx.id)
                ? { ...tx, pending: false, error: false }
                : tx
            );
          }
        );
        void queryClient.invalidateQueries({ queryKey: ["cashflow-transactions"] });
      }
    };

    void checkPendingStatus();
    return () => {
      isMounted = false;
    };
  }, [transactions, queryClient]);

  useEffect(() => {
    const handleSyncProcessed = (event: Event) => {
      const detail = (event as CustomEvent<{ operation?: { opType: string; body?: any }; data?: CashflowTransaction }>).detail;
      const operation = detail?.operation;
      const syncedId = operation?.opType === "create" ? operation.body?.__localId : operation?.body?.id;

      if (syncedId) {
        queryClient.setQueriesData<CashflowTransaction[]>({ queryKey: ["cashflow-transactions"] }, (prev) => {
          if (!prev) return prev;
          if (operation?.opType === "delete") {
            return prev.filter((transaction) => transaction.id !== syncedId);
          }
          return prev.map((transaction) =>
            transaction.id === syncedId
              ? { ...transaction, ...(detail.data ?? {}), pending: false, error: false }
              : transaction,
          );
        });

        queryClient.setQueriesData<CashflowTransaction[]>({ queryKey: ["cashflow-report-transactions"] }, (prev) => {
          if (!prev) return prev;
          if (operation?.opType === "delete") {
            return prev.filter((transaction) => transaction.id !== syncedId);
          }
          return prev.map((transaction) =>
            transaction.id === syncedId
              ? { ...transaction, ...(detail.data ?? {}), pending: false, error: false }
              : transaction,
          );
        });
      }

      void queryClient.invalidateQueries({ queryKey: ["cashflow-transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["cashflow-report-transactions"] });
    };

    window.addEventListener("xper:sync:processed", handleSyncProcessed);
    return () => window.removeEventListener("xper:sync:processed", handleSyncProcessed);
  }, [queryClient]);

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    if (!accountFilter || accountFilter === "all") return transactions;

    const myAccountIds = new Set(accounts.filter((a) => isMyAccount(a.type)).map((a) => a.id));
    const partnerAccountIds = new Set(accounts.filter((a) => isPartnerAccount(a.type)).map((a) => a.id));
    const otherAccountIds = new Set(accounts.filter((a) => isOtherAccount(a.type)).map((a) => a.id));

    if (accountFilter === "my") {
      return transactions.filter((tx) => {
        if (tx.account_id && myAccountIds.has(tx.account_id)) return true;
        if (!tx.account_id && tx.account?.type && isMyAccount(tx.account.type)) return true;
        return accounts.length > 0 ? (tx.account_id ? myAccountIds.has(tx.account_id) : true) : true;
      });
    }

    if (accountFilter === "partner") {
      return transactions.filter((tx) => {
        if (tx.account_id && partnerAccountIds.has(tx.account_id)) return true;
        if (!tx.account_id && tx.account?.type && isPartnerAccount(tx.account.type)) return true;
        return false;
      });
    }

    if (accountFilter === "other") {
      return transactions.filter((tx) => {
        if (tx.account_id && otherAccountIds.has(tx.account_id)) return true;
        if (!tx.account_id && tx.account?.type && isOtherAccount(tx.account.type)) return true;
        return false;
      });
    }

    return transactions.filter((tx) => tx.account_id === accountFilter);
  }, [transactions, accountFilter, accounts]);

  const sorted = useMemo(() => {
    const data = [...filteredTransactions].sort((a, b) => {
      const aTime = new Date(a.transaction_time).getTime();
      const bTime = new Date(b.transaction_time).getTime();
      return Number.isNaN(bTime) || Number.isNaN(aTime) ? 0 : bTime - aTime;
    });
    return data;
  }, [filteredTransactions]);

  const groupedByDay = useMemo(() => {
    const groups: Record<string, CashflowTransaction[]> = {};
    const formatter = new Intl.DateTimeFormat("vi-VN", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    sorted.forEach((tx) => {
      const key = formatter.format(new Date(tx.transaction_time));
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });
    return groups;
  }, [sorted]);

  const dayTotals = useMemo(() => {
    const totals: Record<string, { income: number; expense: number; currency: string }> = {};
    Object.entries(groupedByDay).forEach(([dayLabel, transactions]) => {
      const income = transactions
        .filter((tx) => isTxPositive(tx))
        .reduce((sum, tx) => sum + tx.amount, 0);
      const expense = transactions
        .filter((tx) => !isTxPositive(tx))
        .reduce((sum, tx) => sum + tx.amount, 0);
      const currency = transactions[0]?.currency ?? "VND";
      totals[dayLabel] = { income, expense, currency };
    });
    return totals;
  }, [groupedByDay]);

  const openDetail = (tx: CashflowTransaction) => {
    setSubmitError(null);
    setDeleteError(null);
    setSelected(tx);
  };

  const handleSave = async (values: any) => {
    if (!selected) return;
    const current = selected;
    setSubmitError(null);
    const normalizedTime = toIsoStringWithOffset(values.transaction_time);
    const payload = {
      ...values,
      category_id: values.category_id || null,
      account_id: values.account_id || null,
      transaction_time: normalizedTime || undefined,
    };

    updateMutation.mutate(
      { id: current.id, values: payload },
      {
        onSuccess: () => {
          const category = values.category_id ? categories.find((c) => c.id === values.category_id) : null;
          const account = values.account_id ? accounts.find((a) => a.id === values.account_id) : null;
          const normalizedTimeForState = normalizedTime ?? current.transaction_time ?? new Date().toISOString();
          const updatedTx: CashflowTransaction = {
            ...current,
            type: payload.type ?? "expense",
            amount: payload.amount,
            currency: payload.currency ?? current.currency,
            note: payload.note ?? null,
            transaction_time: normalizedTimeForState,
            category: category ? { id: category.id, name: category.name, type: category.type } : null,
            account: account ? { id: account.id, name: account.name, currency: account.currency } : null,
            user_id: current.user_id,
            pending: true,
          };
          setSelected(null);
          queryClient.setQueriesData<CashflowTransaction[]>({ queryKey: ["cashflow-transactions"] }, (prev) => (prev ? prev.map((tx) => (tx.id === current.id ? updatedTx : tx)) : prev));
          queryClient.setQueriesData<CashflowTransaction[]>({ queryKey: ["cashflow-report-transactions"] }, (prev) => (prev ? prev.map((tx) => (tx.id === current.id ? updatedTx : tx)) : prev));
        },
        onError: (error) => {
          setSubmitError(error.message || "Cập nhật thất bại");
        },
      }
    );
  };

  const handleDelete = async () => {
    if (!selected) return;
    const current = selected;
    const peerId = current.transfer_peer_id;
    setDeleteError(null);
    setDeleting(true);

    deleteMutation.mutate(
      current.id,
      {
        onSuccess: () => {
          setSelected(null);
          setDeleting(false);
          queryClient.setQueriesData<CashflowTransaction[]>(
            { queryKey: ["cashflow-transactions"] },
            (prev) => prev?.filter((tx) => tx.id !== current.id && tx.id !== peerId)
          );
          queryClient.setQueriesData<CashflowTransaction[]>(
            { queryKey: ["cashflow-report-transactions"] },
            (prev) => prev?.filter((tx) => tx.id !== current.id && tx.id !== peerId)
          );
        },
        onError: (error) => {
          setDeleting(false);
          setDeleteError(error.message || "Xoá thất bại");
        },
      }
    );
  };

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có giao dịch.</p>;
  }

  return (
    <div className="space-y-3">
      {isFetching ? <p className="text-xs text-muted-foreground">Đang đồng bộ dữ liệu...</p> : null}
      <div className="md:hidden space-y-4">
        {Object.entries(groupedByDay).map(([dayLabel, dayTransactions]) => {
          const totals = dayTotals[dayLabel];
          return (
            <div key={dayLabel} className="space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dayLabel}</p>
                <div className="flex items-center gap-2 text-xs">
                  {totals?.income ? (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      +{formatNumber(totals.income, totals.currency)}
                    </span>
                  ) : null}
                  {totals?.expense ? (
                    <span className="flex items-center gap-1 text-red-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      -{formatNumber(totals.expense, totals.currency)}
                    </span>
                  ) : null}
                </div>
              </div>
              {dayTransactions.map((tx) => {
                const isPos = isTxPositive(tx);
                const badgeInfo = getTxBadgeInfo(tx);
                return (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => openDetail(tx)}
                    className="w-full text-left rounded-lg border bg-white p-3 shadow-sm transition hover:shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{formatDateTime(tx.transaction_time)}</p>
                        <p className="text-sm font-semibold">{getCategoryName(tx)}</p>
                        {tx.note ? <p className="text-sm text-muted-foreground">{tx.note}</p> : null}
                      </div>
                      <div className={`money-blur text-base font-semibold ${isPos ? "text-emerald-600" : "text-red-600"}`}>
                        {isPos ? "+" : "-"}{formatNumber(tx.amount, tx.currency)} {tx.currency}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={`${typeBadgeBaseClasses} ${badgeInfo.classes}`}>
                        {badgeInfo.label}
                      </span>
                      {tx.type === "transfer" ? (
                        <span className="font-medium text-slate-700">
                          {!isPos ? (
                            <>
                              {tx.account?.name ?? "Nguồn"} ➔ {tx.destination_account?.name ?? "Đích"}
                            </>
                          ) : (
                            <>
                              {tx.account?.name ?? "Đích"} ⬅ {tx.destination_account?.name ?? "Nguồn"}
                            </>
                          )}
                          {tx.destination_amount && tx.destination_currency && tx.destination_currency !== tx.currency ? (
                            <span className="ml-1 text-emerald-600 font-semibold">
                              (Nhận: {formatNumber(tx.destination_amount, tx.destination_currency)} {tx.destination_currency})
                            </span>
                          ) : null}
                        </span>
                      ) : tx.account?.name ? (
                        <span>{tx.account.name}</span>
                      ) : null}
                      {tx.pending ? (
                        <span
                          title="Đang chờ đồng bộ"
                          aria-label="Đang chờ đồng bộ"
                          className="ml-2 inline-flex items-center text-yellow-700"
                        >
                          <Clock3 className="h-4 w-4" aria-hidden="true" />
                        </span>
                      ) : null}
                      {tx.error ? (
                        <span
                          title="Lỗi đồng bộ"
                          aria-label="Lỗi đồng bộ"
                          className="ml-2 inline-flex items-center text-red-700"
                        >
                          <CircleAlert className="h-4 w-4" aria-hidden="true" />
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(groupedByDay).map(([dayLabel, dayTransactions]) => {
              const totals = dayTotals[dayLabel];
              return (
                <Fragment key={dayLabel}>
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {dayLabel}
                        </span>
                        <div className="flex items-center gap-3 text-xs">
                          {totals?.income ? (
                            <span className="flex items-center gap-1 font-semibold text-emerald-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Thu: +{formatNumber(totals.income, totals.currency)} {totals.currency}
                            </span>
                          ) : null}
                          {totals?.expense ? (
                            <span className="flex items-center gap-1 font-semibold text-red-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              Chi: -{formatNumber(totals.expense, totals.currency)} {totals.currency}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                  {dayTransactions.map((tx) => {
                    const isPos = isTxPositive(tx);
                    return (
                      <TableRow key={tx.id} className="cursor-pointer" onClick={() => openDetail(tx)}>
                        <TableCell className="whitespace-nowrap text-sm">{formatDateTime(tx.transaction_time)}</TableCell>
                        <TableCell className="font-medium">{getCategoryName(tx)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tx.type === "transfer" ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-800">
                                {!isPos ? (
                                  <>
                                    {tx.account?.name ?? "—"} ➔ {tx.destination_account?.name ?? "—"}
                                  </>
                                ) : (
                                  <>
                                    {tx.account?.name ?? "—"} ⬅ {tx.destination_account?.name ?? "—"}
                                  </>
                                )}
                              </span>
                              {tx.destination_amount && tx.destination_currency && tx.destination_currency !== tx.currency ? (
                                <span className="text-[11px] text-emerald-600 font-medium">
                                  Nhận: {formatNumber(tx.destination_amount, tx.destination_currency)} {tx.destination_currency}
                                  {tx.exchange_rate ? ` (x${tx.exchange_rate})` : ""}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            tx.account?.name ?? "—"
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{tx.note ?? "—"}</TableCell>
                        <TableCell className={`money-blur text-right font-semibold ${isPos ? "text-emerald-600" : "text-red-600"}`}>
                          <div className="flex items-center justify-end gap-3">
                            <div>
                              {isPos ? "+" : "-"}{formatNumber(tx.amount, tx.currency)} {tx.currency}
                            </div>
                            {tx.pending ? (
                              <span
                                title="Đang chờ đồng bộ"
                                aria-label="Đang chờ đồng bộ"
                                className="inline-flex items-center text-yellow-700"
                              >
                                <Clock3 className="h-4 w-4" aria-hidden="true" />
                              </span>
                            ) : null}
                            {tx.error ? (
                              <span
                                title="Lỗi đồng bộ"
                                aria-label="Lỗi đồng bộ"
                                className="inline-flex items-center text-red-700"
                              >
                                <CircleAlert className="h-4 w-4" aria-hidden="true" />
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <CashflowTransactionDetailDialog
        transaction={selected}
        open={Boolean(selected)}
        categories={categories}
        accounts={accounts}
        saveError={submitError}
        deleteError={deleteError}
        isSaving={updateMutation.isPending}
        isDeleting={deleting}
        onClose={() => setSelected(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  cashflowQuickAddSchema,
  type CashflowQuickAddValues,
  type CashflowTransactionType,
} from "@/lib/validation/cashflow";
import { useQueryClient } from "@/lib/query";
import {
  cashflowReportTransactionsQueryKey,
  cashflowTransactionsQueryKey,
  type CashflowTransaction,
  useCashflowReportTransactions,
  useCreateTransaction,
} from "@/hooks/useCashflowTransactions";
import { normalizeCashflowRange, rangeBounds } from "@/lib/cashflow/utils";
import { type CategoryFocus } from "@/lib/validation/categories";
import { useNotificationsStore } from "@/store/notifications";
import { CategoryTreeModal } from "./CategoryTreeModal";
import { CashflowAmountFields } from "./CashflowAmountFields";
import { CashflowDateFields } from "./CashflowDateFields";
import {
  formatDebtExpenseNote,
  type DebtExpenseMode,
} from "@/lib/cashflow/debtExpenseUtils";
import { useAuth } from "@/hooks/useAuth";
import { useDebtPartners } from "@/hooks/useDebtsData";
import {
  isCreditCardAccount,
  isOtherAccount,
  isPartnerAccount,
} from "@/lib/cashflow/accountBalance";
import { apiClient } from "@/lib/api/client";
import db from "@/lib/db";
import { type DebtCreateInput } from "@/lib/validation/debts";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CreditCard,
  Layers,
  Loader2,
  PenLine,
  Plus,
  ShoppingBag,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer" | "debt";
  parent_id: string | null;
  category_focus: CategoryFocus | null;
};
type Account = { id: string; name: string; currency: string; type?: string | null; balance?: number | null; is_default?: boolean | null };
type Partner = { id: string; name: string; currency?: string; type?: string | null };

const formatNumber = (value: number, curr?: string) => {
  const isVnd = curr?.toUpperCase() === "VND";
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: isVnd ? 0 : 2,
    minimumFractionDigits: isVnd ? 0 : 2,
  });
};

type Props = {
  categories: Category[];
  accounts: Account[];
  partners?: Partner[];
  defaultAccountId?: string | null;
  defaultCurrency: string;
  useDialog?: boolean;
  range: string;
  isLoading?: boolean;
};

const CUSTOM_CURRENCY = "__custom__";
const CURRENCIES = ["VND", "USD", "EUR", "GBP", "JPY", "SGD", "AUD", "CAD", "CNY"];
const lastCategoryKey = (type: CashflowTransactionType) => `cashflow:lastCategory:${type}`;

const toIsoStringWithOffset = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const defaultDateTimeValue = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 23);
};

const getCurrentDateTimeValue = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 23);
};

import { getCategoryEmoji } from "@/lib/cashflow/categoryUtils";
export { getCategoryEmoji };

export function CashflowQuickAddForm({
  categories,
  accounts,
  partners = [],
  defaultAccountId,
  defaultCurrency,
  useDialog = false,
  range,
  isLoading = false,
}: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customCurrency, setCustomCurrency] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [lastTransactionTime, setLastTransactionTime] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [showCurrencySelect, setShowCurrencySelect] = useState(false);
  const [debtMode, setDebtMode] = useState<DebtExpenseMode>("none");
  const [debtPartnerName, setDebtPartnerName] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [isCreatingPartner, setIsCreatingPartner] = useState(false);
  const [showNewPartnerInput, setShowNewPartnerInput] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [isCustomSubmitting, setIsCustomSubmitting] = useState(false);

  const { user } = useAuth();
  const { data: fetchedPartners = [] } = useDebtPartners(user?.id ?? "");
  const allPartnersList = partners.length > 0 ? partners : fetchedPartners;

  // Split into my accounts, other accounts, and partners
  const { myAccountOptions, otherAccountOptions, partnerOptions, allTargetsMap } = useMemo(() => {
    const myList: Array<{ id: string; name: string; currency: string; balance: number; type: string; isPartner: boolean; isOther: boolean }> = [];
    const otherList: Array<{ id: string; name: string; currency: string; balance: number; type: string; isPartner: boolean; isOther: boolean }> = [];
    const partMap = new Map<string, { id: string; name: string; currency: string; balance: number; type: string; isPartner: boolean; isOther: boolean }>();

    accounts.forEach((acc) => {
      const isPartner = isPartnerAccount(acc.type);
      const isOther = isOtherAccount(acc.type);
      const item = {
        id: acc.id,
        name: acc.name,
        currency: acc.currency || "VND",
        balance: Number(acc.balance ?? 0),
        type: acc.type || "account",
        isPartner,
        isOther,
      };
      if (isPartner) {
        partMap.set(acc.id, item);
      } else if (isOther) {
        otherList.push(item);
      } else {
        myList.push(item);
      }
    });

    allPartnersList.forEach((p) => {
      if (!partMap.has(p.id)) {
        partMap.set(p.id, {
          id: p.id,
          name: p.name,
          currency: p.currency || "VND",
          balance: 0,
          type: "partner",
          isPartner: true,
          isOther: false,
        });
      }
    });

    const partList = Array.from(partMap.values());
    const allMap = new Map<string, { id: string; name: string; currency: string; balance: number; type: string; isPartner: boolean; isOther: boolean }>();
    myList.forEach((a) => allMap.set(a.id, a));
    otherList.forEach((a) => allMap.set(a.id, a));
    partList.forEach((p) => allMap.set(p.id, p));

    return {
      myAccountOptions: myList,
      otherAccountOptions: otherList,
      partnerOptions: partList,
      allTargetsMap: allMap,
    };
  }, [accounts, allPartnersList]);

  // Tab Cá nhân: only my accounts EXCLUDING credit card types
  const personalAccounts = useMemo(
    () => myAccountOptions.filter((acc) => !isCreditCardAccount(acc.type)),
    [myAccountOptions]
  );

  // Tab Chi vay từ: accounts with type is credit card
  const creditCardAccounts = useMemo(
    () => myAccountOptions.filter((acc) => isCreditCardAccount(acc.type)),
    [myAccountOptions]
  );

  const form = useForm<CashflowQuickAddValues>({
    resolver: zodResolver(cashflowQuickAddSchema),
    mode: "onChange",
    defaultValues: {
      type: "expense",
      amount: undefined,
      account_id: defaultAccountId ?? null,
      destination_account_id: null,
      destination_amount: undefined,
      destination_currency: undefined,
      exchange_rate: undefined,
      category_id: "",
      note: "",
      transaction_time: lastTransactionTime ? lastTransactionTime : defaultDateTimeValue(),
      currency: defaultCurrency,
    },
  });

  const selectedType = useWatch({ control: form.control, name: "type" }) ?? "expense";
  const selectedCategoryId = useWatch({ control: form.control, name: "category_id" });
  const amount = useWatch({ control: form.control, name: "amount" });
  const accountId = useWatch({ control: form.control, name: "account_id" });
  const destinationAccountId = useWatch({ control: form.control, name: "destination_account_id" });
  const currency = useWatch({ control: form.control, name: "currency" }) ?? defaultCurrency;
  const destinationCurrency = useWatch({ control: form.control, name: "destination_currency" });
  const destinationAmount = useWatch({ control: form.control, name: "destination_amount" });
  const exchangeRate = useWatch({ control: form.control, name: "exchange_rate" });

  useEffect(() => {
    if (!useDialog) return;
    if (typeof window === "undefined") return;

    const updateViewportHeight = () => {
      const nextHeight = window.visualViewport?.height ?? window.innerHeight;
      setViewportHeight(nextHeight);
    };

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", updateViewportHeight);
    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      viewport?.removeEventListener("resize", updateViewportHeight);
    };
  }, [useDialog]);

  useEffect(() => {
    const current = form.getValues("account_id");
    const targetList =
      selectedType === "expense" && debtMode === "borrowed_spent"
        ? creditCardAccounts
        : selectedType === "expense" && debtMode === "none"
          ? personalAccounts
          : myAccountOptions;

    const isCurrentValid = targetList.some((a) => a.id === current);
    if (!isCurrentValid) {
      const validDefault = targetList.find((a) => a.id === defaultAccountId)?.id ?? targetList[0]?.id ?? null;
      form.setValue("account_id", validDefault);
      const chosenAcc = targetList.find((a) => a.id === validDefault);
      if (chosenAcc?.currency) {
        form.setValue("currency", chosenAcc.currency);
      }
    }
  }, [defaultAccountId, defaultCurrency, form, myAccountOptions, personalAccounts, creditCardAccounts, selectedType, debtMode]);

  const handleDebtModeChange = (nextMode: DebtExpenseMode) => {
    setDebtMode(nextMode);
    const currentAccId = form.getValues("account_id");
    if (nextMode === "none") {
      const isStillValid = personalAccounts.some((a) => a.id === currentAccId);
      if (!isStillValid) {
        const nextAcc = personalAccounts.find((a) => a.id === defaultAccountId) ?? personalAccounts[0];
        form.setValue("account_id", nextAcc?.id ?? null, { shouldValidate: true });
        if (nextAcc?.currency) form.setValue("currency", nextAcc.currency);
      }
    } else if (nextMode === "borrowed_spent") {
      const isStillValid = creditCardAccounts.some((a) => a.id === currentAccId);
      if (!isStillValid) {
        const nextAcc = creditCardAccounts.find((a) => a.id === defaultAccountId) ?? creditCardAccounts[0];
        form.setValue("account_id", nextAcc?.id ?? null, { shouldValidate: true });
        if (nextAcc?.currency) form.setValue("currency", nextAcc.currency);
      }
    } else if (nextMode === "lent_spent") {
      const isStillValid = myAccountOptions.some((a) => a.id === currentAccId);
      if (!isStillValid) {
        const nextAcc = personalAccounts[0] ?? myAccountOptions[0];
        form.setValue("account_id", nextAcc?.id ?? null, { shouldValidate: true });
        if (nextAcc?.currency) form.setValue("currency", nextAcc.currency);
      }
      if (!selectedPartnerId && allPartnersList.length > 0) {
        setSelectedPartnerId(allPartnersList[0].id);
      }
    }
  };

  const handleQuickCreatePartner = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsCreatingPartner(true);
    try {
      const res = await apiClient.post("/debts/partners", { name: trimmed });
      const newPartner = res.data?.partner;
      queryClient.invalidateQueries({ queryKey: ["debts", "partners"] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-accounts"] });
      if (newPartner?.id) {
        setSelectedPartnerId(newPartner.id);
      }
      setNewPartnerName("");
      setShowNewPartnerInput(false);
      notify({
        title: "Đã tạo đối tác",
        description: `Đã thêm "${trimmed}" vào danh sách đối tác`,
        type: "success",
      });
    } catch (err: any) {
      notify({
        title: "Lỗi tạo đối tác",
        description: err?.response?.data?.error || err?.message || "Không thể tạo đối tác",
        type: "error",
      });
    } finally {
      setIsCreatingPartner(false);
    }
  };

  const isTransfer = selectedType === "transfer";
  const destTarget = destinationAccountId ? allTargetsMap.get(destinationAccountId) : null;
  const effectiveDestCurrency = destinationCurrency || destTarget?.currency || "VND";
  const isDifferentCurrency = Boolean(
    isTransfer &&
    destinationAccountId &&
    currency &&
    effectiveDestCurrency &&
    currency.trim().toUpperCase() !== effectiveDestCurrency.trim().toUpperCase()
  );

  const handleExchangeRateChange = (rateVal: number | undefined) => {
    form.setValue("exchange_rate", rateVal, { shouldValidate: true, shouldDirty: true });
    if (rateVal && rateVal > 0 && typeof amount === "number" && amount > 0) {
      const isVnd = effectiveDestCurrency.toUpperCase() === "VND";
      const calculatedDest = isVnd ? Math.round(amount * rateVal) : Math.round(amount * rateVal * 100) / 100;
      form.setValue("destination_amount", calculatedDest, { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleDestinationAmountChange = (destVal: number | undefined) => {
    form.setValue("destination_amount", destVal, { shouldValidate: true, shouldDirty: true });
    if (destVal && destVal > 0 && typeof amount === "number" && amount > 0) {
      const calculatedRate = Number((destVal / amount).toFixed(6));
      form.setValue("exchange_rate", calculatedRate, { shouldValidate: true, shouldDirty: true });
    }
  };

  // Keep conversion synced when amount changes
  useEffect(() => {
    if (!isTransfer || !isDifferentCurrency) return;
    const currentRate = form.getValues("exchange_rate");
    const currentDest = form.getValues("destination_amount");
    if (typeof amount === "number" && amount > 0) {
      if (currentRate && currentRate > 0) {
        const isVnd = effectiveDestCurrency.toUpperCase() === "VND";
        const calculatedDest = isVnd ? Math.round(amount * currentRate) : Math.round(amount * currentRate * 100) / 100;
        form.setValue("destination_amount", calculatedDest, { shouldValidate: true });
      } else if (currentDest && currentDest > 0) {
        const calculatedRate = Number((currentDest / amount).toFixed(6));
        form.setValue("exchange_rate", calculatedRate, { shouldValidate: true });
      }
    }
  }, [amount, isTransfer, isDifferentCurrency, effectiveDestCurrency, form]);

  const categoriesByType = useMemo(
    () => categories.filter((c) => c.type === selectedType),
    [categories, selectedType]
  );
  const { data: reportTransactions = [] } = useCashflowReportTransactions();

  // Top smart categories sorted by recent usage
  const displayCategoryChips = useMemo(() => {
    const counts = new Map<string, number>();

    [...reportTransactions]
      .filter((tx) => tx.type === selectedType && tx.category?.id)
      .sort((a, b) => new Date(b.transaction_time).getTime() - new Date(a.transaction_time).getTime())
      .slice(0, 40)
      .forEach((tx) => {
        const catId = tx.category?.id;
        if (!catId) return;
        counts.set(catId, (counts.get(catId) ?? 0) + 1);
      });

    // Check last used category for this type
    let lastUsedId: string | null = null;
    try {
      lastUsedId = localStorage.getItem(lastCategoryKey(selectedType));
    } catch {
      // ignore
    }

    const sorted = [...categoriesByType].sort((a, b) => {
      if (a.id === lastUsedId) return -1;
      if (b.id === lastUsedId) return 1;
      const countA = counts.get(a.id) ?? 0;
      const countB = counts.get(b.id) ?? 0;
      if (countA !== countB) return countB - countA;
      return a.name.localeCompare(b.name);
    });

    const topList = sorted.slice(0, 7);

    // If the currently selected category is not in the top list, include it at the beginning
    if (selectedCategoryId) {
      const selectedCategory = categoriesByType.find((c) => c.id === selectedCategoryId);
      if (selectedCategory && !topList.some((c) => c.id === selectedCategoryId)) {
        return [selectedCategory, ...topList.slice(0, 6)];
      }
    }

    return topList;
  }, [categoriesByType, reportTransactions, selectedCategoryId, selectedType]);

  const selectedCategoryObj = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  );

  const notify = useNotificationsStore((state) => state.notify);
  const createMutation = useCreateTransaction();
  const isSubmitting = createMutation.isPending;
  const isFormSubmitting = isSubmitting || isCustomSubmitting;

  // Validation state: Amount MUST be entered and > 0, account must be selected, and category MUST be selected (except for transfer)
  const isValidAmount = typeof amount === "number" && Number.isFinite(amount) && amount > 0;
  const hasAccount =
    selectedType === "expense" && debtMode === "borrowed_spent" && creditCardAccounts.length === 0
      ? true
      : selectedType === "expense" && debtMode === "none"
        ? personalAccounts.length === 0 || Boolean(accountId)
        : myAccountOptions.length === 0 || Boolean(accountId);
  const hasCategory = isTransfer || Boolean(selectedCategoryId && selectedCategoryId.trim().length > 0);
  const hasDestination = !isTransfer || Boolean(destinationAccountId && destinationAccountId !== accountId);
  const isValidTransferCurrency =
    !isTransfer ||
    !isDifferentCurrency ||
    (Boolean(destinationAmount && destinationAmount > 0) && Boolean(exchangeRate && exchangeRate > 0));
  const hasLentPartner =
    selectedType !== "expense" || debtMode !== "lent_spent" || Boolean(selectedPartnerId);
  const canSubmit =
    isValidAmount && hasAccount && hasCategory && hasDestination && isValidTransferCurrency && hasLentPartner && !isFormSubmitting;

  const onSubmit = async (values: CashflowQuickAddValues) => {
    if (!isValidAmount || !hasCategory || !hasDestination || !hasLentPartner) return;
    setSubmitError(null);
    const transactionTimeIso = toIsoStringWithOffset(values.transaction_time);
    const rawNote = values.note?.trim() || "";

    // Mua hộ cho vay: create debt in Debts and corresponding transaction
    if (values.type === "expense" && debtMode === "lent_spent") {
      const selectedPartner = allPartnersList.find((p) => p.id === selectedPartnerId);
      const partnerName = selectedPartner?.name || "Đối tác";
      const finalNote = formatDebtExpenseNote(rawNote, "lent_spent", partnerName);

      const debtPayload: DebtCreateInput = {
        partner_id: selectedPartnerId,
        direction: "lend",
        principal_amount: values.amount!,
        currency: values.currency || defaultCurrency,
        start_date: values.transaction_time ? values.transaction_time.slice(0, 10) : new Date().toISOString().slice(0, 10),
        due_date: null,
        interest_type: "none",
        account_id: values.account_id || defaultAccountId || null,
        category_id: values.category_id || null,
        transaction_time: transactionTimeIso,
        note: finalNote,
        description: finalNote || `Mua hộ cho ${partnerName}`,
      };

      try {
        setIsCustomSubmitting(true);
        const debtRes = await apiClient.post("/debts", debtPayload);
        const createdTx = debtRes.data?.transaction;

        queryClient.invalidateQueries({ queryKey: ["debts"] });
        queryClient.invalidateQueries({ queryKey: ["cashflow"] });
        queryClient.invalidateQueries({ queryKey: ["cashflow-accounts"] });
        queryClient.invalidateQueries({ queryKey: ["accounts"] });

        if (createdTx) {
          try {
            await db.transactions.put(createdTx);
            if (debtPayload.account_id) {
              const acc = await db.accounts.get(debtPayload.account_id);
              if (acc) {
                await db.accounts.update(debtPayload.account_id, {
                  balance: (Number(acc.balance) || 0) - debtPayload.principal_amount,
                });
              }
            }
          } catch {
            // ignore local storage errors
          }

          const normalizedRange = normalizeCashflowRange(range);
          const { start, end } = rangeBounds(normalizedRange, 0);
          const txDate = new Date(createdTx.transaction_time);
          if (!Number.isNaN(txDate.getTime()) && txDate >= start && txDate < end) {
            queryClient.setQueryData<CashflowTransaction[]>(cashflowTransactionsQueryKey(range, 0), (prev) => {
              const existing = (prev ?? []).filter((tx) => tx.id !== createdTx.id);
              return [createdTx, ...existing];
            });
            queryClient.setQueryData<CashflowTransaction[]>(cashflowReportTransactionsQueryKey, (prev) => {
              const existing = (prev ?? []).filter((tx) => tx.id !== createdTx.id);
              return [createdTx, ...existing];
            });
          }
        }

        const submittedTime = values.transaction_time ? new Date(values.transaction_time) : new Date();
        submittedTime.setMilliseconds(submittedTime.getMilliseconds() + 1);
        const nextTransactionTime = Number.isNaN(submittedTime.getTime())
          ? getCurrentDateTimeValue()
          : (() => {
            const local = new Date(submittedTime.getTime() - submittedTime.getTimezoneOffset() * 60000);
            return local.toISOString().slice(0, 23);
          })();

        setLastTransactionTime(nextTransactionTime);

        form.reset({
          type: values.type,
          amount: undefined,
          account_id: values.account_id,
          destination_account_id: null,
          destination_amount: undefined,
          destination_currency: undefined,
          exchange_rate: undefined,
          category_id: "",
          note: "",
          transaction_time: nextTransactionTime,
          currency: defaultCurrency,
        });

        setDebtMode("none");
        setSelectedPartnerId("");
        setDebtPartnerName("");

        try {
          if (values.category_id) {
            localStorage.setItem(lastCategoryKey("expense"), values.category_id);
          }
        } catch { }

        if (useDialog) {
          setDialogOpen(false);
        }
        persistRecentAmount(values.amount ?? 0, values.currency ?? defaultCurrency);

        notify({
          title: "Thành công",
          description: `Đã ghi nhận chi mua hộ và tạo khoản cho vay với ${partnerName} vào Debts!`,
          type: "success",
        });
        return;
      } catch (err: any) {
        const message = err?.response?.data?.error || err?.message || "Không thể tạo khoản mua hộ/cho vay";
        setSubmitError(message);
        notify({
          title: "Lỗi",
          description: message,
          type: "error",
        });
        return;
      } finally {
        setIsCustomSubmitting(false);
      }
    }

    // Format note with debt expense tags or transfer destination
    let finalNote = rawNote;
    if (values.type === "expense") {
      if (debtMode === "borrowed_spent") {
        const chosenCard = creditCardAccounts.find((a) => a.id === values.account_id);
        const partnerToSave = debtPartnerName.trim() || chosenCard?.name || "Thẻ tín dụng";
        finalNote = formatDebtExpenseNote(rawNote, "borrowed_spent", partnerToSave);
      } else {
        finalNote = formatDebtExpenseNote(rawNote, "none");
      }
    } else if (values.type === "transfer" && values.destination_account_id) {
      const destTargetObj = allTargetsMap.get(values.destination_account_id);
      const destName = destTargetObj ? destTargetObj.name : "Đối tác / Tài khoản nhận";
      const srcCurr = (values.currency || defaultCurrency).toUpperCase();
      const dstCurr = (values.destination_currency || effectiveDestCurrency).toUpperCase();
      let transferDesc = `Chuyển đến: ${destName}`;
      if (srcCurr !== dstCurr && values.destination_amount) {
        transferDesc += ` (Nhận: ${formatNumber(values.destination_amount, dstCurr)} ${dstCurr}, Tỷ giá: ${values.exchange_rate})`;
      }
      finalNote = finalNote ? `${finalNote} (${transferDesc})` : transferDesc;
    }

    const payload = {
      ...values,
      note: finalNote || null,
      category_id: values.type === "transfer" ? null : values.category_id,
      account_id: values.account_id || defaultAccountId || null,
      destination_account_id: values.type === "transfer" ? (values.destination_account_id || null) : null,
      destination_amount: values.type === "transfer" ? (isDifferentCurrency ? values.destination_amount : values.amount) : null,
      destination_currency: values.type === "transfer" ? (isDifferentCurrency ? (values.destination_currency || effectiveDestCurrency) : values.currency) : null,
      exchange_rate: values.type === "transfer" ? (isDifferentCurrency ? values.exchange_rate : 1) : null,
      transaction_time: transactionTimeIso ?? undefined,
      currency: values.currency || defaultCurrency,
    };

    createMutation.mutate(payload, {
      onSuccess: (response) => {
        const normalizedRange = normalizeCashflowRange(range);
        const { start, end } = rangeBounds(normalizedRange, 0);
        const resList = Array.isArray(response) ? response : [response];
        for (const item of resList) {
          if (!item) continue;
          const transactionDate = new Date(item.transaction_time);
          if (!Number.isNaN(transactionDate.getTime()) && transactionDate >= start && transactionDate < end) {
            queryClient.setQueryData<CashflowTransaction[]>(cashflowTransactionsQueryKey(range, 0), (prev) => {
              const existing = (prev ?? []).filter((tx) => tx.id !== item.id);
              return [item, ...existing];
            });
            queryClient.setQueryData<CashflowTransaction[]>(cashflowReportTransactionsQueryKey, (prev) => {
              const existing = (prev ?? []).filter((tx) => tx.id !== item.id);
              return [item, ...existing];
            });
          }
        }
        const submittedTime = values.transaction_time ? new Date(values.transaction_time) : new Date();
        submittedTime.setMilliseconds(submittedTime.getMilliseconds() + 1);
        const nextTransactionTime = Number.isNaN(submittedTime.getTime())
          ? getCurrentDateTimeValue()
          : (() => {
            const local = new Date(submittedTime.getTime() - submittedTime.getTimezoneOffset() * 60000);
            return local.toISOString().slice(0, 23);
          })();

        setLastTransactionTime(nextTransactionTime);

        form.reset({
          type: values.type,
          amount: undefined,
          account_id: payload.account_id,
          destination_account_id: null,
          destination_amount: undefined,
          destination_currency: undefined,
          exchange_rate: undefined,
          category_id: "",
          note: "",
          transaction_time: nextTransactionTime,
          currency: defaultCurrency,
        });

        // Reset debt expense selection
        setDebtMode("none");
        setDebtPartnerName("");

        try {
          if (payload.category_id && payload.type !== "transfer") {
            localStorage.setItem(lastCategoryKey(payload.type ?? "expense"), payload.category_id);
          }
        } catch {
          // ignore storage errors
        }
        if (useDialog) {
          setDialogOpen(false);
        }
        persistRecentAmount(values.amount ?? 0, payload.currency ?? defaultCurrency);

        notify({
          title: "Thành công",
          description: "Đã thêm giao dịch thành công!",
          type: "success",
        });
      },
      onError: (error) => {
        const message = error.message || "Không thể thêm giao dịch";
        setSubmitError(message);
        notify({
          title: "Lỗi",
          description: message,
          type: "error",
        });
      },
    });
  };

  const persistRecentAmount = (value: number, curr: string) => {
    if (!Number.isFinite(value) || value <= 0) return;
    const key = `cashflow:recentAmounts:${curr}`;
    try {
      const existingRaw = localStorage.getItem(key);
      const existing: Array<{ amount: number; ts: number }> = existingRaw ? JSON.parse(existingRaw) : [];
      const now = Date.now();
      const merged = [{ amount: value, ts: now }, ...existing.filter((item) => item.amount !== value)].slice(0, 8);
      localStorage.setItem(key, JSON.stringify(merged));
    } catch {
      // ignore storage errors
    }
  };

  const dialogMaxHeight = useDialog && viewportHeight ? Math.max(360, viewportHeight - 32) : null;

  const currentThemeColor: "rose" | "emerald" | "blue" =
    selectedType === "expense" ? "rose" : selectedType === "income" ? "emerald" : "blue";

  const formContent = isLoading ? (
    <div className="space-y-4 py-2">
      <div className="h-10 w-full animate-pulse rounded-2xl bg-muted" />
      <div className="h-16 w-full animate-pulse rounded-2xl bg-muted" />
      <div className="h-28 w-full animate-pulse rounded-2xl bg-muted" />
      <div className="h-10 w-full animate-pulse rounded-2xl bg-muted" />
    </div>
  ) : (
    <div className="space-y-4">
      <Form {...form}>
        <form id="cashflow-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          {/* Transaction Type Segmented Control */}
          <div className="flex items-center rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => form.setValue("type", "expense")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all duration-150 sm:text-sm active:scale-95",
                selectedType === "expense"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <ArrowDownRight className="h-3.5 w-3.5" />
              <span>Chi tiêu</span>
            </button>
            <button
              type="button"
              onClick={() => form.setValue("type", "income")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all duration-150 sm:text-sm active:scale-95",
                selectedType === "income"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>Thu nhập</span>
            </button>
            <button
              type="button"
              onClick={() => form.setValue("type", "transfer")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all duration-150 sm:text-sm active:scale-95",
                selectedType === "transfer"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>Chuyển khoản</span>
            </button>
          </div>

          {/* Amount Field with Hero Input & Quick Presets */}
          <CashflowAmountFields
            control={form.control}
            currency={currency}
            themeColor={currentThemeColor}
            transactionType={selectedType}
            categories={categoriesByType}
            onSelectCategory={(catId) => {
              form.setValue("category_id", catId, { shouldValidate: true, shouldDirty: true });
            }}
          />

          {/* 1-Tap Category Selector (Only for income & expense) */}
          {selectedType !== "transfer" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <span>Danh mục</span>
                  <span className="text-rose-500 font-bold">*</span>
                  {selectedCategoryObj && (
                    <span className="font-normal text-slate-500">({selectedCategoryObj.name})</span>
                  )}
                </Label>
                <div className="flex items-center gap-2">
                  {selectedCategoryId && (
                    <button
                      type="button"
                      onClick={() => form.setValue("category_id", "", { shouldValidate: true, shouldDirty: true })}
                      className="text-[11px] font-medium text-rose-500 hover:text-rose-600"
                    >
                      Bỏ chọn
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCategoryModalOpen(true)}
                    className="flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    <span>Tất cả ({categoriesByType.length})</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Direct Category Chips */}
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {displayCategoryChips.map((cat) => {
                  const isSelected = selectedCategoryId === cat.id;
                  const emoji = getCategoryEmoji(cat.name);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          form.setValue("category_id", "", { shouldValidate: true, shouldDirty: true });
                        } else {
                          form.setValue("category_id", cat.id, { shouldValidate: true, shouldDirty: true });
                        }
                      }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border p-2 text-left text-xs font-medium transition-all active:scale-[0.98]",
                        isSelected
                          ? selectedType === "expense"
                            ? "border-rose-400 bg-rose-50 text-rose-800 shadow-2xs ring-2 ring-rose-400/30 font-semibold"
                            : selectedType === "income"
                              ? "border-emerald-400 bg-emerald-50 text-emerald-800 shadow-2xs ring-2 ring-emerald-400/30 font-semibold"
                              : "border-blue-400 bg-blue-50 text-blue-800 shadow-2xs ring-2 ring-blue-400/30 font-semibold"
                          : "border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/80"
                      )}
                    >
                      <span className="shrink-0 text-sm sm:text-base">{emoji}</span>
                      <span className="truncate flex-1">{cat.name}</span>
                      {isSelected && <Check className="h-3 w-3 shrink-0 text-current" />}
                    </button>
                  );
                })}

                {/* View all categories trigger chip */}
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(true)}
                  className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-2 text-xs font-medium text-slate-500 transition-all hover:border-slate-400 hover:bg-slate-100/70 active:scale-[0.98]"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Khác...</span>
                </button>
              </div>

              {form.formState.errors.category_id && (
                <p className="text-xs font-medium text-rose-500">
                  {form.formState.errors.category_id.message}
                </p>
              )}

              <CategoryTreeModal
                open={categoryModalOpen}
                onClose={() => setCategoryModalOpen(false)}
                categories={categoriesByType}
                selected={selectedCategoryId || null}
                onSelect={(next) => {
                  form.setValue("category_id", next ?? "", { shouldValidate: true, shouldDirty: true });
                }}
                suggestedId={null}
              />
            </div>
          )}

          {/* Debt Expense Mode Selector (Mục đích / Nguồn chi) & Full-width Date Picker for Expense */}
          {selectedType === "expense" && (
            <>
              {/* Date Picker full width for Expense */}
              <div className="w-full">
                <CashflowDateFields control={form.control} />
              </div>
              <div className="space-y-3 rounded-2xl border border-slate-200/90 bg-slate-50/80 p-3 sm:p-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-700">Mục đích / Nguồn chi</Label>
                  {debtMode !== "none" && (
                    <span
                      className={cn(
                        "text-[11px] font-bold",
                        debtMode === "borrowed_spent" ? "text-amber-700" : "text-sky-700"
                      )}
                    >
                      {debtMode === "borrowed_spent" ? "⚡ Nợ thẻ / Cần trả lại" : "⚡ Khoản vay / Cần thu lại"}
                    </span>
                  )}
                </div>

                {/* Segmented Option Control */}
                <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-200/70 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => handleDebtModeChange("none")}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-lg py-1.5 font-medium transition active:scale-95",
                      debtMode === "none"
                        ? "bg-white text-slate-800 shadow-2xs font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <User className="h-3 w-3" />
                    <span>Cá nhân</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDebtModeChange("borrowed_spent")}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-lg py-1.5 font-medium transition active:scale-95",
                      debtMode === "borrowed_spent"
                        ? "bg-amber-600 text-white shadow-2xs font-semibold"
                        : "text-slate-600 hover:text-amber-800"
                    )}
                  >
                    <CreditCard className="h-3 w-3" />
                    <span className="truncate">Chi vay từ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDebtModeChange("lent_spent")}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-lg py-1.5 font-medium transition active:scale-95",
                      debtMode === "lent_spent"
                        ? "bg-sky-600 text-white shadow-2xs font-semibold"
                        : "text-slate-600 hover:text-sky-800"
                    )}
                  >
                    <ShoppingBag className="h-3 w-3" />
                    <span className="truncate">Mua hộ cho vay</span>
                  </button>
                </div>

                {/* Tab 1: Cá nhân (Chỉ tài khoản của tôi ngoại trừ thẻ tín dụng) */}
                {debtMode === "none" && (
                  <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white/90 p-3 animate-in fade-in slide-in-from-top-1 duration-150">
                    <FormField
                      control={form.control}
                      name="account_id"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-xs font-semibold text-slate-700">
                              Tài khoản thanh toán (Cá nhân)
                            </FormLabel>
                            <button
                              type="button"
                              onClick={() => setShowCurrencySelect((v) => !v)}
                              className="text-[11px] font-medium text-slate-400 hover:text-slate-600"
                            >
                              {currency} ▾
                            </button>
                          </div>
                          <Select
                            value={field.value ?? undefined}
                            onValueChange={(val) => {
                              const nextVal = val === "none" ? null : val;
                              field.onChange(nextVal);
                              const found = nextVal ? allTargetsMap.get(nextVal) : null;
                              if (found?.currency) {
                                form.setValue("currency", found.currency);
                              }
                            }}
                          >
                            <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-xs sm:text-sm">
                              <div className="flex items-center gap-2 truncate">
                                <Wallet className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <SelectValue placeholder="Chọn tài khoản cá nhân..." />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              {personalAccounts.length > 0 ? (
                                <>
                                  <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 bg-slate-100/70 rounded-md">
                                    💳 Tài khoản cá nhân của tôi
                                  </div>
                                  {personalAccounts.map((acc) => (
                                    <SelectItem key={acc.id} value={acc.id} className="text-xs sm:text-sm">
                                      <div className="flex items-center justify-between gap-3 w-full">
                                        <span className="font-medium truncate">{acc.name}</span>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                                          ({formatNumber(acc.balance, acc.currency)} {acc.currency})
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </>
                              ) : (
                                <div className="p-2 text-center text-xs text-slate-500">
                                  Không có tài khoản phù hợp (ngoại trừ thẻ tín dụng)
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-xs text-rose-500 font-medium">
                            {form.formState.errors.account_id?.message}
                          </FormMessage>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Tab 2: Chi vay từ (Thẻ tín dụng) */}
                {debtMode === "borrowed_spent" && (
                  <div className="space-y-2.5 rounded-xl border border-amber-200/90 bg-amber-50/80 p-3 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-amber-950 flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-amber-600" />
                        <span>Nguồn vay: Thẻ tín dụng</span>
                      </span>
                      <span className="rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                        Chi nợ
                      </span>
                    </div>

                    {creditCardAccounts.length > 0 ? (
                      <FormField
                        control={form.control}
                        name="account_id"
                        render={({ field }) => (
                          <FormItem className="space-y-1.5">
                            <FormLabel className="text-xs font-semibold text-slate-700">
                              Tài khoản thẻ tín dụng (Chi vay)
                            </FormLabel>
                            <Select
                              value={field.value ?? undefined}
                              onValueChange={(val) => {
                                const nextVal = val === "none" ? null : val;
                                field.onChange(nextVal);
                                const found = nextVal ? allTargetsMap.get(nextVal) : null;
                                if (found?.currency) {
                                  form.setValue("currency", found.currency);
                                }
                              }}
                            >
                              <SelectTrigger className="h-10 rounded-xl border-amber-300 bg-white text-xs sm:text-sm">
                                <div className="flex items-center gap-2 truncate">
                                  <CreditCard className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                  <SelectValue placeholder="Chọn thẻ tín dụng chi trả..." />
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                <div className="px-2 py-1 text-[11px] font-semibold text-amber-800 bg-amber-100/70 rounded-md">
                                  💳 Thẻ tín dụng của tôi
                                </div>
                                {creditCardAccounts.map((acc) => (
                                  <SelectItem key={acc.id} value={acc.id} className="text-xs sm:text-sm">
                                    <div className="flex items-center justify-between gap-3 w-full">
                                      <span className="font-medium truncate">{acc.name}</span>
                                      <span className="text-xs text-amber-700 whitespace-nowrap">
                                        (Dư nợ: {formatNumber(acc.balance, acc.currency)} {acc.currency})
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-xs text-rose-500 font-medium">
                              {form.formState.errors.account_id?.message}
                            </FormMessage>
                          </FormItem>
                        )}
                      />
                    ) : (
                      <div className="space-y-1.5 rounded-lg border border-amber-300 bg-white/90 p-2.5 text-xs text-amber-900">
                        <p className="font-semibold text-amber-900">⚠️ Bạn chưa có tài khoản Thẻ tín dụng nào</p>
                        <p className="text-[11px] text-slate-600">
                          Hãy tạo tài khoản loại <em>"Thẻ tín dụng"</em> trong mục Tài khoản, hoặc nhập tên bên cho vay dưới đây:
                        </p>
                        <Input
                          value={debtPartnerName}
                          onChange={(e) => setDebtPartnerName(e.target.value)}
                          placeholder="Nhập tên người/ngân hàng cho vay (vd: VPBank, Nam...)"
                          className="h-8.5 rounded-lg border-slate-200 bg-white text-xs"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Mua hộ cho vay details (Đối tác & Debts) */}
                {debtMode === "lent_spent" && (
                  <div className="space-y-2.5 rounded-xl border border-sky-200/90 bg-sky-50/80 p-3 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-sky-950 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-sky-600" />
                        <span>Chọn đối tác mua hộ / cho vay</span>
                        <span className="text-rose-500 font-bold">*</span>
                      </span>
                      <span className="rounded bg-sky-200/80 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-900">
                        Tạo khoản nợ
                      </span>
                    </div>

                    {/* Suggestion Chips */}
                    {allPartnersList.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[10px] text-slate-400 font-medium">Gợi ý:</span>
                        {allPartnersList.slice(0, 6).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedPartnerId(p.id)}
                            className={cn(
                              "rounded-md px-2 py-0.5 text-[11px] font-medium transition active:scale-95",
                              selectedPartnerId === p.id
                                ? "bg-sky-600 text-white font-semibold shadow-2xs"
                                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            )}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Partner Select Dropdown */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                          <SelectTrigger className="h-9 rounded-xl border-slate-200 bg-white text-xs">
                            <div className="flex items-center gap-2 truncate">
                              <Users className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                              <SelectValue placeholder="Chọn đối tác cần thu lại tiền..." />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {allPartnersList.map((p) => (
                              <SelectItem key={p.id} value={p.id} className="text-xs">
                                <span className="font-medium">{p.name}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowNewPartnerInput((v) => !v)}
                        className="h-9 px-2.5 rounded-xl border-slate-200 bg-white text-xs text-sky-700 hover:bg-sky-50 hover:text-sky-800"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        <span>Thêm</span>
                      </Button>
                    </div>

                    {/* Inline Create Partner Form */}
                    {showNewPartnerInput && (
                      <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-150">
                        <Input
                          value={newPartnerName}
                          onChange={(e) => setNewPartnerName(e.target.value)}
                          placeholder="Nhập tên đối tác mới..."
                          className="h-8.5 rounded-lg border-sky-300 bg-white text-xs flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleQuickCreatePartner(newPartnerName);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={!newPartnerName.trim() || isCreatingPartner}
                          onClick={() => handleQuickCreatePartner(newPartnerName)}
                          className="h-8.5 rounded-lg bg-sky-600 px-3 text-xs text-white hover:bg-sky-700"
                        >
                          {isCreatingPartner ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Lưu"}
                        </Button>
                      </div>
                    )}

                    {/* Account selector for paying money in lent_spent */}
                    <FormField
                      control={form.control}
                      name="account_id"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5 pt-1">
                          <FormLabel className="text-xs font-semibold text-slate-700">
                            Tài khoản chi tiền mua hộ
                          </FormLabel>
                          <Select
                            value={field.value ?? undefined}
                            onValueChange={(val) => {
                              const nextVal = val === "none" ? null : val;
                              field.onChange(nextVal);
                              const found = nextVal ? allTargetsMap.get(nextVal) : null;
                              if (found?.currency) {
                                form.setValue("currency", found.currency);
                              }
                            }}
                          >
                            <SelectTrigger className="h-9 rounded-xl border-sky-200 bg-white text-xs sm:text-sm">
                              <div className="flex items-center gap-2 truncate">
                                <CreditCard className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                                <SelectValue placeholder="Chọn tài khoản chi tiền..." />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 bg-slate-100/70 rounded-md">
                                💳 Tài khoản của tôi
                              </div>
                              {myAccountOptions.map((acc) => (
                                <SelectItem key={acc.id} value={acc.id} className="text-xs sm:text-sm">
                                  <div className="flex items-center justify-between gap-3 w-full">
                                    <span className="font-medium truncate">{acc.name}</span>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      ({formatNumber(acc.balance, acc.currency)} {acc.currency})
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-xs text-rose-500 font-medium">
                            {form.formState.errors.account_id?.message}
                          </FormMessage>
                        </FormItem>
                      )}
                    />

                    <div className="rounded-lg bg-sky-100/70 p-2 text-[11px] text-sky-900 leading-relaxed flex items-start gap-1.5">
                      <span className="text-xs shrink-0">💡</span>
                      <span>
                        Khoản chi này sẽ tự động ghi nhận vào mục <strong>Chi tiêu</strong> và tạo 1 khoản cho vay trong <strong>Debts</strong> để theo dõi thu hồi từ đối tác.
                      </span>
                    </div>
                  </div>
                )}
              </div>


            </>
          )}

          {/* Income Mode: Account & Full-width Date Picker */}
          {selectedType === "income" && (
            <div className="space-y-3">
              <div className="w-full">
                <CashflowDateFields control={form.control} />
              </div>
              <FormField
                control={form.control}
                name="account_id"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-xs font-semibold text-slate-700">
                        Tài khoản nhận tiền
                      </FormLabel>
                      <button
                        type="button"
                        onClick={() => setShowCurrencySelect((v) => !v)}
                        className="text-[11px] font-medium text-slate-400 hover:text-slate-600"
                      >
                        {currency} ▾
                      </button>
                    </div>
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={(val) => {
                        const nextVal = val === "none" ? null : val;
                        field.onChange(nextVal);
                        const found = nextVal ? allTargetsMap.get(nextVal) : null;
                        if (found?.currency) {
                          form.setValue("currency", found.currency);
                        }
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-xs sm:text-sm">
                        <div className="flex items-center gap-2 truncate">
                          <CreditCard className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <SelectValue placeholder="Chọn tài khoản nhận..." />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 bg-slate-100/70 rounded-md">
                          💳 Tài khoản của tôi
                        </div>
                        {myAccountOptions.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id} className="text-xs sm:text-sm">
                            <div className="flex items-center justify-between gap-3 w-full">
                              <span className="font-medium truncate">{acc.name}</span>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                ({formatNumber(acc.balance, acc.currency)} {acc.currency})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs text-rose-500 font-medium">
                      {form.formState.errors.account_id?.message}
                    </FormMessage>
                  </FormItem>
                )}
              />

            </div>
          )}

          {/* Transfer Mode: Source & Destination Accounts, and Full-width Date Picker */}
          {selectedType === "transfer" && (
            <div className="space-y-3">
              {/* Date Picker full width for transfer */}
              <div className="w-full">
                <CashflowDateFields control={form.control} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Source Account */}
                <FormField
                  control={form.control}
                  name="account_id"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-xs font-semibold text-slate-700">
                          Từ tài khoản (Của tôi)
                        </FormLabel>
                        <button
                          type="button"
                          onClick={() => setShowCurrencySelect((v) => !v)}
                          className="text-[11px] font-medium text-slate-400 hover:text-slate-600"
                        >
                          {currency} ▾
                        </button>
                      </div>
                      <Select
                        value={field.value ?? undefined}
                        onValueChange={(val) => {
                          const nextVal = val === "none" ? null : val;
                          field.onChange(nextVal);
                          const found = nextVal ? allTargetsMap.get(nextVal) : null;
                          if (found?.currency) {
                            form.setValue("currency", found.currency);
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-xs sm:text-sm">
                          <div className="flex items-center gap-2 truncate">
                            <CreditCard className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <SelectValue placeholder="Chọn tài khoản nguồn của tôi..." />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 bg-slate-100/70 rounded-md">
                            💳 Tài khoản của tôi
                          </div>
                          {myAccountOptions.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id} className="text-xs sm:text-sm">
                              <div className="flex items-center justify-between gap-3 w-full">
                                <span className="font-medium truncate">{acc.name}</span>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  ({formatNumber(acc.balance, acc.currency)} {acc.currency})
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs text-rose-500 font-medium">
                        {form.formState.errors.account_id?.message}
                      </FormMessage>
                    </FormItem>
                  )}
                />

                {/* Destination Account */}
                <FormField
                  control={form.control}
                  name="destination_account_id"
                  render={({ field }) => {
                    const selectedDest = field.value ? allTargetsMap.get(field.value) : null;
                    const availableMyAccounts = myAccountOptions.filter((acc) => acc.id !== accountId);
                    const availableOtherAccounts = otherAccountOptions.filter((acc) => acc.id !== accountId);
                    const availablePartners = partnerOptions.filter((p) => p.id !== accountId);

                    return (
                      <FormItem className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-xs font-semibold text-slate-700">
                            Đến tài khoản / Đối tác
                          </FormLabel>
                          {field.value && (
                            <span className="text-[11px] font-medium text-slate-400">
                              {effectiveDestCurrency}
                            </span>
                          )}
                        </div>
                        <Select
                          value={field.value ?? undefined}
                          onValueChange={(val) => {
                            const nextVal = val === "none" ? null : val;
                            field.onChange(nextVal);
                            const target = nextVal ? allTargetsMap.get(nextVal) : null;
                            const targetCurr = target?.currency || "VND";
                            form.setValue("destination_currency", targetCurr);
                            if (targetCurr.toUpperCase() === currency.toUpperCase()) {
                              form.setValue("destination_amount", amount);
                              form.setValue("exchange_rate", 1);
                            } else {
                              const currentRate = form.getValues("exchange_rate");
                              if (currentRate && currentRate > 0 && typeof amount === "number" && amount > 0) {
                                const isVnd = targetCurr.toUpperCase() === "VND";
                                form.setValue(
                                  "destination_amount",
                                  isVnd ? Math.round(amount * currentRate) : Math.round(amount * currentRate * 100) / 100
                                );
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-xs sm:text-sm">
                            <div className="flex items-center gap-2 truncate">
                              {selectedDest?.isPartner ? (
                                <Users className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                              ) : selectedDest?.isOther ? (
                                <User className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                              ) : (
                                <CreditCard className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              )}
                              <SelectValue placeholder="Chọn tài khoản / đối tác nhận" />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {availableMyAccounts.length > 0 && (
                              <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 bg-slate-100/70 rounded-md">
                                💳 Tài khoản của tôi
                              </div>
                            )}
                            {availableMyAccounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id} className="text-xs sm:text-sm">
                                <div className="flex items-center justify-between gap-3 w-full">
                                  <span className="font-medium truncate">{acc.name}</span>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    ({formatNumber(acc.balance, acc.currency)} {acc.currency})
                                  </span>
                                </div>
                              </SelectItem>
                            ))}

                            {availableOtherAccounts.length > 0 && (
                              <div className="mt-1 px-2 py-1 text-[11px] font-semibold text-purple-600 bg-purple-50 rounded-md">
                                👤 Tài khoản khác (Người khác)
                              </div>
                            )}
                            {availableOtherAccounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id} className="text-xs sm:text-sm">
                                <div className="flex items-center justify-between gap-3 w-full">
                                  <span className="font-medium truncate">{acc.name}</span>
                                  <span className="text-xs text-purple-600 whitespace-nowrap">
                                    ({formatNumber(acc.balance, acc.currency)} {acc.currency})
                                  </span>
                                </div>
                              </SelectItem>
                            ))}

                            {availablePartners.length > 0 && (
                              <div className="mt-1 px-2 py-1 text-[11px] font-semibold text-sky-600 bg-sky-50 rounded-md">
                                👥 Đối tác
                              </div>
                            )}
                            {availablePartners.map((p) => (
                              <SelectItem key={p.id} value={p.id} className="text-xs sm:text-sm">
                                <span className="font-medium">{p.name}</span>{" "}
                                <span className="text-xs text-sky-600 font-normal">(Đối tác · {p.currency})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-xs text-rose-500 font-medium">
                          {form.formState.errors.destination_account_id?.message}
                        </FormMessage>
                      </FormItem>
                    );
                  }}
                />
              </div>


            </div>
          )}

          {/* Currency Exchange Panel when currencies differ in Transfer mode */}
          {isTransfer && destinationAccountId && isDifferentCurrency && (
            <div className="rounded-2xl border border-blue-200/90 bg-gradient-to-br from-blue-50/80 to-indigo-50/40 p-3.5 sm:p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-600 text-white shadow-2xs">
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900">Quy đổi ngoại tệ</span>
                    <p className="text-[11px] text-slate-500">
                      Chuyển {currency} ➔ Nhận {effectiveDestCurrency}
                    </p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-blue-100/80 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                  <span>{currency}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>{effectiveDestCurrency}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Exchange Rate / Multiplier */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">
                      Hệ số nhân / Tỷ giá
                    </Label>
                    <span className="text-[10px] text-slate-400">
                      1 {currency} = ? {effectiveDestCurrency}
                    </span>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      step="any"
                      placeholder="VD: 25400"
                      value={exchangeRate ?? ""}
                      onChange={(e) => {
                        const val = e.target.value === "" ? undefined : parseFloat(e.target.value);
                        handleExchangeRateChange(val);
                      }}
                      className="h-10 rounded-xl border-slate-200 bg-white text-xs sm:text-sm font-semibold pr-16"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400 pointer-events-none">
                      tỷ giá
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Nhập tỷ giá sẽ tự tính tiền nhận
                  </p>
                  {form.formState.errors.exchange_rate && (
                    <p className="text-xs font-medium text-rose-500">
                      {form.formState.errors.exchange_rate.message}
                    </p>
                  )}
                </div>

                {/* Destination Received Amount */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">
                      Tiền nhận ({effectiveDestCurrency})
                    </Label>
                    {destinationAmount && destinationAmount > 0 ? (
                      <span className="text-[10px] font-bold text-emerald-600">
                        ≈ {formatNumber(destinationAmount, effectiveDestCurrency)} {effectiveDestCurrency}
                      </span>
                    ) : null}
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      step="any"
                      placeholder={`Số tiền nhận (${effectiveDestCurrency})`}
                      value={destinationAmount ?? ""}
                      onChange={(e) => {
                        const val = e.target.value === "" ? undefined : parseFloat(e.target.value);
                        handleDestinationAmountChange(val);
                      }}
                      className="h-10 rounded-xl border-slate-200 bg-white text-xs sm:text-sm font-semibold pr-14 text-emerald-700"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600 pointer-events-none">
                      {effectiveDestCurrency}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Hoặc nhập tiền nhận sẽ tự tính tỷ giá
                  </p>
                  {form.formState.errors.destination_amount && (
                    <p className="text-xs font-medium text-rose-500">
                      {form.formState.errors.destination_amount.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Optional Currency Override Drawer/Selector if user clicked currency pill */}
          {showCurrencySelect && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 animate-in fade-in slide-in-from-top-1 duration-150 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Chọn loại tiền tệ</span>
                <button
                  type="button"
                  onClick={() => setShowCurrencySelect(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Select value={field.value ?? CUSTOM_CURRENCY} onValueChange={field.onChange}>
                      <SelectTrigger className="h-9 rounded-xl bg-white border-slate-200 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((curr) => (
                          <SelectItem key={curr} value={curr} className="text-xs">
                            {curr}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_CURRENCY} className="text-xs">
                          Tùy chỉnh khác...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {field.value && !CURRENCIES.includes(field.value) ? (
                      <Input
                        className="h-9 rounded-xl text-xs bg-white border-slate-200"
                        value={customCurrency}
                        onChange={(e) => {
                          setCustomCurrency(e.target.value);
                          field.onChange(e.target.value.toUpperCase());
                        }}
                        placeholder="Nhập mã tiền tệ (vd: KRW)"
                      />
                    ) : null}
                  </div>
                )}
              />
            </div>
          )}

          {/* Note Input */}
          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-xs font-semibold text-slate-700">Ghi chú (tùy chọn)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <PenLine className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="vd: Cà phê sáng, ăn trưa, đổ xăng..."
                      className="h-10 rounded-xl border-slate-200 bg-white pl-8.5 pr-3 text-xs sm:text-sm"
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-xs text-rose-500 font-medium">
                  {form.formState.errors.note?.message}
                </FormMessage>
              </FormItem>
            )}
          />

          {submitError ? <p className="text-xs font-medium text-rose-500">{submitError}</p> : null}
        </form>
      </Form>

      {/* Docked Submit Action Bar on Mobile - Snuggly positioned right above bottom nav bar (no 125px gap) */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+3.5rem)] z-20 border-t border-slate-200/90 bg-white/95 px-4 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.07)] backdrop-blur-xl md:static md:mt-6 md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <div className="mx-auto max-w-2xl">
          <Button
            type="submit"
            form="cashflow-form"
            disabled={!canSubmit}
            className={cn(
              "h-12 w-full rounded-2xl text-sm sm:text-base font-semibold shadow-sm transition-all duration-200",
              canSubmit
                ? selectedType === "expense"
                  ? "bg-rose-600 text-white shadow-rose-600/25 hover:bg-rose-700 active:scale-[0.99]"
                  : selectedType === "income"
                    ? "bg-emerald-600 text-white shadow-emerald-600/25 hover:bg-emerald-700 active:scale-[0.99]"
                    : "bg-blue-600 text-white shadow-blue-600/25 hover:bg-blue-700 active:scale-[0.99]"
                : "cursor-not-allowed bg-slate-200 text-slate-400 hover:bg-slate-200 shadow-none border-0"
            )}
          >
            {isFormSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                Đang lưu...
              </span>
            ) : !isValidAmount ? (
              <span>Nhập số tiền để tiếp tục</span>
            ) : !hasCategory ? (
              <span>Chọn danh mục để tiếp tục</span>
            ) : !hasAccount ? (
              <span>
                {selectedType === "expense" && debtMode === "borrowed_spent"
                  ? "Chọn thẻ tín dụng"
                  : "Chọn tài khoản thanh toán"}
              </span>
            ) : selectedType === "expense" && debtMode === "lent_spent" && !selectedPartnerId ? (
              <span>Chọn đối tác mua hộ để tiếp tục</span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <span>
                  Thêm{" "}
                  {selectedType === "expense"
                    ? debtMode === "borrowed_spent"
                      ? "chi từ thẻ tín dụng"
                      : debtMode === "lent_spent"
                        ? "chi mua hộ / cho vay"
                        : "chi tiêu cá nhân"
                    : selectedType === "income"
                      ? "thu nhập"
                      : "chuyển khoản"}
                </span>
                <span className="font-bold opacity-90">
                  • {Number(amount).toLocaleString("vi-VN")} {currency}
                </span>
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  if (useDialog) {
    return (
      <>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent
            className="w-full max-w-lg"
            style={{ maxHeight: dialogMaxHeight ? `${dialogMaxHeight}px` : undefined }}
          >
            <DialogHeader>
              <DialogTitle>Thêm giao dịch</DialogTitle>
              <DialogDescription>Ghi chép giao dịch tài chính nhanh chóng</DialogDescription>
            </DialogHeader>
            {formContent}
          </DialogContent>
        </Dialog>
        <Button onClick={() => setDialogOpen(true)} disabled={isSubmitting}>
          Thêm giao dịch
        </Button>
      </>
    );
  }

  return formContent;
}

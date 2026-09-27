import { type CashflowAccount, type CashflowTransaction } from "@/hooks/useCashflowTransactions";

export interface AccountBalanceDetails {
  currentBalance: number;
  initialBalance: number;
  totalIncome: number;
  totalExpense: number;
  totalTransferOut: number;
  totalTransferIn: number;
  transactionCount: number;
  isCreditCard: boolean;
}

/**
 * Calculates current balance, transaction metrics, and credit card status for an account.
 */
export function calculateAccountBalance(
  account: CashflowAccount,
  transactions: CashflowTransaction[] = []
): AccountBalanceDetails {
  const initial = Number(account.balance ?? 0);
  let income = 0;
  let expense = 0;
  let transferOut = 0;
  let transferIn = 0;
  let count = 0;

  for (const tx of transactions) {
    const isSource = tx.account_id === account.id;
    const isDest = tx.destination_account_id === account.id;

    if (isSource) {
      count++;
      if (tx.type === "income") {
        income += Number(tx.amount || 0);
      } else if (tx.type === "expense") {
        expense += Number(tx.amount || 0);
      } else if (tx.type === "transfer") {
        if (tx.flow_type === true) {
          transferIn += Number(tx.amount || 0);
        } else {
          transferOut += Number(tx.amount || 0);
        }
      }
    }

    // For legacy single-record transfer where the inflow leg was only destination_account_id
    if (isDest && !isSource && tx.type === "transfer" && !tx.transfer_peer_id) {
      count++;
      const destAmount = tx.destination_amount ?? tx.amount ?? 0;
      transferIn += Number(destAmount);
    }
  }

  const currentBalance = initial;
  const isCreditCard = account.type === "credit" || account.type === "credit_card";

  return {
    currentBalance,
    initialBalance: initial,
    totalIncome: income,
    totalExpense: expense,
    totalTransferOut: transferOut,
    totalTransferIn: transferIn,
    transactionCount: count,
    isCreditCard,
  };
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  cash: "Tiền mặt",
  bank: "Ngân hàng",
  credit: "Thẻ tín dụng",
  credit_card: "Thẻ tín dụng",
  debit: "Thẻ ghi nợ",
  broker: "Chứng khoán",
  "e-wallet": "Ví điện tử",
  other: "Tài khoản khác",
  external: "Tài khoản khác",
  partner: "Đối tác",
};

export const AVAILABLE_ACCOUNT_TYPES = [
  { value: "cash", label: "Tiền mặt (Cash)" },
  { value: "bank", label: "Ngân hàng (Bank)" },
  { value: "credit", label: "Thẻ tín dụng (Credit Card)" },
  { value: "debit", label: "Thẻ ghi nợ (Debit Card)" },
  { value: "e-wallet", label: "Ví điện tử (E-wallet)" },
  { value: "broker", label: "Chứng khoán (Broker)" },
  { value: "other", label: "Tài khoản khác (Người khác)" },
];

export function isMyAccount(type: string | null | undefined): boolean {
  if (!type) return false;
  const t = type.toLowerCase();
  return t !== "partner" && t !== "other" && t !== "external";
}

export function isOtherAccount(type: string | null | undefined): boolean {
  if (!type) return false;
  const t = type.toLowerCase();
  return t === "other" || t === "external";
}

export function isPartnerAccount(type: string | null | undefined): boolean {
  if (!type) return false;
  return type.toLowerCase() === "partner";
}

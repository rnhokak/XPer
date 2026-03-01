import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PartnerDetailPageClient } from "@/features/partners/PartnerDetailPageClient";

export const dynamic = "force-dynamic";

type Partner = { id: string; name: string; type: string | null; phone: string | null; note: string | null; created_at: string | null };
type Balance = { total_lent: number | null; total_borrowed: number | null; total_receive: number | null; total_repay: number | null; balance: number | null };
type Account = { id: string; name: string; currency: string; is_default?: boolean | null };
type Category = { id: string; name: string; type: "income" | "expense" | "transfer" };
type PartnerTransactionRow = {
  id: string;
  direction: "lend" | "borrow" | "repay" | "receive";
  amount: number;
  principal_amount: number | null;
  interest_amount: number | null;
  date: string;
  note: string | null;
  transaction: {
    id: string;
    type: "income" | "expense" | "transfer";
    amount: number;
    currency: string;
    transaction_time: string;
    note: string | null;
    account: { id: string; name: string | null; currency: string | null } | null;
    category: { id: string; name: string | null; type: "income" | "expense" | "transfer" | null } | null;
  } | null;
};

export default async function PartnerDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const supabase = await createClient();

  const partnerPromise = supabase
    .from("partners")
    .select("id,name,type,phone,note,created_at")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const balancePromise = supabase
    .from("partner_balances")
    .select("partner_id,total_lent,total_borrowed,total_receive,total_repay,balance")
    .eq("partner_id", params.id)
    .maybeSingle();

  const transactionsPromise = supabase
    .from("partner_transactions")
    .select(
      "id,direction,amount,principal_amount,interest_amount,date,note,transaction:transactions(id,type,amount,currency,transaction_time,note,account:accounts(id,name,currency),category:categories(id,name,type))"
    )
    .eq("partner_id", params.id)
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  const accountsPromise = supabase
    .from("accounts")
    .select("id,name,currency,is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false });

  const categoriesPromise = supabase.from("categories").select("id,name,type").eq("user_id", user.id);

  const [partnerRes, balanceRes, transactionsRes, accountsRes, categoriesRes] = await Promise.all([
    partnerPromise,
    balancePromise,
    transactionsPromise,
    accountsPromise,
    categoriesPromise,
  ]);

  if (partnerRes.error) throw partnerRes.error;
  if (!partnerRes.data) return notFound();

  if (balanceRes.error) throw balanceRes.error;
  if (transactionsRes.error) throw transactionsRes.error;

  const partner: Partner = partnerRes.data as Partner;
  const balance: Balance | null = (balanceRes.data as Balance | null) ?? null;
  const transactions: PartnerTransactionRow[] = (transactionsRes.data as PartnerTransactionRow[] | null) ?? [];
  const accounts: Account[] = accountsRes.data ?? [];
  const categories: Category[] = categoriesRes.data ?? [];
  const defaultCurrency = accounts.find((a) => a.is_default)?.currency ?? accounts[0]?.currency ?? "VND";

  return (
    <PartnerDetailPageClient
      partner={partner}
      balance={balance}
      transactions={transactions}
      accounts={accounts}
      categories={categories}
      defaultCurrency={defaultCurrency}
    />
  );
}

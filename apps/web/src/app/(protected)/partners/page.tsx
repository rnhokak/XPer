import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PartnerListPageClient } from "@/features/partners/PartnerListPageClient";

export const dynamic = "force-dynamic";

type Account = { id: string; name: string; currency: string; is_default?: boolean | null };
type Category = { id: string; name: string; type: "income" | "expense" | "transfer" };
type PartnerBalance = {
  total_lent: number | null;
  total_borrowed: number | null;
  total_receive: number | null;
  total_repay: number | null;
  balance: number | null;
};

type PartnerRow = {
  id: string;
  name: string;
  type: string | null;
  phone: string | null;
  note: string | null;
  created_at: string | null;
  balance: PartnerBalance | null;
};

export default async function PartnersPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const partnersPromise = supabase
    .from("partners")
    .select("id,name,type,phone,note,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const balancesPromise = supabase
    .from("partner_balances")
    .select("partner_id,total_lent,total_borrowed,total_receive,total_repay,balance");

  const accountsPromise = supabase
    .from("accounts")
    .select("id,name,currency,is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  const categoriesPromise = supabase.from("categories").select("id,name,type").eq("user_id", user.id);

  const [{ data: partners, error: partnersError }, balancesRes, accountsRes, categoriesRes] = await Promise.all([
    partnersPromise,
    balancesPromise,
    accountsPromise,
    categoriesPromise,
  ]);

  if (partnersError) throw partnersError;

  if (balancesRes.error) throw balancesRes.error;

  const balances = new Map<string, PartnerBalance>();
  (balancesRes.data ?? []).forEach((b: any) => {
    if (b.partner_id) balances.set(b.partner_id, b as PartnerBalance);
  });

  const accounts: Account[] = accountsRes.data ?? [];
  const categories: Category[] = categoriesRes.data ?? [];
  const defaultCurrency = accounts.find((a) => a.is_default)?.currency ?? accounts[0]?.currency ?? "VND";

  return (
    <PartnerListPageClient
      partners={((partners ?? []) as PartnerRow[]).map((p) => ({ ...p, balance: balances.get(p.id) ?? null }))}
      accounts={accounts}
      categories={categories}
      defaultCurrency={defaultCurrency}
    />
  );
}

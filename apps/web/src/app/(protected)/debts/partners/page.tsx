import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PartnersManager } from "../_components/PartnersManager";

export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: partners } = await supabase
    .from("partners")
    .select("id,name,type,phone,note")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Quản lý người/đơn vị liên quan tới khoản vay</p>
          <h1 className="text-2xl font-semibold">Đối tác</h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/debts">Quay lại Debts</Link>
        </Button>
      </div>

      <PartnersManager partners={partners ?? []} />
    </div>
  );
}

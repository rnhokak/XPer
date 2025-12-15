import { CategoriesManager } from "../_components/CategoriesManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CashflowCategoriesPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id,name,type,parent_id,level,is_default,category_group,category_focus,created_at")
    .eq("user_id", user.id)
    .order("level", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoriesManager categories={(data as any) ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}

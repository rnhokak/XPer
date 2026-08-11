import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoriesManager } from './components/CategoriesManager';
import { useCashflowCategories } from '@/hooks/useCashflowTransactions';
import { Loader2 } from 'lucide-react';

export default function CashflowCategoriesPage() {
  const { data: categories = [], isLoading } = useCashflowCategories();

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoriesManager categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}

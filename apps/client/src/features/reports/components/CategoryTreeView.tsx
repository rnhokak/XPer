import { ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type Category = {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer";
  parent_id: string | null;
  is_default?: boolean | null;
  category_focus: string | null;
  children: Category[];
  transactions: unknown[];
  totalAmount: number;
};

type Props = {
  categories: Category[];
  expandedCategories: Set<string>;
  toggleCategory: (categoryId: string) => void;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(value)));

function calculateTotalAmount(categories: Category[]): number {
  let total = 0;
  const traverse = (cats: Category[]) => {
    cats.forEach((cat) => {
      total += cat.totalAmount;
      if (cat.children.length > 0) {
        traverse(cat.children);
      }
    });
  };
  traverse(categories);
  return total;
}

function CategoryItem({
  category,
  expandedCategories,
  toggleCategory,
  level = 0,
  parentTotal = 0,
}: {
  category: Category;
  expandedCategories: Set<string>;
  toggleCategory: (categoryId: string) => void;
  level?: number;
  parentTotal?: number;
}) {
  const isExpanded = expandedCategories.has(category.id);
  const hasChildren = category.children && category.children.length > 0;
  const percentage = parentTotal > 0 ? ((category.totalAmount / parentTotal) * 100).toFixed(1) : "0";

  return (
    <div className="w-full">
      <div
        className={`flex items-center py-2 pl-${level * 4} pr-2 hover:bg-accent rounded-md transition-colors cursor-pointer`}
        onClick={() => hasChildren && toggleCategory(category.id)}
      >
        {hasChildren ? (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 mr-1">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        ) : (
          <div className="w-6 h-6 mr-1 flex items-center justify-center" />
        )}

        <div className="flex-1 flex items-center justify-between">
          <span className="font-medium">{category.name}</span>
          <div className="text-right">
            <span className="text-sm font-medium text-muted-foreground">{formatCurrency(category.totalAmount)}</span>
            <span className="ml-2 text-xs text-muted-foreground">({percentage}%)</span>
          </div>
        </div>
      </div>

      {isExpanded && hasChildren && (
        <div className="ml-2 border-l border-muted pl-2">
          {category.children.map((child) => (
            <CategoryItem
              key={child.id}
              category={child}
              expandedCategories={expandedCategories}
              toggleCategory={toggleCategory}
              level={level + 1}
              parentTotal={category.totalAmount}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryTreeView({ categories, expandedCategories, toggleCategory }: Props) {
  const totalAmount = calculateTotalAmount(categories);

  if (categories.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">Không có danh mục nào để hiển thị</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="mb-4 rounded-lg bg-slate-50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Tổng tất cả danh mục</span>
          <span className="text-base font-bold text-slate-900">{formatCurrency(totalAmount)} đ</span>
        </div>
      </div>
      {categories.map((category) => (
        <CategoryItem
          key={category.id}
          category={category}
          expandedCategories={expandedCategories}
          toggleCategory={toggleCategory}
          parentTotal={totalAmount}
        />
      ))}
    </div>
  );
}

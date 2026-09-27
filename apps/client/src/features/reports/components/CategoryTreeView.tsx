import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Filter, Search, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getCategoryEmoji } from "@/lib/cashflow/categoryUtils";
import { cn } from "@/lib/utils";

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
  currency?: string;
  themeColor?: "rose" | "emerald" | "blue";
  activeCategoryId?: string | null;
  onSelectCategory?: (categoryId: string | null) => void;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(value)));

function calculateTotalAmount(categories: Category[]): number {
  return categories.reduce((sum, cat) => sum + cat.totalAmount, 0);
}

export function CategoryTreeView({
  categories,
  expandedCategories,
  toggleCategory,
  currency = "VND",
  themeColor = "rose",
  activeCategoryId,
  onSelectCategory,
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"ranking" | "tree">("ranking");

  const totalAmount = useMemo(() => calculateTotalAmount(categories), [categories]);

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return categories;

    const matches = (cat: Category): boolean => {
      if (cat.name.toLowerCase().includes(q)) return true;
      if (cat.children?.some(matches)) return true;
      return false;
    };

    return categories.filter(matches);
  }, [categories, searchTerm]);

  // Flattened ranking of all categories that have transactions
  const rankedCategories = useMemo(() => {
    const all: { category: Category; isRoot: boolean }[] = [];
    const traverse = (cat: Category, isRoot: boolean) => {
      if (cat.totalAmount > 0) {
        all.push({ category: cat, isRoot });
      }
      cat.children?.forEach((child) => traverse(child, false));
    };

    categories.forEach((cat) => traverse(cat, true));
    return all.sort((a, b) => b.category.totalAmount - a.category.totalAmount);
  }, [categories]);

  const filteredRanking = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rankedCategories;
    return rankedCategories.filter((item) => item.category.name.toLowerCase().includes(q));
  }, [rankedCategories, searchTerm]);

  if (categories.length === 0 || totalAmount <= 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
        <span className="text-3xl mb-2">📁</span>
        <p className="text-sm font-semibold text-slate-700">Chưa có danh mục nào phát sinh</p>
        <p className="text-xs text-slate-500 mt-0.5">Dữ liệu danh mục sẽ hiển thị khi có giao dịch trong kỳ.</p>
      </div>
    );
  }

  const barColorClass =
    themeColor === "rose"
      ? "bg-rose-500"
      : themeColor === "emerald"
      ? "bg-emerald-500"
      : "bg-blue-500";

  return (
    <div className="space-y-4">
      {/* Search & Mode Switcher Bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm danh mục trong báo cáo..."
            className="h-9 rounded-xl border-slate-200 bg-slate-50/50 pl-8.5 text-xs sm:text-sm focus-visible:ring-slate-300"
          />
        </div>

        <div className="flex items-center rounded-xl bg-slate-100 p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("ranking")}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
              viewMode === "ranking"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-500 hover:text-slate-900"
            )}
          >
            <TrendingUp className="h-3 w-3" />
            <span>Xếp hạng</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("tree")}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
              viewMode === "tree"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-500 hover:text-slate-900"
            )}
          >
            <Filter className="h-3 w-3" />
            <span>Phân cấp</span>
          </button>
        </div>
      </div>

      {/* Mode 1: RANKING VIEW */}
      {viewMode === "ranking" && (
        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {filteredRanking.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">Không tìm thấy danh mục phù hợp</p>
          ) : (
            filteredRanking.map(({ category }, index) => {
              const percentage = totalAmount > 0 ? (category.totalAmount / totalAmount) * 100 : 0;
              const emoji = getCategoryEmoji(category.name);
              const isSelected = activeCategoryId === category.id;

              return (
                <div
                  key={category.id}
                  onClick={() => onSelectCategory?.(isSelected ? null : category.id)}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-xl border p-2.5 transition-all duration-150 cursor-pointer active:scale-[0.99]",
                    isSelected
                      ? "border-slate-400 bg-slate-50/90 shadow-2xs ring-2 ring-slate-400/20"
                      : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* Rank Medal / Badge */}
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-bold text-slate-600">
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                      </span>
                      <span className="text-base shrink-0">{emoji}</span>
                      <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                        {category.name}
                      </span>
                      {category.transactions && category.transactions.length > 0 && (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-500 shrink-0">
                          {category.transactions.length} GD
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        {formatCurrency(category.totalAmount)} <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
                      </span>
                      <span className="min-w-[42px] text-right rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn("h-full rounded-full transition-all duration-300", barColorClass)}
                      style={{ width: `${Math.min(100, Math.max(1, percentage))}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Mode 2: HIERARCHICAL TREE VIEW */}
      {viewMode === "tree" && (
        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {filteredCategories.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">Không tìm thấy danh mục phù hợp</p>
          ) : (
            filteredCategories.map((category) => (
              <CategoryTreeItem
                key={category.id}
                category={category}
                expandedCategories={expandedCategories}
                toggleCategory={toggleCategory}
                parentTotal={totalAmount}
                currency={currency}
                themeColor={themeColor}
                activeCategoryId={activeCategoryId}
                onSelectCategory={onSelectCategory}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function CategoryTreeItem({
  category,
  expandedCategories,
  toggleCategory,
  level = 0,
  parentTotal = 0,
  currency = "VND",
  themeColor = "rose",
  activeCategoryId,
  onSelectCategory,
}: {
  category: Category;
  expandedCategories: Set<string>;
  toggleCategory: (categoryId: string) => void;
  level?: number;
  parentTotal?: number;
  currency?: string;
  themeColor?: "rose" | "emerald" | "blue";
  activeCategoryId?: string | null;
  onSelectCategory?: (categoryId: string | null) => void;
}) {
  const isExpanded = expandedCategories.has(category.id);
  const hasChildren = category.children && category.children.length > 0;
  const percentage = parentTotal > 0 ? (category.totalAmount / parentTotal) * 100 : 0;
  const emoji = getCategoryEmoji(category.name);
  const isSelected = activeCategoryId === category.id;

  const barColorClass =
    themeColor === "rose"
      ? "bg-rose-500"
      : themeColor === "emerald"
      ? "bg-emerald-500"
      : "bg-blue-500";

  return (
    <div className="w-full space-y-1">
      <div
        className={cn(
          "flex flex-col gap-1.5 rounded-xl border p-2.5 transition-all duration-150 cursor-pointer active:scale-[0.99]",
          level === 0
            ? "border-slate-200/90 bg-white"
            : "border-slate-150 bg-slate-50/70",
          isSelected
            ? "border-slate-400 bg-slate-50/90 shadow-2xs ring-2 ring-slate-400/20"
            : "hover:border-slate-300 hover:bg-slate-50"
        )}
        style={level > 0 ? { marginLeft: `${Math.min(level, 3) * 16}px` } : undefined}
        onClick={() => {
          if (hasChildren) {
            toggleCategory(category.id);
          } else {
            onSelectCategory?.(isSelected ? null : category.id);
          }
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCategory(category.id);
                }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <div className="w-5 shrink-0" />
            )}

            <span className="text-sm shrink-0">{emoji}</span>
            <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
              {category.name}
            </span>
            {hasChildren && (
              <span className="rounded-md bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-500 shrink-0">
                {category.children.length} con
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs sm:text-sm font-bold text-slate-900">
              {formatCurrency(category.totalAmount)} <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
            </span>
            <span className="min-w-[42px] text-right rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">
              {percentage.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Mini progress bar */}
        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn("h-full rounded-full transition-all duration-300", barColorClass)}
            style={{ width: `${Math.min(100, Math.max(1, percentage))}%` }}
          />
        </div>
      </div>

      {/* Children list */}
      {isExpanded && hasChildren && (
        <div className="space-y-1 pl-1 border-l-2 border-slate-100 ml-3">
          {category.children.map((child) => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              expandedCategories={expandedCategories}
              toggleCategory={toggleCategory}
              level={level + 1}
              parentTotal={category.totalAmount}
              currency={currency}
              themeColor={themeColor}
              activeCategoryId={activeCategoryId}
              onSelectCategory={onSelectCategory}
            />
          ))}
        </div>
      )}
    </div>
  );
}

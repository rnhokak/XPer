import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  CreditCard,
  Layers,
  PieChart,
  Sparkles,
} from "lucide-react";
import { CashflowRangeFilter } from "@/features/cashflow/components/CashflowRangeFilter";
import { ParentCategoryPieChart } from "./ParentCategoryPieChart";
import { CategoryTreeView } from "./CategoryTreeView";
import { getCategoryEmoji } from "@/lib/cashflow/categoryUtils";
import { cn } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer";
  parent_id: string | null;
  is_default?: boolean | null;
  category_focus: string | null;
};

type Transaction = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  currency: string;
  note: string | null;
  transaction_time: string;
  category_id?: string | null;
  category?: { id: string | null; name: string | null; type?: string } | null;
  account_id?: string | null;
  account?: { id: string | null; name: string | null; currency?: string | null } | null;
};

type CategoryWithChildren = Category & {
  children: CategoryWithChildren[];
  transactions: Transaction[];
  totalAmount: number;
};

type ProcessedData = {
  parentCategories: {
    id: string;
    name: string;
    type: "income" | "expense" | "transfer";
    totalAmount: number;
    childCategories: {
      id: string;
      name: string;
      totalAmount: number;
    }[];
  }[];
  categoryTree: CategoryWithChildren[];
};

function buildCategoryTree(categories: Category[], transactions: Transaction[]): ProcessedData {
  const categoryMap = new Map<string, CategoryWithChildren>();

  categories.forEach((category) => {
    categoryMap.set(category.id, {
      ...category,
      children: [],
      transactions: [],
      totalAmount: 0,
    });
  });

  transactions.forEach((transaction) => {
    const categoryId = transaction.category_id ?? transaction.category?.id;
    if (!categoryId) return;

    const category = categoryMap.get(categoryId);
    if (category) {
      category.transactions.push(transaction);
      category.totalAmount += transaction.amount;
    }
  });

  const rootCategories: CategoryWithChildren[] = [];
  categoryMap.forEach((category) => {
    if (category.parent_id && categoryMap.has(category.parent_id)) {
      const parent = categoryMap.get(category.parent_id);
      if (parent) {
        parent.children.push(category);
      }
    } else {
      rootCategories.push(category);
    }
  });

  const calculateTotalWithDescendants = (category: CategoryWithChildren): number => {
    const directAmount = category.totalAmount;
    const childrenAmount = category.children.reduce(
      (sum, child) => sum + calculateTotalWithDescendants(child),
      0
    );
    return directAmount + childrenAmount;
  };

  const updateCategoryTreeTotals = (category: CategoryWithChildren) => {
    category.totalAmount = calculateTotalWithDescendants(category);
    category.children.forEach(updateCategoryTreeTotals);
  };

  rootCategories.forEach(updateCategoryTreeTotals);

  const sortTreeByAmountDesc = (category: CategoryWithChildren) => {
    category.children.sort((a, b) => b.totalAmount - a.totalAmount);
    category.children.forEach(sortTreeByAmountDesc);
  };

  rootCategories.sort((a, b) => b.totalAmount - a.totalAmount);
  rootCategories.forEach(sortTreeByAmountDesc);

  const parentCategories = rootCategories.map((parent) => ({
    id: parent.id,
    name: parent.name,
    type: parent.type,
    totalAmount: parent.totalAmount,
    childCategories: parent.children
      .map((child) => ({
        id: child.id,
        name: child.name,
        totalAmount: child.totalAmount,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount),
  }));

  return {
    parentCategories,
    categoryTree: rootCategories,
  };
}

type Props = {
  transactions: Transaction[];
  categories: Category[];
  range: string;
  shift: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(value)));

export function TransactionByCategoryReport({ transactions, categories, range }: Props) {
  const [selectedType, setSelectedType] = useState<"expense" | "income" | "transfer">("expense");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Filter categories and transactions by selected type
  const typeTransactions = useMemo(
    () => transactions.filter((tx) => tx.type === selectedType),
    [transactions, selectedType]
  );

  const typeCategories = useMemo(
    () => categories.filter((c) => c.type === selectedType),
    [categories, selectedType]
  );

  const { parentCategories, categoryTree } = useMemo(() => {
    return buildCategoryTree(typeCategories, typeTransactions);
  }, [typeCategories, typeTransactions]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Financial KPIs
  const totalAmount = useMemo(
    () => typeTransactions.reduce((sum, tx) => sum + tx.amount, 0),
    [typeTransactions]
  );

  const transactionCount = typeTransactions.length;
  const averagePerTx = transactionCount > 0 ? totalAmount / transactionCount : 0;

  // Top category
  const topCategory = useMemo(() => {
    if (parentCategories.length === 0 || parentCategories[0].totalAmount <= 0) return null;
    const top = parentCategories[0];
    const percentage = totalAmount > 0 ? ((top.totalAmount / totalAmount) * 100).toFixed(1) : "0";
    return {
      ...top,
      percentage,
      emoji: getCategoryEmoji(top.name),
    };
  }, [parentCategories, totalAmount]);

  const activeCategoryCount = useMemo(
    () => parentCategories.filter((c) => c.totalAmount > 0).length,
    [parentCategories]
  );

  const themeConfig = {
    expense: {
      label: "Chi tiêu",
      badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
      activeTabColor: "bg-rose-600 text-white shadow-xs",
      kpiColor: "text-rose-600",
      icon: <ArrowDownRight className="h-4 w-4" />,
    },
    income: {
      label: "Thu nhập",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      activeTabColor: "bg-emerald-600 text-white shadow-xs",
      kpiColor: "text-emerald-600",
      icon: <ArrowUpRight className="h-4 w-4" />,
    },
    transfer: {
      label: "Chuyển khoản",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      activeTabColor: "bg-blue-600 text-white shadow-xs",
      kpiColor: "text-blue-600",
      icon: <ArrowLeftRight className="h-4 w-4" />,
    },
  }[selectedType];

  return (
    <div className="space-y-6">
      {/* Top Controls: Type Switcher & Range Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Type Switcher Tabs */}
        <div className="flex items-center rounded-2xl bg-slate-100 p-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setSelectedType("expense");
              setActiveCategoryId(null);
            }}
            className={cn(
              "flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-95",
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
            onClick={() => {
              setSelectedType("income");
              setActiveCategoryId(null);
            }}
            className={cn(
              "flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-95",
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
            onClick={() => {
              setSelectedType("transfer");
              setActiveCategoryId(null);
            }}
            className={cn(
              "flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-95",
              selectedType === "transfer"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>Chuyển khoản</span>
          </button>
        </div>

        {/* Range Period Filter */}
        <div className="flex items-center justify-end shrink-0">
          <CashflowRangeFilter value={range} />
        </div>
      </div>

      {/* Financial KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* KPI 1: Total Amount */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs sm:p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Tổng {themeConfig.label}</span>
            <div className={cn("rounded-lg p-1.5", themeConfig.badgeColor)}>
              {themeConfig.icon}
            </div>
          </div>
          <div className="mt-2">
            <p className={cn("text-lg sm:text-2xl font-black tracking-tight", themeConfig.kpiColor)}>
              {formatCurrency(totalAmount)}{" "}
              <span className="text-xs sm:text-sm font-semibold text-slate-500">₫</span>
            </p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Trong kỳ đã chọn</p>
          </div>
        </div>

        {/* KPI 2: Transaction Count */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs sm:p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Số giao dịch</span>
            <div className="rounded-lg bg-slate-100 p-1.5 text-slate-600">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
              {transactionCount}{" "}
              <span className="text-xs sm:text-sm font-medium text-slate-500">giao dịch</span>
            </p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              TB {formatCurrency(averagePerTx)} ₫/GD
            </p>
          </div>
        </div>

        {/* KPI 3: Top Category */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs sm:p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Danh mục lớn nhất</span>
            <div className="rounded-lg bg-amber-50 p-1.5 text-amber-600">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            {topCategory ? (
              <>
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-base sm:text-lg">{topCategory.emoji}</span>
                  <p className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    {topCategory.name}
                  </p>
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  {formatCurrency(topCategory.totalAmount)} ₫ ({topCategory.percentage}%)
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-400">Chưa có</p>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">0%</p>
              </>
            )}
          </div>
        </div>

        {/* KPI 4: Active Categories */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs sm:p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Danh mục phát sinh</span>
            <div className="rounded-lg bg-slate-100 p-1.5 text-slate-600">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
              {activeCategoryCount} / {typeCategories.length}
            </p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Danh mục đang sử dụng</p>
          </div>
        </div>
      </div>

      {/* Main Charts & Breakdown Section */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left Column: Donut Breakdown Chart */}
        <Card className="rounded-3xl border-slate-200/80 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                <PieChart className="h-4 w-4 text-emerald-600" />
                <span>Tỷ trọng danh mục ({themeConfig.label})</span>
              </CardTitle>
              {activeCategoryId && (
                <button
                  type="button"
                  onClick={() => setActiveCategoryId(null)}
                  className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                >
                  Bỏ lọc
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <ParentCategoryPieChart
              parentCategories={parentCategories}
              typeLabel={themeConfig.label}
              activeCategoryId={activeCategoryId}
              onSelectCategory={setActiveCategoryId}
            />
          </CardContent>
        </Card>

        {/* Right Column: Category Tree & Ranking */}
        <Card className="rounded-3xl border-slate-200/80 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                <BarChart3 className="h-4 w-4 text-emerald-600" />
                <span>Bảng xếp hạng & Phân cấp danh mục</span>
              </CardTitle>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {typeCategories.length} mục
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <CategoryTreeView
              categories={categoryTree}
              expandedCategories={expandedCategories}
              toggleCategory={toggleCategory}
              themeColor={selectedType === "expense" ? "rose" : selectedType === "income" ? "emerald" : "blue"}
              activeCategoryId={activeCategoryId}
              onSelectCategory={setActiveCategoryId}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronDown, PieChart } from "lucide-react";
import { CashflowRangeFilter } from "@/app/(protected)/cashflow/_components/CashflowRangeFilter";
import { ParentCategoryPieChart } from "./ParentCategoryPieChart";
import { CategoryTreeView } from "./CategoryTreeView";

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
  category_id: string | null;
  account_id: string | null;
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
  // Create a map of all categories
  const categoryMap = new Map<string, CategoryWithChildren>();

  // Initialize all categories with empty children and transactions
  categories.forEach(category => {
    categoryMap.set(category.id, {
      ...category,
      children: [],
      transactions: [],
      totalAmount: 0
    });
  });

  // Calculate transaction amounts per category
  transactions.forEach(transaction => {
    if (!transaction.category_id) return;

    const category = categoryMap.get(transaction.category_id);
    if (category) {
      category.transactions.push(transaction);
      category.totalAmount += transaction.amount;
    }
  });

  // Build parent-child relationships
  const rootCategories: CategoryWithChildren[] = [];
  categoryMap.forEach(category => {
    if (category.parent_id) {
      const parent = categoryMap.get(category.parent_id);
      if (parent) {
        parent.children.push(category);
      }
    } else {
      rootCategories.push(category);
    }
  });

  // Recursively calculate total amount including all descendants
  const calculateTotalWithDescendants = (category: CategoryWithChildren): number => {
    const directAmount = category.totalAmount;
    const childrenAmount = category.children.reduce(
      (sum, child) => sum + calculateTotalWithDescendants(child),
      0
    );
    return directAmount + childrenAmount;
  };

  // Recursively update all categories in the tree with their total amounts including descendants
  const updateCategoryTreeTotals = (category: CategoryWithChildren) => {
    category.totalAmount = calculateTotalWithDescendants(category);
    category.children.forEach(updateCategoryTreeTotals);
  };

  // Update all categories with their total amounts including descendants
  rootCategories.forEach(updateCategoryTreeTotals);

  // Calculate parent categories with their children
  const parentCategories = rootCategories.map(parent => ({
    id: parent.id,
    name: parent.name,
    type: parent.type,
    totalAmount: parent.totalAmount,
    childCategories: parent.children.map(child => ({
      id: child.id,
      name: child.name,
      totalAmount: child.totalAmount
    }))
  }));

  return {
    parentCategories,
    categoryTree: rootCategories
  };
}

type Props = {
  transactions: Transaction[];
  categories: Category[];
  range: string;
  shift: number;
};

export function TransactionByCategoryReport({ transactions, categories, range, shift }: Props) {
  const { parentCategories, categoryTree } = useMemo(() => {
    return buildCategoryTree(categories, transactions);
  }, [categories, transactions]);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <CashflowRangeFilter value={range} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Danh mục cha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ParentCategoryPieChart parentCategories={parentCategories} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cây danh mục</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryTreeView 
              categories={categoryTree} 
              expandedCategories={expandedCategories}
              toggleCategory={toggleCategory}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
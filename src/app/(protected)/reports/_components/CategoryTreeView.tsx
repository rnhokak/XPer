"use client";

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
  transactions: any[];
  totalAmount: number;
};

type Props = {
  categories: Category[];
  expandedCategories: Set<string>;
  toggleCategory: (categoryId: string) => void;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(value)));

function CategoryItem({ 
  category, 
  expandedCategories, 
  toggleCategory,
  level = 0
}: { 
  category: Category; 
  expandedCategories: Set<string>; 
  toggleCategory: (categoryId: string) => void;
  level?: number;
}) {
  const isExpanded = expandedCategories.has(category.id);
  const hasChildren = category.children && category.children.length > 0;
  
  return (
    <div className="w-full">
      <div 
        className={`flex items-center py-2 pl-${level * 4} pr-2 hover:bg-accent rounded-md transition-colors cursor-pointer`}
        onClick={() => hasChildren && toggleCategory(category.id)}
      >
        {hasChildren ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 mr-1"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <div className="w-6 h-6 mr-1 flex items-center justify-center" />
        )}
        
        <div className="flex-1 flex items-center justify-between">
          <span className="font-medium">{category.name}</span>
          <span className="text-sm font-medium text-muted-foreground">
            {formatCurrency(category.totalAmount)}
          </span>
        </div>
      </div>
      
      {isExpanded && hasChildren && (
        <div className="ml-2 border-l border-muted pl-2">
          {category.children.map(child => (
            <CategoryItem
              key={child.id}
              category={child}
              expandedCategories={expandedCategories}
              toggleCategory={toggleCategory}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryTreeView({ 
  categories, 
  expandedCategories, 
  toggleCategory 
}: Props) {
  if (categories.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">Không có danh mục nào để hiển thị</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {categories.map(category => (
        <CategoryItem
          key={category.id}
          category={category}
          expandedCategories={expandedCategories}
          toggleCategory={toggleCategory}
        />
      ))}
    </div>
  );
}
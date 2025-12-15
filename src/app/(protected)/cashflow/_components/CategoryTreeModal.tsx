"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Category = { id: string; name: string; parent_id: string | null };

type CategoryTreeModalProps = {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  selected: string | null;
  onSelect: (categoryId: string | null) => void;
  suggestedId: string | null;
  searchPlaceholder?: string;
};

export function CategoryTreeModal({
  open,
  onClose,
  categories,
  selected,
  onSelect,
  suggestedId,
  searchPlaceholder = "Search categories",
}: CategoryTreeModalProps) {
  const collator = useMemo(() => new Intl.Collator(undefined, { sensitivity: "base", numeric: true }), []);
  const [searchTerm, setSearchTerm] = useState("");

  const groupedByParent = useMemo(() => {
    const map = new Map<string | null, Category[]>();
    categories.forEach((category) => {
      const key = category.parent_id ?? null;
      const list = map.get(key);
      if (list) {
        list.push(category);
      } else {
        map.set(key, [category]);
      }
    });
    map.forEach((list) => list.sort((a, b) => collator.compare(a.name, b.name)));
    return map;
  }, [categories, collator]);

  const parentIdSet = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((category) => {
      if (category.parent_id) {
        set.add(category.parent_id);
      }
    });
    return set;
  }, [categories]);

  const categoryLookup = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((category) => map.set(category.id, category));
    return map;
  }, [categories]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleIds = useMemo(() => {
    if (!normalizedSearch) return null;
    const set = new Set<string>();
    categories.forEach((category) => {
      if (category.name.toLowerCase().includes(normalizedSearch)) {
        let current: Category | undefined | null = category;
        while (current) {
          set.add(current.id);
          current = current.parent_id ? categoryLookup.get(current.parent_id) ?? null : null;
        }
      }
    });
    return set;
  }, [categories, categoryLookup, normalizedSearch]);

  const rootCategories = groupedByParent.get(null) ?? [];
  const implicitRoots = useMemo(
    () => categories.filter((category) => !category.parent_id || !parentIdSet.has(category.parent_id)),
    [categories, parentIdSet]
  );
  const displayRoots = rootCategories.length
    ? rootCategories
    : implicitRoots.length
    ? implicitRoots
    : categories;

  const handleSelect = (categoryId: string) => {
    onSelect(categoryId);
    onClose();
  };

  const noMatches = Boolean(normalizedSearch && visibleIds && visibleIds.size === 0);

  const renderNodes = (nodes: Category[], depth = 0): JSX.Element[] => {
    const nodesToRender = visibleIds ? nodes.filter((category) => visibleIds.has(category.id)) : nodes;
    return nodesToRender.map((category) => {
      const children = groupedByParent.get(category.id) ?? [];
      const isActive = selected === category.id;
      const prefix = depth === 0 ? "" : `${"--".repeat(depth)} `;
      const indent = depth === 0 ? 0 : Math.min(depth, 3) * 12;
      return (
        <div key={category.id} className="space-y-1">
          <button
            type="button"
            onClick={() => handleSelect(category.id)}
            className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition duration-150 ${
              isActive
                ? "bg-foreground text-white border-foreground hover:border-foreground"
                : "border border-gray-200 bg-white text-foreground hover:border-primary/60"
            }`}
            style={indent ? { paddingLeft: `${12 + indent}px` } : undefined}
          >
            <span className="truncate">
              {prefix}
              {category.name}
            </span>
            {suggestedId === category.id && !isActive ? (
              <span className="text-[10px] uppercase tracking-wide text-primary">Suggested</span>
            ) : null}
          </button>
          {children.length ? renderNodes(children, depth + 1) : null}
        </div>
      );
    });
  };

  if (!categories.length) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <div className="mb-3">
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <DialogHeader>
          <DialogTitle>Chọn category</DialogTitle>
          <DialogDescription>Hiển thị cây category theo loại giao dịch</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-1 overflow-y-auto pt-1">
          {noMatches ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No categories match your search.</div>
          ) : (
            renderNodes(displayRoots)
          )}
        </div>
        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            onClick={() => {
              onSelect(null);
              onClose();
            }}
          >
            Clear selection
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

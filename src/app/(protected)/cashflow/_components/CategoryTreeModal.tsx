"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

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
  const [dialogMaxHeight, setDialogMaxHeight] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const max = Math.max(360, viewportHeight - 120);
      setDialogMaxHeight(max);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose();
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleSelectAndClose = (categoryId: string | null) => {
    onSelect(categoryId);
    onClose();
  };

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
            onClick={() => handleSelectAndClose(category.id)}
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
    <Dialog
      open={open}
      onOpenChange={handleDialogOpenChange}
    >
      <DialogContent className="sm:max-w-2xl gap-0 p-0 sm:p-6">
        <div className="flex h-full flex-col gap-3 sm:gap-4">
          <div className="border-b px-4 py-3 sm:border-none sm:px-0 sm:py-0">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base font-semibold sm:text-lg">Chọn category</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground sm:text-sm">
                Hiển thị cây category theo loại giao dịch
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-4 sm:px-0">
            {/* <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(event) => handleSearchChange(event.target.value)}
                className="h-10 rounded-xl border px-9 text-sm"
                inputMode="search"
              />
            </div> */}
          </div>
          <div
            className="space-y-1 overflow-y-auto px-4 pb-4 pt-1 sm:px-0"
            style={dialogMaxHeight ? { maxHeight: dialogMaxHeight } : undefined}
          >
            {noMatches ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No categories match your search.</div>
            ) : (
              renderNodes(displayRoots)
            )}
          </div>
          <DialogFooter className="flex flex-row gap-3 border-t px-4 py-3 sm:border-none sm:px-0 sm:py-0">
            <div className="flex flex-1 flex-row gap-3 sm:flex-initial">
              <Button
                variant="outline"
                onClick={() => handleSelectAndClose(null)}
                className="flex-1"
              >
                Clear selection
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  searchInputRef.current?.blur();
                  onClose();
                }}
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

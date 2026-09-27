import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronRight, FolderTree, Search, Sparkles, X } from "lucide-react";
import { getCategoryEmoji } from "@/lib/cashflow/categoryUtils";
import { cn } from "@/lib/utils";

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
  searchPlaceholder = "Tìm kiếm danh mục...",
}: CategoryTreeModalProps) {
  const collator = useMemo(() => new Intl.Collator("vi-VN", { sensitivity: "base", numeric: true }), []);
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);



  // Reset search when modal closes
  useEffect(() => {
    if (!open) {
      setSearchTerm("");
    }
  }, [open]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose();
    }
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
      const hasChildren = children.length > 0;
      const isActive = selected === category.id;
      const isSuggested = suggestedId === category.id && !isActive;
      const emoji = getCategoryEmoji(category.name);

      return (
        <div key={category.id} className="space-y-1.5">
          <button
            type="button"
            onClick={() => handleSelectAndClose(category.id)}
            className={cn(
              "group flex w-full items-center justify-between gap-2.5 rounded-xl border p-2.5 text-left text-xs sm:text-sm font-medium transition-all duration-150 active:scale-[0.99]",
              isActive
                ? "border-emerald-500 bg-emerald-50/90 text-emerald-950 font-semibold shadow-2xs ring-2 ring-emerald-500/25"
                : isSuggested
                  ? "border-amber-300 bg-amber-50/70 text-amber-900 hover:bg-amber-100/70"
                  : depth === 0
                    ? "border-slate-200/90 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                    : "border-slate-150 bg-slate-50/80 text-slate-700 hover:border-slate-300 hover:bg-slate-100/70"
            )}
            style={depth > 0 ? { marginLeft: `${Math.min(depth, 3) * 16}px`, width: `calc(100% - ${Math.min(depth, 3) * 16}px)` } : undefined}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="text-base sm:text-lg shrink-0 flex items-center justify-center w-6 h-6">{emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate">
                  {depth > 0 && (
                    <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />
                  )}
                  <span className="truncate">{category.name}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {isSuggested && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 uppercase tracking-wide">
                  <Sparkles className="h-2.5 w-2.5" />
                  Gợi ý
                </span>
              )}
              {hasChildren && depth === 0 && (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                  {children.length} mục con
                </span>
              )}
              {isActive && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs">
                  <Check className="h-3 w-3 stroke-[2.5]" />
                </div>
              )}
            </div>
          </button>

          {children.length > 0 && (
            <div className="space-y-1.5 pl-1.5 border-l-2 border-slate-100 ml-3.5 my-1">
              {renderNodes(children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  if (!categories.length) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => {
          // CRITICAL: Prevent auto-focusing on the search input to avoid opening mobile keyboard automatically!
          e.preventDefault();
        }}
        className="w-[calc(100%-2rem)] max-w-lg rounded-2xl gap-0 p-0 overflow-hidden sm:max-w-xl max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] sm:max-h-[85vh] flex flex-col"
      >
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          {/* Header */}
          <div className="border-b border-slate-100 px-4 py-3.5 sm:px-5">
            <DialogHeader className="space-y-1 text-left">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2 text-base font-bold sm:text-lg text-slate-900">
                  <FolderTree className="h-4.5 w-4.5 text-emerald-600" />
                  <span>Chọn danh mục</span>
                </DialogTitle>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {categories.length} danh mục
                </span>
              </div>
              <DialogDescription className="text-xs text-slate-500">
                Chạm để chọn danh mục tương ứng cho giao dịch
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Search Box - strictly no autoFocus */}
          <div className="border-b border-slate-100 bg-slate-50/60 p-3 sm:px-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                ref={searchInputRef}
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-9.5 rounded-xl border-slate-200 bg-white pl-9 pr-8 text-xs sm:text-sm focus-visible:ring-emerald-500/20"
                inputMode="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-2.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Category Tree Scroll Area */}
          <div className="flex-1 min-h-0 space-y-2 overflow-y-auto p-3.5 sm:p-5 overscroll-contain">
            {noMatches ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span className="text-3xl mb-2">🔍</span>
                <p className="text-sm font-semibold text-slate-800">Không tìm thấy danh mục</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Không có danh mục nào khớp với từ khóa "{searchTerm}"
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchTerm("")}
                  className="mt-3 h-8 rounded-lg text-xs"
                >
                  Xóa tìm kiếm
                </Button>
              </div>
            ) : (
              renderNodes(displayRoots)
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 sm:px-5">
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400 truncate">
                {selected ? "Đã chọn 1 danh mục" : "Vui lòng chọn 1 danh mục"}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  searchInputRef.current?.blur();
                  onClose();
                }}
                className="h-8.5 rounded-xl border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

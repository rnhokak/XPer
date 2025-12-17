"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Search } from "lucide-react";
import {
  categorySchema,
  categoryTypes,
  categoryGroups,
  categoryGroupLabels,
  categoryFocuses,
  categoryFocusLabels,
  type CategoryInput,
  type CategoryGroup,
  type CategoryFocus,
} from "@/lib/validation/categories";

type Category = {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer";
  parent_id: string | null;
  level: 0 | 1 | 2;
  category_group: CategoryGroup | null;
  category_focus: CategoryFocus | null;
};

const EMPTY_GROUP = "__none__";
const EMPTY_FOCUS = "__none_focus__";

type CategoryMeta = {
  type: CategoryInput["type"];
  category_group: CategoryGroup | null;
  category_focus: CategoryFocus | null;
};

const categoryTypeLabels: Record<CategoryInput["type"], string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
};

const initialCategoryMeta: CategoryMeta = {
  type: "expense",
  category_group: "sinh_hoat",
  category_focus: "co_ban",
};

export function CategoriesManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Category | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [preferredCategoryMeta, setPreferredCategoryMeta] = useState<CategoryMeta>(initialCategoryMeta);
  const [parentSearch, setParentSearch] = useState("");
  const [parentPickerOpen, setParentPickerOpen] = useState(false);
  const parentPickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const parentPickerPanelRef = useRef<HTMLDivElement | null>(null);

  const form = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      type: initialCategoryMeta.type,
      parent_id: null,
      level: 0,
      category_group: initialCategoryMeta.category_group,
      category_focus: initialCategoryMeta.category_focus,
    },
  });

  const selectedType = form.watch("type") ?? "expense";
  const parentId = form.watch("parent_id");
  const parentChoices = useMemo(() => {
    if (selectedType === "transfer") return [];
    return categories.filter((c) => c.type === selectedType && c.level <= 1);
  }, [categories, selectedType]);
  const parentChildrenMap = useMemo(() => {
    const map = new Map<string | null, Category[]>();
    const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
    parentChoices.forEach((category) => {
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
  }, [parentChoices]);
  const visibleParentIds = useMemo(() => {
    const query = parentSearch.trim().toLowerCase();
    if (!query) return null;
    const matches = new Set<string>();
    const visit = (node: Category): boolean => {
      const children = parentChildrenMap.get(node.id) ?? [];
      const childMatch = children.some((child) => visit(child));
      const selfMatch = node.name.toLowerCase().includes(query);
      if (selfMatch || childMatch) {
        matches.add(node.id);
        return true;
      }
      return false;
    };
    (parentChildrenMap.get(null) ?? []).forEach((root) => visit(root));
    return matches;
  }, [parentChildrenMap, parentSearch]);

  const categoryLookup = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((category) => map.set(category.id, category));
    return map;
  }, [categories]);

  const rootCategory = useMemo(() => {
    if (!parentId) return null;
    let current = categoryLookup.get(parentId) ?? null;
    while (current?.parent_id) {
      const next = categoryLookup.get(current.parent_id);
      if (!next) break;
      current = next;
    }
    return current;
  }, [parentId, categoryLookup]);

  const metadataEditable = !parentId;
  const metadataOriginLabel = parentId
    ? rootCategory?.name ?? categoryLookup.get(parentId)?.name ?? "parent"
    : null;

  const groupedCategories = useMemo(() => {
    const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
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
  }, [categories]);

  const rootCategories = groupedCategories.get(null) ?? [];

  const renderEntry = (category: Category, depth: number) => {
    const prefix = depth === 0 ? "" : `${"--".repeat(depth)} `;
    const indentClass = depth === 0 ? "" : depth === 1 ? "pl-4" : "pl-8";
    const parentName = category.parent_id ? categoryLookup.get(category.parent_id)?.name : null;
    const entryClasses = [
      "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition",
      depth === 0 ? "border bg-white hover:border-primary/40" : "border border-transparent bg-muted/40 text-sm hover:border-primary/40",
      indentClass,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => startEdit(category)}
        onKeyDown={(event) => event.key === "Enter" && startEdit(category)}
        className={entryClasses}
      >
        <div className="min-w-0">
          <p className={depth === 0 ? "text-base font-semibold" : "text-sm font-semibold"}>
            {prefix}
            {category.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {categoryTypeLabels[category.type]} ·{" "}
            {category.category_group ? categoryGroupLabels[category.category_group] : "Không phân loại"} ·{" "}
            {category.category_focus ? categoryFocusLabels[category.category_focus] : "Không phân loại"} · level {category.level}
            {parentName ? ` · parent: ${parentName}` : ""}
          </p>
        </div>
      </div>
    );
  };

  const renderChildren = (parentId: string, depth: number): JSX.Element | null => {
    const children = groupedCategories.get(parentId) ?? [];
    if (!children.length) return null;
    return (
      <div className="mt-2 space-y-1">
        {children.map((child) => (
          <div key={child.id} className="space-y-1">
            {renderEntry(child, depth)}
            {renderChildren(child.id, depth + 1)}
          </div>
        ))}
      </div>
    );
  };

  useEffect(() => {
    if (selectedType === "transfer") {
      if (form.getValues("parent_id") !== null) {
        form.setValue("parent_id", null);
      }
      if (form.getValues("level") !== 0) {
        form.setValue("level", 0);
      }
      if (parentPickerOpen) {
        setParentPickerOpen(false);
      }
    }
  }, [selectedType, form, parentPickerOpen]);
  useEffect(() => {
    setParentSearch("");
    setParentPickerOpen(false);
  }, [selectedType, modalOpen]);
  useEffect(() => {
    if (!parentPickerOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setParentPickerOpen(false);
      }
    };
    const handleClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (parentPickerTriggerRef.current?.contains(target)) return;
      if (parentPickerPanelRef.current?.contains(target)) return;
      setParentPickerOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [parentPickerOpen]);

  const resetForm = (meta?: CategoryMeta) => {
    const target = meta ?? preferredCategoryMeta;
    form.reset({
      name: "",
      type: target.type,
      parent_id: null,
      level: 0,
      category_group: target.category_group,
      category_focus: target.category_focus,
    });
    setEditing(null);
    setSubmitError(null);
  };
  const closeModal = () => {
    resetForm();
  };

  const categoriesByType = useMemo(() => {
    const map: Record<Category["type"], Category[]> = {
      expense: [],
      income: [],
      transfer: [],
    };
    categories.forEach((category) => {
      map[category.type].push(category);
    });
    return map;
  }, [categories]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setModalOpen(true);
      return;
    }
    closeModal();
    setModalOpen(false);
  };

  const openModalForType = (type: Category["type"]) => {
    const meta: CategoryMeta = {
      type,
      category_group: preferredCategoryMeta.category_group,
      category_focus: preferredCategoryMeta.category_focus,
    };
    resetForm(meta);
    setModalOpen(true);
  };

  const upsert = async (values: CategoryInput) => {
    setSubmitError(null);
    const payload = { ...values, parent_id: values.parent_id || null };
    // Ensure level is consistent before sending
    if (payload.parent_id) {
      const parent = categories.find((c) => c.id === payload.parent_id);
      payload.level = parent ? ((parent.level + 1) as 0 | 1 | 2) : 0;
      payload.type = parent?.type ?? payload.type;
    } else {
      payload.level = 0;
    }
    const res = await fetch("/api/cashflow/categories", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSubmitError(err.error ?? "Failed to save category");
      return;
    }
    const nextMeta: CategoryMeta = {
      type: values.type,
      category_group: values.category_group ?? null,
      category_focus: values.category_focus ?? null,
    };
    setPreferredCategoryMeta(nextMeta);
    resetForm(nextMeta);
    setModalOpen(false);
    router.refresh();
  };

  const remove = async (id: string) => {
    setSubmitError(null);
    const res = await fetch("/api/cashflow/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSubmitError(err.error ?? "Failed to delete");
      return;
    }
    if (editing?.id === id) resetForm();
    router.refresh();
  };

  const startEdit = (cat: Category) => {
    setEditing(cat);
    form.reset({
      name: cat.name,
      type: cat.type,
      parent_id: cat.parent_id,
      level: cat.level,
      category_group: cat.category_group,
      category_focus: cat.category_focus,
    });
    setModalOpen(true);
  };

  useEffect(() => {
    if (selectedType === "transfer") {
      if (form.getValues("level") !== 0) {
        form.setValue("level", 0);
      }
      return;
    }

    if (!parentId) {
      if (form.getValues("level") !== 0) {
        form.setValue("level", 0);
      }
      const preferredGroup = preferredCategoryMeta.category_group ?? null;
      const preferredFocus = preferredCategoryMeta.category_focus ?? null;
      if (form.getValues("category_group") !== preferredGroup) {
        form.setValue("category_group", preferredGroup);
      }
      if (form.getValues("category_focus") !== preferredFocus) {
        form.setValue("category_focus", preferredFocus);
      }
      return;
    }

    const parent = categoryLookup.get(parentId);
    if (parent) {
      const targetLevel = (parent.level + 1) as 0 | 1 | 2;
      if (form.getValues("level") !== targetLevel) {
        form.setValue("level", targetLevel);
      }
      if (form.getValues("type") !== parent.type) {
        form.setValue("type", parent.type);
      }
    }

    const rootMeta = rootCategory ?? parent;
    const inheritedGroup = rootMeta?.category_group ?? null;
    const inheritedFocus = rootMeta?.category_focus ?? null;
    if (form.getValues("category_group") !== inheritedGroup) {
      form.setValue("category_group", inheritedGroup);
    }
    if (form.getValues("category_focus") !== inheritedFocus) {
      form.setValue("category_focus", inheritedFocus);
    }
  }, [parentId, categoryLookup, form, preferredCategoryMeta, rootCategory, selectedType]);

  return (
    <>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Categories</p>
            <p className="text-sm text-muted-foreground">Manage income, expense, and transfer hierarchies.</p>
          </div>
          <div className="flex flex-wrap gap-2">
             <Button  size="sm" variant="outline" onClick={() => openModalForType('expense')}>
                Add Category 
              </Button>
          </div>
        </div>

        <div className="space-y-5">
          {categoryTypes.map((type) => {
            const roots = rootCategories.filter((root) => root.type === type);
            return (
              <section key={type} className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{categoryTypeLabels[type]}</p>
                    <p className="text-xs text-muted-foreground">{categoriesByType[type].length} total</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openModalForType(type)}>
                    Add {categoryTypeLabels[type]} category
                  </Button>
                </div>
                {roots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No {categoryTypeLabels[type]} categories yet.</p>
                ) : (
                  <div className="space-y-3">
                    {roots.map((root) => (
                      <div key={root.id} className="space-y-2">
                        {renderEntry(root, 0)}
                        {renderChildren(root.id, 1)}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="w-full max-w-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
            <DialogDescription>Type, metadata, and positioning are enforced hierarchically.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(upsert)}>
              <div className="grid gap-3 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categoryTypes.map((value) => (
                            <SelectItem key={value} value={value}>
                              {categoryTypeLabels[value]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage>{form.formState.errors.type?.message}</FormMessage>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category_group"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group</FormLabel>
                      <Select
                        value={field.value ?? EMPTY_GROUP}
                        onValueChange={(v) => metadataEditable && field.onChange(v === EMPTY_GROUP ? null : v)}
                        disabled={!metadataEditable}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={EMPTY_GROUP}>Không phân loại</SelectItem>
                          {categoryGroups.map((value) => (
                            <SelectItem key={value} value={value}>
                              {categoryGroupLabels[value]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!metadataEditable ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Inherited from {metadataOriginLabel ?? "parent"}.
                        </p>
                      ) : null}
                      <FormMessage>{form.formState.errors.category_group?.message}</FormMessage>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category_focus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Định hướng</FormLabel>
                      <Select
                        value={field.value ?? EMPTY_FOCUS}
                        onValueChange={(v) => metadataEditable && field.onChange(v === EMPTY_FOCUS ? null : v)}
                        disabled={!metadataEditable}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={EMPTY_FOCUS}>Không phân loại</SelectItem>
                          {categoryFocuses.map((value) => (
                            <SelectItem key={value} value={value}>
                              {categoryFocusLabels[value]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!metadataEditable ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Inherited from {metadataOriginLabel ?? "parent"}.
                        </p>
                      ) : null}
                      <FormMessage>{form.formState.errors.category_focus?.message}</FormMessage>
                    </FormItem>
                  )}
                />
              </div>
              <FormItem>
                <FormLabel>Computed level</FormLabel>
                <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Level {form.watch("level")} (auto from parent)
                </div>
              </FormItem>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage>{form.formState.errors.name?.message}</FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parent_id"
                render={({ field }) => {
                  const isTransfer = selectedType === "transfer";
                  const hasParentOptions = parentChoices.length > 0;
                  const hasSearchMatches = visibleParentIds
                    ? parentChoices.some((choice) => visibleParentIds.has(choice.id))
                    : hasParentOptions;
                  const renderParentTree = (targetParentId: string | null, depth = 0): JSX.Element[] => {
                    const children = parentChildrenMap.get(targetParentId) ?? [];
                    return children
                      .map((child) => {
                        if (visibleParentIds && !visibleParentIds.has(child.id)) {
                          return null;
                        }
                        const isActive = field.value === child.id;
                        const padding = depth === 0 ? "" : depth === 1 ? "pl-4" : "pl-6";
                        return (
                          <div key={child.id} className={`space-y-1 ${padding}`}>
                            <button
                              type="button"
                              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                                isActive
                                  ? "border-foreground bg-foreground text-white"
                                  : "border border-gray-200 bg-white text-foreground hover:border-primary/60"
                              }`}
                              onClick={() => {
                                field.onChange(child.id);
                                setParentPickerOpen(false);
                              }}
                            >
                              <span className="truncate font-medium">{child.name}</span>
                              <span className="text-xs text-muted-foreground">Level {child.level}</span>
                            </button>
                            {renderParentTree(child.id, depth + 1)}
                          </div>
                        );
                      })
                      .filter(Boolean);
                  };
                  const parentLabel = field.value ? categoryLookup.get(field.value)?.name ?? "Unknown parent" : "No parent (root)";
                  return (
                    <FormItem>
                      <FormLabel>Parent</FormLabel>
                      {isTransfer ? (
                        <div className="rounded-md border border-dashed border-primary/60 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
                          Transfer categories must stay at level 0 and cannot have parents.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="relative">
                            <button
                              ref={parentPickerTriggerRef}
                              type="button"
                              className="flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2 text-left text-sm transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              onClick={() => setParentPickerOpen((prev) => !prev)}
                            >
                              <div className="min-w-0">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                  {hasParentOptions ? "Choose parent" : "No parent options"}
                                </p>
                                <p className="truncate font-medium text-foreground">{parentLabel}</p>
                              </div>
                              <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${parentPickerOpen ? "rotate-180" : ""}`} />
                            </button>
                            {parentPickerOpen ? (
                              <>
                                <div className="fixed inset-0 z-40" aria-hidden onClick={() => setParentPickerOpen(false)} />
                                <div
                                  ref={parentPickerPanelRef}
                                  className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-full rounded-2xl border bg-white p-4 text-sm shadow-2xl sm:w-[min(380px,calc(100vw-2rem))]"
                                >
                                  <div className="space-y-3">
                                    <div className="relative">
                                      <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                      <Input
                                        value={parentSearch}
                                        onChange={(event) => setParentSearch(event.target.value)}
                                        placeholder="Search parent..."
                                        className="h-9 pl-8 text-sm"
                                        autoFocus
                                      />
                                    </div>
                                    <div className="rounded-lg border">
                                      <button
                                        type="button"
                                        className={`flex w-full items-center justify-between rounded-t-lg px-3 py-2 text-left text-sm font-medium transition ${
                                          field.value === null ? "bg-foreground text-white" : "hover:bg-muted"
                                        }`}
                                        onClick={() => {
                                          field.onChange(null);
                                          setParentPickerOpen(false);
                                        }}
                                      >
                                        <span>No parent (root)</span>
                                        {field.value === null ? <span className="text-xs font-semibold">✓</span> : null}
                                      </button>
                                      <div className="max-h-64 space-y-1 overflow-y-auto p-2">
                                        {!hasParentOptions ? (
                                          <p className="px-2 py-4 text-sm text-muted-foreground">No available parents.</p>
                                        ) : visibleParentIds && !hasSearchMatches ? (
                                          <p className="px-2 py-4 text-sm text-muted-foreground">No matches found.</p>
                                        ) : (
                                          renderParentTree(null, 0)
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">Tap outside or press Esc to close.</p>
                                  </div>
                                </div>
                              </>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-muted-foreground">Parents limited to level 1 for nesting.</p>
                        </div>
                      )}
                      <FormMessage>{form.formState.errors.parent_id?.message}</FormMessage>
                    </FormItem>
                  );
                }}
              />

              {submitError ? <p className="text-sm text-red-500">{submitError}</p> : null}
              <div className="flex items-center justify-between gap-3">
                <Button variant="ghost" type="button" onClick={() => { closeModal(); setModalOpen(false); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Saving..." : editing ? "Update category" : "Add category"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

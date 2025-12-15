"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { categorySchema, type CategoryInput } from "@/lib/validation/categories";

type Category = { id: string; name: string; type: "income" | "expense"; parent_id: string | null; level: 0 | 1 | 2 };

export function CategoriesManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Category | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const form = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", type: "expense", parent_id: null, level: 0 },
  });

  const parentChoices = useMemo(() => {
    const type = form.watch("type") ?? "expense";
    return categories.filter((c) => c.type === type && c.level <= 1);
  }, [categories, form]);

  const categoryLookup = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((category) => map.set(category.id, category));
    return map;
  }, [categories]);

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
            {category.type} · level {category.level}
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
    setMounted(true);
  }, []);

  const resetForm = () => {
    form.reset({ name: "", type: "expense", parent_id: null, level: 0 });
    setEditing(null);
    setSubmitError(null);
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
    resetForm();
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
    });
  };

  // When parent changes, auto-adjust level to parent level + 1 (or reset when cleared)
  const parentId = form.watch("parent_id");
  useEffect(() => {
    if (!parentId) {
      if (form.getValues("level") !== 0) {
        form.setValue("level", 0);
      }
      return;
    }
    const parent = categories.find((c) => c.id === parentId);
    if (parent) {
      const targetLevel = (parent.level + 1) as 0 | 1 | 2;
      if (form.getValues("level") !== targetLevel) {
        form.setValue("level", targetLevel);
      }
      // Ensure type matches parent
      if (form.getValues("type") !== parent.type) {
        form.setValue("type", parent.type);
      }
    }
  }, [parentId, categories, form]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
      {!mounted ? (
        <div className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
        </div>
      ) : (
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground/70">{editing ? "Edit category" : "New category"}</p>
            <p className="text-sm text-muted-foreground">Type + level + name; parent required for level 1/2.</p>
          </div>
          {editing ? (
            <Button variant="ghost" size="sm" onClick={resetForm}>
              Cancel
            </Button>
          ) : null}
        </div>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(upsert)}>
            <div className="grid gap-3 sm:grid-cols-2">
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
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage>{form.formState.errors.type?.message}</FormMessage>
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Computed level</FormLabel>
                <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Level {form.watch("level")} (auto from parent)
                </div>
              </FormItem>
            </div>

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
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent</FormLabel>
                  <Select value={field.value ?? "__root__"} onValueChange={(v) => field.onChange(v === "__root__" ? null : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__root__">No parent (root)</SelectItem>
                      {parentChoices.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} (level {p.level})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage>{form.formState.errors.parent_id?.message}</FormMessage>
                </FormItem>
              )}
            />

            {submitError ? <p className="text-sm text-red-500">{submitError}</p> : null}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : editing ? "Update category" : "Add category"}
            </Button>
          </form>
        </Form>
      </div>
      )}

      <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Categories (hierarchical)</p>
          <span className="text-xs text-muted-foreground">{categories.length} total</span>
        </div>
        <div className="space-y-2">
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          ) : (
            <div className="space-y-3">
              {rootCategories.map((root) => (
                <div key={root.id} className="space-y-2">
                  {renderEntry(root, 0)}
                  {renderChildren(root.id, 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

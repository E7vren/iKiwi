"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Category } from "@prisma/client";
import { Edit2, Loader2, PackagePlus, Plus, Tag, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  createCategorySchema,
  type CreateCategoryInput,
} from "@/lib/validations/category.schema";
import {
  createCategory,
  deleteCategory,
  getAllCategories,
  toggleCategoryActive,
  updateCategory,
} from "@/server/actions/categories";

type CategoryWithCount = Category & { _count: { products: number } };

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function CategoryForm({
  initial,
  onClose,
}: {
  initial?: CategoryWithCount;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!initial;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<any>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: initial
      ? {
          nameEn: initial.nameEn,
          nameUz: initial.nameUz,
          nameRu: initial.nameRu ?? "",
          slug: initial.slug,
          icon: initial.icon ?? "",
          sortOrder: initial.sortOrder,
        }
      : { nameEn: "", nameUz: "", nameRu: "", slug: "", icon: "", sortOrder: 0 },
  });

  const { register, handleSubmit, setValue, control, formState: { errors, isSubmitting }, reset } = form;

  // Auto-generate slug from English name (only when creating, not editing)
  const nameEn = useWatch({ control, name: "nameEn" });
  useEffect(() => {
    if (!isEdit && nameEn) {
      setValue("slug", slugify(nameEn), { shouldValidate: false });
    }
  }, [nameEn, isEdit, setValue]);

  async function onSubmit(data: CreateCategoryInput) {
    try {
      if (isEdit) {
        await updateCategory({ id: initial.id, ...data });
      } else {
        await createCategory(data);
      }
      toast.success(isEdit ? "Category updated" : "Category added");
      qc.invalidateQueries({ queryKey: ["categories"] });
      reset();
      onClose();
    } catch {
      toast.error("Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Icon (emoji)</Label>
          <Input {...register("icon")} placeholder="🥦" className="text-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>Sort order</Label>
          <Input
            type="number"
            min={0}
            {...register("sortOrder", { valueAsNumber: true })}
            placeholder="0"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Name in English *</Label>
        <Input {...register("nameEn")} placeholder="Vegetables" />
        {errors.nameEn && (
          <p className="text-xs text-destructive">{String(errors.nameEn.message ?? "")}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Name in Uzbek *</Label>
        <Input {...register("nameUz")} placeholder="SABZAVOTLAR" />
        {errors.nameUz && (
          <p className="text-xs text-destructive">{String(errors.nameUz.message ?? "")}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Name in Russian</Label>
        <Input {...register("nameRu")} placeholder="Овощи" />
      </div>

      <div className="space-y-1.5">
        <Label>
          URL slug *
          {!isEdit && (
            <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">
              auto-generated from EN name
            </span>
          )}
        </Label>
        <Input {...register("slug")} placeholder="vegetables" />
        {errors.slug && (
          <p className="text-xs text-destructive">{String(errors.slug.message ?? "")}</p>
        )}
      </div>

      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEdit ? "Save changes" : "Save Category"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function CategoriesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryWithCount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryWithCount | null>(null);

  const { data: categories = [], isLoading } = useQuery<CategoryWithCount[]>({
    queryKey: ["categories"],
    queryFn: () => getAllCategories() as unknown as Promise<CategoryWithCount[]>,
  });

  const toggleMutation = useMutation({
    mutationFn: toggleCategoryActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Category deleted");
        qc.invalidateQueries({ queryKey: ["categories"] });
      } else {
        toast.error(result.error);
      }
      setDeleteTarget(null);
    },
  });

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(cat: CategoryWithCount) {
    setEditing(cat);
    setDialogOpen(true);
  }

  const hasProducts = (deleteTarget?._count.products ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-headline-lg">Categories</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage product categories shown in the shop catalog
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Category
        </Button>
      </div>

      {/* Table or loading or empty */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl border bg-card">
          <div className="text-5xl mb-4">🏷️</div>
          <p className="text-lg font-semibold text-foreground">No categories yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            Create your first category to organize products
          </p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Category
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">Icon</TableHead>
                <TableHead>Name (EN)</TableHead>
                <TableHead className="hidden sm:table-cell">Name (UZ)</TableHead>
                <TableHead className="hidden md:table-cell">Slug</TableHead>
                <TableHead className="text-center">Products</TableHead>
                <TableHead className="w-8 text-center">Sort</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="text-center text-2xl">{cat.icon ?? <Tag className="h-4 w-4 mx-auto text-muted-foreground" />}</TableCell>
                  <TableCell className="font-medium">{cat.nameEn}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{cat.nameUz}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <code className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{cat.slug}</code>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="tabular-nums">
                      {cat._count.products}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground text-sm">
                    {cat.sortOrder}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={cat.isActive ? "default" : "outline"}
                      className={cat.isActive ? "bg-green-500 hover:bg-green-500" : "text-muted-foreground"}
                    >
                      {cat.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5 justify-end">
                      <Link
                        href={`/admin/products?add=1&categoryId=${cat.id}`}
                        title="Add product in this category"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                      >
                        <PackagePlus className="h-4 w-4" />
                      </Link>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title={cat.isActive ? "Deactivate" : "Activate"}
                        onClick={() => toggleMutation.mutate(cat.id)}
                        disabled={toggleMutation.isPending}
                      >
                        {cat.isActive ? (
                          <ToggleRight className="h-4 w-4 text-primary" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => openEdit(cat)}
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(cat)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Category" : "Add New Category"}</DialogTitle>
          </DialogHeader>
          <CategoryForm
            key={editing?.id ?? "new"}
            initial={editing ?? undefined}
            onClose={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {hasProducts
                ? "Cannot delete this category"
                : `Delete "${deleteTarget?.nameEn}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {hasProducts ? (
                <div className="space-y-2">
                  <p className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-lg px-3 py-2.5 text-sm">
                    ⚠️ This category has{" "}
                    <strong>{deleteTarget?._count.products} products</strong>.
                    Reassign them to another category first, or delete them.
                  </p>
                </div>
              ) : (
                <span>This action cannot be undone.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {hasProducts ? (
              <AlertDialogAction onClick={() => setDeleteTarget(null)}>
                OK, got it
              </AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90 text-white"
                  onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Delete
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

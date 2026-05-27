"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Category } from "@prisma/client";
import {
  ArrowUpDown, ChevronDown, ChevronUp, DollarSign, Edit2, ExternalLink,
  ImagePlus, Loader2, Package, Plus, Search, ShoppingCart, Trash2, ToggleLeft, ToggleRight, Upload, X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { PriceGrid } from "@/components/admin/PriceGrid";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from "@/lib/validations/product.schema";
import type { ImportMode } from "@/lib/validations/import.schema";
import { cn, getCategoryName } from "@/lib/utils";
import { useLocaleStore } from "@/store/localeStore";
import { getAllCategories } from "@/server/actions/categories";
import { bulkImport } from "@/server/actions/import";
import {
  createProduct,
  deleteProduct,
  getAllProducts,
  toggleProductAvailability,
  updateProduct,
} from "@/server/actions/products";

type ProductRow = Awaited<ReturnType<typeof getAllProducts>>[number];
type CategoryRow = Category & { _count: { products: number } };

const PAGE_SIZE = 25;
type SortCol = "name" | "category" | "price";

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol | null; sortDir: "asc" | "desc" }) {
  if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40 inline" />;
  return sortDir === "asc"
    ? <ChevronUp className="h-3 w-3 ml-1 inline" />
    : <ChevronDown className="h-3 w-3 ml-1 inline" />;
}

// ─── Form ────────────────────────────────────────────────────────────────────

function ProductForm({
  initial,
  categories,
  defaultCategoryId,
  onClose,
}: {
  initial?: ProductRow;
  categories: CategoryRow[];
  defaultCategoryId?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!initial;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<any>({
    resolver: zodResolver(isEdit ? updateProductSchema : createProductSchema),
    defaultValues: initial
      ? {
          id:          initial.id,
          name:        initial.name,
          nameUz:      initial.nameUz ?? "",
          nameRu:      initial.nameRu ?? "",
          categoryId:  initial.categoryId,
          unitType:    initial.unitType,
          imageUrl:    initial.imageUrl ?? "",
          isAvailable: initial.isAvailable,
        }
      : { unitType: "KG", isAvailable: true, categoryId: defaultCategoryId ?? "" },
  });

  const locale = useLocaleStore((s) => s.locale);
  const [imagePreview, setImagePreview] = useState<string>(initial?.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const {
    register, handleSubmit, setValue, control,
    formState: { errors, isSubmitting },
  } = form;

  const unitType   = useWatch({ control, name: "unitType" });
  const categoryId = useWatch({ control, name: "categoryId" });
  const showKg    = !unitType || unitType === "KG"    || unitType === "BOTH";
  const showPiece = unitType === "PIECE" || unitType === "BOTH";

  async function onSubmit(data: CreateProductInput | UpdateProductInput) {
    try {
      if (isEdit) {
        const result = await updateProduct(data as UpdateProductInput);
        if (!result.success) { toast.error(result.error); return; }
        toast.success("Product updated");
      } else {
        const result = await createProduct(data as CreateProductInput);
        if (!result.success) { toast.error(result.error); return; }
        toast.success("Product added");
      }
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      onClose();
    } catch {
      toast.error("Something went wrong");
    }
  }

  function err(field: string) {
    const e = errors[field];
    return e ? <p className="text-xs text-destructive mt-0.5">{String((e as { message?: string }).message ?? "")}</p> : null;
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok) {
        setValue("imageUrl", json.url);
        setImagePreview(json.url);
      } else {
        toast.error(json.error ?? "Upload failed");
        setImagePreview(initial?.imageUrl ?? "");
      }
    } catch {
      toast.error("Upload failed");
      setImagePreview(initial?.imageUrl ?? "");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {isEdit && <input type="hidden" {...register("id")} />}

      <div className="space-y-1.5">
        <Label>Product name *</Label>
        <Input {...register("name")} placeholder="Kartoshka yangi" />
        {err("name")}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Uzbek name</Label>
          <Input {...register("nameUz")} placeholder="Kartoshka yangi" />
        </div>
        <div className="space-y-1.5">
          <Label>Russian name</Label>
          <Input {...register("nameRu")} placeholder="Картошка новая" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Category *</Label>
          <Select
            value={categoryId ?? ""}
            onValueChange={(v) => setValue("categoryId", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.icon} {getCategoryName(c, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {err("categoryId")}
        </div>

        <div className="space-y-1.5">
          <Label>Unit type *</Label>
          <Select
            defaultValue={initial?.unitType ?? "KG"}
            onValueChange={(v) => setValue("unitType", v)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="KG">KG — by weight</SelectItem>
              <SelectItem value="PIECE">PIECE — by unit</SelectItem>
              <SelectItem value="BOTH">BOTH — kg &amp; piece</SelectItem>
            </SelectContent>
          </Select>
          {err("unitType")}
        </div>
      </div>

      {/* Prices: editable on create, read-only on edit */}
      {isEdit ? (
        <div className="rounded-lg bg-gray-50 border px-3 py-2.5 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Today&apos;s prices (read-only)</p>
          <div className="flex gap-6 text-sm">
            {initial.unitType !== "PIECE" && (
              <span>
                Per kg:{" "}
                <strong>
                  {initial.pricePerKg != null
                    ? `${initial.pricePerKg.toLocaleString("ru-RU")} UZS`
                    : "—"}
                </strong>
              </span>
            )}
            {initial.unitType !== "KG" && (
              <span>
                Per pcs:{" "}
                <strong>
                  {initial.pricePerPiece != null
                    ? `${initial.pricePerPiece.toLocaleString("ru-RU")} UZS`
                    : "—"}
                </strong>
              </span>
            )}
          </div>
          <Link
            href="/admin/prices"
            className="text-xs text-primary flex items-center gap-1 hover:underline"
          >
            💰 Manage prices in Daily Prices <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {showKg && (
            <div className="space-y-1.5">
              <Label>Initial price / kg *</Label>
              <div className="relative">
                <Input
                  type="number" min={1} step={100}
                  {...register("initialPricePerKg", { valueAsNumber: true })}
                  placeholder="7500" className="pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">UZS</span>
              </div>
              {err("initialPricePerKg")}
            </div>
          )}
          {showPiece && (
            <div className="space-y-1.5">
              <Label>Initial price / pcs *</Label>
              <div className="relative">
                <Input
                  type="number" min={1} step={100}
                  {...register("initialPricePerPiece", { valueAsNumber: true })}
                  placeholder="25000" className="pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">UZS</span>
              </div>
              {err("initialPricePerPiece")}
            </div>
          )}
        </div>
      )}

      {/* Image upload */}
      <div className="space-y-1.5">
        <Label>Product image</Label>
        <input type="hidden" {...register("imageUrl")} />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
        <div className="flex items-center gap-3">
          <div
            className="h-20 w-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted overflow-hidden cursor-pointer hover:border-primary transition-colors shrink-0"
            onClick={() => imageInputRef.current?.click()}
          >
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <ImagePlus className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => imageInputRef.current?.click()}
            >
              {uploading
                ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading…</>
                : <><ImagePlus className="h-3.5 w-3.5 mr-1.5" />{imagePreview ? "Change image" : "Upload image"}</>}
            </Button>
            {imagePreview && (
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                onClick={() => { setImagePreview(""); setValue("imageUrl", ""); }}
              >
                <X className="h-3 w-3" /> Remove image
              </button>
            )}
            <p className="text-[11px] text-muted-foreground">PNG, JPG, WebP · max 5 MB</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isAvailable"
          className="h-4 w-4 accent-primary cursor-pointer"
          {...register("isAvailable")}
          defaultChecked={initial?.isAvailable ?? true}
        />
        <Label htmlFor="isAvailable" className="cursor-pointer font-normal">
          Available in shop catalog
        </Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEdit ? "Save changes" : "Add Product"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ─── Bulk Import Dialog ───────────────────────────────────────────────────────

interface FileData {
  categories: Array<{ key: string; name_en: string; name_uz: string; name_ru?: string | null; icon?: string | null }>;
  products: Array<{ category: string; name_uz: string; unitType: string; price: number }>;
}

function BulkImportDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen]           = useState(false);
  const [fileData, setFileData]   = useState<FileData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mode, setMode]           = useState<ImportMode>("skip");
  const [isPending, startTransition] = useTransition();
  const fileRef                   = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        if (!Array.isArray(json.categories) || !Array.isArray(json.products)) {
          setParseError("File must contain 'categories' and 'products' arrays");
          setFileData(null);
          return;
        }
        setFileData(json as FileData);
        setParseError(null);
      } catch {
        setParseError("Invalid JSON — could not parse file");
        setFileData(null);
      }
    };
    reader.readAsText(file);
  }

  function handleClose() {
    setOpen(false);
    setFileData(null);
    setParseError(null);
    setMode("skip");
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleImport() {
    if (!fileData) return;
    startTransition(async () => {
      const result = await bulkImport({ ...fileData, mode });
      if (result.success) {
        const { productsCreated, productsUpdated, categoriesCreated, categoriesUpdated } = result.summary;
        const totalCats = categoriesCreated + categoriesUpdated;
        toast.success(
          `✅ Imported ${productsCreated + productsUpdated} products across ${totalCats} categories`
        );
        if (result.summary.errors.length > 0) {
          toast.warning(`${result.summary.errors.length} item(s) had errors`);
        }
        onSuccess();
        handleClose();
      } else {
        toast.error(result.error ?? "Import failed");
      }
    });
  }

  const modeOptions: Array<{ value: ImportMode; label: string; desc: string }> = [
    { value: "skip",    label: "Skip existing",            desc: "Only add products not already in the database" },
    { value: "update",  label: "Update existing",          desc: "Update prices for existing products; create new ones" },
    { value: "replace", label: "Replace (hide others) ⚠️", desc: "Update existing + hide products not in this file" },
  ];

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4 mr-1.5" /> Bulk Import
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Import Products</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* File picker */}
            <div className="space-y-1.5">
              <Label>JSON file</Label>
              <Input
                ref={fileRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="cursor-pointer file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary/10 file:text-primary file:px-3 file:py-1 file:text-xs file:font-medium hover:file:bg-primary/20"
              />
              {parseError && (
                <p className="text-xs text-destructive">{parseError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Expected format: <code className="bg-gray-100 px-1 rounded">{"{ categories: [...], products: [...] }"}</code>
              </p>
            </div>

            {/* Preview */}
            {fileData && (
              <div className="space-y-2">
                <p className="text-sm">
                  Found{" "}
                  <strong>{fileData.products.length}</strong> products in{" "}
                  <strong>{fileData.categories.length}</strong> categories
                </p>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name (UZ)</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fileData.products.slice(0, 5).map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{p.name_uz}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.category}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs font-normal">{p.unitType}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {typeof p.price === "number" ? p.price.toLocaleString("ru-RU") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {fileData.products.length > 5 && (
                    <div className="px-4 py-2 text-xs text-muted-foreground border-t">
                      …and {fileData.products.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mode */}
            <div className="space-y-2">
              <Label>Import mode</Label>
              <div className="space-y-1.5">
                {modeOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-2.5 cursor-pointer rounded-lg border p-3 transition-colors ${
                      mode === opt.value ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value={opt.value}
                      checked={mode === opt.value}
                      onChange={() => setMode(opt.value)}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium leading-tight">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!fileData || isPending}
              className="bg-green-600 hover:bg-green-700 text-white border-0"
            >
              {isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing…</>
                : fileData
                  ? `Import ${fileData.products.length} Products`
                  : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Page content (needs Suspense for useSearchParams) ────────────────────────

function formatPrice(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("ru-RU");
}

function ProductsContent() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const locale = useLocaleStore((s) => s.locale);

  const [search, setSearch]               = useState("");
  const [catFilter, setCatFilter]         = useState("ALL");
  const [availFilter, setAvailFilter]     = useState<"ALL" | "AVAILABLE" | "UNAVAILABLE">("ALL");
  const [sortCol, setSortCol]             = useState<SortCol | null>(null);
  const [sortDir, setSortDir]             = useState<"asc" | "desc">("asc");
  const [page, setPage]                   = useState(1);
  const [dialogOpen, setDialogOpen]       = useState(false);
  const [defaultCatId, setDefaultCatId]   = useState<string | undefined>();
  const [editing, setEditing]             = useState<ProductRow | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<ProductRow | null>(null);

  // Quick Add from categories page: ?add=1&categoryId=<id>
  useEffect(() => {
    if (searchParams.get("add") === "1") {
      setDefaultCatId(searchParams.get("categoryId") ?? undefined);
      setEditing(null);
      setDialogOpen(true);
    }
  }, [searchParams]);

  const { data: products = [], isLoading } = useQuery<ProductRow[]>({
    queryKey: ["admin-products"],
    queryFn: () => getAllProducts() as unknown as Promise<ProductRow[]>,
  });

  const { data: categories = [] } = useQuery<CategoryRow[]>({
    queryKey: ["categories"],
    queryFn: () => getAllCategories() as unknown as Promise<CategoryRow[]>,
  });

  const toggleMutation = useMutation({
    mutationFn: toggleProductAvailability,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
    onError: () => toast.error("Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.softDeleted ? "Marked unavailable (has order history)" : "Product deleted");
        qc.invalidateQueries({ queryKey: ["admin-products"] });
      }
      setDeleteTarget(null);
    },
    onError: () => toast.error("Delete failed"),
  });

  // Filter
  const filtered = products.filter((p) => {
    const matchCat  = catFilter === "ALL" || p.categoryId === catFilter;
    const matchAvail =
      availFilter === "ALL" ||
      (availFilter === "AVAILABLE"   && p.isAvailable) ||
      (availFilter === "UNAVAILABLE" && !p.isAvailable);
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.nameUz ?? "").toLowerCase().includes(q);
    return matchCat && matchAvail && matchSearch;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (!sortCol) return 0;
    let cmp = 0;
    if (sortCol === "name")     cmp = a.name.localeCompare(b.name);
    if (sortCol === "category") cmp = getCategoryName(a.category, locale).localeCompare(getCategoryName(b.category, locale));
    if (sortCol === "price") {
      const pa = a.pricePerKg ?? a.pricePerPiece ?? 0;
      const pb = b.pricePerKg ?? b.pricePerPiece ?? 0;
      cmp = pa - pb;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
    setPage(1);
  }

  function openCreate() {
    setEditing(null);
    setDefaultCatId(undefined);
    setDialogOpen(true);
  }

  function openEdit(p: ProductRow) {
    setEditing(p);
    setDialogOpen(true);
  }

  const deleteHasOrders = (deleteTarget?.orderCount ?? 0) > 0;

  return (
    <div className="space-y-5">
      {/* Controls row */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {products.length} products across {categories.length} categories
        </p>
        <div className="flex items-center gap-2">
          <BulkImportDialog
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ["admin-products"] });
              qc.invalidateQueries({ queryKey: ["categories"] });
            }}
          />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Product
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products…"
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={catFilter} onValueChange={(v) => { setCatFilter(v ?? "ALL"); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.icon} {getCategoryName(c, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Availability filter */}
        <div className="flex rounded-lg border bg-card overflow-hidden text-sm">
          {(["ALL", "AVAILABLE", "UNAVAILABLE"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { setAvailFilter(v); setPage(1); }}
              className={`px-3 py-1.5 transition-colors ${
                availFilter === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {v === "ALL" ? "All" : v === "AVAILABLE" ? "Active" : "Hidden"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-xl border bg-card text-center">
          <Package className="h-12 w-12 text-gray-300 mb-4" />
          <p className="font-semibold text-gray-700">No products found</p>
          {search || catFilter !== "ALL" || availFilter !== "ALL" ? (
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Add your first product to get started
              </p>
              <div className="flex gap-2">
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1.5" /> Add Product
                </Button>
                <BulkImportDialog
                  onSuccess={() => {
                    qc.invalidateQueries({ queryKey: ["admin-products"] });
                    qc.invalidateQueries({ queryKey: ["categories"] });
                  }}
                />
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("name")}
                >
                  Product <SortIcon col="name" sortCol={sortCol} sortDir={sortDir} />
                </TableHead>
                <TableHead
                  className="hidden sm:table-cell cursor-pointer select-none"
                  onClick={() => handleSort("category")}
                >
                  Category <SortIcon col="category" sortCol={sortCol} sortDir={sortDir} />
                </TableHead>
                <TableHead className="hidden md:table-cell">Unit</TableHead>
                <TableHead
                  className="text-right cursor-pointer select-none"
                  onClick={() => handleSort("price")}
                >
                  Price / kg <SortIcon col="price" sortCol={sortCol} sortDir={sortDir} />
                </TableHead>
                <TableHead className="text-right hidden sm:table-cell">Price / pcs</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((p) => (
                <TableRow key={p.id} className={!p.isAvailable ? "opacity-50" : undefined}>
                  <TableCell>
                    <p className="font-medium text-sm">{p.name}</p>
                    {p.nameUz && p.nameUz !== p.name && (
                      <p className="text-xs text-muted-foreground">{p.nameUz}</p>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="text-sm">{p.category.icon} {getCategoryName(p.category, locale)}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className="text-xs font-normal">{p.unitType}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {p.unitType !== "PIECE" ? `${formatPrice(p.pricePerKg)} ` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums hidden sm:table-cell">
                    {p.unitType !== "KG" ? `${formatPrice(p.pricePerPiece)} ` : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={p.isAvailable ? "default" : "outline"}
                      className={p.isAvailable ? "bg-green-500 hover:bg-green-500" : "text-muted-foreground"}
                    >
                      {p.isAvailable ? "Active" : "Hidden"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5 justify-end">
                      <Button
                        size="icon" variant="ghost" className="h-8 w-8"
                        title={p.isAvailable ? "Hide" : "Show"}
                        onClick={() => toggleMutation.mutate(p.id)}
                        disabled={toggleMutation.isPending}
                      >
                        {p.isAvailable
                          ? <ToggleRight className="h-4 w-4 text-primary" />
                          : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-8 w-8"
                        onClick={() => openEdit(p)} title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(p)} title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {/* Footer: count + pagination */}
          <div className="px-4 py-2.5 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {sorted.length === products.length
                ? `${products.length} products`
                : `${sorted.length} of ${products.length} products`}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm" variant="outline" className="h-7 px-2 text-xs"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Prev
                </Button>
                <span className="text-xs text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  size="sm" variant="outline" className="h-7 px-2 text-xs"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>
          <ProductForm
            key={editing?.id ?? "new"}
            initial={editing ?? undefined}
            categories={categories}
            defaultCategoryId={defaultCatId}
            onClose={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteHasOrders
                ? `Hide "${deleteTarget?.name}"?`
                : `Delete "${deleteTarget?.name}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {deleteHasOrders ? (
                <div>
                  <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
                    ⚠️ This product has{" "}
                    <strong>
                      {deleteTarget?.orderCount} order{(deleteTarget?.orderCount ?? 0) !== 1 ? "s" : ""}
                    </strong>{" "}
                    in its history and cannot be permanently deleted. It will be marked as{" "}
                    <strong>unavailable</strong> instead.
                  </p>
                </div>
              ) : (
                <span>This will permanently delete the product. This action cannot be undone.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={deleteHasOrders ? "" : "bg-destructive hover:bg-destructive/90 text-white"}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {deleteHasOrders ? "Mark Unavailable" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CombinedContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "prices" ? "prices" : "products";

  const tabLink = (href: string, active: boolean, icon: React.ReactNode, label: string) => (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
      )}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <div className="space-y-0">
      {/* Page header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-headline-lg">Products &amp; Prices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your catalog and set today&apos;s prices
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b mb-5">
        {tabLink(
          "/admin/products",
          tab === "products",
          <ShoppingCart className="h-4 w-4" />,
          "Products"
        )}
        {tabLink(
          "/admin/products?tab=prices",
          tab === "prices",
          <DollarSign className="h-4 w-4" />,
          "Daily Prices"
        )}
      </div>

      {tab === "prices" ? <PriceGrid /> : <ProductsContent />}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense>
      <CombinedContent />
    </Suspense>
  );
}

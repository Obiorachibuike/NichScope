"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Loader2, Plus, Tags } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  nicheCount: number;
  activeNicheCount: number;
}

interface NicheRow {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  categoryName: string;
  parentId: string | null;
  isActive: boolean;
  isFeatured: boolean;
  formats: string[];
  competitionLevel: string;
  monetizationPotential: string;
  childCount: number;
}

async function patchJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { error?: { message: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? "Update failed");
}

export function CategoryCreator() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/v1/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null }),
      });
      const payload = (await response.json()) as { error?: { message: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to create category");
      toast.success("Category created");
      setOpen(false);
      setName("");
      setDescription("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create category");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <FolderPlus className="size-4" /> New category
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create category</DialogTitle>
          <DialogDescription>
            Categories are first-level taxonomy nodes. They are independent of any
            YouTube data source.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="category-name">Name</Label>
            <Input id="category-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Emerging Tech" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category-description">Description (optional)</Label>
            <Textarea
              id="category-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="What belongs in this category?"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" type="button">Cancel</Button>
          </DialogClose>
          <Button type="button" onClick={() => void create()} disabled={saving || name.trim().length < 2}>
            {saving && <Loader2 className="size-3.5 animate-spin" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NicheCreator({
  categories,
  niches,
}: {
  categories: { id: string; name: string }[];
  niches: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [parentId, setParentId] = useState("none");
  const [description, setDescription] = useState("");
  const [formats, setFormats] = useState({ shorts: false, long_form: true });
  const [saving, setSaving] = useState(false);

  const create = async () => {
    setSaving(true);
    try {
      const selectedFormats = Object.entries(formats)
        .filter(([, checked]) => checked)
        .map(([key]) => key);
      const response = await fetch("/api/v1/admin/niches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          categoryId,
          parentId: parentId === "none" ? null : parentId,
          description: description || null,
          formats: selectedFormats,
        }),
      });
      const payload = (await response.json()) as { error?: { message: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to create niche");
      toast.success("Niche created");
      setOpen(false);
      setName("");
      setDescription("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create niche");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> New niche
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create niche</DialogTitle>
          <DialogDescription>
            A new taxonomy node has no performance metrics until an eligible source
            supplies them. It is never assigned invented scores.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="niche-name">Name</Label>
              <Input id="niche-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. AI Workflow Automation" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="niche-category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="niche-category"><SelectValue placeholder="Choose category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="niche-parent">Parent niche (optional)</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger id="niche-parent"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Top-level niche</SelectItem>
                {niches.map((niche) => (
                  <SelectItem key={niche.id} value={niche.id}>{niche.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="niche-description">Description (optional)</Label>
            <Textarea id="niche-description" value={description} rows={2} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formats.shorts}
                onChange={(event) => setFormats((value) => ({ ...value, shorts: event.target.checked }))}
                className="size-4 rounded border-border bg-surface accent-[var(--primary)]"
              />
              Shorts
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formats.long_form}
                onChange={(event) => setFormats((value) => ({ ...value, long_form: event.target.checked }))}
                className="size-4 rounded border-border bg-surface accent-[var(--primary)]"
              />
              Long-form
            </label>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" type="button">Cancel</Button>
          </DialogClose>
          <Button
            type="button"
            onClick={() => void create()}
            disabled={saving || name.trim().length < 2 || !categoryId}
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />} Create niche
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CategoryToggle({
  categoryId,
  isActive,
  name,
}: {
  categoryId: string;
  isActive: boolean;
  name: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  return (
    <Switch
      checked={isActive}
      aria-label={`${isActive ? "Deactivate" : "Activate"} ${name}`}
      disabled={saving}
      onCheckedChange={async (next) => {
        setSaving(true);
        try {
          await patchJson(`/api/v1/admin/categories/${categoryId}`, { isActive: next });
          toast.success(next ? "Category activated" : "Category deactivated");
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Update failed");
        } finally {
          setSaving(false);
        }
      }}
    />
  );
}

export function NicheToggles({
  niche,
}: {
  niche: { id: string; name: string; isActive: boolean; isFeatured: boolean };
}) {
  const router = useRouter();
  const [state, setState] = useState({ active: niche.isActive, featured: niche.isFeatured });
  const [saving, setSaving] = useState(false);

  const update = async (updates: Partial<{ isActive: boolean; isFeatured: boolean }>) => {
    setSaving(true);
    try {
      await patchJson(`/api/v1/admin/niches/${niche.id}`, updates);
      setState((value) => ({
        active: updates.isActive ?? value.active,
        featured: updates.isFeatured ?? value.featured,
      }));
      toast.success("Niche updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted">active</span>
        <Switch
          checked={state.active}
          disabled={saving}
          aria-label={`Toggle active for ${niche.name}`}
          onCheckedChange={(next) => void update({ isActive: next })}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted">featured</span>
        <Switch
          checked={state.featured}
          disabled={saving}
          aria-label={`Toggle featured for ${niche.name}`}
          onCheckedChange={(next) => void update({ isFeatured: next })}
        />
      </div>
    </div>
  );
}

export function TaxonomyTables({
  categories,
  niches,
  total,
}: {
  categories: CategoryRow[];
  niches: NicheRow[];
  total: number;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Tags className="size-4 text-primary" /> Categories
            <Badge variant="outline">{categories.length}</Badge>
          </h2>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Slug</th>
                <th className="px-4 py-2 font-medium">Niches</th>
                <th className="px-4 py-2 font-medium">Active niches</th>
                <th className="px-4 py-2 font-medium">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-t border-border/60">
                  <td className="px-4 py-2 font-medium text-muted-strong">{category.name}</td>
                  <td className="px-4 py-2 font-mono text-[11px] text-muted">{category.slug}</td>
                  <td className="px-4 py-2 text-muted">{category.nicheCount}</td>
                  <td className="px-4 py-2 text-muted">{category.activeNicheCount}</td>
                  <td className="px-4 py-2">
                    <CategoryToggle
                      categoryId={category.id}
                      isActive={category.isActive}
                      name={category.name}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Niches ({total})</h2>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[860px] text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
                <th className="px-4 py-2 font-medium">Niche</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Format</th>
                <th className="px-4 py-2 font-medium">Competition</th>
                <th className="px-4 py-2 font-medium">Sub-niches</th>
                <th className="px-4 py-2 font-medium">Visibility</th>
              </tr>
            </thead>
            <tbody>
              {niches.map((niche) => (
                <tr key={niche.id} className="border-t border-border/60">
                  <td className="px-4 py-2">
                    <p className="font-medium text-muted-strong">{niche.name}</p>
                    <p className="font-mono text-[10px] text-muted">{niche.slug}</p>
                  </td>
                  <td className="px-4 py-2 text-muted">{niche.categoryName}</td>
                  <td className="px-4 py-2">
                    <span className="flex flex-wrap gap-1">
                      {niche.formats.length === 0 ? (
                        <span className="text-muted">—</span>
                      ) : (
                        niche.formats.map((format) => (
                          <Badge key={format} variant="outline">
                            {format === "shorts" ? "Shorts" : "Long-form"}
                          </Badge>
                        ))
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2 capitalize text-muted">{niche.competitionLevel}</td>
                  <td className="px-4 py-2 text-muted">{niche.childCount}</td>
                  <td className="px-4 py-2">
                    <NicheToggles niche={niche} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

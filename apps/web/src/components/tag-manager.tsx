"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

type Props = {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
};

export function TagManager({ selectedTagIds, onChange }: Props) {
  const [newTag, setNewTag] = useState("");
  const [showInput, setShowInput] = useState(false);
  const utils = trpc.useUtils();
  const tags = trpc.expenses.tags.useQuery();
  const createTag = trpc.expenses.createTag.useMutation({
    onSuccess: (tag) => {
      utils.expenses.tags.invalidate();
      onChange([...selectedTagIds, tag.id]);
      setNewTag("");
      setShowInput(false);
    },
  });

  const toggle = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const handleCreate = () => {
    if (newTag.trim()) {
      createTag.mutate({ name: newTag.trim() });
    }
  };

  // Autocomplete filter
  const filtered = newTag
    ? tags.data?.filter((t: any) =>
        t.name.toLowerCase().includes(newTag.toLowerCase())
      )
    : tags.data;

  return (
    <div>
      <label className="block text-sm text-zinc-400 mb-1">Tags</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.data?.map((tag: any) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
            className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
              selectedTagIds.includes(tag.id)
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {tag.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowInput(!showInput)}
          className="px-2.5 py-1 rounded-full text-xs bg-zinc-800 text-zinc-500 hover:bg-zinc-700 transition-colors"
        >
          + New tag
        </button>
      </div>

      {showInput && (
        <div className="flex gap-2">
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Tag name"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreate())}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newTag.trim() || createTag.isPending}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-xs disabled:opacity-50"
          >
            Add
          </button>

          {/* Autocomplete suggestions */}
          {newTag && filtered && filtered.length > 0 && (
            <div className="absolute mt-10 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-10 max-h-32 overflow-y-auto">
              {filtered.map((t: any) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { toggle(t.id); setNewTag(""); setShowInput(false); }}
                  className="block w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-700 text-zinc-300"
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

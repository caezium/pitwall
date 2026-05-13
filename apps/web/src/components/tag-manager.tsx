"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

type Tag = { id: string; name: string };

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
    onSuccess: (tag: Tag) => {
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

  const filtered = newTag
    ? tags.data?.filter((t: Tag) =>
        t.name.toLowerCase().includes(newTag.toLowerCase())
      )
    : tags.data;

  return (
    <div>
      <label className="block text-sm text-base-content/60 mb-1">Tags</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.data?.map((tag: Tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
            className={`badge gap-1 cursor-pointer ${
              selectedTagIds.includes(tag.id)
                ? "badge-primary"
                : "badge-ghost"
            }`}
          >
            {tag.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowInput(!showInput)}
          className="badge badge-outline gap-1 cursor-pointer"
        >
          + New tag
        </button>
      </div>

      {showInput && (
        <div className="flex gap-2 relative">
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Tag name"
            className="input input-sm input-bordered flex-1"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreate())}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newTag.trim() || createTag.isPending}
            className="btn btn-sm btn-success"
          >
            Add
          </button>

          {newTag && filtered && filtered.length > 0 && (
            <div className="absolute top-full left-0 mt-1 bg-base-200 border border-base-300 rounded-lg shadow-lg z-10 max-h-32 overflow-y-auto w-full">
              {filtered.map((t: Tag) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { toggle(t.id); setNewTag(""); setShowInput(false); }}
                  className="block w-full text-left px-3 py-1.5 text-xs hover:bg-base-300 text-base-content/80"
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

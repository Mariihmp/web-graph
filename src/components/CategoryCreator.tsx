import React, { useState } from "react";
import { FolderPlus, Loader2, CheckCircle2, Palette } from "lucide-react";
import { BrainNode } from "../types";

interface CategoryCreatorProps {
  nodes: BrainNode[];
  onSuccess: () => void;
}

const PRESET_COLORS = [
  { name: "Blue", value: "#3B82F6" },
  { name: "Indigo", value: "#6366F1" },
  { name: "Violet", value: "#8B5CF6" },
  { name: "Emerald", value: "#10B981" },
  { name: "Rose", value: "#F43F5E" },
  { name: "Amber", value: "#F59E0B" },
  { name: "Slate", value: "#64748B" },
];

export default function CategoryCreator({ nodes, onSuccess }: CategoryCreatorProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState("#3B82F6");
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Only list non-parent (site) nodes as eligible for initial grouping
  const eligibleNodes = (nodes || []).filter((node) => !node.isParent);

  const handleToggleNode = (nodeId: string) => {
    setSelectedNodeIds((prev) =>
      prev.includes(nodeId)
        ? prev.filter((id) => id !== nodeId)
        : [...prev, nodeId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/parent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          color: selectedColor,
          description: description.trim() || undefined,
          associatedNodeIds: selectedNodeIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create category node.");
      }

      setTitle("");
      setDescription("");
      setSelectedNodeIds([]);
      setSuccess(true);
      onSuccess();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to create category.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="category-creator-card" className="bg-[#1A1D23] rounded-xl border border-[#374151] p-5 shadow-sm space-y-4 font-sans">
      <h3 className="font-sans font-semibold text-xs text-slate-400 uppercase tracking-widest flex items-center gap-2">
        <FolderPlus className="w-4 h-4 text-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.4)]" />
        Create Parent Category
      </h3>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 font-mono">Category Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. AI Resources, Personal Notes..."
            disabled={isLoading}
            className="w-full bg-[#0F1115] border border-[#374151] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 font-mono">Category Description (Optional)</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description of this semantic cluster..."
            disabled={isLoading}
            className="w-full bg-[#0F1115] border border-[#374151] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Color Palette Choice */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 font-mono">
            <Palette className="w-3.5 h-3.5 text-slate-400" /> Category Accent Color
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setSelectedColor(preset.value)}
                disabled={isLoading}
                className={`w-6 h-6 rounded-full border transition cursor-pointer relative ${
                  selectedColor === preset.value
                    ? "border-white scale-110 shadow-lg"
                    : "border-[#374151] hover:scale-105"
                }`}
                style={{ backgroundColor: preset.value }}
                title={preset.name}
              >
                {selectedColor === preset.value && (
                  <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold">
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Associated Nodes (Connect to as much nodes as possible) */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-mono">
            Directly Associate Websites ({selectedNodeIds.length} selected)
          </label>
          {eligibleNodes.length > 0 ? (
            <div className="bg-[#0F1115] border border-[#374151] rounded-lg p-2.5 max-h-[150px] overflow-y-auto space-y-1.5">
              {eligibleNodes.map((node) => {
                const isChecked = selectedNodeIds.includes(node.id);
                return (
                  <label
                    key={node.id}
                    className={`flex items-start gap-2 p-1.5 rounded cursor-pointer transition text-xs ${
                      isChecked 
                        ? "bg-blue-950/20 text-blue-300" 
                        : "hover:bg-slate-800/50 text-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleNode(node.id)}
                      disabled={isLoading}
                      className="mt-0.5 rounded text-blue-600 focus:ring-0 cursor-pointer bg-slate-900 border-[#4B5563]"
                    />
                    <div className="truncate">
                      <span className="font-semibold block truncate">{node.title}</span>
                      <span className="text-[10px] text-slate-500 block truncate">{node.url}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="bg-[#0F1115] border border-[#374151] rounded-lg p-3 text-center text-xs text-slate-500 italic">
              No websites currently available to associate.
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !title.trim()}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-blue-200" />
              Creating Category...
            </>
          ) : (
            <>
              Initialize Parent Group
            </>
          )}
        </button>
      </form>

      {success && (
        <div className="bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 text-xs rounded-lg p-2 flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>Category created successfully!</span>
        </div>
      )}

      {error && (
        <div className="bg-red-950/40 border border-red-900/50 text-red-400 text-xs rounded-lg p-2.5">
          {error}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { BrainNode } from "../types";
import { 
  X, ExternalLink, Calendar, Tag, FileText, Edit3, Check, MessageSquare, Trash2, Folder, ListCollapse, Palette, Unlink
} from "lucide-react";

interface NodeDrawerProps {
  node: BrainNode;
  allNodes: BrainNode[];
  onClose: () => void;
  onUpdate: (updatedNode: BrainNode) => void;
  onSelectNode: (node: BrainNode) => void;
  edges: any[];
  onDelete?: () => void;
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

export default function NodeDrawer({ 
  node, 
  allNodes, 
  onClose, 
  onUpdate, 
  onSelectNode, 
  edges,
  onDelete
}: NodeDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(node.title);
  const [description, setDescription] = useState(node.description);
  const [tagsInput, setTagsInput] = useState("");
  const [selectedColor, setSelectedColor] = useState(node.color || "#3B82F6");
  const [selectedParentId, setSelectedParentId] = useState<string>(node.parentId || "");
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
  const [connectionSearch, setConnectionSearch] = useState("");

  // Sync state when node changes
  useEffect(() => {
    setTitle(node.title);
    setDescription(node.description);
    setTagsInput(Array.isArray(node.tags) ? node.tags.join(", ") : "");
    setSelectedColor(node.color || "#3B82F6");
    setSelectedParentId(node.parentId || "");
    setIsEditing(false);
    setSaveSuccess(false);
    setError(null);
    setConfirmDeleteId(null);

    // Sync connections
    const initialConns = (edges || [])
      .filter(e => e && (e.sourceId === node.id || e.targetId === node.id))
      .map(e => e.sourceId === node.id ? e.targetId : e.sourceId);
    setSelectedConnections(Array.from(new Set(initialConns)));
    setConnectionSearch("");
  }, [node, edges]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    const updatedTags = tagsInput
      .split(",")
      .map(t => t.trim())
      .filter(t => t.length > 0);

    try {
      // 1. Save Node Details
      const response = await fetch(`/api/node/${encodeURIComponent(node.id)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          tags: updatedTags,
          color: selectedColor,
          parentId: selectedParentId === "" ? null : selectedParentId,
          isParent: node.isParent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update node details.");
      }

      // 2. Save Connections
      const edgesResponse = await fetch(`/api/node/${encodeURIComponent(node.id)}/edges`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connectedNodeIds: selectedConnections,
        }),
      });

      if (!edgesResponse.ok) {
        const edgesData = await edgesResponse.json();
        throw new Error(edgesData.error || "Failed to update connections.");
      }

      onUpdate(data.node);
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (idToDelete: string) => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/node/${encodeURIComponent(idToDelete)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete node.");
      }

      if (idToDelete === node.id) {
        if (onDelete) {
          onDelete();
        } else {
          onClose();
        }
      } else {
        if (onUpdate) {
          onUpdate(node);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete node.");
      setIsDeleting(false);
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const handleUnlink = async (idToUnlink: string) => {
    try {
      const response = await fetch(`/api/node/${encodeURIComponent(idToUnlink)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: null }) // Set parent to null
      });
      if (!response.ok) throw new Error("Failed to unlink node");
      if (onUpdate) onUpdate(node);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // List of all other parent nodes to assign as parent (skip this node itself to prevent cycle)
  const availableParents = allNodes.filter(n => n.isParent && n.id !== node.id);

  // Find connections related to this node
  const nodeConnections = (edges || []).filter(
    (edge) => edge && (edge.sourceId === node.id || edge.targetId === node.id)
  );

  // Find all child nodes belonging to this parent node (either via parentId column or direct visual edges)
  const childNodes = allNodes.filter((n) => {
    if (n.id === node.id) return false;
    // Strictly a child via parentId column
    if (n.parentId === node.id) return true;
    // Or if there is a direct edge between them and the child is a site node, not another category
    if (!n.isParent) {
      const hasEdge = (edges || []).some(
        (edge) =>
          edge &&
          ((edge.sourceId === node.id && edge.targetId === n.id) ||
            (edge.sourceId === n.id && edge.targetId === node.id))
      );
      if (hasEdge) return true;
    }
    return false;
  });

  return (
    <div id="node-drawer-card" className="bg-[#1A1D23] rounded-xl border border-[#374151] shadow-lg overflow-hidden flex flex-col flex-1 h-full min-h-0">
      {/* Header */}
      <div className="bg-[#0F1115] px-3 py-2.5 border-b border-[#1F2937] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div 
            className="w-2.5 h-2.5 rounded-full shadow-inner animate-pulse" 
            style={{ 
              backgroundColor: node.color || (node.isParent ? "#3B82F6" : "#64748B"),
              boxShadow: `0 0 10px ${node.color || (node.isParent ? "#3B82F6" : "#64748B")}`
            }} 
          />
          <span className="font-mono text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            {node.type || (node.isParent ? "Category Node" : "Site Node")}
          </span>
        </div>
        <button 
          onClick={onClose}
          className="text-slate-500 hover:text-white hover:bg-slate-800 p-1 rounded-md transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 overflow-y-auto flex-1 space-y-5">
        {!isEditing && node.shortTitle && (
          <div className="text-sm font-bold text-slate-300">
            {node.shortTitle}
          </div>
        )}
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#0F1115] border border-[#374151] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#0F1115] border border-[#374151] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none font-sans"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="tech, ai, productivity"
                className="w-full bg-[#0F1115] border border-[#374151] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            {/* Custom Color Selector */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-slate-400" /> Category Theme Color
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((colorPreset) => (
                  <button
                    key={colorPreset.value}
                    type="button"
                    onClick={() => setSelectedColor(colorPreset.value)}
                    className={`w-7 h-7 rounded-full border transition cursor-pointer relative ${
                      selectedColor === colorPreset.value 
                        ? "border-white scale-110 shadow-lg" 
                        : "border-[#374151] hover:scale-105"
                    }`}
                    style={{ backgroundColor: colorPreset.value }}
                    title={colorPreset.name}
                  >
                    {selectedColor === colorPreset.value && (
                      <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Parent Category Dropdown (Only for non-parent nodes) */}
            {!node.isParent && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-slate-400" /> Assign Parent Category
                </label>
                <select
                  value={selectedParentId}
                  onChange={(e) => setSelectedParentId(e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#374151] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- No Parent (Uncategorized) --</option>
                  {availableParents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Assigning a parent categorizes the node and automatically synchronizes its visual category color!
                </p>
              </div>
            )}

            {/* Searchable Connections Editor */}
            <div className="space-y-2 border-t border-[#1F2937] pt-3">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center justify-between">
                <span>Edit Local Connections</span>
                <span className="text-slate-400 text-[9px] lowercase">({selectedConnections.length} connected)</span>
              </label>
              
              <input 
                type="text"
                placeholder="Search other websites/categories to connect..."
                value={connectionSearch}
                onChange={(e) => setConnectionSearch(e.target.value)}
                className="w-full bg-[#0F1115] border border-[#374151] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />

              <div className="bg-[#0F1115] border border-[#1F2937] rounded-lg max-h-[140px] overflow-y-auto p-2 space-y-1">
                {allNodes
                  .filter(n => n.id !== node.id)
                  .filter(n => {
                    if (!connectionSearch) return true;
                    return n.title.toLowerCase().includes(connectionSearch.toLowerCase()) || 
                           n.tags.some(t => t.toLowerCase().includes(connectionSearch.toLowerCase()));
                  })
                  .map((n) => {
                    const isConnected = selectedConnections.includes(n.id);
                    return (
                      <label 
                        key={n.id} 
                        className="flex items-center gap-2.5 p-1.5 hover:bg-slate-800/50 rounded cursor-pointer transition text-xs text-slate-300"
                      >
                        <input
                          type="checkbox"
                          checked={isConnected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedConnections(prev => [...prev, n.id]);
                            } else {
                              setSelectedConnections(prev => prev.filter(id => id !== n.id));
                            }
                          }}
                          className="rounded text-blue-500 focus:ring-0 bg-slate-950 border-slate-700 w-3.5 h-3.5 cursor-pointer"
                        />
                        <div className="truncate flex-1">
                          <span className={`block truncate ${isConnected ? "text-blue-400 font-medium" : "text-slate-300"}`}>
                            {n.isParent ? "[Category] " : "[Site] "}{n.title}
                          </span>
                        </div>
                      </label>
                    );
                  })
                }
                {allNodes.filter(n => n.id !== node.id).length === 0 && (
                  <p className="text-[10px] text-slate-500 italic text-center py-2">No other nodes available.</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => {
                  const initialConns = (edges || [])
                    .filter(e => e && (e.sourceId === node.id || e.targetId === node.id))
                    .map(e => e.sourceId === node.id ? e.targetId : e.sourceId);
                  setSelectedConnections(Array.from(new Set(initialConns)));
                  setConnectionSearch("");
                  setIsEditing(false);
                }}
                disabled={isSaving}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Title & URL */}
            <div>
              <h2 className="font-sans font-bold text-base text-white leading-snug mb-1.5">{node.title}</h2>
              {(node.isParent || node.url.startsWith("group:") || node.url.startsWith("category:") || node.url.startsWith("category://")) ? (
                <div className="text-[10px] font-mono text-blue-400 bg-blue-950/20 px-2.5 py-1 rounded-md border border-blue-900/30 inline-block">
                  Semantic category folder
                </div>
              ) : (
                <a 
                  href={node.url} 
                  target="_blank" 
                  referrerPolicy="no-referrer"
                  className="text-xs text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1 font-mono break-all"
                >
                  {node.url}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Parent Indicator if attached */}
            {!node.isParent && node.parentId && (
              <div className="bg-[#0F1115]/50 border border-[#1F2937] rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-slate-500 text-[10px] font-mono uppercase font-semibold">Category:</span>
                <button 
                  onClick={() => {
                    const parentNode = allNodes.find(n => n.id === node.parentId);
                    if (parentNode && onSelectNode) {
                      onSelectNode(parentNode);
                    }
                  }}
                  className="text-xs font-medium font-mono bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded text-white border transition cursor-pointer"
                  style={{ borderColor: node.color || "#3B82F6" }}
                  title="Click to view and edit this parent Category"
                >
                  {allNodes.find(n => n.id === node.parentId)?.title || "Attached Parent"}
                </button>
              </div>
            )}

            {/* Age Badge */}
            {!node.isParent && (
              <div className="bg-[#0F1115] border border-[#1F2937] rounded-lg px-3 py-2 flex items-center gap-3">
                <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                <div className="text-xs">
                  <span className="text-slate-500">Node age: </span>
                  <span className="font-medium text-slate-300 font-mono">
                    {node.ageInDays === 0 ? "Seeded today" : node.ageInDays === 1 ? "1 day" : `${node.ageInDays} days`}
                  </span>
                </div>
              </div>
            )}

            {/* Description */}
            <div className="space-y-1">
              <span className="text-slate-500 text-[10px] font-mono tracking-wider uppercase flex items-center gap-1 font-semibold">
                <FileText className="w-3 h-3" /> Description
              </span>
              <p className="text-xs text-slate-300 leading-relaxed bg-[#0F1115]/50 p-3 rounded-lg border border-[#1F2937] italic">
                "{node.description}"
              </p>
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <span className="text-slate-500 text-[10px] font-mono tracking-wider uppercase flex items-center gap-1 font-semibold">
                <Tag className="w-3 h-3" /> Semantic Tags
              </span>
              <div className="flex flex-wrap gap-1.5">
                {node.tags && node.tags.length > 0 ? (
                  node.tags.map((tag, idx) => (
                    <span 
                      key={idx} 
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] px-2.5 py-1 rounded-full border-none transition"
                    >
                      #{tag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500 italic">No tags associated.</span>
                )}
              </div>
            </div>

            {/* Children List (FOR PARENT NODES ONLY) */}
            {node.isParent && (
              <div className="space-y-2 border-t border-[#1F2937] pt-3">
                <span className="text-slate-400 text-[10px] font-mono tracking-wider uppercase flex items-center gap-1.5 font-bold">
                  <ListCollapse className="w-4 h-4 text-blue-400" /> Child Nodes in Category ({childNodes.length})
                </span>
                {childNodes.length > 0 ? (
                  <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                    {childNodes.map((child) => (
                      <div
                        key={child.id}
                        className="w-full bg-slate-900/40 hover:bg-slate-800/80 border border-[#1F2937] rounded-lg p-2.5 text-xs text-slate-300 transition flex items-center justify-between group"
                      >
                        <div 
                          onClick={() => onSelectNode(child)}
                          className="truncate pr-2 flex-1 cursor-pointer"
                        >
                          <p className="font-semibold text-slate-200 hover:text-blue-400 truncate">
                            {child.title}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">{child.url}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {confirmDeleteId === child.id ? (
                            <div className="flex items-center gap-1 bg-red-950/50 p-1 rounded border border-red-900/50">
                              <span className="text-[10px] text-red-300 px-1">Delete?</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(child.id);
                                }}
                                className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[10px] rounded"
                              >
                                Yes
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-white text-[10px] rounded"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => onSelectNode(child)}
                                className="px-2 py-1 text-[10px] text-slate-400 hover:text-blue-400 hover:bg-slate-750 rounded transition cursor-pointer"
                                title="View child details"
                              >
                                View →
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnlink(child.id);
                                }}
                                className="p-1.5 text-slate-500 hover:text-orange-400 hover:bg-orange-950/30 rounded transition cursor-pointer"
                                title="Unlink from category"
                              >
                                <Unlink className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(child.id);
                                }}
                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded transition cursor-pointer"
                                title="Delete this child node"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic bg-[#0F1115]/30 p-3 rounded-lg border border-[#1F2937] text-center">
                    No children yet. Edit a site to assign it to this category.
                  </p>
                )}
              </div>
            )}

            {/* Semantic Linkages (Semantic Context) */}
            <div className="space-y-2 border-t border-[#1F2937] pt-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[10px] font-mono tracking-wider uppercase flex items-center gap-1 font-semibold">
                  <MessageSquare className="w-3 h-3" /> Local Brain Connections ({nodeConnections.length})
                </span>
                {nodeConnections.length > 0 && (
                  <button
                    onClick={async () => {
                      if (confirm("Disconnect all connections for this node?")) {
                        try {
                          const response = await fetch(`/api/node/${encodeURIComponent(node.id)}/edges`, {
                            method: "DELETE"
                          });
                          if (response.ok) {
                            onUpdate(node);
                          } else {
                            alert("Failed to disconnect all connections.");
                          }
                        } catch (err: any) {
                          alert(err.message || "Failed to disconnect all connections.");
                        }
                      }
                    }}
                    className="text-[9px] text-red-400 hover:text-red-300 font-semibold hover:underline bg-red-950/20 px-2 py-0.5 rounded border border-red-900/30 cursor-pointer"
                  >
                    Disconnect All
                  </button>
                )}
              </div>
              {nodeConnections.length > 0 ? (
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {nodeConnections.map((edge) => {
                    const isIncoming = edge.targetId === node.id;
                    const connectedNodeId = isIncoming ? edge.sourceId : edge.targetId;
                    const connectedObj = allNodes.find(n => n.id === connectedNodeId);
                    const displayLabel = connectedObj ? connectedObj.title : connectedNodeId.replace(/^https?:\/\/(www\.)?/, "");
                    
                    return (
                      <div 
                        key={edge.id} 
                        onClick={() => {
                          if (connectedObj) onSelectNode(connectedObj);
                        }}
                        className="bg-blue-950/20 hover:bg-blue-950/45 border border-blue-900/30 rounded-lg p-2.5 text-xs text-slate-300 space-y-1 cursor-pointer transition relative group"
                      >
                        <div className="flex items-center justify-between font-medium gap-2">
                          <span className="text-blue-400 text-[11px] shrink-0">
                            {isIncoming ? "← Linked from:" : "→ Links to:"}
                          </span>
                          <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                            <span className="text-slate-300 font-mono text-[10px] truncate max-w-[120px]" title={connectedNodeId}>
                              {displayLabel}
                            </span>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm(`Disconnect link with "${displayLabel}"?`)) {
                                  try {
                                    const response = await fetch(`/api/edges?sourceId=${encodeURIComponent(edge.sourceId)}&targetId=${encodeURIComponent(edge.targetId)}`, {
                                      method: "DELETE"
                                    });
                                    if (response.ok) {
                                      onUpdate(node);
                                    } else {
                                      alert("Failed to disconnect.");
                                    }
                                  } catch (err: any) {
                                    alert(err.message || "Failed to disconnect.");
                                  }
                                }
                              }}
                              className="text-slate-500 hover:text-red-400 p-1 hover:bg-slate-850 rounded transition shrink-0"
                              title="Disconnect link"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-slate-400 text-[10px] leading-snug italic">
                          "{edge.reason}"
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No semantic connections found.</p>
              )}
            </div>

            {/* Quick Action Overrides */}
            <div className="flex gap-2 pt-2 border-t border-[#1F2937]">
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 bg-[#1A1D23] hover:bg-[#2A2E35] text-slate-300 font-medium text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 border border-[#374151] transition cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                Edit Details
              </button>
              
              {confirmDeleteId === node.id ? (
                <div className="flex items-center gap-2 bg-red-950/20 border border-red-900/50 rounded-lg px-2">
                  <span className="text-[10px] text-red-300">Are you sure?</span>
                  <button
                    onClick={() => handleDelete(node.id)}
                    disabled={isDeleting}
                    className="bg-red-600 hover:bg-red-500 text-white font-medium text-xs py-1 px-3 rounded transition cursor-pointer"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="bg-slate-700 hover:bg-slate-600 text-white font-medium text-xs py-1 px-3 rounded transition cursor-pointer"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(node.id)}
                  className="bg-red-950/20 hover:bg-red-900/35 border border-red-900/50 hover:border-red-500 text-red-400 hover:text-red-300 font-medium text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
                  title="Delete Node"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Node
                </button>
              )}
            </div>
          </div>
        )}

        {/* Status / Alerts */}
        {saveSuccess && (
          <div className="bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 text-xs rounded-lg p-2.5 text-center font-medium animate-fade-in">
            ✓ Brain node updated successfully!
          </div>
        )}

        {error && (
          <div className="bg-red-950/40 border border-red-900/50 text-red-400 text-xs rounded-lg p-2.5 text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

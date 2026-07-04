import React, { useState, useEffect } from "react";
import { BrainNode } from "../types";
import { Link2, Sparkles, Loader2, Info, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ManualConnectorProps {
  nodes: BrainNode[];
  selectedNode: BrainNode | null;
  onConnectionSuccess: () => void;
}

export default function ManualConnector({ nodes, selectedNode, onConnectionSuccess }: ManualConnectorProps) {
  const [sourceId, setSourceId] = useState("");
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Handle shortcut buttons or active node sync
  useEffect(() => {
    if (selectedNode) {
      // Don't auto-set source if target is already checked
      if (!selectedTargetIds.includes(selectedNode.id)) {
        setSourceId(selectedNode.id);
      }
    }
  }, [selectedNode]);

  const handleToggleTarget = (nodeId: string) => {
    setSelectedTargetIds((prev) =>
      prev.includes(nodeId)
        ? prev.filter((id) => id !== nodeId)
        : [...prev, nodeId]
    );
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!sourceId) {
      setError("Please select a source website/category node.");
      return;
    }

    if (selectedTargetIds.length === 0) {
      setError("Please select at least one target node to connect.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/edges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceId,
          targetIds: selectedTargetIds,
          reason: "Manual connection", // Default fallback if needed
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create connections.");
      }

      setSelectedTargetIds([]);
      setSuccess(true);
      onConnectionSuccess();
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  const setSourceFromSelected = () => {
    if (selectedNode) {
      setSourceId(selectedNode.id);
      // Ensure it is not in target list
      setSelectedTargetIds((prev) => prev.filter((id) => id !== selectedNode.id));
    }
  };

  // Filter out the source node from targets to prevent self-connection
  const eligibleTargets = nodes.filter((n) => n.id !== sourceId);

  return (
    <div id="manual-connector-card" className="bg-[#1A1D23] rounded-xl border border-[#374151] p-5 shadow-sm space-y-4">
      <h3 className="font-sans font-semibold text-xs text-slate-400 uppercase tracking-widest flex items-center gap-2">
        <Link2 className="w-4 h-4 text-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.4)]" />
        Manual Edge Connection
      </h3>

      <div className="bg-blue-950/20 border border-blue-900/30 rounded-lg p-3 text-xs text-slate-300 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="leading-normal">
          Select a source node, then check multiple target nodes to establish connections instantly.
        </p>
      </div>

      <form onSubmit={handleConnect} className="space-y-3">
        {/* Source Selection */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Source Node
            </label>
            {selectedNode && (
              <button
                type="button"
                onClick={setSourceFromSelected}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-medium hover:underline cursor-pointer"
              >
                Set to current active
              </button>
            )}
          </div>
          <select
            value={sourceId}
            onChange={(e) => {
              const val = e.target.value;
              setSourceId(val);
              setSelectedTargetIds((prev) => prev.filter((id) => id !== val));
            }}
            className="w-full bg-[#0F1115] border border-[#374151] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="" className="bg-[#0F1115] text-slate-400">-- Select Source Node --</option>
            {nodes.map((node) => (
              <option 
                key={node.id} 
                value={node.id} 
                className={`bg-[#0F1115] ${node.isParent ? "font-bold text-white font-sans" : "font-normal text-slate-300"}`}
                style={{ fontWeight: node.isParent ? "bold" : "normal" }}
              >
                {node.isParent ? "[Category] " : "[Site] "}{node.title.substring(0, 45)}
              </option>
            ))}
          </select>
        </div>

        {/* Target Multi-Selection (As many possible!) */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            Select Target Nodes ({selectedTargetIds.length} selected)
          </label>
          {sourceId ? (
            eligibleTargets.length > 0 ? (
              <div className="bg-[#0F1115] border border-[#374151] rounded-lg p-2.5 max-h-[160px] overflow-y-auto space-y-1.5">
                {eligibleTargets.map((node) => {
                  const isChecked = selectedTargetIds.includes(node.id);
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
                        onChange={() => handleToggleTarget(node.id)}
                        className="mt-0.5 rounded text-blue-600 focus:ring-0 cursor-pointer bg-slate-900 border-[#4B5563]"
                      />
                      <div className="truncate">
                        <span className={`block truncate ${node.isParent ? "font-bold text-slate-200" : ""}`}>
                          {node.isParent ? "[Category] " : "[Site] "}{node.title}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">{node.url}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="bg-[#0F1115] border border-[#374151] rounded-lg p-3 text-center text-xs text-slate-500 italic">
                No other websites available to connect.
              </div>
            )
          ) : (
            <div className="bg-[#0F1115]/50 border border-dashed border-[#374151] rounded-lg p-4 text-center text-xs text-slate-500 italic">
              Please select a Source Node first to choose targets.
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading || !sourceId || selectedTargetIds.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-blue-200" />
              Connecting...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              Establish Connections
            </>
          )}
        </button>
      </form>

      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 text-xs rounded-lg p-2.5 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>Successfully connected nodes in your Second Brain!</span>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-red-950/40 border border-red-900/50 text-red-400 text-xs rounded-lg p-2.5"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

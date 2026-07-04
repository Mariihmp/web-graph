import React, { useState, useEffect, useRef } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { motion, AnimatePresence } from "motion/react";
import { BrainNode, BrainEdge, GraphData } from "./types";
import UrlIngester from "./components/UrlIngester";
import NodeDrawer from "./components/NodeDrawer";
import ManualConnector from "./components/ManualConnector";
import CirclePacking from "./components/CirclePacking";
import CategoryCreator from "./components/CategoryCreator";
import { 
  Brain, Link2, Network, Info, Layers, RefreshCw, Compass, CircleDot, Sparkles, FolderPlus, Trash2, X
} from "lucide-react";

export default function App() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState<BrainNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View modes: "graph" (Force Directed Map) vs "packing" (Hierarchical D3 Circle Packing)
  const [viewMode, setViewMode] = useState<"graph" | "packing">("graph");

  // Active Tool sidebar Tab: "ingest" (Ingest Brain Wave) vs "connect" (Manual Connection) vs "category" (Create Parent Category)
  const [activeTab, setActiveTab] = useState<"ingest" | "connect" | "category" | null>("ingest");

  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  const nodesList = graphData?.nodes || [];
  const edgesList = graphData?.edges || [];

  const visibleNodes = React.useMemo(() => {
    return nodesList.filter((node) => {
      if (node.isParent) return true;
      if (!node.parentId) return true;
      return !!expandedParents[node.parentId];
    });
  }, [nodesList, expandedParents]);

  const linksList = React.useMemo(() => {
    return edgesList.map((edge) => ({
      ...edge,
      source: edge.sourceId,
      target: edge.targetId,
    }));
  }, [edgesList]);

  const visibleLinks = React.useMemo(() => {
    return linksList.filter((link) => {
      const sourceId = typeof link.source === "object" ? (link.source as any).id : link.source;
      const targetId = typeof link.target === "object" ? (link.target as any).id : link.target;
      return visibleNodes.some(n => n.id === sourceId) && visibleNodes.some(n => n.id === targetId);
    });
  }, [linksList, visibleNodes]);

  // Auto-expand the parent of the currently selected node
  useEffect(() => {
    if (selectedNode) {
      if (selectedNode.isParent) {
        setExpandedParents((prev) => ({
          ...prev,
          [selectedNode.id]: true,
        }));
      } else if (selectedNode.parentId) {
        setExpandedParents((prev) => ({
          ...prev,
          [selectedNode.parentId!]: true,
        }));
      }
    }
  }, [selectedNode]);

  // Ref for the ForceGraph instance to dynamically configure forces
  const fgRef = useRef<any>(null);

  // Resize handling for the canvas container
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });



  // Apply forces to the graph on data load or mount
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force("charge")?.strength(-180).distanceMax(350);
      fgRef.current.d3Force("link")?.distance(120);
    }
  }, [graphData, fgRef.current, viewMode]);

  const fetchGraph = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/graph");
      if (!response.ok) {
        throw new Error("Failed to load digital garden graph.");
      }
      const data = await response.json();
      setGraphData(data);

      // If we have an active selection, refresh its values
      if (selectedNode && data && Array.isArray(data.nodes)) {
        const refreshed = data.nodes.find((n: BrainNode) => n.id === selectedNode.id);
        if (refreshed) {
          setSelectedNode(refreshed);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to retrieve brain graph data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  // Set up resize observer to keep canvas perfectly scaled
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: Math.max(400, width),
          height: Math.max(300, height),
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef.current]);

  const handleIngestSuccess = (newNode: BrainNode) => {
    fetchGraph();
    setSelectedNode(newNode);
  };

  const handleNodeUpdate = (updatedNode: BrainNode) => {
    fetchGraph();
    setSelectedNode(updatedNode);
  };

  const handleNodeClick = (node: any) => {
    setSelectedNode(node);
    if (node.isParent) {
      setExpandedParents((prev) => ({
        ...prev,
        [node.id]: !prev[node.id],
      }));
    }
  };

  const handleCanvasClick = () => {
    setSelectedNode(null);
  };



  // Node Painter (Custom Canvas Rendering for Force Graph)
  const paintNode = (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isSelected = selectedNode && selectedNode.id === node.id;
    const isParentNode = node.isParent;
    
    // Size & Color mapping
    let radius = isParentNode ? 10 : 5.5;
    let color = node.color || "#475569"; // fallback to node color or slate
    
    if (!node.color) {
      if (node.ageInDays === 0) {
        radius = 8.5;
        color = "#60A5FA"; // New (Active Segment)
      } else if (node.ageInDays <= 2) {
        radius = 7.0;
        color = "#3B82F6"; // Mature
      } else if (node.ageInDays <= 7) {
        radius = 6.0;
        color = "#1D4ED8"; // Mid-mature
      } else {
        radius = 5.0;
        color = "#475569"; // Legacy
      }
    }

    // Outer halo / selection rings
    if (isSelected) {
      // Large glow ring
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 6, 0, 2 * Math.PI);
      ctx.fillStyle = isParentNode ? "rgba(147, 197, 253, 0.2)" : `${color}35`;
      ctx.fill();

      // Sharp accent border
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 2.5, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    } else if (isParentNode) {
      // Subtle constant ring for group parents
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 3.5, 0, 2 * Math.PI);
      ctx.strokeStyle = `${color}60`;
      ctx.lineWidth = 1 / globalScale;
      ctx.stroke();
    } else if (node.ageInDays === 0) {
      // Pulsing effect for brand new nodes
      const timePulse = Math.abs(Math.sin(Date.now() / 320)) * 2;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 2 + timePulse, 0, 2 * Math.PI);
      ctx.fillStyle = `${color}15`;
      ctx.fill();
    }

    // Base Node circle - site nodes are drawn as full dots, category/parent nodes as nested rings
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    if (isParentNode) {
      // Inner core hole for category node
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius * 0.45, 0, 2 * Math.PI);
      ctx.fillStyle = "#090A0C"; // Dark center for extreme contrast
      ctx.fill();

      // Inner core center dot for category node
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius * 0.25, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Node Labels
    if (globalScale > 0.45) {
      const label = node.shortTitle || node.title || node.id;
      const fontSize = Math.max(9, isParentNode ? 11 : 10 / Math.sqrt(globalScale));
      ctx.font = isParentNode ? `bold ${fontSize}px Inter, sans-serif` : `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      // Dark backdrop pill for clear reading on dark grid background
      ctx.fillStyle = "rgba(15, 17, 21, 0.85)";
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(
        node.x - textWidth / 2 - 4,
        node.y + radius + 3,
        textWidth + 8,
        fontSize + 4
      );

      // Label text
      ctx.fillStyle = isSelected ? "#60A5FA" : isParentNode ? "#F8FAFC" : "#CBD5E1";
      ctx.fillText(label, node.x, node.y + radius + 5);
    }
  };

  return (
    <div id="app-root-container" className="h-screen w-screen bg-[#090A0C] text-[#E2E8F0] flex flex-col font-sans overflow-hidden">
      {/* Elegant System Header */}
      <header className="h-16 border-b border-[#1F2937] bg-[#0F1115] flex items-center justify-between px-6 shrink-0 shadow-sm z-30">
        <div className="flex items-center">
          <h1 className="font-sans font-bold text-base text-white tracking-widest">
            SYNAPSE
          </h1>
        </div>

        {/* View Selection Mode Slider */}
        <div className="flex items-center bg-[#1A1D23] p-1 rounded-lg border border-[#374151]">
          <button
            onClick={() => setViewMode("graph")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
              viewMode === "graph" 
                ? "bg-blue-600 text-white shadow-sm" 
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Digital Garden Graph</span>
          </button>
          <button
            onClick={() => setViewMode("packing")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
              viewMode === "packing" 
                ? "bg-blue-600 text-white shadow-sm" 
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <CircleDot className="w-4 h-4" />
            <span>Circular Tree Map</span>
          </button>
        </div>

        {/* Real-time Statistics Grid */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-4 bg-[#1A1D23]/50 border border-[#1F2937] rounded-lg px-4 py-1.5 text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_4px_#60A5FA]" />
              <span>Nodes: <strong className="text-white">{nodesList.length}</strong></span>
            </div>
            <div className="w-[1px] h-3 bg-[#1F2937]" />
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-800" />
              <span>Edges: <strong className="text-white">{edgesList.length}</strong></span>
            </div>
          </div>

          <button
            onClick={fetchGraph}
            title="Refresh digital garden"
            className="p-2 border border-[#374151] rounded-lg bg-[#1A1D23] hover:bg-[#374151] transition cursor-pointer text-slate-400 hover:text-white"
          >
            <RefreshCw className="w-4 h-4 animate-hover-spin" />
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Interactive Visual Canvas Container */}
        <div 
          ref={containerRef} 
          className="flex-1 relative bg-[#090A0C] overflow-hidden"
          style={{ 
            backgroundImage: "radial-gradient(#1F2937 1px, transparent 1px)", 
            backgroundSize: "32px 32px" 
          }}
        >
          {isLoading && nodesList.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#090A0C]/90 z-20 space-y-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-400 font-mono">Seeding visual digital garden...</p>
            </div>
          ) : null}

          {nodesList.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-10 max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 bg-[#1A1D23] border border-[#374151] rounded-2xl flex items-center justify-center text-blue-400 shadow-sm animate-pulse">
                <Network className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-sans font-semibold text-white text-base">Your digital garden is empty</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Start mapping your knowledge graph by pasting website articles or URLs in the right panel. Gemini will automatically extract context, tag topics, and discover conceptual linkages!
                </p>
              </div>
            </div>
          ) : viewMode === "packing" ? (
            <CirclePacking
              nodes={nodesList}
              onNodeClick={handleNodeClick}
              selectedNode={selectedNode}
              width={dimensions.width}
              height={dimensions.height}
            />
          ) : (
            <ForceGraph2D
              ref={fgRef}
              graphData={{ nodes: visibleNodes, links: visibleLinks }}
              width={dimensions.width}
              height={dimensions.height}
              onNodeClick={handleNodeClick}
              onBackgroundClick={handleCanvasClick}
              nodeCanvasObject={paintNode}
              nodePointerAreaPaint={(node, color, ctx) => {
                ctx.beginPath();
                ctx.arc(node.x, node.y, 14, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.fill();
              }}

              // Direct graphs - connections starting from parent to the children or conceptual associations
              linkWidth={1.5}
              linkColor={(link: any) => {
                const sourceNode = nodesList.find(n => n.id === (typeof link.source === 'object' ? link.source.id : link.source));
                return sourceNode?.color ? `${sourceNode.color}45` : "rgba(55, 65, 81, 0.4)";
              }}
              linkDirectionalArrowLength={4.5}
              linkDirectionalArrowRelPos={0.95}
              linkDirectionalArrowColor={(link: any) => {
                const sourceNode = nodesList.find(n => n.id === (typeof link.source === 'object' ? link.source.id : link.source));
                return sourceNode?.color || "#3B82F6";
              }}
              linkDirectionalParticles={2}
              linkDirectionalParticleSpeed={0.008}
              linkDirectionalParticleWidth={1.5}
              linkDirectionalParticleColor={(link: any) => {
                const sourceNode = nodesList.find(n => n.id === (typeof link.source === 'object' ? link.source.id : link.source));
                return sourceNode?.color || "#60A5FA";
              }}
              cooldownTicks={100}
            />
          )}

          {/* Bottom-left stack containing Graph Legend and Tool Bar */}
          <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-3">
            {/* Quick Graph Legend */}
            {nodesList.length > 0 && viewMode === "graph" && (
              <div className="bg-[#0F1115]/90 backdrop-blur-md border border-[#1F2937] rounded-lg p-3.5 text-[10px] space-y-2.5 shadow-lg font-mono text-slate-400 w-48">
                <div className="font-bold text-[10px] text-slate-500 uppercase tracking-tighter pb-1.5 border-b border-[#1F2937] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" /> GRAPH LEGEND
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-4 h-4 rounded-full border border-blue-400 bg-[#090A0C] flex items-center justify-center shadow-[0_0_4px_rgba(96,165,250,0.3)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  </span>
                  <span className="font-bold text-white">Category Node</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-slate-500 block" />
                  <span className="text-slate-300">Site Node</span>
                </div>
              </div>
            )}

            {/* Tool Bar under Graph Legend */}
            <div className="bg-[#0F1115]/90 backdrop-blur-md border border-[#1F2937] rounded-lg p-3 shadow-lg flex items-center justify-between w-48">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Tools</span>
              
              <div className="flex items-center bg-[#1A1D23] p-1 rounded-md border border-[#374151] gap-1">
                <button
                  onClick={() => {
                    setActiveTab("ingest");
                    setSelectedNode(null);
                  }}
                  title="Ingest Brain Wave"
                  className={`p-1.5 rounded transition cursor-pointer ${
                    activeTab === "ingest" && !selectedNode
                      ? "bg-blue-600 text-white" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setActiveTab("connect");
                    setSelectedNode(null);
                  }}
                  title="Manual Edge Connection"
                  className={`p-1.5 rounded transition cursor-pointer ${
                    activeTab === "connect" && !selectedNode
                      ? "bg-blue-600 text-white" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Link2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setActiveTab("category");
                    setSelectedNode(null);
                  }}
                  title="Create Parent Category"
                  className={`p-1.5 rounded transition cursor-pointer ${
                    activeTab === "category" && !selectedNode
                      ? "bg-blue-600 text-white" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Floating Right Panel (The div that you selected, Selector 3) */}
        <div 
          id="right-panel"
          className="absolute right-4 top-4 bottom-4 w-[420px] z-20 flex flex-col bg-[#0F1115]/95 backdrop-blur-md border border-[#1F2937] rounded-xl p-5 shadow-2xl overflow-hidden"
        >
          {selectedNode ? (
            <NodeDrawer
              node={selectedNode}
              allNodes={nodesList}
              edges={edgesList}
              onClose={() => setSelectedNode(null)}
              onUpdate={handleNodeUpdate}
              onSelectNode={setSelectedNode}
              onDelete={() => {
                setSelectedNode(null);
                fetchGraph();
              }}
            />
          ) : activeTab ? (
            <div className="bg-[#1A1D23] rounded-xl border border-[#374151] p-5 shadow-lg flex flex-col flex-grow min-h-0 overflow-hidden">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1F2937] shrink-0">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">
                  {activeTab === "ingest" ? "Ingest Brain Wave" : activeTab === "connect" ? "Manual Connection" : "Create Parent Category"}
                </span>
                <button 
                  onClick={() => setActiveTab(null)}
                  className="text-slate-500 hover:text-white hover:bg-slate-800 p-1 rounded transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-grow overflow-y-auto pr-1">
                {activeTab === "ingest" && (
                  <UrlIngester onIngestSuccess={handleIngestSuccess} />
                )}
                {activeTab === "connect" && (
                  <ManualConnector
                    nodes={nodesList}
                    selectedNode={selectedNode}
                    onConnectionSuccess={fetchGraph}
                  />
                )}
                {activeTab === "category" && (
                  <CategoryCreator nodes={nodesList} onSuccess={fetchGraph} />
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#1A1D23] rounded-xl border border-dashed border-[#374151] p-6 text-center text-xs text-slate-400 flex flex-col items-center justify-center py-12 space-y-3 flex-grow my-auto">
              <Info className="w-5 h-5 text-blue-400 animate-pulse" />
              <p className="font-medium text-white text-sm">Active Selection</p>
              <p className="leading-relaxed">
                Click any website circle or category on your garden to expand details, edit tags, update parent grouping, or view sub-nodes.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import { BrainNode } from "../types";
import { Maximize2, Minimize2, ZoomIn, Info } from "lucide-react";

interface CirclePackingProps {
  nodes: BrainNode[];
  onNodeClick: (node: BrainNode) => void;
  selectedNode: BrainNode | null;
  width: number;
  height: number;
}

interface PackDatum {
  id: string;
  name: string;
  color?: string;
  value?: number;
  nodeData?: BrainNode;
  children?: PackDatum[];
}

export default function CirclePacking({
  nodes,
  onNodeClick,
  selectedNode,
  width,
  height,
}: CirclePackingProps) {
  const [zoomKey, setZoomKey] = useState<string | null>(null);

  // Construct hierarchy from flat parent-child relationship
  const hierarchyData = useMemo(() => {
    const parentNodes = nodes.filter((n) => n.isParent);
    const childNodes = nodes.filter((n) => !n.isParent);

    const childrenList: PackDatum[] = [];

    // Add each parent node group
    parentNodes.forEach((parent) => {
      const parentColor = parent.color || "#3B82F6";
      const childrenOfThisParent = childNodes.filter((c) => c.parentId === parent.id);

      childrenList.push({
        id: parent.id,
        name: parent.title,
        color: parentColor,
        nodeData: parent,
        children: childrenOfThisParent.map((child) => ({
          id: child.id,
          name: child.title,
          color: parentColor, // child gets same color as parent category
          value: 1, // uniform weight, or based on content length
          nodeData: child,
        })),
      });
    });

    // Group for uncategorized/standalone nodes
    const uncategorizedNodes = childNodes.filter((c) => !c.parentId);
    if (uncategorizedNodes.length > 0) {
      childrenList.push({
        id: "uncategorized",
        name: "Uncategorized Sites",
        color: "#64748B", // slate grey for uncategorized
        children: uncategorizedNodes.map((child) => ({
          id: child.id,
          name: child.title,
          color: child.color || "#475569",
          value: 1,
          nodeData: child,
        })),
      });
    }

    const root: PackDatum = {
      id: "root",
      name: "Brain Garden",
      color: "#0F1115",
      children: childrenList,
    };

    return root;
  }, [nodes]);

  // Compute Circle Packing Layout
  const packingResult = useMemo(() => {
    if (width <= 0 || height <= 0) return null;

    const rootNode = d3
      .hierarchy<PackDatum>(hierarchyData)
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const pack = d3
      .pack<PackDatum>()
      .size([width - 40, height - 40])
      .padding(8);

    const packedRoot = pack(rootNode);
    return packedRoot.descendants();
  }, [hierarchyData, width, height]);

  if (!packingResult) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-500 font-mono text-xs">
        Preparing circle packing canvas...
      </div>
    );
  }

  // Find zoomed element or fallback to root (which covers full bounds)
  const rootElement = packingResult.find((d) => d.data.id === "root");
  const zoomElement = zoomKey
    ? packingResult.find((d) => d.data.id === zoomKey) || rootElement
    : rootElement;

  // Zoom math: mapping original coordinates to fill the container nicely
  const zoomX = zoomElement?.x ?? width / 2;
  const zoomY = zoomElement?.y ?? height / 2;
  const zoomR = zoomElement?.r ?? Math.min(width, height) / 2;

  const viewPadding = 30;
  const scale = (Math.min(width, height) - viewPadding * 2) / (zoomR * 2 || 1);

  const getTransformedX = (x: number) => {
    return width / 2 + (x - zoomX) * scale;
  };

  const getTransformedY = (y: number) => {
    return height / 2 + (y - zoomY) * scale;
  };

  const getTransformedR = (r: number) => {
    return r * scale;
  };

  return (
    <div className="w-full h-full relative overflow-hidden select-none">
      {/* Dynamic Header Overlay */}
      <div className="absolute top-4 left-4 bg-[#0F1115]/90 border border-[#1F2937] px-3 py-2 rounded-lg text-xs flex items-center gap-2 z-10 shadow-md">
        <Info className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-slate-300">
          Double-click any group circle to **zoom in/out**. Single-click to select a node.
        </span>
      </div>

      {zoomKey && (
        <button
          onClick={() => setZoomKey(null)}
          className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-500 text-white border-none px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition z-10 font-medium shadow-md shadow-blue-900/40 animate-fade-in"
        >
          <Minimize2 className="w-3.5 h-3.5" />
          Zoom Out to Root
        </button>
      )}

      {/* SVG Canvas */}
      <svg width={width} height={height} className="w-full h-full">
        <g>
          {packingResult.map((d) => {
            if (d.data.id === "root") return null; // skip root background circle to keep layout clean

            const isParentGroup = d.depth === 1;
            const isLeafNode = d.depth === 2;
            const hasChildren = d.children && d.children.length > 0;

            const cx = getTransformedX(d.x);
            const cy = getTransformedY(d.y);
            const r = getTransformedR(d.r);

            // Skip rendering if circle shrinks into sub-pixel scale
            if (r < 1.5) return null;

            const isSelected = selectedNode && selectedNode.id === d.data.id;

            // Define coloring based on depth and tags
            let fill = "transparent";
            let stroke = "#374151";
            let strokeWidth = 1;
            let strokeDasharray = undefined;

            if (isParentGroup) {
              fill = d.data.color ? `${d.data.color}0d` : "rgba(59, 130, 246, 0.05)";
              stroke = d.data.color || "#3B82F6";
              strokeWidth = 1.5;
              strokeDasharray = hasChildren ? "3 3" : undefined;
            } else if (isLeafNode) {
              fill = d.data.color ? `${d.data.color}25` : "rgba(71, 85, 105, 0.2)";
              stroke = d.data.color || "#475569";
              strokeWidth = isSelected ? 2.5 : 1;
            }

            return (
              <g
                key={d.data.id}
                className="transition-all duration-500 ease-out"
                onClick={(e) => {
                  e.stopPropagation();
                  if (d.data.nodeData) {
                    onNodeClick(d.data.nodeData);
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (hasChildren) {
                    setZoomKey(zoomKey === d.data.id ? null : d.data.id);
                  }
                }}
              >
                {/* Visual Glow for Selected Node */}
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r + 4}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={1}
                    className="animate-pulse opacity-40"
                  />
                )}

                {/* Primary Circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={fill}
                  stroke={isSelected ? "#60A5FA" : stroke}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  className={`transition-colors duration-300 ${
                    d.data.nodeData ? "cursor-pointer hover:brightness-125" : "cursor-zoom-in"
                  }`}
                />

                {/* Text Label */}
                {r > 16 && (
                  <text
                    x={cx}
                    y={isParentGroup && hasChildren ? cy - r + 15 : cy + 3}
                    textAnchor="middle"
                    fill={isParentGroup ? "#E2E8F0" : isSelected ? "#60A5FA" : "#94A3B8"}
                    fontSize={isParentGroup ? "10px" : "9px"}
                    fontWeight={isParentGroup || isSelected ? "bold" : "normal"}
                    fontFamily="monospace"
                    className="pointer-events-none select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                  >
                    {d.data.name.length > (r / 3)
                      ? `${d.data.name.substring(0, Math.floor(r / 3.5))}...`
                      : d.data.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

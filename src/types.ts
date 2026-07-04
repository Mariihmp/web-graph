export interface BrainNode {
  id: string;
  url: string;
  title: string;
  description: string;
  tags: string[];
  createdAt: string;
  ageInDays: number;
  isParent?: boolean;
  color?: string | null;
  parentId?: string | null;
  type?: string | null;
  shortTitle?: string | null;
  x?: number;
  y?: number;
}

export interface BrainEdge {
  id: string;
  sourceId: string;
  targetId: string;
  reason: string;
  source?: string | BrainNode;
  target?: string | BrainNode;
}

export interface GraphData {
  nodes: BrainNode[];
  edges: BrainEdge[];
}

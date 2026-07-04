import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

// ES Module dirname resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup database client (prevent hot-reloading duplicate instances)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// OpenRouter API Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY?.trim();
const LLM_MODEL = process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o-mini";
const OPENROUTER_REFERER = process.env.APP_URL?.trim() || "http://localhost:3000";
const FALLBACK_LLM_MODEL = process.env.OPENROUTER_FALLBACK_MODEL?.trim() || "openai/gpt-4o-mini";

// Helper function to call OpenRouter with a robust fallback model
async function callOpenRouter(systemInstruction: string, prompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not defined in your .env file.");
  }

  const modelsToTry = [LLM_MODEL, FALLBACK_LLM_MODEL].filter((value, index, self) => value && self.indexOf(value) === index);
  let lastError: Error | null = null;

  for (const modelName of modelsToTry) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": OPENROUTER_REFERER,
        "X-Title": "Second Brain Garden",
      },
      body: JSON.stringify({
        model: modelName,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (typeof content === "string") {
        return content;
      }

      if (Array.isArray(content)) {
        return content.map((part: any) => (typeof part === "string" ? part : part?.text || "")).join("");
      }

      return "";
    }

    const errText = await response.text();
    lastError = new Error(`OpenRouter API error for ${modelName}: ${response.status} - ${errText}`);

    if (response.status !== 404 && response.status !== 400) {
      break;
    }
  }

  throw lastError || new Error("OpenRouter request failed.");
}

function parseJsonResponse<T>(raw: string): T | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    return JSON.parse(normalized) as T;
  } catch {
    const start = normalized.indexOf("{");
    const end = normalized.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(normalized.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function toReadableTitle(input: string) {
  const trimmed = (input || "").trim();
  if (!trimmed) {
    return "Untitled";
  }

  let readable = trimmed;
  try {
    readable = decodeURIComponent(trimmed);
  } catch {
    readable = trimmed;
  }

  readable = readable
    .replace(/^https?:\/\//i, "")
    .replace(/[?#].*$/, "")
    .replace(/^www\./i, "")
    .replace(/\/+/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const segments = readable
    .split(" ")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return "Untitled";
  }

  const title = segments
    .map((segment) => segment.replace(/\b\w/g, (char) => char.toUpperCase()))
    .join(" ");

  return title.length > 80 ? `${title.slice(0, 77)}...` : title;
}

function extractFallbackMetadata(url: string, content: string) {
  const normalizedContent = (content || "").trim();
  const lines = normalizedContent.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const placeholderPattern = /^fallback content for/i;

  let title = "";

  // Find first meaningful markdown heading or clean line
  const h1Line = lines.find((l) => l.startsWith("# "));
  if (h1Line) {
    title = h1Line.replace(/^#\s+/, "").trim();
  } else {
    const simpleLine = lines.find((l) => !l.startsWith("!") && !l.startsWith("[") && l.length > 3 && !placeholderPattern.test(l));
    if (simpleLine) {
      title = simpleLine;
    }
  }

  if (!title || title.length > 100 || placeholderPattern.test(title)) {
    title = toReadableTitle(url);
  }

  let cleanedContent = content
    .replace(/^#+\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/[\*\_\`\#]/g, "")
    .trim();

  const descLines = cleanedContent.split("\n").map(l => l.trim()).filter(l => l.length > 20);
  let description = descLines[0] || `Information about ${title}.`;
  if (description.length > 200) {
    description = description.substring(0, 197) + "...";
  }

  let type = "Website";
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes("course") || lowerUrl.includes("learn") || lowerUrl.includes("class")) {
    type = "Course";
  } else if (lowerUrl.includes("blog") || lowerUrl.includes("post") || lowerUrl.includes("article") || lowerUrl.includes("medium.com")) {
    type = "Blog Post";
  } else if (lowerUrl.includes("github") || lowerUrl.includes("tool") || lowerUrl.includes("app")) {
    type = "Tool";
  } else {
    type = "Article";
  }

  const tags: string[] = [];
  const words = cleanedContent.toLowerCase().split(/[^a-zA-Z]+/);
  const tagCandidates = ["learning", "ai", "rag", "llamaindex", "react", "programming", "database", "agent", "development", "tutorial", "guide"];
  
  for (const candidate of tagCandidates) {
    if (words.includes(candidate)) {
      tags.push(candidate.charAt(0).toUpperCase() + candidate.slice(1));
    }
  }
  
  if (tags.length === 0) {
    tags.push(type);
    tags.push("Digital Garden");
  }
  
  const shortTitle = title.length > 25 ? title.substring(0, 22) + "..." : title;

  return {
    title,
    shortTitle,
    type,
    description,
    tags: tags.slice(0, 4),
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // GET /api/graph: Returns all nodes and edges
  app.get("/api/graph", async (req, res) => {
    try {
      const nodes = await prisma.node.findMany({
        orderBy: { createdAt: "desc" },
      });
      const edges = await prisma.edge.findMany();

      // Dynamically compute ageInDays for each node
      const nodesWithAge = nodes.map((node) => {
        const ageInMs = new Date().getTime() - new Date(node.createdAt).getTime();
        const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));
        const cleanText = (val: string | undefined | null) => {
          if (!val) return val;
          return val.replace(/^Title:\s*/i, "");
        };
        return {
          ...node,
          title: cleanText(node.title) || "",
          shortTitle: cleanText(node.shortTitle),
          ageInDays: Math.max(0, ageInDays),
          tags: JSON.parse(node.tags), // parse tags JSON array
        };
      });

      res.json({
        nodes: nodesWithAge,
        edges,
      });
    } catch (error: any) {
      console.error("Failed to fetch graph data:", error);
      res.status(500).json({ error: "Failed to retrieve second brain graph data.", details: error.message });
    }
  });

  // POST /api/ingest: Scrapes URL, extracts details using LLM, finds semantic connections, saves to database
  app.post("/api/ingest", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL parameter is required." });
    }

    try {
      const rawUrls = url.split(/[\s,]+/).map((u) => u.trim()).filter((u) => u.length > 0);
      const validUrls = rawUrls.map((u) => /^https?:\/\//i.test(u) ? u : "https://" + u);

      if (validUrls.length === 0) {
        return res.status(400).json({ error: "No valid URLs provided." });
      }

      console.log(`Processing ${validUrls.length} URLs for ingestion...`);
      const extractedDataList = [];

      for (const targetUrl of validUrls) {
        console.log(`Scraping content from URL: ${targetUrl}`);
        let markdownContent = "";
        try {
          const scrapeRes = await fetch(`https://r.jina.ai/${targetUrl}`);
          if (scrapeRes.ok) {
            markdownContent = await scrapeRes.text();
          } else {
            console.warn(`Jina Reader returned status: ${scrapeRes.status}`);
          }
        } catch (scrapeError) {
          console.warn(`Jina Reader failed. Error: ${scrapeError.message}`);
        }
        
        if (!markdownContent) {
          markdownContent = "";
        }

        console.log(`Analyzing scraped content for ${targetUrl} with OpenRouter...`);
        const fallbackData = extractFallbackMetadata(targetUrl, markdownContent);
        const extractionPrompt = `You are a critical component of a Second Brain system. Read the following website content (in markdown format if available) and extract/generate the website's title, a concise 2-sentence description, a shortTitle, and a type. Organically invent 3 to 5 hyper-relevant tags based entirely on the specific content.
        
        Website Content:
        ${markdownContent.substring(0, 10000)} // truncate to preserve token limit if extremely large`;

        try {
          const systemInstruction = "You are a website metadata extractor. You must extract the website's title, a concise 2-sentence description, a shortTitle, and a type (e.g. Course, Blog Post, Tool, Article). Organically invent 3 to 5 hyper-relevant tags. Return data strictly in valid JSON format matching this schema: { \"title\": \"string\", \"shortTitle\": \"string\", \"type\": \"string\", \"description\": \"string\", \"tags\": [\"string\"] }";
          const responseText = await callOpenRouter(systemInstruction, extractionPrompt);
          const extractionData = JSON.parse(responseText || "{}");
          const cleanText = (val: string | undefined | null) => {
            if (!val) return val;
            return val.replace(/^Title:\s*/i, "").trim();
          };
          const finalTitle = cleanText(extractionData.title) || fallbackData.title || targetUrl;
          const finalShortTitle = cleanText(extractionData.shortTitle) || fallbackData.shortTitle || finalTitle.substring(0, 20) || targetUrl;

          extractedDataList.push({
            url: targetUrl,
            nodeId: targetUrl.trim().replace(/\/$/, "").toLowerCase(),
            title: finalTitle,
            shortTitle: finalShortTitle,
            type: extractionData.type || fallbackData.type || "Website",
            description: extractionData.description || fallbackData.description || "No description generated.",
            tags: extractionData.tags || fallbackData.tags || [],
          });
        } catch (aiErr) {
          console.error(`Failed AI extraction for ${targetUrl}:`, aiErr);
          console.log(`Using smart fallback parser for ${targetUrl}...`);
          extractedDataList.push({
            url: targetUrl,
            nodeId: targetUrl.trim().replace(/\/$/, "").toLowerCase(),
            ...fallbackData
          });
        }
      }

      if (extractedDataList.length === 0) {
        return res.status(500).json({ error: "Failed to extract data for any provided URLs." });
      }

      let categoryNode = null;
      if (extractedDataList.length > 1) {
        console.log("Generating Category Node for batch ingestion...");
        const catPrompt = `We have just ingested multiple websites together. We need to create a parent category node to group them in a star topology. 
        Here are the websites: ${JSON.stringify(extractedDataList.map(d => ({ title: d.title, description: d.description, tags: d.tags }))) }
        
        Generate a category title, description, shortTitle, and tags for this group.`;
        
        try {
          const systemInstruction = "You are a semantic categorizer. Create an overarching category node to group the provided websites. You must return your response strictly in valid JSON format matching this schema: { \"title\": \"string\", \"shortTitle\": \"string\", \"description\": \"string\", \"tags\": [\"string\"] }";
          const responseText = await callOpenRouter(systemInstruction, catPrompt);
          const catData = JSON.parse(responseText || "{}");
          const catId = "cat-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
          
          categoryNode = {
            id: catId,
            url: "category://" + catId,
            title: catData.title || "New Batch Category",
            shortTitle: catData.shortTitle || "Batch Category",
            type: "Category",
            description: catData.description || "Automatically grouped sites.",
            tags: catData.tags || [],
            isParent: true,
            color: "#8B5CF6", // Purple for batch category
          };
        } catch (e) {
          console.error("Failed to generate category node:", e);
          const catId = "cat-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
          categoryNode = {
            id: catId,
            url: "category://" + catId,
            title: "Import Batch " + new Date().toLocaleDateString(),
            shortTitle: "Batch Category",
            type: "Category",
            description: `Group of ${extractedDataList.length} websites ingested together.`,
            tags: ["Batch", "Category"],
            isParent: true,
            color: "#8B5CF6",
          };
        }
      }

      let generatedEdges = [];
      
      console.log("Writing Nodes and Edges to database...");
      const createdNodes = await prisma.$transaction(async (tx) => {
        let catNodeResult = null;
        if (categoryNode) {
          catNodeResult = await tx.node.upsert({
            where: { id: categoryNode.id },
            update: { ...categoryNode, tags: JSON.stringify(categoryNode.tags) },
            create: { ...categoryNode, tags: JSON.stringify(categoryNode.tags) },
          });
        }

        const nodesToReturn = [];
        if (catNodeResult) {
           nodesToReturn.push({ ...catNodeResult, tags: categoryNode.tags, ageInDays: 0 });
        }

        for (const nodeData of extractedDataList) {
          const parentId = categoryNode ? categoryNode.id : null;
          const childColor = categoryNode ? categoryNode.color : undefined;
          
          const dbNode = await tx.node.upsert({
            where: { id: nodeData.nodeId },
            update: {
              title: nodeData.title,
              description: nodeData.description,
              type: nodeData.type,
              shortTitle: nodeData.shortTitle,
              parentId: parentId || undefined,
              tags: JSON.stringify(nodeData.tags),
              color: childColor,
            },
            create: {
              id: nodeData.nodeId,
              url: nodeData.url,
              title: nodeData.title,
              description: nodeData.description,
              type: nodeData.type,
              shortTitle: nodeData.shortTitle,
              parentId: parentId,
              tags: JSON.stringify(nodeData.tags),
              color: childColor,
            }
          });

          // Create the directed edge to represent star topology
          if (parentId) {
            const edgeExists = await tx.edge.findFirst({
              where: { sourceId: parentId, targetId: nodeData.nodeId }
            });
            if (!edgeExists) {
              await tx.edge.create({
                data: {
                  sourceId: parentId,
                  targetId: nodeData.nodeId,
                  reason: `Parent-child directed classification under ${categoryNode.title}`
                }
              });
            }
          }

          nodesToReturn.push({ ...dbNode, tags: nodeData.tags, ageInDays: 0 });
        }

        for (const edge of generatedEdges) {
          const targetExists = await tx.node.findUnique({ where: { id: edge.targetId } });
          if (targetExists && edge.targetId !== edge.sourceId) {
            await tx.edge.create({
              data: {
                sourceId: edge.sourceId,
                targetId: edge.targetId,
                reason: edge.reason,
              }
            });
          }
        }
        
        return nodesToReturn;
      });

      res.status(201).json({
        success: true,
        node: categoryNode ? createdNodes[0] : createdNodes[0], 
        nodes: createdNodes,
        connectionsAdded: generatedEdges.length
      });

    } catch (error) {
      console.error("Ingestion error:", error);
      res.status(500).json({ error: "Failed to ingest website and build brain connections.", details: error.message });
    }
  });

  // PUT /api/node/*/edges: Synchronizes the connections of a node
  app.put("/api/node/:id(*)/edges", async (req, res) => {
    let id = req.params.id || "";
    try {
      id = decodeURIComponent(id);
    } catch (e) {}
    const { connectedNodeIds } = req.body; // array of node IDs that should be connected

    const fallbackIdCandidates = [id, id.replace(/\s+/g, ""), id.replace(/:\/\//g, "://")].filter(Boolean);
    
    if (!Array.isArray(connectedNodeIds)) {
      return res.status(400).json({ error: "connectedNodeIds must be an array" });
    }

    try {
      let currentNode = null as any;
      for (const candidateId of fallbackIdCandidates) {
        currentNode = await prisma.node.findUnique({ where: { id: candidateId } });
        if (currentNode) {
          id = candidateId;
          break;
        }
      }

      if (!currentNode) {
        return res.status(404).json({ error: "Node not found" });
      }

      // 1. Delete all existing edges where this node is either source or target
      await prisma.edge.deleteMany({
        where: {
          OR: [
            { sourceId: id },
            { targetId: id }
          ]
        }
      });

      // 2. Build complete list of node IDs to connect to
      const targetIdsToConnect = [...connectedNodeIds];

      // If the node has a parent category, ensure that connection exists
      if (currentNode.parentId && !targetIdsToConnect.includes(currentNode.parentId)) {
        targetIdsToConnect.push(currentNode.parentId);
      }

      // If other nodes had this node as their parent, ensure those connections are kept
      const childNodes = await prisma.node.findMany({
        where: { parentId: id }
      });
      for (const child of childNodes) {
        if (!targetIdsToConnect.includes(child.id)) {
          targetIdsToConnect.push(child.id);
        }
      }

      // 3. Create new edges for each ID in the array (prevent duplicates and ignore self)
      const createdEdges = [];
      const seen = new Set();
      
      for (const targetId of targetIdsToConnect) {
        if (targetId === id) continue;
        if (seen.has(targetId)) continue;
        seen.add(targetId);

        const isParentChild = (currentNode.parentId === targetId) || 
                              (childNodes.some(c => c.id === targetId));

        const edge = await prisma.edge.create({
          data: {
            sourceId: id,
            targetId: targetId,
            reason: isParentChild 
              ? `Parent-child directed classification under parent category`
              : "Manual connection"
          }
        });
        createdEdges.push(edge);
      }

      res.json({ success: true, count: createdEdges.length, edges: createdEdges });
    } catch (error: any) {
      console.error("Failed to sync node edges:", error);
      res.status(500).json({ error: "Failed to update connections.", details: error.message });
    }
  });

  // DELETE /api/node/*/edges: Disconnect ALL edges of a node
  app.delete("/api/node/:id(*)/edges", async (req, res) => {
    let id = req.params.id || "";
    try {
      id = decodeURIComponent(id);
    } catch (e) {}
    try {
      let nodeObj = null as any;
      for (const candidateId of [id, id.replace(/\s+/g, ""), id.replace(/:\/\//g, "://")].filter(Boolean)) {
        nodeObj = await prisma.node.findUnique({ where: { id: candidateId } });
        if (nodeObj) {
          id = candidateId;
          break;
        }
      }

      if (!nodeObj) {
        return res.status(404).json({ error: "Node not found" });
      }

      const deleted = await prisma.edge.deleteMany({
        where: {
          OR: [
            { sourceId: id },
            { targetId: id }
          ]
        }
      });
      
      // Also clear parentId since it's disconnected
      await prisma.node.update({
        where: { id },
        data: { parentId: null }
      });

      // If it's a parent, set children's parentId to null
      await prisma.node.updateMany({
        where: { parentId: id },
        data: { parentId: null }
      });

      res.json({ success: true, count: deleted.count });
    } catch (error: any) {
      console.error("Failed to disconnect all edges:", error);
      res.status(500).json({ error: "Failed to disconnect all edges.", details: error.message });
    }
  });

  // PUT /api/node/*: Update node title, description, tags, color, parentId manually
  app.put("/api/node/:id(*)", async (req, res) => {
    let id = req.params.id || "";
    try {
      id = decodeURIComponent(id);
    } catch (e) {}
    const { title, description, tags, color, parentId, isParent } = req.body;

    try {
      let currentNode = null as any;
      for (const candidateId of [id, id.replace(/\s+/g, ""), id.replace(/:\/\//g, "://")].filter(Boolean)) {
        currentNode = await prisma.node.findUnique({ where: { id: candidateId } });
        if (currentNode) {
          id = candidateId;
          break;
        }
      }

      if (!currentNode) {
        return res.status(404).json({ error: "Node not found." });
      }

      let finalColor = color !== undefined ? color : currentNode.color;
      let finalParentId = parentId !== undefined ? parentId : currentNode.parentId;

      // If attaching to a parent, sync the color with parent and create a directed edge!
      if (parentId && parentId !== currentNode.parentId) {
        const parentNode = await prisma.node.findUnique({ where: { id: parentId } });
        if (parentNode) {
          if (parentNode.color) {
            finalColor = parentNode.color;
          }
          
          // Check if directed edge from parent to child already exists
          const edgeExists = await prisma.edge.findFirst({
            where: { sourceId: parentId, targetId: id }
          });
          if (!edgeExists) {
            await prisma.edge.create({
              data: {
                sourceId: parentId,
                targetId: id,
                reason: `Parent-child directed classification under ${parentNode.title}`
              }
            });
          }
        }
      } else if (parentId === null && currentNode.parentId) {
        // If detaching, remove the directed edge between the old parent and this node
        await prisma.edge.deleteMany({
          where: {
            OR: [
              { sourceId: currentNode.parentId, targetId: id },
              { sourceId: id, targetId: currentNode.parentId }
            ]
          }
        });
      }

      // If this is a parent node and its color changed, propagate the color to all its children!
      if (currentNode.isParent && color && color !== currentNode.color) {
        await prisma.node.updateMany({
          where: { parentId: id },
          data: { color }
        });
      }

      const finalShortTitle = title !== undefined ? (title.length > 25 ? title.substring(0, 22) + "..." : title) : undefined;

      const updatedNode = await prisma.node.update({
        where: { id },
        data: {
          title: title !== undefined ? title : currentNode.title,
          shortTitle: finalShortTitle !== undefined ? finalShortTitle : currentNode.shortTitle,
          description: description !== undefined ? description : currentNode.description,
          tags: tags !== undefined ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : currentNode.tags,
          color: finalColor,
          parentId: finalParentId,
          isParent: isParent !== undefined ? isParent : currentNode.isParent,
        }
      });

      res.json({
        success: true,
        node: {
          ...updatedNode,
          tags: Array.isArray(tags) ? tags : JSON.parse(updatedNode.tags)
        }
      });
    } catch (error: any) {
      console.error("Failed to update node:", error);
      res.status(500).json({ error: "Failed to update node details.", details: error.message });
    }
  });

  // POST /api/parent: Create a parent/group node
  app.post("/api/parent", async (req, res) => {
    const { title, color, description, tags, associatedNodeIds } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Title is required for a parent node." });
    }

    try {
      const parentId = `parent-${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`;
      const nodeColor = color || "#3B82F6"; // default blue
      const parentNode = await prisma.node.create({
        data: {
          id: parentId,
          url: `group:${parentId}`,
          title,
          description: description || `Group category for ${title}`,
          tags: Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify(["Category", title]),
          isParent: true,
          color: nodeColor,
          parentId: null,
        }
      });

      // If we have initial nodes to associate with this brand new parent category
      if (Array.isArray(associatedNodeIds) && associatedNodeIds.length > 0) {
        // Update their parentId and set their color to match this parent category
        await prisma.node.updateMany({
          where: { id: { in: associatedNodeIds } },
          data: { parentId, color: nodeColor }
        });

        // Create directed parent-child edges for visual mapping
        for (const childId of associatedNodeIds) {
          try {
            await prisma.edge.create({
              data: {
                sourceId: parentId,
                targetId: childId,
                reason: `Parent-child directed classification under ${title}`
              }
            });
          } catch (edgeErr) {
            console.error(`Failed to create edge for child node ${childId}:`, edgeErr);
          }
        }
      }

      res.status(201).json({
        success: true,
        node: {
          ...parentNode,
          tags: Array.isArray(tags) ? tags : ["Category", title],
          ageInDays: 0,
        }
      });
    } catch (error: any) {
      console.error("Failed to create parent node:", error);
      res.status(500).json({ error: "Failed to create parent category node.", details: error.message });
    }
  });

  // DELETE /api/node/*: Delete a node (and cascade deletes its edges)
  app.delete("/api/node/:id(*)", async (req, res) => {
    let id = req.params.id || "";
    try {
      id = decodeURIComponent(id);
    } catch (e) {}
    try {
      // Find the node first to check if it has a parent
      let nodeToDelete = null as any;
      for (const candidateId of [id, id.replace(/\s+/g, ""), id.replace(/:\/\//g, "://")].filter(Boolean)) {
        nodeToDelete = await prisma.node.findUnique({ where: { id: candidateId } });
        if (nodeToDelete) {
          id = candidateId;
          break;
        }
      }

      if (!nodeToDelete) {
        return res.status(404).json({ error: "Node not found." });
      }

      const originalParentId = nodeToDelete.parentId;

      // Find children if this is a parent, and set their parentId to null
      await prisma.node.updateMany({
        where: { parentId: id },
        data: { parentId: null }
      });

      // Manually delete any connected edges first to prevent any foreign key constraint failures
      await prisma.edge.deleteMany({
        where: {
          OR: [
            { sourceId: id },
            { targetId: id }
          ]
        }
      });

      // Delete the node
      await prisma.node.delete({
        where: { id }
      });

      res.json({ success: true, message: "Node deleted successfully." });
    } catch (error: any) {
      console.error("Failed to delete node:", error);
      res.status(500).json({ error: "Failed to delete node.", details: error.message });
    }
  });

  // POST /api/edges: Manually create edge connections between Node A and Node B(s)
  app.post("/api/edges", async (req, res) => {
    const { sourceId, targetId, targetIds, reason } = req.body;

    if (!sourceId) {
      return res.status(400).json({ error: "sourceId is required." });
    }

    const finalReason = reason || "Manual connection";
    const idsToConnect: string[] = Array.isArray(targetIds) 
      ? targetIds 
      : (targetId ? [targetId] : []);

    if (idsToConnect.length === 0) {
      return res.status(400).json({ error: "At least one target website must be selected." });
    }

    try {
      // Check if source node exists
      const sourceNode = await prisma.node.findUnique({ where: { id: sourceId } });
      if (!sourceNode) {
        return res.status(404).json({ error: "Source node not found in database." });
      }

      const createdEdges = [];
      for (const tId of idsToConnect) {
        if (tId === sourceId) continue;

        const targetNode = await prisma.node.findUnique({ where: { id: tId } });
        if (!targetNode) continue;

        // Check if edge already exists to prevent duplicate lines
        const existingEdge = await prisma.edge.findFirst({
          where: {
            OR: [
              { sourceId, targetId: tId },
              { sourceId: tId, targetId: sourceId }
            ]
          }
        });

        if (!existingEdge) {
          const newEdge = await prisma.edge.create({
            data: {
              sourceId,
              targetId: tId,
              reason: finalReason,
            }
          });
          createdEdges.push(newEdge);
        }
      }

      res.status(201).json({
        success: true,
        edgesCreatedCount: createdEdges.length,
        edges: createdEdges
      });
    } catch (error: any) {
      console.error("Failed to create manual connection:", error);
      res.status(500).json({ error: "Failed to establish connection.", details: error.message });
    }
  });

  // DELETE /api/edges: Delete an edge between sourceId and targetId
  app.delete("/api/edges", async (req, res) => {
    const { sourceId, targetId } = req.query;
    if (!sourceId || !targetId) {
      return res.status(400).json({ error: "sourceId and targetId query parameters are required" });
    }
    try {
      const deleted = await prisma.edge.deleteMany({
        where: {
          OR: [
            { sourceId: String(sourceId), targetId: String(targetId) },
            { sourceId: String(targetId), targetId: String(sourceId) },
          ]
        }
      });
      res.json({ success: true, count: deleted.count });
    } catch (error: any) {
      console.error("Failed to delete edge:", error);
      res.status(500).json({ error: "Failed to delete edge.", details: error.message });
    }
  });

  // Vite Integration Middleware (Development vs Production)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});

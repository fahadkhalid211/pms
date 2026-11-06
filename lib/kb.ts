import prisma from "@/lib/db";
import { Prisma, DocumentType } from "@prisma/client";
import { logActivity } from "@/lib/audit";

export interface CreateDocumentInput {
  organizationId: string;
  propertyId?: string | null;
  type?: DocumentType;
  title: string;
  content: string;
  source?: string;
  userId?: string;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  title: string;
  type: string;
  content: string;
  score: number;
}

/**
 * Splits document content into semantic chunks for retrieval.
 */
export function chunkText(content: string, maxChunkLength = 600): string[] {
  const paragraphs = content.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).trim().length > maxChunkLength && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  // If text has no paragraphs, chunk by sentence or character length
  if (chunks.length === 0 && content.trim()) {
    for (let i = 0; i < content.length; i += maxChunkLength) {
      chunks.push(content.slice(i, i + maxChunkLength).trim());
    }
  }

  return chunks.filter(Boolean);
}

/**
 * Creates a knowledge base document and automatically indexes its chunks.
 */
export async function createKnowledgeBaseDocument(input: CreateDocumentInput) {
  if (!input.organizationId) {
    throw new Error("organizationId is required to create a knowledge base document.");
  }
  if (!input.title || !input.content) {
    throw new Error("Title and content are required.");
  }

  const chunks = chunkText(input.content);

  const document = await prisma.$transaction(async (tx) => {
    const doc = await tx.knowledgeBaseDocument.create({
      data: {
        organizationId: input.organizationId,
        propertyId: input.propertyId ?? null,
        type: input.type ?? "faq",
        title: input.title,
        content: input.content,
        source: input.source,
        status: "active",
      },
    });

    for (let i = 0; i < chunks.length; i++) {
      await tx.knowledgeBaseChunk.create({
        data: {
          organizationId: input.organizationId,
          documentId: doc.id,
          chunkIndex: i,
          content: chunks[i],
          tokenCount: Math.ceil(chunks[i].length / 4),
        },
      });
    }

    return doc;
  });

  await logActivity({
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    userId: input.userId,
    source: "backend",
    category: "ai",
    action: "kb.document_created",
    summary: `Created KB document '${document.title}' with ${chunks.length} indexed chunks.`,
    entityType: "KnowledgeBaseDocument",
    entityId: document.id,
  });

  return {
    ...document,
    chunksCount: chunks.length,
  };
}

/**
 * Searches the Knowledge Base using MySQL/MariaDB FULLTEXT (MATCH ... AGAINST in
 * natural-language mode) with relevance ranking and strict multi-tenant isolation.
 * The query is always passed as a bound parameter; natural-language mode ignores
 * boolean operators, so user input cannot alter the search expression.
 */
export async function searchKnowledgeBase(
  organizationId: string,
  query: string,
  options: { propertyId?: string | null; limit?: number } = {},
): Promise<SearchResult[]> {
  if (!organizationId) {
    throw new Error("organizationId is required for knowledge base search.");
  }

  const limit = Math.max(1, Math.min(Math.floor(options.limit ?? 5), 50));
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  type RawMatch = {
    id: string;
    documentId: string;
    content: string;
    title: string;
    type: string;
    score: number | string;
  };

  // 1. FULLTEXT relevance search
  try {
    const propertyFilter = options.propertyId
      ? Prisma.sql`AND (d.propertyId = ${options.propertyId} OR d.propertyId IS NULL)`
      : Prisma.empty;

    const rawMatches = await prisma.$queryRaw<RawMatch[]>(Prisma.sql`
      SELECT c.id AS id, c.documentId AS documentId, c.content AS content,
             d.title AS title, d.type AS type,
             MATCH(c.content) AGAINST (${cleanQuery} IN NATURAL LANGUAGE MODE) AS score
      FROM KnowledgeBaseChunk c
      JOIN KnowledgeBaseDocument d ON c.documentId = d.id
      WHERE c.organizationId = ${organizationId}
        AND d.organizationId = ${organizationId}
        AND d.status = 'active'
        ${propertyFilter}
        AND MATCH(c.content) AGAINST (${cleanQuery} IN NATURAL LANGUAGE MODE)
      ORDER BY score DESC
      LIMIT ${limit}
    `);

    if (rawMatches.length > 0) {
      return rawMatches.map((m) => ({
        chunkId: m.id,
        documentId: m.documentId,
        title: m.title,
        type: m.type,
        content: m.content,
        score: Number(Number(m.score).toFixed(4)),
      }));
    }
  } catch {
    // FULLTEXT can reject very short or stop-word-only queries; fall back to LIKE matching.
  }

  // 2. Fallback keyword matching (LIKE; MySQL collation is case-insensitive)
  const keywords = cleanQuery.toLowerCase().split(/s+/).filter((w) => w.length > 2);
  const whereOr = keywords.map((k) => ({
    content: { contains: k },
  }));

  const fallbackChunks = await prisma.knowledgeBaseChunk.findMany({
    where: {
      organizationId,
      document: {
        status: "active",
        ...(options.propertyId ? { OR: [{ propertyId: options.propertyId }, { propertyId: null }] } : {}),
      },
      ...(whereOr.length > 0 ? { OR: whereOr } : {}),
    },
    include: { document: { select: { id: true, title: true, type: true } } },
    take: limit,
  });

  return fallbackChunks.map((c) => ({
    chunkId: c.id,
    documentId: c.documentId,
    title: c.document.title,
    type: c.document.type,
    content: c.content,
    score: 0.1,
  }));
}

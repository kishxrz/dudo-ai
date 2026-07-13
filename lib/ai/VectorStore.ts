import fs from 'fs';
import path from 'path';
import os from 'os';

export interface VectorItem {
  id: string;
  workspaceId: string;
  resourceId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  metadata: any;
}

/**
 * Computes the cosine similarity between two float vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

export class VectorStore {
  private static getFilePath(workspaceId: string): string {
    const baseDir = process.env.VERCEL ? os.tmpdir() : process.cwd();
    const dir = path.join(baseDir, 'data', 'vectors');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, `${workspaceId}.json`);
  }

  private static loadItems(workspaceId: string): VectorItem[] {
    const file = this.getFilePath(workspaceId);
    if (!fs.existsSync(file)) return [];
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return [];
    }
  }

  private static saveItems(workspaceId: string, items: VectorItem[]): void {
    const file = this.getFilePath(workspaceId);
    fs.writeFileSync(file, JSON.stringify(items, null, 2), 'utf8');
  }

  /**
   * Adds vector items to a tenant's isolated vector store.
   * Auto-overwrites existing vectors for the same resource to avoid duplicate chunks.
   */
  static async addItems(items: VectorItem[]): Promise<void> {
    if (items.length === 0) return;
    const workspaceId = items[0].workspaceId;
    const resourceId = items[0].resourceId;
    const existing = this.loadItems(workspaceId);
    const filtered = existing.filter(item => item.resourceId !== resourceId);
    filtered.push(...items);
    this.saveItems(workspaceId, filtered);
  }

  /**
   * Searches the current workspace's vectors using Cosine Similarity.
   */
  static async query(
    workspaceId: string,
    queryEmbedding: number[],
    topK: number,
    threshold: number
  ): Promise<VectorItem[]> {
    const items = this.loadItems(workspaceId);
    const scored = items.map(item => {
      const score = cosineSimilarity(queryEmbedding, item.embedding);
      return { item, score };
    });
    const filtered = scored.filter(s => s.score >= threshold);
    filtered.sort((a, b) => b.score - a.score);
    return filtered.slice(0, topK).map(s => ({
      ...s.item,
      metadata: { ...s.item.metadata, similarityScore: s.score }
    }));
  }

  /**
   * Deletes a resource's vectors from a tenant's store.
   */
  static async deleteResource(workspaceId: string, resourceId: string): Promise<void> {
    const existing = this.loadItems(workspaceId);
    const filtered = existing.filter(item => item.resourceId !== resourceId);
    this.saveItems(workspaceId, filtered);
  }
}

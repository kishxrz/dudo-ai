import { EmbeddingService } from './EmbeddingService';
import { VectorStore, VectorItem } from './VectorStore';
import { WorkspaceContextLoader } from './WorkspaceContextLoader';

export class KnowledgeRetrievalService {
  /**
   * Rewrites/normalizes the user query and retrieves top relevant chunks 
   * from the tenant's isolated vector store.
   */
  static async retrieve(
    workspaceId: string,
    queryText: string,
    topK = 4,
    threshold = 0.45
  ): Promise<VectorItem[]> {
    if (!queryText || queryText.trim() === '') return [];

    try {
      // Clean query and normalize whitespace
      const normalizedQuery = queryText
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

      // Load active workspace credentials
      const context = await WorkspaceContextLoader.load(workspaceId);
      const providerInfo = context.provider;

      // Generate embedding vector
      const queryEmbedding = await EmbeddingService.getEmbedding(normalizedQuery, providerInfo);

      // Search tenant's vector store
      const results = await VectorStore.query(workspaceId, queryEmbedding, topK, threshold);
      
      console.log(`[RAG Retrieval] Scoped search found ${results.length} chunks for query: "${normalizedQuery}"`);
      return results;
    } catch (e) {
      console.error('[KnowledgeRetrievalService] Query retrieval failure:', e);
      return [];
    }
  }
}

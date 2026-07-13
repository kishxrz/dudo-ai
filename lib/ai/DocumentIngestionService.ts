import crypto from 'crypto';
import { db } from '../firebase';
import { getAdminDb } from '../firebase-admin';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { TextExtractionService } from './TextExtractionService';
import { ChunkingService } from './ChunkingService';
import { EmbeddingService } from './EmbeddingService';
import { VectorStore, VectorItem } from './VectorStore';
import { BusinessFactExtractionService } from './BusinessFactExtractionService';
import { ProfileSuggestionService } from './ProfileSuggestionService';

export class DocumentIngestionService {
  /**
   * Performs the complete backend ingestion workflow for a single knowledge resource.
   */
  static async ingest(workspaceId: string, itemId: string): Promise<boolean> {
    const adminDb = getAdminDb();
    const docPath = `workspaces/${workspaceId}/knowledge/${itemId}`;
    let itemData: any = null;

    // 1. Fetch item from Firestore
    if (adminDb) {
      try {
        const snap = await adminDb.doc(docPath).get();
        if (snap.exists) itemData = snap.data();
      } catch (e) {}
    } else if (db) {
      try {
        const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'knowledge', itemId));
        if (snap.exists()) itemData = snap.data();
      } catch (e) {}
    }

    if (!itemData) {
      console.error(`[Ingestion] Resource not found: ${docPath}`);
      return false;
    }

    const title = itemData.title || itemData.name || 'Untitled Document';

    // Set status to Extracting
    console.log(`[RAG] Ingestion started for resource: ${title}`);
    console.log(`[RAG] extraction started`);
    await this.updateStatus(workspaceId, itemId, 'Extracting');

    try {
      const type = itemData.type || 'pdf';
      let rawText = '';

      // 2. Extract plain text based on type
      if (type === 'faq') {
        const q = (itemData.question || '').trim();
        const a = (itemData.answer || '').trim();
        rawText = `Question: ${q}\nAnswer: ${a}`;
      } else if (type === 'text' || type === 'url') {
        rawText = (itemData.source || '').trim();
      } else {
        // PDF, DOCX, TXT, MD binary/base64 parsing
        const base64 = itemData.base64 || '';
        rawText = TextExtractionService.extractText(base64, type);
      }

      if (!rawText || rawText.trim() === '') {
        throw new Error('Extraction produced empty text.');
      }
      console.log(`[RAG] extraction completed (length: ${rawText.length} chars)`);

      // 3. Content Hashing & Duplicate Prevention
      const contentHash = crypto.createHash('sha256').update(rawText).digest('hex');
      const isDuplicate = await this.checkDuplicateHash(workspaceId, itemId, contentHash, title);
      if (isDuplicate) {
        console.warn(`[Ingestion] Duplicate document content detected. Aborting ingestion for ${itemId}`);
        await this.updateStatus(workspaceId, itemId, 'Failed', {
          errorMessage: 'Duplicate document content detected.',
          contentHash
        });
        return false;
      }

      // 4. Split text into chunks
      await this.updateStatus(workspaceId, itemId, 'Indexing');
      const chunks = ChunkingService.splitText(rawText, 500, 100);
      if (chunks.length === 0) {
        throw new Error('Chunking produced zero chunks.');
      }
      console.log(`[RAG] chunks created: ${chunks.length} chunks`);

      // 5. Load workspace provider to generate embeddings
      const providerInfo = await this.getWorkspaceProvider(workspaceId);

      // 6. Generate embeddings and create VectorItems
      const vectorItems: VectorItem[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i];
        const embedding = await EmbeddingService.getEmbedding(chunkText, providerInfo);
        
        vectorItems.push({
          id: `${itemId}_chunk_${i}`,
          workspaceId,
          resourceId: itemId,
          documentName: title,
          chunkIndex: i,
          content: chunkText,
          embedding,
          metadata: {
            sourceType: type,
            ingestedAt: new Date().toISOString()
          }
        });
      }

      // 7. Save vector chunks to VectorStore
      await VectorStore.addItems(vectorItems);
      console.log(`[RAG] vectors indexed: ${vectorItems.length} vectors stored`);

      // 8. Analyze: Extract Business Facts & Suggest Updates
      await this.updateStatus(workspaceId, itemId, 'Analyzing');
      console.log(`[RAG] fact extraction started`);
      
      let suggestionsCreated = 0;
      try {
        const facts = await BusinessFactExtractionService.extractFacts(workspaceId, rawText);
        console.log(`[RAG] fact extraction completed`);
        const suggestions = await ProfileSuggestionService.createSuggestions(workspaceId, facts, title);
        suggestionsCreated = suggestions.length;
        if (suggestionsCreated > 0) {
          console.log(`[RAG] suggestions created: ${suggestionsCreated} suggestions generated`);
        }
      } catch (e) {
        console.error('[Ingestion] Fact extraction error:', e);
        throw e;
      }

      // 9. Update Firestore status to Suggestions Ready or Ready
      const finalStatus = suggestionsCreated > 0 ? 'Suggestions Ready' : 'Ready';
      await this.updateStatus(workspaceId, itemId, finalStatus, {
        contentHash,
        source: rawText // Store clean extracted text in source for context building fallbacks
      });
      console.log(`[RAG] ingestion completed. Status set to: ${finalStatus}`);

      return true;

    } catch (err: any) {
      console.error(`[Ingestion] Ingestion failed for item ${itemId}:`, err);
      await this.updateStatus(workspaceId, itemId, 'Failed', {
        errorMessage: err.message || 'Ingestion pipeline error'
      });
      return false;
    }
  }

  private static async updateStatus(
    workspaceId: string,
    itemId: string,
    status: 'Uploading' | 'Extracting' | 'Indexing' | 'Analyzing' | 'Suggestions Ready' | 'Ready' | 'Failed',
    extra: Record<string, any> = {}
  ): Promise<void> {
    const adminDb = getAdminDb();
    const docPath = `workspaces/${workspaceId}/knowledge/${itemId}`;
    const payload = {
      status,
      updatedAt: new Date(),
      ...extra
    };

    if (adminDb) {
      try {
        await adminDb.doc(docPath).set(payload, { merge: true });
      } catch (e) {}
    } else if (db) {
      try {
        await setDoc(doc(db, 'workspaces', workspaceId, 'knowledge', itemId), payload, { merge: true });
      } catch (e) {}
    }
  }

  /**
   * Verifies if another document in the current workspace already matches this content hash.
   */
  private static async checkDuplicateHash(
    workspaceId: string,
    currentId: string,
    hash: string,
    currentTitle: string
  ): Promise<boolean> {
    const adminDb = getAdminDb();
    let docs: any[] = [];

    if (adminDb) {
      try {
        const q = await adminDb
          .collection(`workspaces/${workspaceId}/knowledge`)
          .where('contentHash', '==', hash)
          .get();
        docs = q.docs;
      } catch (e) {}
    } else if (db) {
      try {
        const q = await getDocs(collection(db, 'workspaces', workspaceId, 'knowledge'));
        docs = q.docs;
      } catch (e) {}
    }

    for (const d of docs) {
      const id = d.id;
      const data = typeof d.data === 'function' ? d.data() : d;
      // If we find the same hash on a different ready document with a DIFFERENT title, it's a duplicate
      const otherTitle = data.title || data.name || '';
      if (id !== currentId && data.contentHash === hash && (data.status === 'Ready' || data.status === 'Suggestions Ready') && otherTitle !== currentTitle) {
        return true;
      }
    }
    return false;
  }

  private static async getWorkspaceProvider(
    workspaceId: string
  ): Promise<{ name: string; apiKey: string; model: string } | undefined> {
    const adminDb = getAdminDb();
    if (adminDb) {
      try {
        const q = await adminDb.collection(`workspaces/${workspaceId}/providers`).where('active', '==', true).get();
        if (!q.empty) {
          const d = q.docs[0].data();
          return { name: q.docs[0].id, apiKey: d.apiKey || '', model: d.model || '' };
        }
      } catch (e) {}
    }
    return undefined;
  }
}

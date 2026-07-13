/**
 * Service to generate vector embeddings.
 * Connects to OpenAI or Gemini APIs when keys are available; falls back to a 
 * deterministic frequency-mapping vector generator for offline/local environments.
 */
export class EmbeddingService {
  static async getEmbedding(
    text: string,
    providerInfo?: { name: string; apiKey: string; model: string }
  ): Promise<number[]> {
    const defaultDim = 1536;

    if (providerInfo?.apiKey && providerInfo.apiKey.trim()) {
      const provider = providerInfo.name.toLowerCase();
      try {
        if (provider === 'openai') {
          const res = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${providerInfo.apiKey}`
            },
            body: JSON.stringify({
              input: text,
              model: 'text-embedding-3-small'
            })
          });
          if (res.ok) {
            const data = await res.json();
            return data.data[0].embedding;
          }
        } else if (provider === 'gemini') {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${providerInfo.apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: { parts: [{ text }] }
              })
            }
          );
          if (res.ok) {
            const data = await res.json();
            const embed = data.embedding?.values;
            if (embed) {
              // Standardize Gemini's 768 length to 1536 by padding or repeating
              if (embed.length === 768) {
                return [...embed, ...embed];
              }
              return embed;
            }
          }
        }
      } catch (e) {
        console.warn('[EmbeddingService] Embedding API failed. Using deterministic fallback:', e);
      }
    }

    // ─── Deterministic mathematical vector fallback (1536 dimensions) ───
    const vector = new Array(defaultDim).fill(0.0);
    
    // Clean and split into tokens (words)
    const tokens = text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0);

    // Extract character 3-grams to allow substring matches (e.g. "refund" matches "refunds")
    const ngrams: string[] = [];
    const cleanText = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let i = 0; i <= cleanText.length - 3; i++) {
      ngrams.push(cleanText.substring(i, i + 3));
    }

    // Hash helper (djb2 string hash)
    const hashString = (str: string): number => {
      let hash = 5381;
      for (let i = 0; i < str.length; i++) {
        hash = (hash * 33) ^ str.charCodeAt(i);
      }
      return Math.abs(hash);
    };

    // Add token contributions (weighted heavily)
    for (const token of tokens) {
      const idx = hashString(token) % defaultDim;
      vector[idx] += 1.0;
    }

    // Add character n-gram contributions (weighted less)
    for (const ngram of ngrams) {
      const idx = hashString(ngram) % defaultDim;
      vector[idx] += 0.2;
    }

    // L2 Normalize the vector so cosine similarity functions correctly
    let normSq = 0;
    for (const val of vector) {
      normSq += val * val;
    }
    const norm = Math.sqrt(normSq);
    if (norm > 0) {
      for (let i = 0; i < defaultDim; i++) {
        vector[i] /= norm;
      }
    } else {
      vector[0] = 1.0; // unit fallback
    }

    return vector;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { WorkspaceContext } from './types/WorkspaceContext';
import { PromptBuilder } from './PromptBuilder';
import { ProviderRegistry } from './ProviderRegistry';
import { Message } from './types/ConversationRequest';
import { db } from '@/lib/firebase';
import { getAdminDb } from '@/lib/firebase-admin';
import { ProviderModelRegistry } from '@/lib/ai/providers/ProviderModelRegistry';
import { collection, addDoc, doc, setDoc, getDoc } from 'firebase/firestore';

// ==========================================
// TYPES
// ==========================================

export interface OrchestrationResult {
  success: boolean;
  reply: string;
  toolUsed?: string;
  imageUrl?: string;
  telemetry?: {
    latencyMs: number;
    tokensUsed?: number;
    injectionDetected?: boolean;
  };
}

export interface ICapabilityPlugin {
  name: string;
  execute(context: WorkspaceContext, input: string, args?: Record<string, any>): Promise<OrchestrationResult>;
}

// ==========================================
// SECURITY GUARD
// ==========================================

export class EnterpriseSecurityGuard {
  private static readonly INJECTION_PATTERNS = [
    /ignore\s+(previous|all|above)\s+instructions/i,
    /reveal\s+your\s+(prompt|instructions|rules)/i,
    /forget\s+your\s+rules/i,
    /act\s+as\s+(a\s+)?(developer|admin|root|superuser)/i,
    /show\s+hidden\s+instructions/i,
    /print\s+memory/i,
    /dump\s+(database|db|data)/i,
    /reveal\s+api\s+keys?/i,
    /what\s+is\s+your\s+system\s+prompt/i,
    /display\s+your\s+context/i,
  ];

  static sanitizeInput(input: string): { safe: boolean; sanitized: string; reason?: string } {
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        return {
          safe: false,
          sanitized: "I can't help with that request. How can I assist you with something else today?",
          reason: 'Prompt injection attempt blocked',
        };
      }
    }
    return { safe: true, sanitized: input };
  }

  static async logTelemetry(
    workspaceId: string,
    event: { type: string; latencyMs: number; success: boolean; toolName?: string; error?: string }
  ) {
    if (!db || !workspaceId) return;
    try {
      const colRef = collection(db, 'workspaces', workspaceId, 'telemetry');
      await addDoc(colRef, { ...event, timestamp: new Date().toISOString() });
    } catch (e) {
      // Never throw from telemetry
    }
  }
}

// ==========================================
// WEB SEARCH — Real DuckDuckGo scraping via internal fetch-url proxy
// ==========================================

async function performWebSearch(query: string): Promise<{ summary: string; sources: string[] }> {
  const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(ddgUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`DuckDuckGo returned ${res.status}`);

    const html = await res.text();

    // Extract result snippets from DDG HTML
    const snippets: string[] = [];
    const sources: string[] = [];

    // Extract result links
    const linkRegex = /class="result__url"[^>]*>([^<]+)</g;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(html)) !== null && sources.length < 5) {
      const url = linkMatch[1].trim();
      if (url && !url.includes('duckduckgo')) sources.push(url);
    }

    // Extract result snippets
    const snippetRegex = /class="result__snippet"[^>]*>([^<]+(?:<[^>]+>[^<]*<\/[^>]+>[^<]*)*)</g;
    let snippetMatch;
    while ((snippetMatch = snippetRegex.exec(html)) !== null && snippets.length < 5) {
      const text = snippetMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 20) snippets.push(text);
    }

    // Fallback: extract any readable text blocks
    if (snippets.length === 0) {
      const textBlocks = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 3000);
      snippets.push(textBlocks);
    }

    return {
      summary: snippets.join(' | '),
      sources,
    };
  } catch (e: any) {
    throw new Error(`Web search failed: ${e.message}`);
  }
}

// ==========================================
// LONG-TERM MEMORY — Real Firestore read/write
// ==========================================

export interface WorkspaceMemory {
  preferredLanguage?: string;
  customerName?: string;
  preferences?: Record<string, string>;
  customFacts?: Record<string, string>;
  updatedAt?: string;
  preferredStyle?: string;
}

export async function readWorkspaceMemory(workspaceId: string): Promise<WorkspaceMemory> {
  if (!db || !workspaceId) return {};
  try {
    const memRef = doc(db, 'workspaces', workspaceId, 'memory', 'preferences');
    const snap = await getDoc(memRef);
    if (snap.exists()) return snap.data() as WorkspaceMemory;
    return {};
  } catch {
    return {};
  }
}

export async function writeWorkspaceMemory(workspaceId: string, data: Partial<WorkspaceMemory>): Promise<void> {
  if (!db || !workspaceId) return;
  try {
    const memRef = doc(db, 'workspaces', workspaceId, 'memory', 'preferences');
    await setDoc(memRef, { ...data, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.error('[Memory] Write failed:', e);
  }
}

// ==========================================
// INTENT DETECTION — No fake routing
// ==========================================

export type DetectedIntent =
  | 'web_search'
  | 'image_generation_request'
  | 'image_analysis_request'
  | 'memory_save'
  | 'memory_read'
  | 'text_chat';

const WEB_SEARCH_PATTERNS = [
  /today'?s?\s+(bitcoin|eth|btc|crypto|stock|share|price|rate)/i,
  /current\s+(price|rate|value|exchange)/i,
  /latest\s+(news|update|score|result)/i,
  /what'?s?\s+(the\s+)?(weather|news|price|rate)\s+(in|at|for|of|today)/i,
  /\b(usd|inr|eur|gbp)\s+(to|vs)\s+(usd|inr|eur|gbp)\b/i,
  /exchange\s+rate/i,
  /live\s+(price|rate|data)/i,
  /breaking\s+news/i,
  /right\s+now\b/i,
];

const IMAGE_GEN_PATTERNS = [
  /\b(generate|create|make|design|draw|produce)\s+(a\s+|an\s+|the\s+)?(image|photo|picture|poster|banner|logo|flyer|ad|advertisement|creative|mockup|illustration|graphic)/i,
  /\b(image|poster|banner|logo|flyer|graphic)\s+(of|for|about|showing)/i,
];

const IMAGE_ANALYSIS_PATTERNS = [
  /\b(analyze|analyse|read|parse|extract|describe|what('?s| is) in)\s+(this\s+)?(image|photo|picture|screenshot|invoice|receipt|document)/i,
  /\b(ocr|scan|digitize)\s+(this|the)\s+(image|photo|document|invoice|receipt)/i,
];

function detectIntent(input: string): DetectedIntent {


  if (IMAGE_ANALYSIS_PATTERNS.some((p) => p.test(input))) return 'image_analysis_request';
  if (IMAGE_GEN_PATTERNS.some((p) => p.test(input))) return 'image_generation_request';
  if (WEB_SEARCH_PATTERNS.some((p) => p.test(input))) return 'web_search';

  // Language preference memory save
  if (
    /my\s+(preferred|favourite|favorite)\s+language\s+is/i.test(input) ||
    /reply\s+(to\s+me\s+)?in\s+(tamil|hindi|english|tanglish|hinglish)/i.test(input) ||
    /i\s+(prefer|want|speak)\s+(tamil|hindi|english|tanglish|hinglish)/i.test(input)
  ) {
    return 'memory_save';
  }

  return 'text_chat';
}

// ==========================================
// IMAGE GENERATION — via OpenAI DALL-E 3
// ==========================================

async function generateImage(
  prompt: string,
  apiKey: string
): Promise<{ url: string; revisedPrompt: string }> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DALL-E 3 API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return {
    url: data.data?.[0]?.url || '',
    revisedPrompt: data.data?.[0]?.revised_prompt || prompt,
  };
}

// ==========================================
// ENTERPRISE ORCHESTRATOR — Real Implementations
// ==========================================

export class EnterpriseOrchestrator {
  /**
   * Main entry point.
   * Routes to the correct real capability based on intent detection,
   * then falls through to the real LLM provider.
   */
  static async routeAndExecute(
    context: WorkspaceContext,
    input: string,
    history: { sender: string; text: string }[] = [],
    attachedContent?: any
  ): Promise<OrchestrationResult> {
    const start = Date.now();

    // 1. Security sanitization
    const secCheck = EnterpriseSecurityGuard.sanitizeInput(input);
    if (!secCheck.safe) {
      await EnterpriseSecurityGuard.logTelemetry(context.workspaceId, {
        type: 'injection_attempt',
        latencyMs: Date.now() - start,
        success: false,
        error: secCheck.reason,
      });
      return { success: false, reply: secCheck.sanitized, telemetry: { latencyMs: Date.now() - start, injectionDetected: true } };
    }

    // 2. Load workspace memory and inject into context
    let memoryContext = '';
    // Detect style FIRST so we can suppress memory style when user is speaking English
    let detectedStyle: string | null = null;
    try {
      const styleDetection = detectConversationStyle(input);
      if (styleDetection) {
        detectedStyle = styleDetection.style;
        console.log(`[StyleMirror] Detected style: "${detectedStyle}" for input: "${input.slice(0, 60)}"`);
        await writeWorkspaceMemory(context.workspaceId, {
          preferredLanguage: styleDetection.language,
          preferredStyle: styleDetection.style,
        });
      } else {
        // Plain English — override to English, do NOT fall back to saved regional style
        detectedStyle = 'English';
      }
    } catch (e) {
      console.error('[Memory] Style detection failed:', e);
    }

    try {
      const memory = await readWorkspaceMemory(context.workspaceId);
      const memParts: string[] = [];
      if (memory.customerName) memParts.push(`Customer name: ${memory.customerName}`);
      
      if (detectedStyle === 'English') {
        memParts.push(`Preferred language: English`);
        memParts.push(`Preferred conversation/writing style: English`);
      } else {
        if (memory.preferredLanguage) memParts.push(`Preferred language: ${memory.preferredLanguage}`);
        if (memory.preferredStyle) memParts.push(`Preferred conversation/writing style: ${memory.preferredStyle}`);
      }

      if (memory.preferences) {
        Object.entries(memory.preferences).forEach(([k, v]) => memParts.push(`${k}: ${v}`));
      }
      if (memory.customFacts) {
        Object.entries(memory.customFacts).forEach(([k, v]) => memParts.push(`${k}: ${v}`));
      }
      if (memParts.length > 0) {
        memoryContext = `[CUSTOMER MEMORY]\n${memParts.join('\n')}`;
      }
    } catch {
      // Memory read errors are non-fatal
    }

    // 3. Intent detection
    const intent = detectIntent(input);

    // 4. Route by intent — ALL inside try-catch so errors are always logged to telemetry
    try {
      // IMPORTANT: If ANY attachment is present, always use the vision-capable handler.
      // This ensures casual captions like "who is this" go through the vision fallback path.
      if (attachedContent) {
        return await this.handleImageAnalysisRequest(context, input, history, memoryContext, start, attachedContent);
      }

      switch (intent) {
        case 'web_search':
          return await this.handleWebSearch(context, input, start);

        case 'image_generation_request':
          return await this.handleImageGeneration(context, input, start);

        case 'image_analysis_request':
          return await this.handleTextChat(context, input, history, memoryContext, start, detectedStyle, undefined);

        case 'memory_save':
          return await this.handleMemorySave(context, input, start);

        default:
          // text_chat — route through the real LLM with memory context injected
          return await this.handleTextChat(context, input, history, memoryContext, start, detectedStyle, attachedContent);
      }
    } catch (err: any) {
      console.error('[EnterpriseOrchestrator] Error:', err);
      await EnterpriseSecurityGuard.logTelemetry(context.workspaceId, {
        type: 'error',
        latencyMs: Date.now() - start,
        success: false,
        toolName: attachedContent ? 'ImageAnalysis' : intent,
        error: err.message,
      });
      return {
        success: false,
        reply: `I'm having trouble with that right now. Please try again in a moment.`,
        telemetry: { latencyMs: Date.now() - start },
      };
    }
  }

  // ----------------------------------------
  // WEB SEARCH
  // ----------------------------------------
  private static async handleWebSearch(
    context: WorkspaceContext,
    input: string,
    start: number
  ): Promise<OrchestrationResult> {
    let searchSummary = '';
    let sources: string[] = [];

    try {
      const result = await performWebSearch(input);
      searchSummary = result.summary;
      sources = result.sources;
    } catch (e: any) {
      console.warn('[WebSearch] Failed, falling back to LLM only:', e.message);
    }

    // Augment LLM response with search results
    const systemPrompt = PromptBuilder.buildSystemPrompt(context);
    const searchContext = searchSummary
      ? `[LIVE WEB SEARCH RESULTS for "${input}"]\n${searchSummary}\nSources: ${sources.join(', ')}\n\nBased on these results, answer the user's question accurately.`
      : '';

    const messages = history_to_messages([]);
    messages.push({ role: 'user' as const, content: searchContext ? `${searchContext}\n\nUser question: ${input}` : input });

    const response = await ProviderRegistry.generate(context.provider.name, context.provider.apiKey, {
      systemPrompt,
      messages,
      model: context.provider.model,
      temperature: 0.3,
    });

    const sourceLine = sources.length > 0 ? `\n\n📎 *Sources: ${sources.slice(0, 3).join(', ')}*` : '';

    await EnterpriseSecurityGuard.logTelemetry(context.workspaceId, {
      type: 'web_search',
      latencyMs: Date.now() - start,
      success: true,
      toolName: 'WebSearch',
    });

    return {
      success: true,
      reply: response.reply + sourceLine,
      toolUsed: 'WebSearch',
      telemetry: { latencyMs: Date.now() - start },
    };
  }

  // ----------------------------------------
  // IMAGE GENERATION — Real DALL-E 3 / Imagen 3
  // ----------------------------------------
  private static async handleImageGeneration(
    context: WorkspaceContext,
    input: string,
    start: number
  ): Promise<OrchestrationResult> {
    const provName = context.provider.name.toLowerCase();
    const apiKey = context.provider.apiKey;

    if (provName === 'openai' && apiKey) {
      try {
        const { url, revisedPrompt } = await generateImage(input, apiKey);

        await EnterpriseSecurityGuard.logTelemetry(context.workspaceId, {
          type: 'image_generation',
          latencyMs: Date.now() - start,
          success: true,
          toolName: 'DALL-E-3',
        });

        return {
          success: true,
          reply: `Here's your generated image! 🎨\n\n*Prompt used: "${revisedPrompt}"*\n\n[View Image](${url})`,
          imageUrl: url,
          toolUsed: 'ImageGeneration',
          telemetry: { latencyMs: Date.now() - start },
        };
      } catch (err: any) {
        return {
          success: false,
          reply: `I wasn't able to generate that image right now via OpenAI. ${err.message}`,
          telemetry: { latencyMs: Date.now() - start },
        };
      }
    } else if (provName === 'gemini' && apiKey) {
      try {
        const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key=${apiKey}`;
        const res = await fetch(imagenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: input,
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '1:1',
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Google Imagen 3 API error ${res.status}: ${errText}`);
        }

        const data = await res.json();
        const base64Bytes = data.generatedImages?.[0]?.image?.imageBytes;
        if (!base64Bytes) {
          throw new Error('Google Imagen 3 did not return any image bytes.');
        }

        const url = `data:image/jpeg;base64,${base64Bytes}`;
        await EnterpriseSecurityGuard.logTelemetry(context.workspaceId, {
          type: 'image_generation',
          latencyMs: Date.now() - start,
          success: true,
          toolName: 'Imagen-3',
        });

        return {
          success: true,
          reply: `Here's your generated image! 🎨\n\n[View Image](${url})`,
          imageUrl: url,
          toolUsed: 'ImageGeneration',
          telemetry: { latencyMs: Date.now() - start },
        };
      } catch (err: any) {
        return {
          success: false,
          reply: `I wasn't able to generate that image right now via Google Imagen. ${err.message}`,
          telemetry: { latencyMs: Date.now() - start },
        };
      }
    }

    // Fall back to asking the LLM to describe what it would generate
    const systemPrompt = PromptBuilder.buildSystemPrompt(context);
    const response = await ProviderRegistry.generate(context.provider.name, context.provider.apiKey, {
      systemPrompt,
      messages: [{ role: 'user', content: input }],
      model: context.provider.model,
      temperature: 0.7,
    });
    return { success: true, reply: response.reply, toolUsed: 'ImageGeneration_TextFallback', telemetry: { latencyMs: Date.now() - start } };
  }

  // ----------------------------------------
  // IMAGE ANALYSIS — Routed through multimodal LLM prompt
  // ----------------------------------------
  private static async handleImageAnalysisRequest(
    context: WorkspaceContext,
    input: string,
    history: { sender: string; text: string }[],
    memoryContext: string,
    start: number,
    attachedContent?: any
  ): Promise<OrchestrationResult> {
    const systemPrompt = PromptBuilder.buildSystemPrompt(context);
    const analysisInstruction = attachedContent
      ? `${memoryContext ? memoryContext + '\n\n' : ''}The user has uploaded an image. Extract text (OCR), describe the contents in detail, identify objects, read invoices/receipts, and answer their questions about it accurately.`
      : `${memoryContext ? memoryContext + '\n\n' : ''}The user wants to analyze an image. Instruct them to upload the image directly in the chat. When they do, you will extract text (OCR), describe the contents, identify objects, read invoices/receipts, and answer their questions about it accurately.`;

    const msgs = history_to_messages(history);
    if (attachedContent) {
      msgs.push({
        role: 'user' as const,
        content: [
          { type: 'text', text: input },
          attachedContent
        ]
      });
    } else {
      msgs.push({ role: 'user' as const, content: input });
    }

    let providerName = context.provider.name;
    let apiKey = context.provider.apiKey;
    let model = context.provider.model;

    // Check if the current model supports vision
    const currentModelDef = ProviderModelRegistry.getModel(providerName as any, model);
    const supportsVision = currentModelDef?.supportsVision ?? false;

    if (!supportsVision) {
      console.log(`[VisionFallback] Active provider ${providerName} (${model}) does not support vision. Resolving fallback vision provider...`);
      // Try to find a vision-capable provider from the workspace database
      const adminDb = getAdminDb();
      let fallbackResolved = false;

      // Basic key format validators — only reject empty or very short keys
      const isKeyValid = (provider: string, key: string): boolean => {
        if (!key || key.length < 10) return false;
        // Note: Google AI Studio keys can be either AIzaSy... (old) or AQ. (new) format - both are valid
        // OpenAI keys can be sk-... or sk-proj-... format
        return true;
      };
      
      const visionProviders = ['gemini', 'openai', 'anthropic', 'openrouter', 'groq', 'deepseek', 'mistral'];
      for (const p of visionProviders) {
        try {
          const path = `workspaces/${context.workspaceId}/providers/${p}`;
          const snap = adminDb 
            ? await adminDb.doc(path).get() 
            : await getDoc(doc(db!, 'workspaces', context.workspaceId, 'providers', p));
          const exists = typeof snap.exists === 'function' ? snap.exists() : snap.exists;
          if (exists) {
            const data = snap.data();
            if (data?.apiKey && isKeyValid(p, data.apiKey)) {
              providerName = p;
              apiKey = data.apiKey;
              model = data.model || ProviderModelRegistry.getDefaultModel(p as any).modelId;
              console.log(`[VisionFallback] Resolved fallback vision provider: ${p} (${model})`);
              fallbackResolved = true;
              break;
            }
          }
        } catch (fallbackErr) {
          console.error(`[VisionFallback] Failed to load provider ${p}:`, fallbackErr);
        }
      }
      
      if (!fallbackResolved) {
        return {
          success: false,
          reply: "I can see you sent an image, but I need a vision-capable AI key to analyze it. Please go to your dashboard → API Keys and add a valid **Gemini API key** (starts with 'AIza...') or **OpenAI API key** (starts with 'sk-...'). Your current Groq provider cannot process images.",
          telemetry: { latencyMs: Date.now() - start }
        };
      }
    }

    let response;
    try {
      response = await ProviderRegistry.generate(providerName, apiKey, {
        systemPrompt: systemPrompt + '\n\n' + analysisInstruction,
        messages: msgs,
        model: model,
        temperature: 0.3,
      });
    } catch (genErr: any) {
      const errMsg = genErr.message || '';
      console.error(`[ImageAnalysis] Provider ${providerName} failed:`, errMsg);
      // Handle 429 quota/rate-limit gracefully
      if (errMsg.includes('429') || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate limit')) {
        return {
          success: false,
          reply: `I received your image but the AI vision service is currently rate-limited (too many requests). Please wait a minute and send the image again. If this keeps happening, your free Gemini quota (20/day) may be exhausted — it resets at midnight UTC.`,
          telemetry: { latencyMs: Date.now() - start },
        };
      }
      // Re-throw other errors so the outer catch can log them
      throw genErr;
    }

    return {
      success: true,
      reply: response.reply,
      toolUsed: 'ImageAnalysis',
      telemetry: { latencyMs: Date.now() - start },
    };
  }

  // ----------------------------------------
  // MEMORY SAVE — Detect and persist from natural language
  // ----------------------------------------
  private static async handleMemorySave(
    context: WorkspaceContext,
    input: string,
    start: number
  ): Promise<OrchestrationResult> {
    const memoryUpdate: Partial<WorkspaceMemory> = {};

    // Detect language preference
    const langMatch = input.match(/\b(tamil|hindi|english|tanglish|hinglish)\b/i);
    if (langMatch) {
      memoryUpdate.preferredLanguage = langMatch[1].charAt(0).toUpperCase() + langMatch[1].slice(1).toLowerCase();
    }

    // Detect name
    const nameMatch = input.match(/(?:my name is|i am|i'm|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (nameMatch) {
      memoryUpdate.customerName = nameMatch[1];
    }

    if (Object.keys(memoryUpdate).length > 0) {
      await writeWorkspaceMemory(context.workspaceId, memoryUpdate);
    }

    // Always also generate a natural LLM response
    const systemPrompt = PromptBuilder.buildSystemPrompt(context);
    const memNote = memoryUpdate.preferredLanguage
      ? ` Remember: the user prefers ${memoryUpdate.preferredLanguage}. Reply in ${memoryUpdate.preferredLanguage} from now on.`
      : '';

    const response = await ProviderRegistry.generate(context.provider.name, context.provider.apiKey, {
      systemPrompt: systemPrompt + memNote,
      messages: [{ role: 'user', content: input }],
      model: context.provider.model,
      temperature: 0.7,
    });

    await EnterpriseSecurityGuard.logTelemetry(context.workspaceId, {
      type: 'memory_save',
      latencyMs: Date.now() - start,
      success: true,
      toolName: 'LongTermMemory',
    });

    return {
      success: true,
      reply: response.reply,
      toolUsed: 'LongTermMemory',
      telemetry: { latencyMs: Date.now() - start },
    };
  }

  // ----------------------------------------
  // TEXT CHAT — Real LLM call with memory injection
  // ----------------------------------------
  private static async handleTextChat(
    context: WorkspaceContext,
    input: string,
    history: { sender: string; text: string }[],
    memoryContext: string,
    start: number,
    detectedStyle?: string | null,
    attachedContent?: any
  ): Promise<OrchestrationResult> {
    const baseSystem = PromptBuilder.buildSystemPrompt(context);

    // Build system prompt: style override FIRST (highest priority), then base prompt, then memory
    const parts: string[] = [];
    if (detectedStyle) {
      parts.push(PromptBuilder.buildStyleOverride(detectedStyle));
    }
    parts.push(baseSystem);
    if (memoryContext) parts.push(memoryContext);
    const systemPrompt = parts.join('\n\n');

    console.log(`[TextChat] Building reply. Style: "${detectedStyle || 'none'}". History length: ${history.length} AttachedContent: ${attachedContent ? 'Yes' : 'No'}`);
    const msgs = history_to_messages(history);
    if (attachedContent) {
      msgs.push({
        role: 'user' as const,
        content: [
          { type: 'text', text: input },
          attachedContent
        ]
      });
    } else {
      msgs.push({ role: 'user' as const, content: input });
    }

    const response = await ProviderRegistry.generate(context.provider.name, context.provider.apiKey, {
      systemPrompt,
      messages: msgs,
      model: context.provider.model,
      temperature: 0.7,
    });

    return {
      success: true,
      reply: response.reply,
      toolUsed: 'TextChat',
      telemetry: { latencyMs: Date.now() - start },
    };
  }

  // Plugin architecture — for future extensibility
  static registerPlugin(_key: string, _plugin: ICapabilityPlugin) {
    // Future: dynamic capability registration
  }
}

// ==========================================
// HELPERS
// ==========================================

function history_to_messages(history: { sender: string; text: string }[]): Message[] {
  return history.slice(-15).map((h) => {
    // Force content to a plain string — non-vision providers (Groq, DeepSeek, etc.)
    // throw a 400 if content is an array/object (e.g. multipart image turns from history).
    let content: string;
    if (typeof h.text === 'string') {
      content = h.text;
    } else if (Array.isArray(h.text)) {
      // Extract just the text part from multipart content arrays
      const textPart = (h.text as any[]).find((p) => p.type === 'text');
      content = textPart?.text ?? '[image]';
    } else {
      content = String(h.text ?? '');
    }
    return {
      role: h.sender === 'user' ? ('user' as const) : ('assistant' as const),
      content,
    };
  });
}

export function detectConversationStyle(input: string): { language: string; style: string } | null {
  const text = input.toLowerCase();

  // 1. Native script detection
  if (/[\u0B80-\u0BFF]/.test(input)) return { language: 'Tamil', style: 'Tamil Native Script' };
  if (/[\u0900-\u097F]/.test(input)) {
    if (/आहे|करतोय|भावा|काय/.test(input)) return { language: 'Marathi', style: 'Marathi Native Script' };
    return { language: 'Hindi', style: 'Hindi Native Script' };
  }
  if (/[\u0C00-\u0C7F]/.test(input)) return { language: 'Telugu', style: 'Telugu Native Script' };
  if (/[\u0C80-\u0CFF]/.test(input)) return { language: 'Kannada', style: 'Kannada Native Script' };
  if (/[\u0D00-\u0D7F]/.test(input)) return { language: 'Malayalam', style: 'Malayalam Native Script' };
  if (/[\u0980-\u09FF]/.test(input)) return { language: 'Bengali', style: 'Bengali Native Script' };
  if (/[\u0A80-\u0AFF]/.test(input)) return { language: 'Gujarati', style: 'Gujarati Native Script' };
  if (/[\u0A00-\u0A7F]/.test(input)) return { language: 'Punjabi', style: 'Punjabi Native Script' };
  if (/[\u0B00-\u0B7F]/.test(input)) return { language: 'Odia', style: 'Odia Native Script' };
  if (/[\u0600-\u06FF]/.test(input)) return { language: 'Urdu', style: 'Urdu Native Script' };

  // 2. Transliterated / Romanized detection
  // Tanglish (Tamil)
  if (/\b(enna|panra|summa|eppadi|irukinga|nalla|ungalukku|venum|illa|iruku|aama|irukken|enaku|enakku|panunga|pannunga|sollunga|vanakkam|epdi|romba|irukkinga|illai|sari|sapteengala|saptengala|namaskaram|romba|nanri|nandri)\b/.test(text)) {
    return { language: 'Tamil', style: 'Tanglish (Romanized Tamil)' };
  }
  // Hinglish (Hindi)
  if (/\b(kya|kar|raha|hai|bhai|bas|bata|chahiye|achha|yaar|main|tum|aap|kuch|nahi|kr|rha|ho|haiyaar|bol|bolo|kaise)\b/.test(text)) {
    return { language: 'Hindi', style: 'Hinglish (Romanized Hindi)' };
  }
  // Teluglish (Telugu)
  if (/\b(em|chestunnav|ledu|neku|kavali|bagunnara|ela|unnaru|nenu|cheppu|kavalii|bagundhi|bagundi|cheppandi)\b/.test(text)) {
    return { language: 'Telugu', style: 'Teluglish (Romanized Telugu)' };
  }
  // Benglish (Bengali)
  if (/\b(ki|korchis|bhalo|achi|lagbe|kemon|achho|ami|tumi|apni|bhalobashi)\b/.test(text)) {
    return { language: 'Bengali', style: 'Benglish (Romanized Bengali)' };
  }
  // Manglish (Malayalam)
  if (/\b(entha|cheyyunnu|sugamano|nalla|enikku|venam|nannayi|evide|nanni|sugam)\b/.test(text)) {
    return { language: 'Malayalam', style: 'Manglish (Romanized Malayalam)' };
  }
  // Kanglish (Kannada)
  if (/\b(enu|madtidiya|chennagi|idini|nanage|beku|hegidhira|chennagiddira|chennagidira)\b/.test(text)) {
    return { language: 'Kannada', style: 'Kanglish (Romanized Kannada)' };
  }
  // Marathish (Marathi Romanized)
  if (/\b(kay|kartoy|bara|ahe|mala|pahije|kasa|bhava|kasat|aho)\b/.test(text)) {
    return { language: 'Marathi', style: 'Marathish (Romanized Marathi)' };
  }
  // Gujarish (Gujarati Romanized)
  if (/\b(kem|chho|majama|mane|joiye|su|karo|nathi|saras)\b/.test(text)) {
    return { language: 'Gujarati', style: 'Gujarish (Romanized Gujarati)' };
  }
  // Punjabi English (Romanized Punjabi)
  if (/\b(ki|karde|vadiya|mainu|chahida|kiddan|tusi|dasso)\b/.test(text)) {
    return { language: 'Punjabi', style: 'Punjabi Romanized (Romanized Punjabi)' };
  }
  // Urdu Roman (Romanized Urdu)
  if (/\b(kya|kar|rahe|ho|bhai|bas|batain|chahiye|achha|yaar|mein|tum|aap|kuch|nahi|kr|rha|hoga|shukriya|khuda|hafiz)\b/.test(text)) {
    return { language: 'Urdu', style: 'Urdu Roman (Romanized Urdu)' };
  }

  return null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { PromptBuilder } from './PromptBuilder';
import { ProviderRegistry } from './ProviderRegistry';
import { KnowledgeService } from './KnowledgeService';
import { ConversationRequest, Message } from './types/ConversationRequest';
import { ConversationResponse } from './types/ConversationResponse';
import { WorkspaceContext } from './types/WorkspaceContext';
import { SkillService } from './SkillService';
import { ToolRegistry } from './ToolRegistry';
import { KnowledgeRetrievalService } from './KnowledgeRetrievalService';
import { RAGContextBuilder } from './RAGContextBuilder';
import { EnterpriseOrchestrator, readWorkspaceMemory, writeWorkspaceMemory, detectConversationStyle } from './EnterpriseOrchestrationEngine';

export interface GenerateReplyOptions {
  model?: string;
  temperature?: number;
  memoryEnabled?: boolean;
  knowledgeEnabled?: boolean;
  systemPrompt?: string;
  attachedContent?: any;
}

export class ConversationService {
  /**
   * Generate an AI reply using a pre-loaded WorkspaceContext.
   *
   * WorkspaceContextLoader.load() must be called ONCE by the caller (e.g. chat/route.ts)
   * and the resulting context object passed here directly.
   * This avoids a second unauthenticated server-side Firestore read.
   */
  static async generateReply(
    context: WorkspaceContext,
    message: string,
    history: { sender: string; text: string }[] = [],
    options: GenerateReplyOptions = {}
  ): Promise<ConversationResponse> {
    try {
      if (!context.workspaceId) {
        throw new Error('Workspace context is missing.');
      }
      if (!message || !message.trim()) {
        throw new Error('Input message content cannot be empty.');
      }

      const providerName = context.provider.name;
      const apiKey = context.provider.apiKey;
      const model = options.model || context.provider.model;
      const temp = typeof options.temperature === 'number' ? options.temperature : 0.7;

      if (!apiKey) {
        throw new Error(
          `API key for provider '${providerName}' is not configured. Please add your key in the API Keys tab.`
        );
      }

      let knowledgeForPrompt = '';
      if (options.knowledgeEnabled !== false) {
        knowledgeForPrompt = context.knowledge?.trim() || '';

        if (!knowledgeForPrompt) {
          console.log('[ConversationService] context.knowledge is empty, reloading via KnowledgeService.getFormattedKnowledge()', {
            workspaceId: context.workspaceId,
          });
          knowledgeForPrompt = await KnowledgeService.getFormattedKnowledge(context.workspaceId);
        }

        // Retrieve relevant RAG vector chunks dynamically using semantic search
        try {
          const startRAG = Date.now();
          const retrievedChunks = await KnowledgeRetrievalService.retrieve(
            context.workspaceId,
            message,
            4,
            0.45,
            context.provider
          );
          const durationRAG = Date.now() - startRAG;
          console.log(`[Timer] Knowledge retrieval (RAG) took ${durationRAG}ms`);
          
          const ragContext = RAGContextBuilder.buildUntrustedRAGContext(retrievedChunks);
          if (ragContext) {
            knowledgeForPrompt = knowledgeForPrompt 
              ? `${knowledgeForPrompt}\n\n${ragContext}`
              : ragContext;
          }
        } catch (e) {
          console.error('[ConversationService] dynamic RAG retrieval error:', e);
        }
      }

      console.log('[ConversationService] Knowledge passed into PromptBuilder', {
        workspaceId: context.workspaceId,
        knowledgeEnabled: options.knowledgeEnabled !== false,
        knowledgeLength: knowledgeForPrompt.length,
      });

      // 1. Select relevant active skills using SkillService.routeRelevantSkills
      const enabledSkills = context.enabledSkills || [];
      const activeSkills = SkillService.routeRelevantSkills(message, enabledSkills);

      // 2. Compose skill instructions
      let skillInstructions = '';
      if (activeSkills.length > 0) {
        skillInstructions = '=== ACTIVE SYSTEM SKILLS & CAPABILITIES ===\nYou have the following skills currently active. Respond and behave strictly according to these active capabilities:\n\n' + 
          activeSkills.map((s, idx) => `${idx + 1}. [Skill: ${s.name}]\n   - Description: ${s.description}\n   - Instructions: ${s.instructions}`).join('\n\n');
      }

      // 3. Expose tools if active skills require them
      const toolsExposed = Array.from(new Set(activeSkills.flatMap(s => s.requiredTools || [])));

      // 4. Compose final system prompt
      let baseSystemPrompt = options.systemPrompt || context.assistant.systemPrompt || '';
      if (skillInstructions) {
        baseSystemPrompt += `\n\n${skillInstructions}`;
      }

      if (toolsExposed.length > 0) {
        baseSystemPrompt += `\n\n=== EXPOSING SERVER-SIDE TOOLS ===
You have access to the following server-side tools:
${toolsExposed.map(t => `- ${t}`).join('\n')}

To execute a tool, output EXACTLY:
<execute_tool name="tool-name">{"arg1": "val1"}</execute_tool>
Ensure your response contains nothing else when executing a tool. Once the tool executes, the system will provide the output and you can generate your final answer.`;
      }

      // Build system prompt with optional knowledge injection
      const systemPrompt = PromptBuilder.buildSystemPrompt(
        {
          ...context,
          knowledge: knowledgeForPrompt,
        },
        baseSystemPrompt
      );

      // Assemble chat history
      const requestMessages: Message[] = [];

      if (options.memoryEnabled !== false && history.length > 0) {
        history.forEach((h) => {
          requestMessages.push({
            role: h.sender === 'user' ? 'user' : 'assistant',
            content: h.text,
          });
        });
      }

      // Append current user message
      if (options.attachedContent) {
        requestMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: message },
            options.attachedContent
          ]
        });
      } else {
        requestMessages.push({ role: 'user', content: message });
      }

      // Construct unified request
      const request: ConversationRequest = {
        systemPrompt,
        messages: requestMessages,
        model,
        temperature: temp,
      };

      console.log('[ConversationService] Final prompt config', {
        workspaceId: context.workspaceId,
        provider: providerName,
        model,
      });

      // Execute via EnterpriseOrchestrator
      const startLLM = Date.now();
      const orchResult = await EnterpriseOrchestrator.routeAndExecute(
        {
          ...context,
          knowledge: knowledgeForPrompt,
          assistant: {
            ...context.assistant,
            systemPrompt: baseSystemPrompt
          }
        },
        message,
        history,
        options.attachedContent
      );
      let response: ConversationResponse = {
        reply: orchResult.reply,
        inputTokens: 0,
        outputTokens: 0
      };
      const durationLLM = Date.now() - startLLM;
      console.log(`[Timer] Enterprise Orchestrator response generation took ${durationLLM}ms`);

      const toolsExecuted: string[] = [];
      const executionErrors: string[] = [];

      // Loop up to 3 times to allow multi-step tool calls/workflows!
      let loopCount = 0;
      while (loopCount < 3) {
        const reply = response.reply || '';
        const match = reply.match(/<execute_tool name="([^"]+)">([\s\S]*?)<\/execute_tool>/);
        if (!match) {
          break;
        }

        const toolName = match[1].trim();
        const argsRaw = match[2].trim();
        let args: Record<string, any> = {};

        console.log(`[ConversationService] Tool execution request detected: ${toolName} with args: ${argsRaw}`);

        try {
          args = JSON.parse(argsRaw);
        } catch (e: any) {
          executionErrors.push(`Failed to parse arguments JSON: ${e.message}`);
        }

        let toolOutput = '';
        if (executionErrors.length === 0) {
          toolsExecuted.push(toolName);
          const toolResult = await ToolRegistry.executeTool(context.workspaceId, toolName, args);
          if (toolResult.success) {
            toolOutput = toolResult.output;
          } else {
            toolOutput = `Error: ${toolResult.error || 'Execution failed.'}`;
            executionErrors.push(toolOutput);
          }
        } else {
          toolOutput = `Error: ${executionErrors[executionErrors.length - 1]}`;
        }

        // Append tool query and output to conversation history
        requestMessages.push({ role: 'assistant', content: reply });
        requestMessages.push({ role: 'user', content: `[Tool Result for ${toolName}: ${toolOutput}]` });

        // Call provider again
        response = await ProviderRegistry.generate(providerName, apiKey, {
          ...request,
          messages: requestMessages
        });
        loopCount++;
      }

      // FIX 2 - Output-side safety checks (defense in depth)
      if (response && response.reply) {
        const reply = response.reply;
        const lowerReply = reply.toLowerCase();
        const lowerMessage = message.toLowerCase();
        const businessName = context.assistant?.name || 'our business';
        const redirectMessage = `I'm here to help you with ${businessName}. What can I assist you with today?`;

        // Check if .pdf appears without the user asking about documents/files
        const hasPdfLeak = reply.includes('.pdf') && 
          !lowerMessage.includes('pdf') && 
          !lowerMessage.includes('doc') && 
          !lowerMessage.includes('file') && 
          !lowerMessage.includes('guide') &&
          !lowerMessage.includes('pamphlet') &&
          !lowerMessage.includes('paper') &&
          !lowerMessage.includes('book') &&
          !lowerMessage.includes('manual');

        const containsLeakMarker =
          reply.includes('IDENTITY RULES') ||
          reply.includes('FACTUALITY RULES') ||
          reply.includes('KNOWLEDGE BASE ===') ||
          reply.includes('BUSINESS PROFILE ===') ||
          lowerReply.includes('system prompt') ||
          hasPdfLeak;

        if (containsLeakMarker) {
          console.warn('[ConversationService] Prompt leak detected in AI response! Overriding with safe redirect.');
          response.reply = redirectMessage;
        }

        // Health & Wellness safety disclaimer enforcement
        const isHealthWellnessActive = activeSkills.some(s => s.category === 'Health & Wellness');
        if (isHealthWellnessActive) {
          const disclaimer = 'Disclaimer: I am an AI assistant and this info is for educational purposes only. For medical queries, consult a professional.';
          const hasDisclaimer = response.reply.toLowerCase().includes('educational purposes only') || 
                               response.reply.toLowerCase().includes('disclaimer');
          if (!hasDisclaimer) {
            response.reply += `\n\n${disclaimer}`;
          }
        }
      }

      // Inject diagnostics
      response.diagnostics = {
        installedSkillsCount: (context.enabledSkills || []).length,
        enabledSkillsCount: (context.enabledSkills || []).length,
        skillsSelected: activeSkills.map(s => s.name),
        toolsExposed,
        toolsExecuted,
        executionErrors,
        llmLatency: durationLLM
      };

      return response;
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'An internal error occurred in the AI Conversation Engine.';
      console.error('ConversationService generateReply error:', e);
      
      const enabledSkills = context.enabledSkills || [];
      const activeSkills = SkillService.routeRelevantSkills(message, enabledSkills);
      const toolsExposed = Array.from(new Set(activeSkills.flatMap(s => s.requiredTools || [])));

      return {
        reply: '',
        inputTokens: 0,
        outputTokens: 0,
        error: errorMessage,
        diagnostics: {
          installedSkillsCount: (context.enabledSkills || []).length,
          enabledSkillsCount: (context.enabledSkills || []).length,
          skillsSelected: activeSkills.map(s => s.name),
          toolsExposed,
          toolsExecuted: [],
          executionErrors: [errorMessage]
        }
      };
    }
  }

  static async *generateReplyStream(
    context: WorkspaceContext,
    message: string,
    history: { sender: string; text: string }[] = [],
    options: GenerateReplyOptions = {}
  ): AsyncGenerator<{ text: string; inputTokens?: number; outputTokens?: number }> {
    if (!context.workspaceId) {
      throw new Error('Workspace context is missing.');
    }
    if (!message || !message.trim()) {
      throw new Error('Input message content cannot be empty.');
    }

    const providerName = context.provider.name;
    const apiKey = context.provider.apiKey;
    const model = options.model || context.provider.model;
    const temp = typeof options.temperature === 'number' ? options.temperature : 0.7;

    if (!apiKey) {
      throw new Error(
        `API key for provider '${providerName}' is not configured. Please add your key in the API Keys tab.`
      );
    }

    let knowledgeForPrompt = '';
    if (options.knowledgeEnabled !== false) {
      knowledgeForPrompt = context.knowledge?.trim() || '';

      if (!knowledgeForPrompt) {
        knowledgeForPrompt = await KnowledgeService.getFormattedKnowledge(context.workspaceId);
      }

      try {
        const retrievedChunks = await KnowledgeRetrievalService.retrieve(
          context.workspaceId,
          message,
          4,
          0.45,
          context.provider
        );
        const ragContext = RAGContextBuilder.buildUntrustedRAGContext(retrievedChunks);
        if (ragContext) {
          knowledgeForPrompt = knowledgeForPrompt 
            ? `${knowledgeForPrompt}\n\n${ragContext}`
            : ragContext;
        }
      } catch (e) {
        console.error('[ConversationService] dynamic RAG retrieval error:', e);
      }
    }

    const enabledSkills = context.enabledSkills || [];
    const activeSkills = SkillService.routeRelevantSkills(message, enabledSkills);

    let skillInstructions = '';
    if (activeSkills.length > 0) {
      skillInstructions = '=== ACTIVE SYSTEM SKILLS & CAPABILITIES ===\nYou have the following skills currently active. Respond and behave strictly according to these active capabilities:\n\n' + 
        activeSkills.map((s, idx) => `${idx + 1}. [Skill: ${s.name}]\n   - Description: ${s.description}\n   - Instructions: ${s.instructions}`).join('\n\n');
    }

    let baseSystemPrompt = options.systemPrompt || context.assistant.systemPrompt || '';
    if (skillInstructions) {
      baseSystemPrompt += `\n\n${skillInstructions}`;
    }

    // Load and update style memory
    let memoryContext = '';
    try {
      const memory = await readWorkspaceMemory(context.workspaceId);
      const memParts: string[] = [];
      if (memory.customerName) memParts.push(`Customer name: ${memory.customerName}`);
      if (memory.preferredLanguage) memParts.push(`Preferred language: ${memory.preferredLanguage}`);
      if (memory.preferredStyle) memParts.push(`Preferred conversation/writing style: ${memory.preferredStyle}`);
      if (memParts.length > 0) {
        memoryContext = `\n\n[CUSTOMER MEMORY]\n${memParts.join('\n')}`;
      }
    } catch {
      // ignore
    }

    try {
      const styleDetection = detectConversationStyle(message);
      if (styleDetection) {
        await writeWorkspaceMemory(context.workspaceId, {
          preferredLanguage: styleDetection.language,
          preferredStyle: styleDetection.style,
        });
        if (!memoryContext.includes(styleDetection.style)) {
          memoryContext += `\nPreferred conversation/writing style: ${styleDetection.style}`;
        }
      }
    } catch (e) {
      console.error('[Memory] Saving style preference during stream failed:', e);
    }

    const systemPrompt = PromptBuilder.buildSystemPrompt(
      {
        ...context,
        knowledge: knowledgeForPrompt,
      },
      baseSystemPrompt + memoryContext
    );

    const requestMessages: Message[] = [];
    if (options.memoryEnabled !== false && history.length > 0) {
      history.forEach((h) => {
        requestMessages.push({
          role: h.sender === 'user' ? 'user' : 'assistant',
          content: h.text,
        });
      });
    }

    if (options.attachedContent) {
      requestMessages.push({
        role: 'user',
        content: [
          { type: 'text', text: message },
          options.attachedContent
        ]
      });
    } else {
      requestMessages.push({ role: 'user', content: message });
    }

    const request: ConversationRequest = {
      systemPrompt,
      messages: requestMessages,
      model,
      temperature: temp,
    };

    yield* ProviderRegistry.generateStream(providerName, apiKey, request);
  }
}

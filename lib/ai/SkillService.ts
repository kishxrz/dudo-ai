import { db } from '@/lib/firebase';
import { getAdminDb } from '@/lib/firebase-admin';
import { doc, getDoc, updateDoc, collection, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { Skill, SkillMetadata } from '@/types/skill';
import { WorkspaceContextLoader } from './WorkspaceContextLoader';
import { ProviderRegistry } from './ProviderRegistry';
import { ToolRegistry } from './ToolRegistry';
import metadataListRaw from '@/data/skills/metadata.json';
import { getSkillsByIds, getSkillsMetadataByCategory } from '@/data/skills/index';

const metadataList = metadataListRaw as SkillMetadata[];
const BUILT_IN_COUNT = 200;
const BUILT_IN_IDS = new Set(metadataList.map(s => s.id).slice(0, BUILT_IN_COUNT));

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  instructions: string;
  inputSchema: string;
  outputSchema: string;
  requiredTools: string[];
  handlerType: 'instruction' | 'tool' | 'workflow';
  handlerConfig: Record<string, any>;
  source: 'built-in' | 'library' | 'custom';
  enabled: boolean;
  tags?: string[];
}

export class SkillService {
  /**
   * Helper to check if a skill is built-in.
   */
  static isBuiltIn(skillId: string): boolean {
    return BUILT_IN_IDS.has(skillId);
  }

  /**
   * Convert compiled catalog Skill to clean SkillDefinition.
   */
  static mapToSkillDefinition(skill: Skill, source: 'built-in' | 'library', enabled: boolean): SkillDefinition {
    let handlerType: 'instruction' | 'tool' | 'workflow' = 'instruction';
    if ((skill.toolsAllowed || []).length > 0) {
      handlerType = 'tool';
    } else if ((skill.actionsAllowed || []).length > 0) {
      handlerType = 'workflow';
    }

    return {
      id: skill.skillId,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      version: skill.version || '1.0.0',
      instructions: skill.systemInstructions || '',
      inputSchema: JSON.stringify({
        required: skill.requiredInputs || [],
        optional: skill.optionalInputs || []
      }),
      outputSchema: skill.outputBehavior || '',
      requiredTools: skill.toolsAllowed || [],
      handlerType,
      handlerConfig: {
        capabilities: skill.capabilities || [],
        triggerConditions: skill.triggerConditions || [],
        negativeTriggerConditions: skill.negativeTriggerConditions || [],
        routingHints: skill.routingHints || [],
        priority: skill.priority || 1,
        tags: skill.tags || []
      },
      source,
      enabled,
      tags: skill.tags || []
    };
  }

  /**
   * List all skills with their installation and enabled statuses for a workspace.
   */
  static async listAllSkills(workspaceId: string): Promise<SkillDefinition[]> {
    const adminDb = getAdminDb();
    let installedIds = new Set<string>();
    let enabledIds = new Set<string>();
    let customSkills: SkillDefinition[] = [];

    // 1. Fetch workspace configuration
    try {
      if (adminDb) {
        const snap = await adminDb.doc(`workspaces/${workspaceId}/assistants/assistant-1`).get();
        if (snap.exists) {
          const data = snap.data();
          if (data) {
            installedIds = new Set(data.installedSkillIds || []);
            enabledIds = new Set(data.enabledSkillIds || []);
          }
        }
      } else if (db) {
        const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'assistants', 'assistant-1'));
        if (snap.exists()) {
          const data = snap.data();
          if (data) {
            installedIds = new Set(data.installedSkillIds || []);
            enabledIds = new Set(data.enabledSkillIds || []);
          }
        }
      }
    } catch (e) {
      console.error('[SkillService] Failed to load workspace configuration:', e);
    }

    // 2. Fetch custom skills
    try {
      if (adminDb) {
        const snap = await adminDb.collection(`workspaces/${workspaceId}/custom_skills`).get();
        snap.forEach((d: any) => {
          const data = d.data();
          customSkills.push({
            ...data,
            id: d.id,
            source: 'custom',
            enabled: enabledIds.has(d.id)
          });
        });
      } else if (db) {
        const snap = await getDocs(collection(db, 'workspaces', workspaceId, 'custom_skills'));
        snap.forEach((d) => {
          const data = d.data() as Omit<SkillDefinition, 'id' | 'source' | 'enabled'>;
          customSkills.push({
            ...data,
            id: d.id,
            source: 'custom',
            enabled: enabledIds.has(d.id)
          } as SkillDefinition);
        });
      }
    } catch (e) {
      console.error('[SkillService] Failed to load custom skills:', e);
    }

    // 3. Resolve built-in and library catalog skills
    const resolvedCatalogSkills: SkillDefinition[] = [];
    const allCatalogIds = metadataList.map(m => m.id);
    
    // Batch load all skills
    try {
      const catalogSkills = await getSkillsByIds(allCatalogIds);
      catalogSkills.forEach((s) => {
        const isBuiltin = this.isBuiltIn(s.skillId);
        const source = isBuiltin ? 'built-in' : 'library';
        const isInstalled = isBuiltin || installedIds.has(s.skillId);
        
        // Only return installed library skills or any built-in skills in list
        if (isBuiltin || isInstalled) {
          resolvedCatalogSkills.push(
            this.mapToSkillDefinition(s, source, enabledIds.has(s.skillId))
          );
        }
      });
    } catch (e) {
      console.error('[SkillService] Failed to load catalog skills:', e);
    }

    return [...resolvedCatalogSkills, ...customSkills];
  }

  /**
   * Install a library skill to a workspace.
   */
  static async installSkill(workspaceId: string, skillId: string): Promise<void> {
    if (this.isBuiltIn(skillId)) return; // Built-in are always installed

    const adminDb = getAdminDb();
    if (adminDb) {
      const ref = adminDb.doc(`workspaces/${workspaceId}/assistants/assistant-1`);
      const snap = await ref.get();
      const installed = snap.exists ? (snap.data()?.installedSkillIds || []) : [];
      if (!installed.includes(skillId)) {
        await ref.set({ installedSkillIds: [...installed, skillId] }, { merge: true });
      }
    } else if (db) {
      const ref = doc(db, 'workspaces', workspaceId, 'assistants', 'assistant-1');
      const snap = await getDoc(ref);
      const installed = snap.exists() ? (snap.data()?.installedSkillIds || []) : [];
      if (!installed.includes(skillId)) {
        await setDoc(ref, { installedSkillIds: [...installed, skillId] }, { merge: true });
      }
    }
  }

  /**
   * Uninstall a library skill from a workspace (and disable it).
   */
  static async uninstallSkill(workspaceId: string, skillId: string): Promise<void> {
    if (this.isBuiltIn(skillId)) return; // Cannot uninstall built-in

    const adminDb = getAdminDb();
    if (adminDb) {
      const ref = adminDb.doc(`workspaces/${workspaceId}/assistants/assistant-1`);
      const snap = await ref.get();
      const installed = snap.exists ? (snap.data()?.installedSkillIds || []).filter((id: string) => id !== skillId) : [];
      const enabled = snap.exists ? (snap.data()?.enabledSkillIds || []).filter((id: string) => id !== skillId) : [];
      await ref.set({ installedSkillIds: installed, enabledSkillIds: enabled }, { merge: true });
    } else if (db) {
      const ref = doc(db, 'workspaces', workspaceId, 'assistants', 'assistant-1');
      const snap = await getDoc(ref);
      const installed = snap.exists() ? (snap.data()?.installedSkillIds || []).filter((id: string) => id !== skillId) : [];
      const enabled = snap.exists() ? (snap.data()?.enabledSkillIds || []).filter((id: string) => id !== skillId) : [];
      await setDoc(ref, { installedSkillIds: installed, enabledSkillIds: enabled }, { merge: true });
    }
  }

  /**
   * Enable a skill.
   */
  static async enableSkill(workspaceId: string, skillId: string): Promise<void> {
    const adminDb = getAdminDb();
    if (adminDb) {
      const ref = adminDb.doc(`workspaces/${workspaceId}/assistants/assistant-1`);
      const snap = await ref.get();
      const enabled = snap.exists ? (snap.data()?.enabledSkillIds || []) : [];
      if (!enabled.includes(skillId)) {
        await ref.set({ enabledSkillIds: [...enabled, skillId] }, { merge: true });
      }
    } else if (db) {
      const ref = doc(db, 'workspaces', workspaceId, 'assistants', 'assistant-1');
      const snap = await getDoc(ref);
      const enabled = snap.exists() ? (snap.data()?.enabledSkillIds || []) : [];
      if (!enabled.includes(skillId)) {
        await setDoc(ref, { enabledSkillIds: [...enabled, skillId] }, { merge: true });
      }
    }
  }

  /**
   * Disable a skill.
   */
  static async disableSkill(workspaceId: string, skillId: string): Promise<void> {
    const adminDb = getAdminDb();
    if (adminDb) {
      const ref = adminDb.doc(`workspaces/${workspaceId}/assistants/assistant-1`);
      const snap = await ref.get();
      const enabled = snap.exists ? (snap.data()?.enabledSkillIds || []).filter((id: string) => id !== skillId) : [];
      await ref.set({ enabledSkillIds: enabled }, { merge: true });
    } else if (db) {
      const ref = doc(db, 'workspaces', workspaceId, 'assistants', 'assistant-1');
      const snap = await getDoc(ref);
      const enabled = snap.exists() ? (snap.data()?.enabledSkillIds || []).filter((id: string) => id !== skillId) : [];
      await setDoc(ref, { enabledSkillIds: enabled }, { merge: true });
    }
  }

  /**
   * Validate a SkillDefinition for safety, code execution, meaning, and parameters.
   */
  static validateSkill(skill: Partial<SkillDefinition>): { valid: boolean; error?: string } {
    if (!skill.name || !skill.name.trim()) return { valid: false, error: 'Skill name is required.' };
    if (!skill.description || !skill.description.trim()) return { valid: false, error: 'Skill description is required.' };
    if (!skill.instructions || !skill.instructions.trim()) return { valid: false, error: 'Skill instructions/prompt behavior are required.' };
    
    if (skill.name.length < 3 || skill.description.length < 10 || skill.instructions.length < 15) {
      return { valid: false, error: 'Skill name, description, or instructions are too short or meaningless.' };
    }

    // Code execution check
    const forbiddenCodePatterns = [
      /javascript:/i,
      /<script/i,
      /\beval\s*\(/,
      /\bFunction\s*\(/,
      /\bexec\s*\(/,
      /\bspawn\s*\(/,
      /\bchild_process\b/i,
      /require\s*\(/,
      /import\s+.*\s+from/
    ];

    for (const pattern of forbiddenCodePatterns) {
      if (pattern.test(skill.instructions || '') || pattern.test(JSON.stringify(skill.handlerConfig || {}))) {
        return { valid: false, error: 'Arbitrary script or shell code execution is strictly forbidden in skill definitions.' };
      }
    }

    // Validate tools
    const reqTools = skill.requiredTools || [];
    for (const t of reqTools) {
      if (!ToolRegistry.isApproved(t)) {
        return { valid: false, error: `Tool '${t}' is not an approved server-side tool.` };
      }
    }

    return { valid: true };
  }

  /**
   * Generate a custom skill definition using AI.
   */
  static async createCustomSkill(workspaceId: string, prompt: string): Promise<SkillDefinition> {
    if (!prompt || !prompt.trim() || prompt.length < 5) {
      throw new Error('A descriptive prompt (at least 5 characters) is required to generate a skill.');
    }

    // 1. Load active AI provider settings
    const context = await WorkspaceContextLoader.load(workspaceId);
    const providerName = context.provider.name;
    const apiKey = context.provider.apiKey;
    const model = context.provider.model;

    if (!apiKey) {
      throw new Error(`API key for provider '${providerName}' is not configured. Config it in API Keys tab.`);
    }

    const systemPrompt = `You are the Dudo AI Skill Architect.
Based on the user's description of a capability they want, generate a highly structured SkillDefinition JSON object.

The output MUST be a single raw JSON object matching this schema exactly:
{
  "name": "Concise Skill Name",
  "description": "Short explanation of what the skill does.",
  "category": "One of: Customer Support, Sales & Marketing, Scheduling, Communication, Analytics & Insights, Industry Specific, Browser & Automation, Writing & Content, Development & Coding, Education & Learning, Health & Wellness, General",
  "instructions": "Detailed system instructions/behavior constraints to inject into the prompt.",
  "inputSchema": "{\\"required\\":[],\\"optional\\":[]}",
  "outputSchema": "Format behavior instructions.",
  "requiredTools": [],
  "handlerType": "instruction"
}

Constraints:
1. "handlerType" must be "instruction" (unless they explicitly request a Google tool interaction, in which case add that tool to requiredTools and set handlerType to "tool").
2. The only allowed tools in "requiredTools" are: "google-calendar-list", "google-calendar-create", "gmail-send", "google-sheets-append", "google-docs-create".
3. Avoid any script or executable code block in "instructions". Include only natural language instructions.
4. Output ONLY the raw JSON string. Do not wrap in markdown fences like \`\`\`json.`;

    const request = {
      systemPrompt,
      messages: [{ role: 'user' as const, content: `Create a skill for: ${prompt}` }],
      model,
      temperature: 0.2
    };

    const response = await ProviderRegistry.generate(providerName, apiKey, request);
    if (!response || !response.reply) {
      throw new Error('Failed to generate skill definition from AI provider.');
    }

    // Clean markdown blocks if LLM wraps it
    let cleanJson = response.reply.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleanJson);
    } catch (e) {
      console.error('[SkillService] Failed to parse AI generated JSON:', cleanJson);
      throw new Error('AI generated an invalid JSON format. Please try again with a different description.');
    }

    const customId = `custom-skill-${Math.random().toString(36).substring(2, 11)}`;

    const skillDef: SkillDefinition = {
      id: customId,
      name: parsed.name || 'AI Custom Skill',
      description: parsed.description || 'Generated custom skill.',
      category: parsed.category || 'General',
      version: '1.0.0',
      instructions: parsed.instructions || '',
      inputSchema: parsed.inputSchema || '{}',
      outputSchema: parsed.outputSchema || '',
      requiredTools: parsed.requiredTools || [],
      handlerType: parsed.handlerType || 'instruction',
      handlerConfig: {},
      source: 'custom',
      enabled: false
    };

    const validation = this.validateSkill(skillDef);
    if (!validation.valid) {
      throw new Error(`AI generated an invalid skill: ${validation.error}`);
    }

    return skillDef;
  }

  /**
   * Persist a custom skill to Firestore.
   */
  static async saveCustomSkill(workspaceId: string, skill: SkillDefinition): Promise<void> {
    const validation = this.validateSkill(skill);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const payload = {
      name: skill.name,
      description: skill.description,
      category: skill.category,
      version: skill.version || '1.0.0',
      instructions: skill.instructions,
      inputSchema: skill.inputSchema || '{}',
      outputSchema: skill.outputSchema || '',
      requiredTools: skill.requiredTools || [],
      handlerType: skill.handlerType || 'instruction',
      handlerConfig: skill.handlerConfig || {},
      source: 'custom'
    };

    const adminDb = getAdminDb();
    if (adminDb) {
      await adminDb.doc(`workspaces/${workspaceId}/custom_skills/${skill.id}`).set(payload, { merge: true });
    } else if (db) {
      await setDoc(doc(db, 'workspaces', workspaceId, 'custom_skills', skill.id), payload, { merge: true });
    }
  }

  /**
   * Delete a custom skill from Firestore and disable it.
   */
  static async deleteCustomSkill(workspaceId: string, skillId: string): Promise<void> {
    const adminDb = getAdminDb();
    if (adminDb) {
      await adminDb.doc(`workspaces/${workspaceId}/custom_skills/${skillId}`).delete();
      // Remove from enabled list too
      const ref = adminDb.doc(`workspaces/${workspaceId}/assistants/assistant-1`);
      const snap = await ref.get();
      const enabled = (snap.data()?.enabledSkillIds || []).filter((id: string) => id !== skillId);
      await ref.update({ enabledSkillIds: enabled });
    } else if (db) {
      await deleteDoc(doc(db, 'workspaces', workspaceId, 'custom_skills', skillId));
      // Remove from enabled list too
      const ref = doc(db, 'workspaces', workspaceId, 'assistants', 'assistant-1');
      const snap = await getDoc(ref);
      const enabled = (snap.data()?.enabledSkillIds || []).filter((id: string) => id !== skillId);
      await updateDoc(ref, { enabledSkillIds: enabled });
    }
  }

  /**
   * Resolve all enabled skills for the workspace.
   */
  static async resolveEnabledSkills(workspaceId: string): Promise<SkillDefinition[]> {
    const allSkills = await this.listAllSkills(workspaceId);
    return allSkills.filter(s => s.enabled);
  }

  /**
   * Route/filter enabled skills based on the incoming message context (returns up to 5).
   */
  static routeRelevantSkills(message: string, enabledSkills: SkillDefinition[]): SkillDefinition[] {
    if (enabledSkills.length === 0) return [];
    const msgLower = message.toLowerCase();

    // Scoring candidates
    const scored = enabledSkills.map(skill => {
      let score = 0;

      // 1. Check title/description matches
      if (msgLower.includes(skill.name.toLowerCase())) score += 5;
      if (msgLower.includes(skill.description.toLowerCase())) score += 2;

      // 2. Check trigger conditions in handlerConfig
      const triggers = skill.handlerConfig?.triggerConditions || [];
      triggers.forEach((trig: string) => {
        if (msgLower.includes(trig.toLowerCase())) score += 8;
      });

      const hints = skill.handlerConfig?.routingHints || [];
      hints.forEach((hint: string) => {
        if (msgLower.includes(hint.toLowerCase())) score += 4;
      });

      const tags = skill.handlerConfig?.tags || [];
      tags.forEach((tag: string) => {
        if (msgLower.includes(tag.toLowerCase())) score += 2;
      });

      // Exclusion checks (negative triggers)
      const negativeTriggers = skill.handlerConfig?.negativeTriggerConditions || [];
      const hasNegative = negativeTriggers.some((neg: string) => msgLower.includes(neg.toLowerCase()));
      if (hasNegative) {
        score = -100; // block
      }

      return { skill, score };
    });

    // Filter positive scores, sort descending
    const filtered = scored.filter(x => x.score >= 0);
    if (filtered.length === 0) {
      // Fallback: return priority-based or the first 2 general/built-in
      return enabledSkills
        .slice()
        .sort((a, b) => {
          const prioA = a.handlerConfig?.priority || 0;
          const prioB = b.handlerConfig?.priority || 0;
          return prioB - prioA;
        })
        .slice(0, 2);
    }

    filtered.sort((a, b) => b.score - a.score);
    return filtered.slice(0, 5).map(x => x.skill);
  }
}

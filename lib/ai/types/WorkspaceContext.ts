import { SkillDefinition } from '../SkillService';

export interface WorkspaceContext {
  workspaceId: string;
  assistant: {
    name: string;
    systemPrompt: string;
    timezone: string;
    whatsappAdmins?: string;
    telegramAdmins?: string;
    bossCode?: string;
    status: 'draft' | 'live' | 'paused';
    enabledSkillIds?: string[];
  };
  provider: {
    name: string;
    model: string;
    apiKey: string;
  };
  knowledge: string; // Formatted context from knowledge base
  enabledSkills?: SkillDefinition[];
}

export interface SkillExample {
  input: string;
  output: string;
}

export interface Skill {
  skillId: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  version: string;
  status: 'active' | 'draft' | 'deprecated' | 'live';
  capabilities: string[];
  triggerConditions: string[];
  negativeTriggerConditions: string[];
  systemInstructions: string;
  requiredInputs: string[];
  optionalInputs: string[];
  outputBehavior: string;
  toolsAllowed: string[];
  actionsAllowed: string[];
  constraints: string[];
  safetyRules: string[];
  conflictsWith: string[];
  compatibleSkills: string[];
  priority: number;
  routingHints: string[];
  examples: SkillExample[];
  parentSkillId?: string;
  relatedSkillIds?: string[];
  knowledgeDomains: string[];
}

export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  aliases?: string[];
  searchKeywords?: string[];
  targetAudiences?: string[];
  parentSkillId?: string;
  relatedSkillIds?: string[];
  knowledgeDomains?: string[];
}

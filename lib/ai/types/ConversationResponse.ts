export interface ConversationResponse {
  reply: string;
  inputTokens: number;
  outputTokens: number;
  error?: string;
  diagnostics?: {
    installedSkillsCount: number;
    enabledSkillsCount: number;
    skillsSelected: string[];
    toolsExposed: string[];
    toolsExecuted: string[];
    executionErrors: string[];
  };
}

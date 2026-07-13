import { Skill } from '@/types/skill';

export class SkillRouter {
  /**
   * Route and select the top 1-5 relevant enabled skills for an incoming message.
   */
  static selectActiveSkills(message: string, enabledSkills: Skill[]): Skill[] {
    if (enabledSkills.length === 0) return [];

    const msgLower = message.toLowerCase();

    // STAGE 1: DETERMINISTIC FILTERING
    const candidates = enabledSkills.filter(skill => {
      // 1. Check negative triggers (exclusion)
      const hasNegativeTrigger = (skill.negativeTriggerConditions || []).some(neg => 
        msgLower.includes(neg.toLowerCase())
      );
      if (hasNegativeTrigger) return false;

      // 2. Check trigger conditions (inclusion)
      const matchesTrigger = (skill.triggerConditions || []).some(trig => 
        msgLower.includes(trig.toLowerCase())
      );

      // 3. Check tags or routing hints in the message text
      const matchesTags = (skill.tags || []).some(tag => 
        msgLower.includes(tag.toLowerCase())
      );

      const matchesHints = (skill.routingHints || []).some(hint => 
        msgLower.includes(hint.toLowerCase())
      );

      return matchesTrigger || matchesTags || matchesHints;
    });

    if (candidates.length === 0) {
      // Fallback: If no candidate matched but we have enabled skills, return default general or high priority skills (up to 2)
      return enabledSkills
        .slice()
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
        .slice(0, 2);
    }

    // STAGE 2: SCORING
    const scoredCandidates = candidates.map(skill => {
      let score = skill.priority || 1;

      // Add score for matches
      (skill.triggerConditions || []).forEach(trig => {
        if (msgLower.includes(trig.toLowerCase())) score += 3;
      });

      (skill.tags || []).forEach(tag => {
        if (msgLower.includes(tag.toLowerCase())) score += 1;
      });

      return { skill, score };
    });

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    // STAGE 3: CONFLICT RESOLUTION
    const selected: Skill[] = [];
    const blockedIds = new Set<string>();

    for (const item of scoredCandidates) {
      const currentSkill = item.skill;

      if (blockedIds.has(currentSkill.skillId)) {
        continue;
      }

      // Check if current conflicts with already selected skills
      const hasConflict = selected.some(sel => 
        (sel.conflictsWith || []).includes(currentSkill.skillId) ||
        (currentSkill.conflictsWith || []).includes(sel.skillId)
      );

      if (hasConflict) {
        // Keep the one with higher priority/score (which is already selected since we sorted)
        continue;
      }

      selected.push(currentSkill);
      
      // Add conflicts to blocked list
      (currentSkill.conflictsWith || []).forEach(id => blockedIds.add(id));
    }

    // Cap selected skills to normally 1-5 to save prompt tokens
    return selected.slice(0, 5);
  }

  /**
   * Determine permitted tools by intersecting selected skills and workspace connected integrations.
   */
  static getPermittedTools(selectedSkills: Skill[], connectedIntegrations: string[]): string[] {
    const isGoogleConnected = connectedIntegrations.includes('google');
    
    // Available system tools
    const availableTools = new Set<string>();
    if (isGoogleConnected) {
      availableTools.add('google-calendar');
      availableTools.add('gmail');
      availableTools.add('google-sheets');
      availableTools.add('google-docs');
    }

    // If no active skills are selected, default tools are allowed based on workspace integrations
    if (selectedSkills.length === 0) {
      return Array.from(availableTools);
    }

    // Compute union of toolsAllowed by the selected skills, filtered by availability
    const permitted = new Set<string>();
    for (const skill of selectedSkills) {
      (skill.toolsAllowed || []).forEach(tool => {
        if (availableTools.has(tool)) {
          permitted.add(tool);
        }
      });
    }

    return Array.from(permitted);
  }

  /**
   * Compose selected skills into a single coherent runtime instructions prompt.
   */
  static composeInstructions(selectedSkills: Skill[]): string {
    if (selectedSkills.length === 0) return '';

    const sections: string[] = [
      '=== ACTIVE SYSTEM SKILLS & CAPABILITIES ===',
      'You have the following skills currently active. Respond and behave strictly according to these active capabilities:'
    ];

    selectedSkills.forEach((skill, index) => {
      const bullet = `${index + 1}. [Skill: ${skill.name}]`;
      const desc = `   - Description: ${skill.description}`;
      const inst = `   - Instructions: ${skill.systemInstructions}`;
      
      const constraints = (skill.constraints || []).length > 0 
        ? `   - Constraints:\n${(skill.constraints || []).map(c => `     * ${c}`).join('\n')}` 
        : '';
        
      const safety = (skill.safetyRules || []).length > 0 
        ? `   - Safety Rules:\n${(skill.safetyRules || []).map(s => `     * ${s}`).join('\n')}` 
        : '';

      const skillBlock = [bullet, desc, inst, constraints, safety]
        .filter(Boolean)
        .join('\n');

      sections.push(skillBlock);
    });

    return sections.join('\n\n');
  }
}

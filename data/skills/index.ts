import { Skill, SkillMetadata } from '@/types/skill';

// Statically import the client-safe metadata list
import metadataListRaw from './metadata.json';
const metadataList = metadataListRaw as SkillMetadata[];

export const CATEGORIES_LIST = [
  'Customer Support',
  'Sales & Marketing',
  'Scheduling',
  'Communication',
  'Analytics & Insights',
  'Industry Specific',
  'Browser & Automation',
  'Writing & Content',
  'Development & Coding',
  'Education & Learning',
  'Health & Wellness',
  'General'
] as const;

export const CATEGORY_DISTRIBUTION: Record<string, number> = {
  'Customer Support': 125,
  'Sales & Marketing': 125,
  'Scheduling': 125,
  'Communication': 125,
  'Analytics & Insights': 125,
  'Industry Specific': 125,
  'Browser & Automation': 125,
  'Writing & Content': 125,
  'Development & Coding': 125,
  'Education & Learning': 125,
  'Health & Wellness': 125,
  'General': 125
};

export async function loadCategorySkills(category: string): Promise<Skill[]> {
  try {
    switch (category) {
      case 'Customer Support':
        return (await import('./compiled/customer-support.json')).default as Skill[];
      case 'Sales & Marketing':
        return (await import('./compiled/sales-marketing.json')).default as Skill[];
      case 'Scheduling':
        return (await import('./compiled/scheduling.json')).default as Skill[];
      case 'Communication':
        return (await import('./compiled/communication.json')).default as Skill[];
      case 'Analytics & Insights':
        return (await import('./compiled/analytics-insights.json')).default as Skill[];
      case 'Industry Specific':
        return (await import('./compiled/industry-specific.json')).default as Skill[];
      case 'Browser & Automation':
        return (await import('./compiled/browser-automation.json')).default as Skill[];
      case 'Writing & Content':
        return (await import('./compiled/writing-content.json')).default as Skill[];
      case 'Development & Coding':
        return (await import('./compiled/development-coding.json')).default as Skill[];
      case 'Education & Learning':
        return (await import('./compiled/education-learning.json')).default as Skill[];
      case 'Health & Wellness':
        return (await import('./compiled/health-wellness.json')).default as Skill[];
      case 'General':
        return (await import('./compiled/general.json')).default as Skill[];
      default:
        return [];
    }
  } catch (err) {
    console.error(`Failed to dynamically load skills for category: ${category}`, err);
    return [];
  }
}

export function getSkillCount(): number {
  return metadataList.length;
}

export function getCategoryCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const cat of CATEGORIES_LIST) {
    counts[cat] = 0;
  }
  for (const m of metadataList) {
    if (counts[m.category] !== undefined) {
      counts[m.category]++;
    }
  }
  return counts;
}

export function getSkillMetadataById(id: string): SkillMetadata | null {
  return metadataList.find(s => s.id === id) || null;
}

export function getSkillsMetadataByIds(ids: string[]): SkillMetadata[] {
  return metadataList.filter(s => ids.includes(s.id));
}

export function getSkillsMetadataByCategory(category: string): SkillMetadata[] {
  if (category === 'All') return metadataList;
  return metadataList.filter(s => s.category === category);
}

// Weighted deterministic search matching name, aliases, tags, keywords, audiences, and description
export function searchSkillsMetadata(query: string, category: string = 'All'): SkillMetadata[] {
  const normalizedQuery = query.trim().toLowerCase();
  const baseList = category === 'All' ? metadataList : metadataList.filter(s => s.category === category);
  
  if (!normalizedQuery) return baseList;
  
  // Score mapping
  const scored = baseList.map(s => {
    let score = 0;
    
    // 1. Exact ID match: +100
    if (s.id.toLowerCase() === normalizedQuery) {
      score += 100;
    }
    
    // 2. Exact/contains name match: +50
    if (s.name.toLowerCase() === normalizedQuery) {
      score += 50;
    } else if (s.name.toLowerCase().includes(normalizedQuery)) {
      score += 25;
    }
    
    // 3. Aliases match: +30
    if (s.aliases && s.aliases.some(a => a.toLowerCase() === normalizedQuery)) {
      score += 30;
    } else if (s.aliases && s.aliases.some(a => a.toLowerCase().includes(normalizedQuery))) {
      score += 15;
    }
    
    // 4. Tags & Search Keywords match: +15
    if (s.tags && s.tags.some(t => t.toLowerCase() === normalizedQuery)) {
      score += 15;
    }
    if (s.searchKeywords && s.searchKeywords.some(k => k.toLowerCase().includes(normalizedQuery))) {
      score += 15;
    }
    
    // 5. Target Audiences & Description match: +5
    if (s.targetAudiences && s.targetAudiences.some(a => a.toLowerCase().includes(normalizedQuery))) {
      score += 5;
    }
    if (s.description && s.description.toLowerCase().includes(normalizedQuery)) {
      score += 5;
    }
    
    return { item: s, score };
  });
  
  return scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.item);
}

export async function getSkillById(id: string): Promise<Skill | null> {
  const meta = getSkillMetadataById(id);
  if (!meta) return null;
  const skills = await loadCategorySkills(meta.category);
  return skills.find(s => s.skillId === id) || null;
}

export async function getSkillsByIds(ids: string[]): Promise<Skill[]> {
  const result: Skill[] = [];
  const metaItems = getSkillsMetadataByIds(ids);
  
  const byCategory: Record<string, string[]> = {};
  for (const m of metaItems) {
    if (!byCategory[m.category]) byCategory[m.category] = [];
    byCategory[m.category].push(m.id);
  }
  
  for (const [category, categoryIds] of Object.entries(byCategory)) {
    const skills = await loadCategorySkills(category);
    for (const s of skills) {
      if (categoryIds.includes(s.skillId)) {
        result.push(s);
      }
    }
  }
  return result;
}

function calculateJaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 1;
  let intersectionSize = 0;
  for (const x of set1) {
    if (set2.has(x)) intersectionSize++;
  }
  const unionSize = set1.size + set2.size - intersectionSize;
  return intersectionSize / unionSize;
}

export interface DuplicateReport {
  duplicateIds: string[];
  duplicateNames: string[];
  duplicateFingerprints: string[];
  suspiciousNearDuplicates: {
    skillId1: string;
    skillId2: string;
    similarity: number;
    reason: string;
  }[];
}

export async function detectDuplicateSkills(): Promise<DuplicateReport> {
  const report: DuplicateReport = {
    duplicateIds: [],
    duplicateNames: [],
    duplicateFingerprints: [],
    suspiciousNearDuplicates: []
  };

  const allSkills: Skill[] = [];
  for (const cat of CATEGORIES_LIST) {
    const list = await loadCategorySkills(cat);
    allSkills.push(...list);
  }

  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const seenFingerprints = new Set<string>();

  for (const s of allSkills) {
    if (seenIds.has(s.skillId)) report.duplicateIds.push(s.skillId);
    seenIds.add(s.skillId);

    const normName = s.name.toLowerCase().trim();
    if (seenNames.has(normName)) report.duplicateNames.push(s.name);
    seenNames.add(normName);

    // Fingerprint by instruction + constraints
    const fingerprint = [
      s.systemInstructions.trim(),
      (s.constraints || []).join(','),
      (s.safetyRules || []).join(',')
    ].join('|').toLowerCase();

    if (seenFingerprints.has(fingerprint)) report.duplicateFingerprints.push(s.skillId);
    seenFingerprints.add(fingerprint);
  }

  // Pre-tokenise for Jaccard checks
  const tokenised = allSkills.map(s => ({
    skillId: s.skillId,
    descSet: new Set(s.description.toLowerCase().split(/\s+/).filter(w => w.length > 2)),
    instSet: new Set(s.systemInstructions.toLowerCase().split(/\s+/).filter(w => w.length > 2))
  }));

  for (let i = 0; i < tokenised.length; i++) {
    for (let j = i + 1; j < tokenised.length; j++) {
      const t1 = tokenised[i];
      const t2 = tokenised[j];
      
      const descSim = calculateJaccardSimilarity(t1.descSet, t2.descSet);
      const instSim = calculateJaccardSimilarity(t1.instSet, t2.instSet);
      
      if (descSim > 0.85 || instSim > 0.85) {
        report.suspiciousNearDuplicates.push({
          skillId1: t1.skillId,
          skillId2: t2.skillId,
          similarity: Math.max(descSim, instSim),
          reason: descSim > 0.85 ? 'Highly similar descriptions' : 'Highly similar system instructions'
        });
      }
    }
  }

  return report;
}

export async function validateSkillRegistry(): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // 1. Total count check
  if (metadataList.length < 1500) {
    errors.push(`Registry has fewer than 1500 skills: ${metadataList.length}`);
  }

  // 2. Category counts check
  const categoryCounts = getCategoryCounts();
  for (const [cat, expected] of Object.entries(CATEGORY_DISTRIBUTION)) {
    if (categoryCounts[cat] !== expected) {
      errors.push(`Category '${cat}' has ${categoryCounts[cat]} skills, expected ${expected}`);
    }
  }

  // Load all compiled skills
  const allSkills: Skill[] = [];
  for (const cat of CATEGORIES_LIST) {
    const list = await loadCategorySkills(cat);
    allSkills.push(...list);
    
    const catMetaCount = metadataList.filter(m => m.category === cat).length;
    if (list.length !== catMetaCount) {
      errors.push(`Compiled file for category '${cat}' contains ${list.length} skills, but metadata has ${catMetaCount}`);
    }
  }

  if (allSkills.length !== metadataList.length) {
    errors.push(`Total compiled skills (${allSkills.length}) does not match metadata list (${metadataList.length})`);
  }

  // 3. Duplicate checks
  const dupReport = await detectDuplicateSkills();
  if (dupReport.duplicateIds.length > 0) {
    errors.push(`Duplicate skill IDs found: ${dupReport.duplicateIds.join(', ')}`);
  }
  if (dupReport.duplicateNames.length > 0) {
    errors.push(`Duplicate names found: ${dupReport.duplicateNames.join(', ')}`);
  }
  if (dupReport.duplicateFingerprints.length > 0) {
    errors.push(`Duplicate behavior fingerprints (exact prompt duplication) found: ${dupReport.duplicateFingerprints.join(', ')}`);
  }
  if (dupReport.suspiciousNearDuplicates.length > 0) {
    errors.push(`Near-duplicate Jaccard similarity (>85%) found between: ${dupReport.suspiciousNearDuplicates.map(d => `${d.skillId1}<->${d.skillId2}`).join(', ')}`);
  }

  // 4. Suffix audits & structure
  const invalidSuffixes = [
    "Intake & Sorting", "Diagnostics & Troubleshooting", "Information Updates",
    "Policy Walkthrough", "Status Verification", "Conflict Resolution",
    "Action Execution", "Quality Feedback Loop", "Quick FAQ Reference", "Handoff Coordinator",
    "Intake", "Diagnostics", "Troubleshooting", "Updates", "Verification", "Dispute",
    "Escalator", "Coordinator", "FAQ"
  ];

  const allIds = new Set(allSkills.map(s => s.skillId));

  for (const s of allSkills) {
    // Basic elements
    if (!s.skillId || !s.name || !s.description || !s.category || !s.systemInstructions) {
      errors.push(`Skill '${s.skillId || 'unknown'}' is missing required fields`);
      continue;
    }

    // Name suffixes check
    for (const suf of invalidSuffixes) {
      if (s.name.endsWith(` - ${suf}`) || s.name.endsWith(`: ${suf}`)) {
        errors.push(`Skill '${s.skillId}' uses artificial suffix family name structure: "${s.name}"`);
      }
    }

    // Missing search metadata
    const meta = getSkillMetadataById(s.skillId);
    if (!meta || !meta.aliases || meta.aliases.length === 0 || !meta.searchKeywords || meta.searchKeywords.length === 0 || !meta.targetAudiences || meta.targetAudiences.length === 0) {
      errors.push(`Skill '${s.skillId}' is missing search metadata in index (aliases, keywords, targetAudiences)`);
    }

    // Overlapping capabilities / Missing domains
    if (!s.capabilities || s.capabilities.length === 0) {
      errors.push(`Skill '${s.skillId}' is missing capabilities`);
    }
    if (!s.knowledgeDomains || s.knowledgeDomains.length === 0) {
      errors.push(`Skill '${s.skillId}' is missing knowledge domains`);
    }
    if (!s.routingHints || s.routingHints.length === 0) {
      errors.push(`Skill '${s.skillId}' is missing routing hints`);
    }

    // Hardcoded tenant-specific data
    const tenantKeywords = [
      "11:00 AM", "10:00 PM", "9:00 AM", "5:00 PM", "8 PM", "12 PM",
      "$15", "$20", "20 seats", "50 seats", "banquet menu", "garlic bread", "pepperoni pizza"
    ];
    for (const tk of tenantKeywords) {
      if (s.systemInstructions.includes(tk) || s.description.includes(tk)) {
        errors.push(`Skill '${s.skillId}' has hardcoded tenant-specific data: "${tk}"`);
      }
    }

    // Parent/related references checks
    if (s.parentSkillId) {
      if (s.parentSkillId === s.skillId) {
        errors.push(`Skill '${s.skillId}' references itself as parent`);
      }
      if (!allIds.has(s.parentSkillId)) {
        errors.push(`Skill '${s.skillId}' references non-existent parent: '${s.parentSkillId}'`);
      }
    }

    if (s.relatedSkillIds) {
      for (const relId of s.relatedSkillIds) {
        if (relId === s.skillId) {
          errors.push(`Skill '${s.skillId}' references itself in related skills`);
        }
        if (!allIds.has(relId)) {
          errors.push(`Skill '${s.skillId}' references non-existent related skill: '${relId}'`);
        }
      }
    }
  }

  // Circular parent checking
  for (const s of allSkills) {
    if (s.parentSkillId) {
      let currentParent = s.parentSkillId;
      const path = [s.skillId];
      while (currentParent) {
        if (path.includes(currentParent)) {
          errors.push(`Circular parent relationship detected: ${path.join(' -> ')} -> ${currentParent}`);
          break;
        }
        path.push(currentParent);
        const parentSkill = allSkills.find(x => x.skillId === currentParent);
        currentParent = parentSkill?.parentSkillId || '';
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

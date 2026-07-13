import metadataListRaw from '@/data/skills/metadata.json';

export interface Skill {
  id: string;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
}

export const INITIAL_HANDCRAFTED_SKILLS: Skill[] = [];

export function generate2000Skills(): Skill[] {
  return (metadataListRaw as any[]).map(s => ({
    id: s.id,
    name: s.name,
    category: s.category,
    description: s.description,
    enabled: false
  }));
}

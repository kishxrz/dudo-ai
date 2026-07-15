import { NextRequest, NextResponse } from 'next/server';
import { SkillService, SkillDefinition } from '@/lib/ai/SkillService';
import { ToolRegistry } from '@/lib/ai/ToolRegistry';
import { requireSubscription, getPlanLimits } from '@/lib/subscription/SubscriptionService';
import { PLAN_LIMITS } from '@/lib/subscription/config';

/**
 * GET /api/agent/skills?workspaceId=...
 * Lists all catalog + custom skills with install/enabled states.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required.' }, { status: 400 });
    }

    // Subscription check — trial users can list skills (read-only)
    const denied = await requireSubscription(req, workspaceId);
    if (denied) return denied;

    const skills = await SkillService.listAllSkills(workspaceId);
    
    // Calculate diagnostics
    const installed = skills.filter(s => s.source === 'built-in' || s.enabled || s.source === 'custom');
    const enabled = skills.filter(s => s.enabled);

    return NextResponse.json({
      skills,
      diagnostics: {
        installedCount: installed.length,
        enabledCount: enabled.length
      }
    });
  } catch (err: any) {
    console.error('[Skills API] GET error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/agent/skills
 * Body: { action, workspaceId, skillId, prompt, skill, toolName, args }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, workspaceId, skillId, prompt, skill, toolName, args } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required.' }, { status: 400 });
    }

    // Enforce active subscription before any skill mutation
    const denied = await requireSubscription(req, workspaceId);
    if (denied) return denied;

    switch (action) {
      case 'install': {
        if (!skillId) return NextResponse.json({ error: 'Skill ID is required.' }, { status: 400 });
        await SkillService.installSkill(workspaceId, skillId);
        return NextResponse.json({ success: true, message: 'Skill installed.' });
      }

      case 'uninstall': {
        if (!skillId) return NextResponse.json({ error: 'Skill ID is required.' }, { status: 400 });
        await SkillService.uninstallSkill(workspaceId, skillId);
        return NextResponse.json({ success: true, message: 'Skill uninstalled.' });
      }

      case 'enable': {
        if (!skillId) return NextResponse.json({ error: 'Skill ID is required.' }, { status: 400 });
        
        const limits = PLAN_LIMITS;
        const planLimits = await getPlanLimits(workspaceId);
        const skills = await SkillService.listAllSkills(workspaceId);
        const enabledSkills = skills.filter(s => s.enabled);
        const alreadyEnabled = enabledSkills.some(s => s.id === skillId);
        
        if (!alreadyEnabled && enabledSkills.length >= planLimits.maxEnabledSkills) {
          return NextResponse.json({ error: 'Upgrade required: Exceeded maximum enabled skills limit for your plan.', code: 'USAGE_LIMIT_REACHED' }, { status: 403 });
        }
        
        await SkillService.enableSkill(workspaceId, skillId);
        return NextResponse.json({ success: true, message: 'Skill enabled.' });
      }

      case 'disable': {
        if (!skillId) return NextResponse.json({ error: 'Skill ID is required.' }, { status: 400 });
        await SkillService.disableSkill(workspaceId, skillId);
        return NextResponse.json({ success: true, message: 'Skill disabled.' });
      }

      case 'createCustom': {
        if (!prompt) return NextResponse.json({ error: 'Prompt description is required.' }, { status: 400 });
        const generatedSkill = await SkillService.createCustomSkill(workspaceId, prompt);
        return NextResponse.json({ success: true, skill: generatedSkill });
      }

      case 'saveCustom':
      case 'updateCustom': {
        if (!skill) return NextResponse.json({ error: 'Skill definition is required.' }, { status: 400 });
        await SkillService.saveCustomSkill(workspaceId, skill as SkillDefinition);
        return NextResponse.json({ success: true, message: 'Custom skill saved.' });
      }

      case 'deleteCustom': {
        if (!skillId) return NextResponse.json({ error: 'Skill ID is required.' }, { status: 400 });
        await SkillService.deleteCustomSkill(workspaceId, skillId);
        return NextResponse.json({ success: true, message: 'Custom skill deleted.' });
      }

      case 'executeTool': {
        if (!toolName) return NextResponse.json({ error: 'Tool name is required.' }, { status: 400 });
        const result = await ToolRegistry.executeTool(workspaceId, toolName, args || {});
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[Skills API] POST error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

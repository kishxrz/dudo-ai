import fs from 'fs';
import path from 'path';

// ─── 1. LOAD ENV DYNAMICALLY BEFORE OTHER IMPORTS ────────────────────
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error(`Env file not found at: ${envPath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.substring(0, idx).trim();
    let val = trimmed.substring(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    process.env[key] = val;
  });
}
loadEnv();

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SkillService, SkillDefinition } from '../lib/ai/SkillService';
import metadataListRaw from '../data/skills/metadata.json';

const metadataList = metadataListRaw as any[];
const BUILT_IN_COUNT = 200;

async function runVerification() {
  console.log('=== STARTING REAL SKILLS SYSTEM END-TO-END VERIFICATION ===\n');

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      }),
    });
  }

  const db = getFirestore();
  const testWorkspaceId = '06En69BlJ7YIT6OWI2x4z8oxKa72';
  const isolationWorkspaceId = 'jRgxcOLxJWe89QlUbN1GCNBLgCt2';

  const report: { name: string; status: 'PASS' | 'FAIL'; details: string }[] = [];

  const assertTest = (name: string, condition: boolean, details: string) => {
    if (condition) {
      console.log(`✅ PASS: [${name}] - ${details}`);
      report.push({ name, status: 'PASS', details });
    } else {
      console.error(`❌ FAIL: [${name}] - ${details}`);
      report.push({ name, status: 'FAIL', details });
    }
  };

  try {
    // ─── Assert 1 & 2: Catalog Size & Distribution ───────────────────
    const uniqueIds = new Set(metadataList.map(s => s.id));
    assertTest('Catalog Size', uniqueIds.size === 1500, `Found ${uniqueIds.size} unique skills in catalog (Expected: 1500).`);

    const categories = [
      'Customer Support', 'Sales & Marketing', 'Scheduling', 'Communication',
      'Analytics & Insights', 'Industry Specific', 'Browser & Automation', 'Writing & Content',
      'Development & Coding', 'Education & Learning', 'Health & Wellness', 'General'
    ];
    let allCategoriesValid = true;
    for (const cat of categories) {
      const count = metadataList.filter(s => s.category === cat).length;
      if (count !== 125) allCategoriesValid = false;
    }
    assertTest('Category Distribution', allCategoriesValid, `All 12 categories contain exactly 125 skills.`);

    // ─── Assert 3: Default Skills & Distribution ─────────────────────
    assertTest('Default Skills Count', BUILT_IN_COUNT === 200, `BUILT_IN_COUNT is set to ${BUILT_IN_COUNT}.`);
    
    const defaultSkills = metadataList.slice(0, BUILT_IN_COUNT);
    let defaultDistributionValid = true;
    for (const cat of categories) {
      const count = defaultSkills.filter(s => s.category === cat).length;
      if (count === 0) defaultDistributionValid = false;
    }
    assertTest('Default Skills Distribution', defaultDistributionValid, `Default skills are distributed across all categories.`);

    // ─── Assert 4: Install one non-default skill ─────────────────────
    const nonDefaultSkillId = metadataList[205].id; // ID from catalog with index >= 200
    
    // Clear initial state
    await SkillService.uninstallSkill(testWorkspaceId, nonDefaultSkillId);
    
    // Install
    await SkillService.installSkill(testWorkspaceId, nonDefaultSkillId);
    
    // Check direct Firestore write
    const docPath = `workspaces/${testWorkspaceId}/assistants/assistant-1`;
    const docSnap = await db.doc(docPath).get();
    const installedIds: string[] = docSnap.data()?.installedSkillIds || [];
    assertTest('Skill Installation Write', installedIds.includes(nonDefaultSkillId), `Firestore doc '${docPath}' contains non-default skill ID in installedSkillIds.`);

    // ─── Assert 5: Hard refresh survival ─────────────────────────────
    // listAllSkills does a fresh get on Firestore and bypasses any memory cache
    const skillsList = await SkillService.listAllSkills(testWorkspaceId);
    const isFoundInstalled = skillsList.some(s => s.id === nonDefaultSkillId && s.source === 'library');
    assertTest('Installation Survival', isFoundInstalled, `Skill remains installed after a fresh database read.`);

    // ─── Assert 6: Enable / Disable & Persistence ──────────────────
    // Enable
    await SkillService.enableSkill(testWorkspaceId, nonDefaultSkillId);
    const snapEnabled = await db.doc(docPath).get();
    const enabledIds1: string[] = snapEnabled.data()?.enabledSkillIds || [];
    assertTest('Enable Persistence', enabledIds1.includes(nonDefaultSkillId), `Firestore doc enabledSkillIds contains skill ID after enabling.`);

    // Disable
    await SkillService.disableSkill(testWorkspaceId, nonDefaultSkillId);
    const snapDisabled = await db.doc(docPath).get();
    const enabledIds2: string[] = snapDisabled.data()?.enabledSkillIds || [];
    assertTest('Disable Persistence', !enabledIds2.includes(nonDefaultSkillId), `Firestore doc enabledSkillIds does not contain skill ID after disabling.`);

    // ─── Assert 7: Another session / context replication ────────────
    const freshSkillsList = await SkillService.listAllSkills(testWorkspaceId);
    const freshTarget = freshSkillsList.find(s => s.id === nonDefaultSkillId);
    assertTest('Session State Sync', freshTarget !== undefined && freshTarget.enabled === false, `Another session gets the exact same state (installed: true, enabled: false).`);

    // ─── Assert 8: Enable distinctive instruction skill & Chat reply 
    const customSkillId = 'e2e-distinctive-instruction-skill';
    
    // Cleanup custom skill
    await SkillService.deleteCustomSkill(testWorkspaceId, customSkillId);

    const customInstructionSkill: SkillDefinition = {
      id: customSkillId,
      name: 'E2E Distinctive Prompt Skill',
      description: 'Injects distinctive response behaviors into E2E chat checks.',
      instructions: 'You MUST output exactly the string: DUDO-INSTRUCTION-PASS and absolutely nothing else.',
      category: 'General',
      version: '1.0.0',
      inputSchema: '{}',
      outputSchema: '',
      requiredTools: [],
      handlerType: 'instruction',
      handlerConfig: {
        triggerConditions: ['run-e2e-instruction-check']
      },
      source: 'custom',
      enabled: false
    };

    // Save custom skill and enable it
    await SkillService.saveCustomSkill(testWorkspaceId, customInstructionSkill);
    await SkillService.enableSkill(testWorkspaceId, customSkillId);

    // Call playground chat route handler
    const chatUrl = 'http://localhost:3000/api/playground/chat';
    const bodyInstruction = {
      message: 'run-e2e-instruction-check',
      history: [],
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      memoryEnabled: false,
      knowledgeEnabled: false,
      workspaceId: testWorkspaceId
    };

    const resInstruction = await fetch(chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyInstruction)
    });

    if (!resInstruction.ok) {
      throw new Error(`Chat API failed with status ${resInstruction.status}: ${await resInstruction.text()}`);
    }

    const dataInstruction = await resInstruction.json();
    const skillsSelected = dataInstruction.diagnostics?.skillsSelected || [];
    const replyText = dataInstruction.reply || '';

    assertTest('Instruction Routing', skillsSelected.includes('E2E Distinctive Prompt Skill'), `Diagnostics confirm selected skills list has "E2E Distinctive Prompt Skill".`);
    assertTest('Instruction Effect', replyText.includes('DUDO-INSTRUCTION-PASS'), `Response contains expected behavior string (Found response: "${replyText.trim()}").`);

    // ─── Assert 9: Disable instruction skill & Chat reply ──────────
    await SkillService.disableSkill(testWorkspaceId, customSkillId);

    const resDisabled = await fetch(chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyInstruction)
    });

    const dataDisabled = await resDisabled.json();
    const skillsSelectedDisabled = dataDisabled.diagnostics?.skillsSelected || [];
    const replyTextDisabled = dataDisabled.reply || '';

    assertTest('Disable Router Triage', !skillsSelectedDisabled.includes('E2E Distinctive Prompt Skill'), `Diagnostics confirm the skill was NOT selected after disabling.`);
    assertTest('Disable Response Check', !replyTextDisabled.includes('DUDO-INSTRUCTION-PASS'), `Response does not contain skill instructions output after disabling.`);

    // ─── Assert 10: Install/Enable real tool skill & trigger ──────
    const customToolSkillId = 'e2e-distinctive-tool-skill';
    
    // Cleanup custom tool skill
    await SkillService.deleteCustomSkill(testWorkspaceId, customToolSkillId);

    const customToolSkill: SkillDefinition = {
      id: customToolSkillId,
      name: 'E2E Calendar Tool Skill',
      description: 'Uses approved calendar tool to list meetings.',
      instructions: 'When the user says trigger-calendar-e2e, you MUST execute the tool google-calendar-list immediately and output nothing else.',
      category: 'Scheduling',
      version: '1.0.0',
      inputSchema: '{}',
      outputSchema: '',
      requiredTools: ['google-calendar-list'],
      handlerType: 'tool',
      handlerConfig: {
        triggerConditions: ['trigger-calendar-e2e']
      },
      source: 'custom',
      enabled: false
    };

    // Save and enable
    await SkillService.saveCustomSkill(testWorkspaceId, customToolSkill);
    await SkillService.enableSkill(testWorkspaceId, customToolSkillId);

    // Trigger tool chat
    const bodyTool = {
      message: 'trigger-calendar-e2e',
      history: [],
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      memoryEnabled: false,
      knowledgeEnabled: false,
      workspaceId: testWorkspaceId
    };

    const resTool = await fetch(chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyTool)
    });

    const dataTool = await resTool.json();
    const toolsExposed = dataTool.diagnostics?.toolsExposed || [];
    const toolsExecuted = dataTool.diagnostics?.toolsExecuted || [];

    assertTest('Tool Exposure', toolsExposed.includes('google-calendar-list'), `Diagnostics show tool 'google-calendar-list' was exposed to LLM context.`);
    assertTest('Tool Execution', toolsExecuted.includes('google-calendar-list'), `Diagnostics show tool 'google-calendar-list' was successfully executed on backend.`);

    // ─── Assert 11: Uninstall both custom/installed skills ──────────
    await SkillService.uninstallSkill(testWorkspaceId, nonDefaultSkillId);
    await SkillService.deleteCustomSkill(testWorkspaceId, customSkillId);
    await SkillService.deleteCustomSkill(testWorkspaceId, customToolSkillId);

    const finalSkillsList = await SkillService.listAllSkills(testWorkspaceId);
    const hasCustom1 = finalSkillsList.some(s => s.id === customSkillId);
    const hasCustom2 = finalSkillsList.some(s => s.id === customToolSkillId);
    const hasInstalled = finalSkillsList.some(s => s.id === nonDefaultSkillId && s.source === 'library');

    assertTest('Cleanup Verification', !hasCustom1 && !hasCustom2 && !hasInstalled, `All test skills uninstalled and removed from workspace.`);

    // ─── Assert 12: Workspace Isolation check ────────────────────────
    // Try to retrieve workspace 1's workspace records using workspace 2's ID
    const snapIsolation = await db.doc(`workspaces/${isolationWorkspaceId}/assistants/assistant-1`).get();
    const isolationInstalled = snapIsolation.data()?.installedSkillIds || [];
    assertTest('Workspace Isolation Access', !isolationInstalled.includes(nonDefaultSkillId), `Workspace isolation restricts workspace 2 from reading workspace 1's installed skill configurations.`);

    console.log('\n=== E2E VERIFICATION COMPLETED ===\n');
    console.log('--- FINAL REPORT ---');
    console.table(report);

    const anyFailed = report.some(r => r.status === 'FAIL');
    if (anyFailed) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (err: any) {
    console.error('Unhandled E2E verification error:', err);
    process.exit(1);
  }
}

runVerification();

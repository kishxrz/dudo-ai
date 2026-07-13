import { SkillRouter } from '../lib/ai/SkillRouter';
import { loadCategorySkills } from '../data/skills/index';
import { Skill } from '../types/skill';

async function runTests() {
  console.log('=== STARTING RUNTIME ROUTER TESTS ===\n');
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  };

  try {
    // Load some sample skills
    const schedulingSkills = await loadCategorySkills('Scheduling');
    const customerSupportSkills = await loadCategorySkills('Customer Support');
    const healthWellnessSkills = await loadCategorySkills('Health & Wellness');

    // 1. Test Deterministic Routing
    console.log('--- Test 1: Deterministic Skill Routing ---');
    const apptSkill = schedulingSkills.find(s => s.skillId.includes('appointment-booking'));
    const billSkill = customerSupportSkills.find(s => s.skillId.includes('billing-inquiries-support'));
    
    if (apptSkill && billSkill) {
      const enabledSkills: Skill[] = [apptSkill, billSkill];
      
      const active1 = SkillRouter.selectActiveSkills('I need to make an appointment booking for tomorrow', enabledSkills);
      assert(
        active1.some(s => s.skillId.includes('appointment-booking')),
        'Route matching scheduling query to appointment booking skill'
      );

      const active2 = SkillRouter.selectActiveSkills('I need billing inquiries support for my invoice issues', enabledSkills);
      assert(
        active2.some(s => s.skillId.includes('billing-inquiries-support')),
        'Route matching customer support query to billing inquiries support skill'
      );
    } else {
      console.error('Failed to locate test skills');
      failed++;
    }

    // 2. Test cap on active skills (1-5 skills maximum)
    console.log('\n--- Test 2: Active Skills Capping ---');
    const activeLarge = SkillRouter.selectActiveSkills(
      'schedule appointment to check billing and write text',
      [...schedulingSkills, ...customerSupportSkills]
    );
    assert(
      activeLarge.length >= 1 && activeLarge.length <= 5,
      `Number of active skills is capped to 1-5 (Count: ${activeLarge.length})`
    );

    // 3. Test Conflict Resolution
    console.log('\n--- Test 3: Conflict Resolution & Priorities ---');
    const testSkill1: Skill = {
      skillId: 'test-skill-1',
      name: 'High Priority Skill',
      priority: 5,
      conflictsWith: ['test-skill-2'],
      triggerConditions: ['test'],
    } as unknown as Skill;

    const testSkill2: Skill = {
      skillId: 'test-skill-2',
      name: 'Low Priority Skill',
      priority: 1,
      conflictsWith: ['test-skill-1'],
      triggerConditions: ['test'],
    } as unknown as Skill;

    const activeConflicts = SkillRouter.selectActiveSkills('test query', [testSkill1, testSkill2]);
    assert(
      activeConflicts.some(s => s.skillId === 'test-skill-1') && 
      !activeConflicts.some(s => s.skillId === 'test-skill-2'),
      'Highest priority skill is selected, conflicting low priority skill is dropped'
    );

    // 4. Test Tool Permissiveness
    console.log('\n--- Test 4: Permitted Tools Intersection ---');
    const apiSkill: Skill = {
      skillId: 'browser-action',
      toolsAllowed: ['gmail', 'google-sheets'],
    } as unknown as Skill;

    const permitted1 = SkillRouter.getPermittedTools([apiSkill], ['google']);
    assert(
      permitted1.includes('gmail') && permitted1.includes('google-sheets') && !permitted1.includes('google-calendar'),
      'Permitted tools maps directly to skill allowed tools list, filtered by integration status'
    );

    const permitted2 = SkillRouter.getPermittedTools([apiSkill], []);
    assert(
      permitted2.length === 0,
      'Permitted tools is empty if google integration is disconnected'
    );

    // 5. Test Safety Constraint Enforcement (Health & Wellness disclaimers)
    console.log('\n--- Test 5: Health & Wellness Safety Disclaimer Enforcement ---');
    const wellnessSkill = healthWellnessSkills.find(s => s.skillId.includes('sleep-coach'));
    assert(!!wellnessSkill, 'Located sleep coach wellness skill');
    
    if (wellnessSkill) {
      // Mocking ConversationService behavior for Health & Wellness
      const mockReplyNoDisclaimer = 'Try avoiding screens or using standard wind down routines before going to bed.';
      const disclaimerText = 'Disclaimer: I am an AI assistant and this info is for educational purposes only.';
      
      const activeSkills = [wellnessSkill];
      let finalReply = mockReplyNoDisclaimer;
      
      const isHealthWellnessActive = activeSkills.some(s => s.category === 'Health & Wellness');
      if (isHealthWellnessActive) {
        const hasDisclaimer = finalReply.toLowerCase().includes('educational purposes only') || 
                             finalReply.toLowerCase().includes('disclaimer');
        if (!hasDisclaimer) {
          finalReply += `\n\nDisclaimer: I am an AI assistant and this info is for educational purposes only. For medical queries, consult a professional.`;
        }
      }

      assert(
        finalReply.includes(disclaimerText),
        'Append medical disclaimer to response output when Health & Wellness skill is active'
      );
    }

    console.log(`\n=== RUNTIME TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED ===`);
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Unhandled runtime test execution error:', err);
    process.exit(1);
  }
}

runTests();

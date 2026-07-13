import { validateSkillRegistry, detectDuplicateSkills, getCategoryCounts, getSkillCount } from '../data/skills/index';

async function runValidation() {
  console.log('=== STARTING SKILL REGISTRY VALIDATION ===\n');

  const startTime = Date.now();
  const totalCount = getSkillCount();
  const catCounts = getCategoryCounts();

  console.log(`Total skills in metadata: ${totalCount}`);
  console.log('Category Counts:');
  for (const [cat, count] of Object.entries(catCounts)) {
    console.log(`  - ${cat}: ${count}`);
  }
  console.log();

  // Run duplicate checks
  console.log('Running duplicate detection checks...');
  const dupReport = await detectDuplicateSkills();
  
  console.log(`Duplicate Skill IDs: ${dupReport.duplicateIds.length}`);
  if (dupReport.duplicateIds.length > 0) {
    console.error('ERROR: Duplicate IDs found:', dupReport.duplicateIds);
  }

  console.log(`Duplicate Normalized Names: ${dupReport.duplicateNames.length}`);
  if (dupReport.duplicateNames.length > 0) {
    console.error('ERROR: Duplicate names found:', dupReport.duplicateNames);
  }

  console.log(`Duplicate Behavior Fingerprints: ${dupReport.duplicateFingerprints.length}`);
  if (dupReport.duplicateFingerprints.length > 0) {
    console.error('ERROR: Duplicate fingerprints found:', dupReport.duplicateFingerprints);
  }

  console.log(`Suspicious Near-Duplicates (Jaccard Similarity > 85%): ${dupReport.suspiciousNearDuplicates.length}`);
  if (dupReport.suspiciousNearDuplicates.length > 0) {
    console.log('\nNear-duplicates requiring manual review (showing top 10):');
    dupReport.suspiciousNearDuplicates.slice(0, 10).forEach(d => {
      console.log(`  * ${d.skillId1} <-> ${d.skillId2} (Sim: ${(d.similarity * 100).toFixed(1)}% | Reason: ${d.reason})`);
    });
  }
  console.log();

  // Run full registry validation
  console.log('Running deep schema validation on all compiled category files...');
  const validationResult = await validateSkillRegistry();
  const endTime = Date.now();

  if (validationResult.valid) {
    console.log('\n✅ SUCCESS: Skill Registry is 100% valid!');
    console.log(`All 12 required categories exist with correct counts.`);
    console.log(`No duplicate IDs, names, or behavior fingerprints found.`);
    console.log(`Validation completed in ${(endTime - startTime) / 1000}s.`);
    process.exit(0);
  } else {
    console.error('\n❌ FAILURE: Skill Registry has validation errors:');
    validationResult.errors.forEach(err => console.error(`  - ${err}`));
    console.log(`\nValidation completed in ${(endTime - startTime) / 1000}s with errors.`);
    process.exit(1);
  }
}

runValidation().catch(err => {
  console.error('Unhandled execution error during validation:', err);
  process.exit(1);
});

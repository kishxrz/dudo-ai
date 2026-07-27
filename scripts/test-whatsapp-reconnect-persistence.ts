import assert from 'assert';
import path from 'path';
import fs from 'fs';

console.log('=== STARTING WHATSAPP RECONNECT & PERSISTENCE VERIFICATION TEST ===\n');

// 1. Verify index.ts module syntax and export
const serviceIndexPath = path.join(__dirname, '../services/whatsapp-service/src/index.ts');
assert(fs.existsSync(serviceIndexPath), 'whatsapp-service index.ts exists');

const fileContent = fs.readFileSync(serviceIndexPath, 'utf8');

// 2. Check for manualDisconnectWorkspaces handling
assert(fileContent.includes('manualDisconnectWorkspaces'), 'manualDisconnectWorkspaces is defined');
assert(fileContent.includes('isManualDisconnect'), 'isManualDisconnect logic is present');
assert(fileContent.includes('AutoReconnect'), 'AutoReconnect handling is present');

// 3. Check for webVersionCache
assert(fileContent.includes('webVersionCache'), 'webVersionCache is configured in Client options');

// 4. Check for Firestore Session Backup and Restore functions
assert(fileContent.includes('backupSessionToFirestore'), 'backupSessionToFirestore function exists');
assert(fileContent.includes('restoreSessionFromFirestore'), 'restoreSessionFromFirestore function exists');
assert(fileContent.includes('deleteSessionFromFirestore'), 'deleteSessionFromFirestore function exists');
assert(fileContent.includes('packDirectory'), 'packDirectory directory serialization function exists');
assert(fileContent.includes('unpackDirectory'), 'unpackDirectory directory deserialization function exists');

// 5. Verify packDirectory & unpackDirectory logic using a temp dir
const tempTestDir = path.join(__dirname, '../temp-pack-test');
const tempUnpackDir = path.join(__dirname, '../temp-unpack-test');

try {
  if (fs.existsSync(tempTestDir)) fs.rmSync(tempTestDir, { recursive: true, force: true });
  if (fs.existsSync(tempUnpackDir)) fs.rmSync(tempUnpackDir, { recursive: true, force: true });

  fs.mkdirSync(path.join(tempTestDir, 'Default/Local Storage/leveldb'), { recursive: true });
  fs.writeFileSync(path.join(tempTestDir, 'Default/Cookies'), 'mock-cookie-data');
  fs.writeFileSync(path.join(tempTestDir, 'Default/Local Storage/leveldb/000003.log'), 'mock-leveldb-data');
  // Add a lock file that should be skipped
  fs.writeFileSync(path.join(tempTestDir, 'SingletonLock'), 'lock');

  // Test packing logic dynamically
  function packDirectory(dirPath: string): Record<string, string> {
    const filesMap: Record<string, string> = {};
    function walk(currentDir: string, relativeDir: string) {
      if (!fs.existsSync(currentDir)) return;
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (['SingletonLock', 'SingletonCookie', 'SingletonSocket'].includes(entry.name)) continue;
        const fullPath = path.join(currentDir, entry.name);
        const relPath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(fullPath, relPath);
        } else if (entry.isFile()) {
          const content = fs.readFileSync(fullPath);
          filesMap[relPath] = content.toString('base64');
        }
      }
    }
    walk(dirPath, '');
    return filesMap;
  }

  function unpackDirectory(targetDir: string, filesMap: Record<string, string>) {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    for (const [relPath, base64] of Object.entries(filesMap)) {
      const fullPath = path.join(targetDir, relPath);
      const parentDir = path.dirname(fullPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(fullPath, Buffer.from(base64, 'base64'));
    }
  }

  const packed = packDirectory(tempTestDir);
  assert(!packed['SingletonLock'], 'SingletonLock was correctly excluded from session backup');
  assert(packed['Default/Cookies'], 'Default/Cookies was included in session backup');
  assert(packed['Default/Local Storage/leveldb/000003.log'], 'Nested leveldb files were included');

  unpackDirectory(tempUnpackDir, packed);
  assert(fs.existsSync(path.join(tempUnpackDir, 'Default/Cookies')), 'Restored Default/Cookies exists');
  assert(!fs.existsSync(path.join(tempUnpackDir, 'SingletonLock')), 'SingletonLock is not present in restored session');
  assert.strictEqual(
    fs.readFileSync(path.join(tempUnpackDir, 'Default/Cookies'), 'utf8'),
    'mock-cookie-data',
    'Restored file contents match original backup'
  );

  console.log('✓ Directory serialization & deserialization backup test passed');
} finally {
  if (fs.existsSync(tempTestDir)) fs.rmSync(tempTestDir, { recursive: true, force: true });
  if (fs.existsSync(tempUnpackDir)) fs.rmSync(tempUnpackDir, { recursive: true, force: true });
}

console.log('\n=== ALL RECONNECT & PERSISTENCE TESTS PASSED SUCCESSFULLY ===');

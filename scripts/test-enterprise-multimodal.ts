import { LanguageCapabilityRegistry } from '../lib/ai/providers/LanguageCapabilityRegistry';
import { SpeechProviderRegistry } from '../lib/ai/providers/SpeechProviderRegistry';
import { TTSProviderRegistry } from '../lib/ai/providers/TTSProviderRegistry';
import { TextExtractionService } from '../lib/ai/TextExtractionService';

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING DUDO MULTIMODAL PLATFORM DIAGNOSTICS');
  console.log('====================================================\n');

  let passed = true;

  // Test 1: Language Capability Registry
  try {
    console.log('Test 1: LanguageCapabilityRegistry...');
    const sttOpenAILangs = LanguageCapabilityRegistry.getSTTSupportedLanguages('openai');
    const ttsElevenLangs = LanguageCapabilityRegistry.getTTSSupportedLanguages('elevenlabs');
    const voicesEleven = LanguageCapabilityRegistry.getTTSSupportedVoices('elevenlabs', 'en');

    console.log(`- OpenAI STT languages: ${sttOpenAILangs.length} found`);
    console.log(`- ElevenLabs TTS languages: ${ttsElevenLangs.length} found`);
    console.log(`- ElevenLabs English voices: ${voicesEleven.map(v => v.name).join(', ')}`);

    if (sttOpenAILangs.length === 0 || ttsElevenLangs.length === 0 || voicesEleven.length === 0) {
      throw new Error('Empty languages or voices returned.');
    }
    console.log('✅ Test 1 Passed: LanguageCapabilityRegistry works.\n');
  } catch (err: any) {
    console.error('❌ Test 1 Failed:', err.message);
    passed = false;
  }

  // Test 2: Document Zip Extraction (docx, xlsx, pptx XML)
  try {
    console.log('Test 2: TextExtractionService Mock Zip Extraction...');

    // Construct a mock zip buffer containing [Content_Types].xml or xl/sharedStrings.xml structures
    // For DOCX
    const mockDocxXml = '<w:document><w:body><w:p><w:t>Hello from Dudo DOCX test!</w:t></w:p></w:body></w:document>';
    // We construct a mock ZIP file manually
    // Zip local file header signature: 0x04034b50 (LE)
    const xmlBuffer = Buffer.from(mockDocxXml, 'utf8');
    const fileName = 'word/document.xml';
    const nameBuffer = Buffer.from(fileName, 'utf8');
    
    const zipHeader = Buffer.alloc(30);
    zipHeader.writeUInt32LE(0x04034b50, 0); // Signature
    zipHeader.writeUInt16LE(10, 4); // Min version
    zipHeader.writeUInt16LE(0, 6); // Flags
    zipHeader.writeUInt16LE(0, 8); // Compression method (Stored)
    zipHeader.writeUInt16LE(0, 10); // Mod time
    zipHeader.writeUInt16LE(0, 12); // Mod date
    zipHeader.writeUInt32LE(0, 14); // CRC32 (mocked)
    zipHeader.writeUInt32LE(xmlBuffer.length, 18); // Compressed size
    zipHeader.writeUInt32LE(xmlBuffer.length, 22); // Uncompressed size
    zipHeader.writeUInt16LE(nameBuffer.length, 26); // Filename length
    zipHeader.writeUInt16LE(0, 28); // Extra field length

    const docxZipBuffer = Buffer.concat([zipHeader, nameBuffer, xmlBuffer]);
    const docxBase64 = docxZipBuffer.toString('base64');

    const extractedDocx = TextExtractionService.extractText(docxBase64, 'docx');
    console.log(`- Extracted docx: "${extractedDocx}"`);

    if (extractedDocx !== 'Hello from Dudo DOCX test!') {
      throw new Error(`Expected "Hello from Dudo DOCX test!" but got "${extractedDocx}"`);
    }

    // For CSV
    const csvBase64 = Buffer.from('Column1,Column2\nValue1,Value2', 'utf8').toString('base64');
    const extractedCsv = TextExtractionService.extractText(csvBase64, 'csv');
    console.log(`- Extracted csv: "${extractedCsv}"`);
    if (!extractedCsv.includes('Column1')) {
      throw new Error('CSV extraction failed');
    }

    console.log('✅ Test 2 Passed: Document parsing & zip extraction works.\n');
  } catch (err: any) {
    console.error('❌ Test 2 Failed:', err.message);
    passed = false;
  }

  // Test 3: Speech Provider Registries
  try {
    console.log('Test 3: Provider Registries initialization...');
    const dummyKey = 'mock-key';
    const whisperStt = SpeechProviderRegistry.getProvider('openai', dummyKey);
    const elevenTts = TTSProviderRegistry.getProvider('elevenlabs', dummyKey);
    const googleTts = TTSProviderRegistry.getProvider('google', dummyKey);
    const azureTts = TTSProviderRegistry.getProvider('azure', dummyKey);

    if (!whisperStt || !elevenTts || !googleTts || !azureTts) {
      throw new Error('Failed to resolve one or more providers.');
    }
    console.log('✅ Test 3 Passed: SpeechProviderRegistry and TTSProviderRegistry resolved successfully.\n');
  } catch (err: any) {
    console.error('❌ Test 3 Failed:', err.message);
    passed = false;
  }

  console.log('====================================================');
  if (passed) {
    console.log('🎉 ALL DIAGNOSTIC TESTS PASSED CLEANLY!');
    process.exit(0);
  } else {
    console.log('🚨 DIAGNOSTIC SUITE ENCOUNTERED FAILURES.');
    process.exit(1);
  }
}

runTests().catch(console.error);

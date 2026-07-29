// @ts-nocheck
import { db } from '@/lib/firebase';
import { getAdminDb } from '@/lib/firebase-admin';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

export class KnowledgeService {
  static async getFormattedKnowledge(workspaceId: string): Promise<string> {
    if (!workspaceId) return '';

    const sections: string[] = [];
    const businessProfilePath = `workspaces/${workspaceId}/knowledge/business-profile`;
    const adminDb = getAdminDb();

    // ─── 1. BUSINESS PROFILE ───────────────────────────────────────────────
    try {
      const bizSnap = adminDb
        ? await adminDb.doc(businessProfilePath).get()
        : db
          ? await getDoc(doc(db, 'workspaces', workspaceId, 'knowledge', 'business-profile'))
          : null;
      const businessExists = bizSnap ? (typeof bizSnap.exists === 'function' ? bizSnap.exists() : bizSnap.exists) : false;
      const businessData = bizSnap?.data() ?? null;

      console.log('[KnowledgeService] Business profile document lookup', {
        workspaceId,
        documentPath: businessProfilePath,
        exists: businessExists,
        data: businessData,
        accessMode: adminDb ? 'admin' : db ? 'client-sdk' : 'unavailable',
      });
      if (businessExists && businessData) {
        const d = businessData;
        const bizLines: string[] = [];
        if (d.businessName?.trim()) {
          bizLines.push(`Business Name: ${d.businessName.trim()}`);
        }
        if (d.description?.trim()) {
          bizLines.push(`Business Description: ${d.description.trim()}`);
        }
        if (d.industry?.trim()) {
          bizLines.push(`Industry: ${d.industry.trim()}`);
        }
        if (d.productsServices?.trim()) {
          bizLines.push(`Products / Services: ${d.productsServices.trim()}`);
        }
        if (d.supportPhone?.trim()) {
          bizLines.push(`Support Phone: ${d.supportPhone.trim()}`);
        }
        if (d.supportEmail?.trim()) {
          bizLines.push(`Support Email: ${d.supportEmail.trim()}`);
        }
        if (d.website?.trim()) {
          bizLines.push(`Website: ${d.website.trim()}`);
        }
        if (bizLines.length > 0) {
          sections.push(`=== BUSINESS PROFILE ===\n${bizLines.join('\n')}`);
        }
      }
    } catch (e) {
      console.error('KnowledgeService: failed to load business-profile:', e);
    }

    // ─── 2. Load all dynamic knowledge items ──────────────────────────────
    const faqs: string[]     = [];
    const texts: string[]    = [];
    const websites: string[] = [];
    const docs_: string[]    = [];

    const RESERVED_IDS = ['knowledge-base', 'business-profile'];

    try {
      const docs = adminDb
        ? (await adminDb.collection(`workspaces/${workspaceId}/knowledge`).get()).docs
        : db
          ? (await getDocs(collection(db, 'workspaces', workspaceId, 'knowledge'))).docs
          : [];

      docs.forEach((knowledgeDoc) => {
        if (RESERVED_IDS.includes(knowledgeDoc.id)) return;
        const item = knowledgeDoc.data();
        if (item.status !== 'Ready' && item.status !== 'Suggestions Ready') return;

        switch (item.type) {
          case 'faq': {
            // Prefer explicit question/answer fields; fall back to title/source
            const q = (item.question || item.title || '').trim();
            const a = (item.answer || item.source || '').trim();
            if (q && a) faqs.push(`Q: ${q}\nA: ${a}`);
            break;
          }
          case 'text':
            if (item.title?.trim() && item.source?.trim()) {
              texts.push(`[${item.title.trim()}]\n${item.source.trim()}`);
            }
            break;
          case 'url':
            if (item.title?.trim() && item.source?.trim()) {
              websites.push(`${item.title.trim()}: ${item.source.trim()}`);
            }
            break;
          case 'pdf':
          case 'docx':
          case 'txt':
          case 'md':
            if (item.title?.trim()) {
              const content = item.source && item.source !== item.title
                ? `\nParsed Content:\n${item.source.trim()}`
                : '';
              docs_.push(`${item.title.trim()}${content}`);
            }
            break;
        }
      });
    } catch (e) {
      console.error('KnowledgeService: failed to load knowledge items:', e);
    }

    // ─── Also load legacy knowledge-base doc ──────────────────────────────
    try {
      const legacySnap = adminDb
        ? await adminDb.doc(`workspaces/${workspaceId}/knowledge/knowledge-base`).get()
        : db
          ? await getDoc(doc(db, 'workspaces', workspaceId, 'knowledge', 'knowledge-base'))
          : null;
      const legacyExists = legacySnap ? (typeof legacySnap.exists === 'function' ? legacySnap.exists() : legacySnap.exists) : false;

      if (legacyExists) {
        const d = legacySnap.data();
        if (d.businessDetails?.trim())   texts.push(`[Business Details]\n${d.businessDetails.trim()}`);
        if (d.productsServices?.trim())  texts.push(`[Products & Services]\n${d.productsServices.trim()}`);
        if (d.commonQuestions?.trim())   texts.push(`[Common Questions]\n${d.commonQuestions.trim()}`);
        if (d.policies?.trim())          texts.push(`[Policies]\n${d.policies.trim()}`);
      }
    } catch (e) {
      console.error('KnowledgeService: failed to load knowledge-base doc:', e);
    }

    // ─── 3. Assemble in consistent section order ───────────────────────────
    if (faqs.length > 0) {
      sections.push(`=== FAQ ===\n${faqs.join('\n\n')}`);
    }
    if (texts.length > 0) {
      sections.push(`=== TEXT KNOWLEDGE ===\n${texts.join('\n\n')}`);
    }
    if (websites.length > 0) {
      sections.push(`=== WEBSITE REFERENCES ===\n${websites.join('\n')}`);
    }
    if (docs_.length > 0) {
      sections.push(`=== DOCUMENT CONTENT ===\n${docs_.join('\n\n')}`);
    }

    const formattedKnowledge = sections.join('\n\n').trim();
    console.log('[KnowledgeService] Formatted knowledge returned', {
      workspaceId,
      knowledge: formattedKnowledge,
    });

    return formattedKnowledge;
  }

  static async getStaticKnowledge(workspaceId: string): Promise<string> {
    if (!workspaceId) return '';
    const adminDb = getAdminDb();
    const sections: string[] = [];

    try {
      const businessProfilePath = `workspaces/${workspaceId}/knowledge/business-profile`;
      const legacyPath = `workspaces/${workspaceId}/knowledge/knowledge-base`;

      const [bizSnap, legacySnap] = await Promise.all([
        adminDb ? adminDb.doc(businessProfilePath).get() : (db ? getDoc(doc(db, 'workspaces', workspaceId, 'knowledge', 'business-profile')) : null),
        adminDb ? adminDb.doc(legacyPath).get() : (db ? getDoc(doc(db, 'workspaces', workspaceId, 'knowledge', 'knowledge-base')) : null)
      ]);

      if (bizSnap) {
        const businessExists = typeof bizSnap.exists === 'function' ? bizSnap.exists() : bizSnap.exists;
        if (businessExists) {
          const d = bizSnap.data();
          if (d) {
            const bizLines: string[] = [];
            if (d.businessName?.trim()) bizLines.push(`Business Name: ${d.businessName.trim()}`);
            if (d.description?.trim()) bizLines.push(`Business Description: ${d.description.trim()}`);
            if (d.industry?.trim()) bizLines.push(`Industry: ${d.industry.trim()}`);
            if (d.productsServices?.trim()) bizLines.push(`Products / Services: ${d.productsServices.trim()}`);
            if (d.supportPhone?.trim()) bizLines.push(`Support Phone: ${d.supportPhone.trim()}`);
            if (d.supportEmail?.trim()) bizLines.push(`Support Email: ${d.supportEmail.trim()}`);
            if (d.website?.trim()) bizLines.push(`Website: ${d.website.trim()}`);
            if (bizLines.length > 0) {
              sections.push(`=== BUSINESS PROFILE ===\n${bizLines.join('\n')}`);
            }
          }
        }
      }

      if (legacySnap) {
        const legacyExists = typeof legacySnap.exists === 'function' ? legacySnap.exists() : legacySnap.exists;
        if (legacyExists) {
          const d = legacySnap.data();
          if (d) {
            const texts: string[] = [];
            if (d.businessDetails?.trim())   texts.push(`[Business Details]\n${d.businessDetails.trim()}`);
            if (d.productsServices?.trim())  texts.push(`[Products & Services]\n${d.productsServices.trim()}`);
            if (d.commonQuestions?.trim())   texts.push(`[Common Questions]\n${d.commonQuestions.trim()}`);
            if (d.policies?.trim())          texts.push(`[Policies]\n${d.policies.trim()}`);
            if (texts.length > 0) {
              sections.push(`=== TEXT KNOWLEDGE ===\n${texts.join('\n\n')}`);
            }
          }
        }
      }
    } catch (e) {
      console.error('KnowledgeService: failed to load static knowledge:', e);
    }

    return sections.join('\n\n').trim();
  }
}

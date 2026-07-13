import { db } from '../firebase';
import { getAdminDb } from '../firebase-admin';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp, updateDoc, writeBatch, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { ExtractedFacts } from './BusinessFactExtractionService';

function normalizeBusinessValue(val: string): string {
  if (!val) return '';
  let cleaned = val.toLowerCase().trim();
  cleaned = cleaned.replace(/[^\w\s]/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  const suffixes = [
    'pvt ltd', 'pvt', 'ltd', 'llc', 'inc', 'co', 'corp', 'corporation',
    'private limited', 'limited', 'incorporated'
  ];
  
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of suffixes) {
      const regex = new RegExp(`\\b${suffix}$`, 'i');
      if (regex.test(cleaned)) {
        cleaned = cleaned.replace(regex, '').trim();
        changed = true;
      }
    }
  }
  return cleaned;
}

function normalizeIndustryValue(val: string): string {
  if (!val) return '';
  return val.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

export interface ProfileSuggestion {
  id?: string;
  workspaceId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  sourceDocument: string;
  confidenceScore: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: any;
  type?: 'conflict' | 'new_info';
  isDifferentBusiness?: boolean;
}

export class ProfileSuggestionService {
  /**
   * Compares extracted facts with current Business Profile and saves suggestions in Firestore.
   */
  static async createSuggestions(
    workspaceId: string,
    facts: ExtractedFacts,
    sourceDocument: string
  ): Promise<ProfileSuggestion[]> {
    const suggestions: ProfileSuggestion[] = [];

    // Load current Business Profile
    let currentProfile: Record<string, any> = {};
    const adminDb = getAdminDb();
    const docPath = `workspaces/${workspaceId}/knowledge/business-profile`;

    if (adminDb) {
      try {
        const snap = await adminDb.doc(docPath).get();
        if (snap.exists) currentProfile = snap.data() || {};
      } catch (e) {}
    } else if (db) {
      try {
        const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'knowledge', 'business-profile'));
        if (snap.exists()) currentProfile = snap.data() || {};
      } catch (e) {}
    }

    // Mapping fields
    const checkFields: { extracted: keyof ExtractedFacts; profileKey: string }[] = [
      { extracted: 'businessName', profileKey: 'businessName' },
      { extracted: 'industry', profileKey: 'industry' },
      { extracted: 'businessDescription', profileKey: 'description' },
      { extracted: 'supportEmail', profileKey: 'supportEmail' },
      { extracted: 'supportPhone', profileKey: 'supportPhone' },
      { extracted: 'website', profileKey: 'website' },
      { extracted: 'products', profileKey: 'productsServices' }
    ];

    for (const field of checkFields) {
      let extValRaw = facts[field.extracted];
      if (extValRaw === undefined || extValRaw === null) continue;

      let newValue = '';
      if (Array.isArray(extValRaw)) {
        newValue = extValRaw.join(', ').trim();
      } else {
        newValue = String(extValRaw).trim();
      }

      if (!newValue) continue;

      const oldValue = String(currentProfile[field.profileKey] || '').trim();

      // Check if new information is found or change is detected
      let isChanged = false;
      if (field.profileKey === 'businessName') {
        isChanged = normalizeBusinessValue(oldValue) !== normalizeBusinessValue(newValue);
      } else if (field.profileKey === 'industry') {
        isChanged = normalizeIndustryValue(oldValue) !== normalizeIndustryValue(newValue);
      } else {
        isChanged = oldValue.toLowerCase() !== newValue.toLowerCase();
      }

      if (isChanged) {
        const suggestion: ProfileSuggestion = {
          workspaceId,
          fieldName: field.profileKey,
          oldValue,
          newValue,
          sourceDocument,
          confidenceScore: 0.9, // Default confidence score
          status: 'pending',
          type: oldValue ? 'conflict' : 'new_info'
        };
        suggestions.push(suggestion);
      }
    }

    // Tag different-business documents if there's an identity conflict
    const hasIdentityConflict = suggestions.some(s => 
      (s.fieldName === 'businessName' || s.fieldName === 'industry') && s.type === 'conflict'
    );

    if (hasIdentityConflict) {
      for (const sug of suggestions) {
        sug.isDifferentBusiness = true;
      }
    }

    // Save suggestions to Firestore workspaces/[workspaceId]/suggestions
    for (const sug of suggestions) {
      if (adminDb) {
        try {
          await adminDb.collection(`workspaces/${workspaceId}/suggestions`).add({
            ...sug,
            createdAt: new Date()
          });
        } catch (e) {}
      } else if (db) {
        try {
          await addDoc(collection(db, 'workspaces', workspaceId, 'suggestions'), {
            ...sug,
            createdAt: serverTimestamp()
          });
        } catch (e) {}
      }
    }

    return suggestions;
  }

  /**
   * Approves a suggestion and updates the Business Profile in Firestore.
   */
  static async approveSuggestion(
    workspaceId: string,
    suggestionId: string,
    fieldName: string,
    newValue: string
  ): Promise<void> {
    const adminDb = getAdminDb();
    const profilePath = `workspaces/${workspaceId}/knowledge/business-profile`;
    const suggestionPath = `workspaces/${workspaceId}/suggestions/${suggestionId}`;

    const updatePayload = { [fieldName]: newValue };

    if (adminDb) {
      await adminDb.doc(profilePath).set(updatePayload, { merge: true });
      await adminDb.doc(suggestionPath).update({ status: 'approved' });
    } else if (db) {
      await setDoc(doc(db, 'workspaces', workspaceId, 'knowledge', 'business-profile'), updatePayload, { merge: true });
      await updateDoc(doc(db, 'workspaces', workspaceId, 'suggestions', suggestionId), { status: 'approved' });
    }

    // Also update local storage if browser environment
    if (typeof window !== 'undefined' && fieldName === 'businessName') {
      try {
        const profile = JSON.parse(localStorage.getItem('__dudo_business_profile') || '{}');
        profile.businessName = newValue;
        localStorage.setItem('__dudo_business_profile', JSON.stringify(profile));
      } catch (e) {}
    }
  }

  /**
   * Rejects a suggestion in Firestore.
   */
  static async rejectSuggestion(workspaceId: string, suggestionId: string): Promise<void> {
    const adminDb = getAdminDb();
    const suggestionPath = `workspaces/${workspaceId}/suggestions/${suggestionId}`;

    if (adminDb) {
      await adminDb.doc(suggestionPath).update({ status: 'rejected' });
    } else if (db) {
      await updateDoc(doc(db, 'workspaces', workspaceId, 'suggestions', suggestionId), { status: 'rejected' });
    }
  }

  /**
   * Replaces the entire Business Profile atomically and saves a rollback snapshot.
   */
  static async replaceProfile(workspaceId: string, suggestionId: string): Promise<void> {
    const adminDb = getAdminDb();
    
    // 1. Get the source suggestion to identify the document group
    let sourceDocTitle = '';
    let sourceDocId = '';
    const sugRefPath = `workspaces/${workspaceId}/suggestions/${suggestionId}`;
    
    let targetSugData: any = null;
    if (adminDb) {
      const snap = await adminDb.doc(sugRefPath).get();
      if (snap.exists) targetSugData = snap.data();
    } else if (db) {
      const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'suggestions', suggestionId));
      if (snap.exists()) targetSugData = snap.data();
    }
    
    if (!targetSugData) {
      throw new Error('Suggestion not found');
    }
    sourceDocTitle = targetSugData.sourceDocument || '';
    sourceDocId = targetSugData.id || suggestionId;
    
    // 2. Load all pending suggestions for this source document
    let allSugs: any[] = [];
    if (adminDb) {
      const snap = await adminDb.collection(`workspaces/${workspaceId}/suggestions`)
        .where('sourceDocument', '==', sourceDocTitle)
        .where('status', '==', 'pending')
        .get();
      allSugs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else if (db) {
      const q = query(
        collection(db, 'workspaces', workspaceId, 'suggestions'),
        where('sourceDocument', '==', sourceDocTitle),
        where('status', '==', 'pending')
      );
      const snap = await getDocs(q);
      allSugs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    
    // 3. Load current Business Profile
    let currentProfile: Record<string, any> = {};
    const profilePath = `workspaces/${workspaceId}/knowledge/business-profile`;
    if (adminDb) {
      const snap = await adminDb.doc(profilePath).get();
      if (snap.exists) currentProfile = snap.data() || {};
    } else if (db) {
      const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'knowledge', 'business-profile'));
      if (snap.exists()) currentProfile = snap.data() || {};
    }
    
    // 4. Build the updated profile and clear old fields not in suggestion
    const updatedProfile: Record<string, any> = {};
    const allProfileKeys = [
      'businessName',
      'description',
      'industry',
      'productsServices',
      'supportEmail',
      'supportPhone',
      'website'
    ];
    
    Object.keys(currentProfile).forEach(k => {
      if (k !== 'updatedAt') {
        updatedProfile[k] = '';
      }
    });
    
    allProfileKeys.forEach(k => {
      updatedProfile[k] = '';
    });
    
    // Apply suggestions
    for (const sug of allSugs) {
      updatedProfile[sug.fieldName] = sug.newValue;
    }
    
    updatedProfile.updatedAt = new Date();
    
    // 5. Create versioned snapshot payload
    const snapshotId = `snap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const snapshotPath = `workspaces/${workspaceId}/profile-snapshots/${snapshotId}`;
    const snapshotPayload = {
      id: snapshotId,
      sourceDocumentId: sourceDocId,
      createdAt: new Date(),
      profileData: currentProfile
    };
    
    // 6. Perform ATOMIC replacement using Batch
    if (adminDb) {
      const batch = adminDb.batch();
      batch.set(adminDb.doc(profilePath), updatedProfile);
      batch.set(adminDb.doc(snapshotPath), snapshotPayload);
      for (const sug of allSugs) {
        batch.update(adminDb.doc(`workspaces/${workspaceId}/suggestions/${sug.id}`), { status: 'approved' });
      }
      await batch.commit();
    } else if (db) {
      const batch = writeBatch(db);
      batch.set(doc(db, 'workspaces', workspaceId, 'knowledge', 'business-profile'), updatedProfile);
      batch.set(doc(db, 'workspaces', workspaceId, 'profile-snapshots', snapshotId), snapshotPayload);
      for (const sug of allSugs) {
        batch.update(doc(db, 'workspaces', workspaceId, 'suggestions', sug.id), { status: 'approved' });
      }
      await batch.commit();
    }
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('__dudo_business_profile', JSON.stringify(updatedProfile));
    }
  }

  /**
   * Discards all related suggestions to index for RAG only.
   */
  static async keepAsKnowledge(workspaceId: string, suggestionId: string): Promise<void> {
    const adminDb = getAdminDb();
    let sourceDocTitle = '';
    const sugRefPath = `workspaces/${workspaceId}/suggestions/${suggestionId}`;
    
    if (adminDb) {
      const snap = await adminDb.doc(sugRefPath).get();
      if (snap.exists) sourceDocTitle = snap.data()?.sourceDocument || '';
    } else if (db) {
      const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'suggestions', suggestionId));
      if (snap.exists()) sourceDocTitle = snap.data()?.sourceDocument || '';
    }
    
    if (!sourceDocTitle) {
      throw new Error('Suggestion not found');
    }
    
    // Reject all pending suggestions for this document group
    if (adminDb) {
      const snap = await adminDb.collection(`workspaces/${workspaceId}/suggestions`)
        .where('sourceDocument', '==', sourceDocTitle)
        .where('status', '==', 'pending')
        .get();
      const batch = adminDb.batch();
      for (const doc of snap.docs) {
        batch.update(doc.ref, { status: 'rejected' });
      }
      await batch.commit();
    } else if (db) {
      const q = query(
        collection(db, 'workspaces', workspaceId, 'suggestions'),
        where('sourceDocument', '==', sourceDocTitle),
        where('status', '==', 'pending')
      );
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      for (const d of snap.docs) {
        batch.update(doc(db, 'workspaces', workspaceId, 'suggestions', d.id), { status: 'rejected' });
      }
      await batch.commit();
    }
  }

  /**
   * Restores a Business Profile snapshot without deleting history.
   */
  static async rollbackProfile(workspaceId: string, snapshotId?: string): Promise<void> {
    const adminDb = getAdminDb();
    let targetSnapshot: any = null;
    
    if (snapshotId) {
      const snapshotPath = `workspaces/${workspaceId}/profile-snapshots/${snapshotId}`;
      if (adminDb) {
        const snap = await adminDb.doc(snapshotPath).get();
        if (snap.exists) targetSnapshot = snap.data();
      } else if (db) {
        const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'profile-snapshots', snapshotId));
        if (snap.exists()) targetSnapshot = snap.data();
      }
    } else {
      // Find latest snapshot
      if (adminDb) {
        const snap = await adminDb.collection(`workspaces/${workspaceId}/profile-snapshots`)
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();
        if (!snap.empty) {
          targetSnapshot = snap.docs[0].data();
        }
      } else if (db) {
        const q = query(
          collection(db, 'workspaces', workspaceId, 'profile-snapshots'),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          targetSnapshot = snap.docs[0].data();
        }
      }
    }
    
    if (!targetSnapshot || !targetSnapshot.profileData) {
      throw new Error('No valid profile snapshot found for rollback');
    }
    
    const profilePath = `workspaces/${workspaceId}/knowledge/business-profile`;
    const restoredProfile = {
      ...targetSnapshot.profileData,
      updatedAt: new Date()
    };
    
    if (adminDb) {
      await adminDb.doc(profilePath).set(restoredProfile);
    } else if (db) {
      await setDoc(doc(db, 'workspaces', workspaceId, 'knowledge', 'business-profile'), restoredProfile);
    }
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('__dudo_business_profile', JSON.stringify(restoredProfile));
    }
  }
}

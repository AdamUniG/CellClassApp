// src/db.ts

import { Platform } from 'react-native';

// ─── 1. Firebase imports ───────────────────────────────────────────────
import { fb } from '@/src/firebase';
import {
  addDoc,
  collection,
  deleteDoc as deleteDocFirestore,
  doc as docFirestore,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch
} from 'firebase/firestore';

// ─── 2. Expo SQLite async API (native only) ─────────────────────────────
import { IMAGES } from '@/src/images';
import type { SQLiteDatabase } from 'expo-sqlite';
let SQLite: typeof import('expo-sqlite');

// ─── 3. In-memory stub for Web ─────────────────────────────────────────
interface StubDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...args: any[]): Promise<void>;
  getAllAsync<T>(sql: string, ...args: any[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...args: any[]): Promise<T | null>;
}
const webDb: StubDb = {
  execAsync: async () => {},
  runAsync: async () => {},
  getAllAsync: async () => [],
  getFirstAsync: async () => null,
};

// ─── 4. DB getter ───────────────────────────────────────────────────────
let _db: SQLiteDatabase | StubDb | null = null;
async function getDb(): Promise<SQLiteDatabase | StubDb> {
  if (!_db) {
    if (Platform.OS === 'web') {
      _db = webDb;
    } else {
      SQLite = require('expo-sqlite');
      _db = await SQLite.openDatabaseAsync('lab.db');
    }
  }
  return _db;
}

// ─── 5. Types ───────────────────────────────────────────────────────────
export type Category = 'Oli' | 'OPC' | 'Astro' | 'More' | 'Multiple' | 'Unknown' | 'Nothing' | 'Back';

export interface ImageRow {
  picture_id: string;
  category:   Category | null;
}

export interface LabelRow {
  label_id:   number;
  user_id:    string;
  picture_id: string;
  category:   Category;
  synced:     number;
  created_at: number;
}

// ─── 6. Bootstrap (native only) ─────────────────────────────────────────
export async function bootstrap(): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pictures (
      picture_id TEXT PRIMARY KEY,
      category   TEXT
    );
  `);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS labels_local (
      label_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT,
      picture_id  TEXT,
      category    TEXT,
      synced      INTEGER DEFAULT 0,
      created_at  INTEGER DEFAULT (strftime('%s','now'))
    );
  `);
  const first = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM pictures;');
  if (!first || first.n === 0) {
    await db.execAsync('BEGIN;');
    for (const { id } of IMAGES) {
      await db.runAsync(
        `INSERT INTO pictures (picture_id, category) VALUES (?, ?);`,
        id,
        null
      );
    }
    await db.execAsync('COMMIT;');
  }
}

// ─── 7. Fetch one unlabelled image ───────────────────────────────────
export async function getNextPicture(user_id: string): Promise<ImageRow | null> {
  if (Platform.OS === 'web') {
    // Fetch labels from Firestore and filter IMAGES
    const snap = await getDocs(query(
      collection(fb, 'labels_master'),
      where('user_id', '==', user_id)
    ));
    const labeled = new Set(snap.docs.map(d => d.data().picture_id));
    const remaining = IMAGES.filter(img => !labeled.has(img.id));
    if (remaining.length === 0) return null;
    const pick = remaining[Math.floor(Math.random() * remaining.length)];
    // On web, no local category field; return null for category
    return { picture_id: pick.id, category: null };
  }
  const db = await getDb();
  const rows = await db.getAllAsync<ImageRow>(
    `SELECT p.picture_id, p.category FROM pictures p
      LEFT JOIN labels_local l ON l.picture_id = p.picture_id AND l.user_id = ?
      WHERE l.picture_id IS NULL ORDER BY RANDOM() LIMIT 1;`,
    user_id
  );
  return rows[0] ?? null;
}

// ─── 8. Save one label locally or remotely ─────────────────────────────
export async function saveLabel(
  user_id: string,
  picture_id: string,
  category: Category
): Promise<void> {
  if (category === 'More' || category === 'Back') return;
  if (Platform.OS === 'web') {
    await addDoc(collection(fb, 'labels_master'), {
      user_id,
      picture_id,
      category,
      created_at: serverTimestamp()
    });
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO labels_local (user_id, picture_id, category) VALUES (?, ?, ?);`,
    user_id,
    picture_id,
    category
  );
}

// ─── 9. Fetch unsynced labels (native only) ───────────────────────────
export async function fetchUnsynced(user_id: string): Promise<LabelRow[]> {
  if (Platform.OS === 'web') return [];
  const db = await getDb();
  return db.getAllAsync<LabelRow>(
    `SELECT * FROM labels_local WHERE user_id = ? AND synced = 0;`,
    user_id
  );
}

// ─── 10. Mark rows synced locally (native only) ───────────────────────
export async function markSynced(labelIds: number[]): Promise<void> {
  if (Platform.OS === 'web' || labelIds.length === 0) return;
  const db = await getDb();
  const placeholders = labelIds.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE labels_local SET synced = 1 WHERE label_id IN (${placeholders});`,
    ...labelIds
  );
}

// ─── 11. Push to Firestore (native sync) ──────────────────────────────
export async function syncToFirestore(user_id: string): Promise<void> {
  const unsynced = await fetchUnsynced(user_id);
  if (unsynced.length === 0) return;
  const batch = writeBatch(fb);
  const colRef = collection(fb, 'labels_master');
  unsynced.forEach(lbl => {
    const docRef = docFirestore(colRef);
    batch.set(docRef, {
      user_id: lbl.user_id,
      picture_id: lbl.picture_id,
      category: lbl.category,
      created_at: serverTimestamp(),
    });
  });
  await batch.commit();
  await markSynced(unsynced.map(l => l.label_id));
}

// ─── 12. Delete local label (native only) ─────────────────────────────
export async function deleteLabelLocal(user_id: string, picture_id: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = await getDb() as SQLiteDatabase;
  await db.runAsync(
    `DELETE FROM labels_local WHERE user_id = ? AND picture_id = ?;`,
    user_id,
    picture_id
  );
}

// ─── 13. Delete from Firestore ─────────────────────────────────────────
export async function deleteLabelFromFirestore(user_id: string, picture_id: string): Promise<void> {
  const col = collection(fb, 'labels_master');
  const q = query(col, where('user_id', '==', user_id), where('picture_id', '==', picture_id), limit(1));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return;
  const docSnap = querySnapshot.docs[0];
  const singleDocRef = docFirestore(fb, 'labels_master', docSnap.id);
  await deleteDocFirestore(singleDocRef);
}

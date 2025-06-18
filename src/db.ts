// src/db.ts

// ─── 1. Firebase imports ───────────────────────────────────────────────
import { fb } from '@/src/firebase';

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch
} from 'firebase/firestore';

// ─── 2. Expo SQLite async API ─────────────────────────────────────────
import { IMAGES } from '@/src/images';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as SQLite from 'expo-sqlite';

let _db: SQLiteDatabase | null = null;
async function getDb(): Promise<SQLiteDatabase> {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync('lab.db');
  }
  return _db;
}

// ─── 3. Types ────────────────────────────────────────────────────────────
export type Category = 'Oli' | 'OPC' | 'Astro' | 'More'| 'Multiple' | 'Unknown' | 'Nothing' | 'Back';

export interface ImageRow {
  picture_id: string;
  category:   Category;
}

export interface LabelRow {
  label_id:   number;
  user_id:    string;
  picture_id: string;
  category:   Category;
  synced:     number;
  created_at: number;
}

// ─── 4. Bootstrap (create + seed) ───────────────────────────────────────
export async function bootstrap(): Promise<void> {
  const db = await getDb();

  // create tables if they don't exist
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
      created_at  INTEGER DEFAULT (strftime('%s','now')),
      FOREIGN KEY(picture_id) REFERENCES pictures(picture_id)
    );
  `);

  // seed pictures once
  const first = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM pictures;'
  );
  if (!first || first.n === 0) {
    await db.execAsync('BEGIN;');
    for (const { id } of IMAGES) {
      await db.runAsync(
        `INSERT INTO pictures (picture_id, category)
         VALUES (?, ?);`,
        id,
        null
        
      );
    }
    await db.execAsync('COMMIT;');
    console.log(`📸 Seeded ${IMAGES.length} pictures`);
  }
}

// ─── 5. Fetch one unlabelled image ───────────────────────────
export async function getNextPicture(
  user_id: string
): Promise<ImageRow | null> {
  const db = await getDb();

  const rows = await db.getAllAsync<ImageRow>(
    `SELECT p.picture_id, p.category
       FROM pictures p
  LEFT JOIN labels_local l
         ON l.picture_id = p.picture_id
        AND l.user_id    = ?
      WHERE l.picture_id IS NULL
      ORDER BY RANDOM()
      LIMIT 1;`,
    user_id,
    
  );

  return rows[0] ?? null;
}

// ─── 6. Save one label locally ──────────────────────────────────────────
export async function saveLabel(
  user_id: string,
  picture_id: string,
  category: Category
): Promise<void> {
  if (category === 'More' || category === 'Back') return;
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO labels_local (user_id, picture_id, category)
     VALUES (?, ?, ?);`,
    user_id,
    picture_id,
    category
  );
}

// ─── 7. Fetch unsynced labels ──────────────────────────────────────────
export async function fetchUnsynced(user_id: string): Promise<LabelRow[]> {
  const db = await getDb();
  return await db.getAllAsync<LabelRow>(
    `SELECT * FROM labels_local
      WHERE user_id = ? AND synced = 0;`,
    user_id
  );
}

// ─── 8. Mark rows synced locally ───────────────────────────────────────
export async function markSynced(labelIds: number[]): Promise<void> {
  if (labelIds.length === 0) return;
  const db = await getDb();
  const placeholders = labelIds.map(() => '?').join(',');
// new—pass the whole array as the second arg:
await db.runAsync(
  `UPDATE labels_local
     SET synced = 1
   WHERE label_id IN (${placeholders});`,
  ...labelIds
);

}

// ─── 9. Push to Firestore ───────────────────────────────────────────────
export async function syncToFirestore(user_id: string): Promise<void> {
  const unsynced = await fetchUnsynced(user_id);
  if (unsynced.length === 0) return;

  const batch = writeBatch(fb.firestore);
  const colRef = collection(fb.firestore, 'labels_master');

  unsynced.forEach(lbl => {
    const docRef = doc(colRef);
    batch.set(docRef, {
      user_id:    lbl.user_id,
      picture_id: lbl.picture_id,
      category:   lbl.category,
      created_at: serverTimestamp(),
    });
  });

  await batch.commit();
  await markSynced(unsynced.map(l => l.label_id));
}
export async function deleteLabelLocal(
  user_id: string,
  picture_id: string
): Promise<void> {
  const db: SQLiteDatabase = await getDb();
  // Remove the row from your local 'labels_local' table.
  // Adjust table/column names if yours differ.
  await db.runAsync(
    `DELETE FROM labels_local
       WHERE user_id = ?
         AND picture_id = ?;`,
    user_id,
    picture_id
  );
}
export async function deleteLabelFromFirestore(
  user_id: string,
  picture_id: string
): Promise<void> {
  // 1) Build a Firestore query: look in "labels_master" for
  //    documents where user_id == user_id AND picture_id == picture_id.
  //    We only expect one such document (limit 1).
  const col = collection(fb.firestore, 'labels_master');
  const q = query(
    col,
    where('user_id', '==', user_id),
    where('picture_id', '==', picture_id),
    limit(1)
  );

  // 2) Execute the query to find the matching doc
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    // No matching doc found; nothing to delete
    return;
  }

  // 3) There should be exactly one document; take its ID
  const docSnap = querySnapshot.docs[0];
  const docId = docSnap.id;

  // 4) Delete that document by reference
  const singleDocRef = doc(fb.firestore, 'labels_master', docId);
  await deleteDoc(singleDocRef);
}
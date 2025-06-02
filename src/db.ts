// src/db.ts

// ─── 1. Firebase imports ───────────────────────────────────────────────
import { fb } from '@/src/firebase';

import {
  collection,
  doc,
  serverTimestamp,
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
export type Category = 'apple' | 'banana' | 'Avo' | 'sabres';

export interface ImageRow {
  picture_id: string;
  file_name:  string;
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
      file_name  TEXT,
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

  // seed pictures once
  const first = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM pictures;'
  );
  if (!first || first.n === 0) {
    await db.execAsync('BEGIN;');
    for (const { id, file_name, category } of IMAGES) {
      await db.runAsync(
        `INSERT INTO pictures (picture_id, file_name, category)
         VALUES (?, ?, ?);`,
        id,
        file_name,
        category
      );
    }
    await db.execAsync('COMMIT;');
    console.log(`📸 Seeded ${IMAGES.length} pictures`);
  }
}

// ─── 5. Fetch one balanced, unlabelled image ───────────────────────────
export async function getNextPicture(
  user_id: string
): Promise<ImageRow | null> {
  const db = await getDb();

  // 1) count labels per category
  const counts = await db.getAllAsync<{ category: string; cnt: number }>(
    `SELECT category, COUNT(*) AS cnt
       FROM labels_local
      WHERE user_id = ?
      GROUP BY category;`,
    user_id
  );
  const map: Record<Category, number> = {} as any;
  counts.forEach(r => {
    map[r.category as Category] = r.cnt;
  });

  // 2) pick the least-labelled category
  const allCats: Category[] = ['apple','banana','Avo','sabres'];
  const minCnt = Math.min(...allCats.map(c => map[c] ?? 0));
  const pool = allCats.filter(c => (map[c] ?? 0) === minCnt);
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  // 3) fetch one random unlabelled image in that category
  const rows = await db.getAllAsync<ImageRow>(
    `SELECT p.picture_id, p.file_name, p.category
       FROM pictures p
  LEFT JOIN labels_local l
         ON l.picture_id = p.picture_id
        AND l.user_id    = ?
      WHERE p.category = ?
        AND l.picture_id IS NULL
      ORDER BY RANDOM()
      LIMIT 1;`,
    user_id,
    chosen
  );

  return rows[0] ?? null;
}

// ─── 6. Save one label locally ──────────────────────────────────────────
export async function saveLabel(
  user_id: string,
  picture_id: string,
  category: Category
): Promise<void> {
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
      _localId:   lbl.label_id
    });
  });

  await batch.commit();
  await markSynced(unsynced.map(l => l.label_id));
}

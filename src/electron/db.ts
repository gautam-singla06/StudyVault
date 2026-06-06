import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import type {
  NoteInput,
  ResourceInput,
  ResourceKind,
  SubjectInput,
  VaultNote,
  VaultResource,
  VaultSearchResult,
  VaultSubject,
} from './types';

type SubjectRow = {
  id: number;
  name: string;
  description: string;
  color: string;
  created_at: string;
  updated_at: string;
  note_count?: number;
  resource_count?: number;
};

type NoteRow = {
  id: number;
  subject_id: number | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

type ResourceRow = {
  id: number;
  subject_id: number | null;
  kind: ResourceKind;
  title: string;
  location: string;
  created_at: string;
  updated_at: string;
};

let db: SqlJsDatabase | null = null;
let currentDbPath = '';

async function loadDatabase() {
  if (db) return db;

  const dataDir = path.join(app.getPath('userData'), 'data');
  currentDbPath = path.join(dataDir, 'studyvault.sqlite');
  const fileExists = fs.existsSync(currentDbPath);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const SQL = await initSqlJs({
    locateFile: (file: string) =>
      app.isPackaged ? path.join(process.resourcesPath, file) : path.join(process.cwd(), 'node_modules/sql.js/dist', file),
  });

  db = fileExists ? new SQL.Database(fs.readFileSync(currentDbPath)) : new SQL.Database();
  runMigrations();
  persistDatabase();
  return db;
}

export async function initDatabase() {
  return loadDatabase();
}

function runMigrations() {
  const vault = getDb();
  vault.run(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#14b8a6',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  vault.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
    );
  `);

  migrateLegacyNotesTable();

  vault.run(`
    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER,
      kind TEXT NOT NULL CHECK (kind IN ('pdf', 'image', 'video', 'link')),
      title TEXT NOT NULL,
      location TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
    );
  `);
}

function migrateLegacyNotesTable() {
  const columns = getTableColumns('notes');
  if (!columns.includes('subject') || columns.includes('subject_id')) return;

  getDb().run('ALTER TABLE notes RENAME TO notes_legacy;');
  getDb().run(`
    CREATE TABLE notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
    );
  `);

  const legacyRows = selectRows<{
    id: number;
    title: string;
    content: string;
    subject: string;
    created_at: string;
    updated_at: string;
  }>('SELECT id, title, content, subject, created_at, updated_at FROM notes_legacy');

  legacyRows.forEach((row) => {
    const subjectId = row.subject.trim() ? ensureSubject(row.subject.trim()) : null;
    runStatement(
      'INSERT INTO notes (id, subject_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [row.id, subjectId, row.title, row.content, row.created_at, row.updated_at],
    );
  });

  getDb().run('DROP TABLE notes_legacy;');
}

function ensureSubject(name: string) {
  const existing = selectOne<SubjectRow>('SELECT id, name, description, color, created_at, updated_at FROM subjects WHERE name = ?', [name]);
  if (existing) return existing.id;
  return createSubject({ name, description: '', color: '#14b8a6' }).id;
}

export function listSubjects(): VaultSubject[] {
  return selectRows<SubjectRow>(`
    SELECT
      s.id,
      s.name,
      s.description,
      s.color,
      s.created_at,
      s.updated_at,
      COUNT(DISTINCT n.id) AS note_count,
      COUNT(DISTINCT r.id) AS resource_count
    FROM subjects s
    LEFT JOIN notes n ON n.subject_id = s.id
    LEFT JOIN resources r ON r.subject_id = s.id
    GROUP BY s.id
    ORDER BY s.updated_at DESC, s.id DESC
  `).map(toSubject);
}

export function createSubject(input: SubjectInput): VaultSubject {
  const name = input.name.trim();
  const description = input.description.trim();
  const color = input.color.trim() || '#14b8a6';

  if (!name) {
    throw new Error('Enter a subject name before adding it.');
  }

  const existing = selectOne<SubjectRow>('SELECT id, name, description, color, created_at, updated_at FROM subjects WHERE lower(name) = lower(?)', [
    name,
  ]);
  if (existing) {
    throw new Error(`A subject named "${name}" already exists.`);
  }

  const current = new Date().toISOString();
  runStatement(
    'INSERT INTO subjects (name, description, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [name, description, color, current, current],
  );
  persistDatabase();
  return toSubject(getSubjectById(lastInsertId()));
}

export function deleteSubject(id: number) {
  runStatement('UPDATE notes SET subject_id = NULL, updated_at = ? WHERE subject_id = ?', [new Date().toISOString(), id]);
  runStatement('UPDATE resources SET subject_id = NULL, updated_at = ? WHERE subject_id = ?', [new Date().toISOString(), id]);
  runStatement('DELETE FROM subjects WHERE id = ?', [id]);
  persistDatabase();
}

export function listNotes(subjectId?: number | null): VaultNote[] {
  const rows =
    typeof subjectId === 'number'
      ? selectRows<NoteRow>(
          'SELECT id, subject_id, title, content, created_at, updated_at FROM notes WHERE subject_id = ? ORDER BY updated_at DESC, id DESC',
          [subjectId],
        )
      : selectRows<NoteRow>('SELECT id, subject_id, title, content, created_at, updated_at FROM notes ORDER BY updated_at DESC, id DESC');
  return rows.map(toNote);
}

export function createNote(input: NoteInput): VaultNote {
  const current = new Date().toISOString();
  runStatement('INSERT INTO notes (subject_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
    input.subjectId,
    input.title.trim(),
    input.content,
    current,
    current,
  ]);
  touchSubject(input.subjectId);
  persistDatabase();
  return toNote(getNoteById(lastInsertId()));
}

export function updateNote(id: number, input: NoteInput): VaultNote {
  const current = new Date().toISOString();
  const previous = getNoteById(id);
  runStatement('UPDATE notes SET subject_id = ?, title = ?, content = ?, updated_at = ? WHERE id = ?', [
    input.subjectId,
    input.title.trim(),
    input.content,
    current,
    id,
  ]);
  touchSubject(previous.subject_id);
  touchSubject(input.subjectId);
  persistDatabase();
  return toNote(getNoteById(id));
}

export function deleteNote(id: number) {
  const note = getNoteById(id);
  runStatement('DELETE FROM notes WHERE id = ?', [id]);
  touchSubject(note.subject_id);
  persistDatabase();
}

export function listResources(subjectId?: number | null): VaultResource[] {
  const rows =
    typeof subjectId === 'number'
      ? selectRows<ResourceRow>(
          'SELECT id, subject_id, kind, title, location, created_at, updated_at FROM resources WHERE subject_id = ? ORDER BY created_at DESC, id DESC',
          [subjectId],
        )
      : selectRows<ResourceRow>('SELECT id, subject_id, kind, title, location, created_at, updated_at FROM resources ORDER BY created_at DESC, id DESC');
  return rows.map(toResource);
}

export function createResource(input: ResourceInput): VaultResource {
  const current = new Date().toISOString();
  runStatement('INSERT INTO resources (subject_id, kind, title, location, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
    input.subjectId,
    input.kind,
    input.title.trim(),
    input.location.trim(),
    current,
    current,
  ]);
  touchSubject(input.subjectId);
  persistDatabase();
  return toResource(getResourceById(lastInsertId()));
}

export function deleteResource(id: number) {
  const resource = getResourceById(id);
  runStatement('DELETE FROM resources WHERE id = ?', [id]);
  touchSubject(resource.subject_id);
  persistDatabase();
}

export function searchVault(query: string, subjectId?: number | null): VaultSearchResult {
  const like = `%${query.trim()}%`;
  if (!query.trim()) {
    return { notes: listNotes(subjectId), resources: listResources(subjectId) };
  }

  const subjectClause = typeof subjectId === 'number' ? ' AND subject_id = ?' : '';
  const params = typeof subjectId === 'number' ? [like, like, subjectId] : [like, like];
  const resourceParams = typeof subjectId === 'number' ? [like, like, subjectId] : [like, like];

  return {
    notes: selectRows<NoteRow>(
      `SELECT id, subject_id, title, content, created_at, updated_at FROM notes WHERE (title LIKE ? OR content LIKE ?)${subjectClause} ORDER BY updated_at DESC, id DESC`,
      params,
    ).map(toNote),
    resources: selectRows<ResourceRow>(
      `SELECT id, subject_id, kind, title, location, created_at, updated_at FROM resources WHERE (title LIKE ? OR location LIKE ?)${subjectClause} ORDER BY created_at DESC, id DESC`,
      resourceParams,
    ).map(toResource),
  };
}

function getTableColumns(tableName: string) {
  return selectRows<Record<string, unknown>>(`PRAGMA table_info(${tableName})`).map((row) => String(row.name));
}

function getSubjectById(id: number): SubjectRow {
  const row = selectOne<SubjectRow>(
    `SELECT
      s.id,
      s.name,
      s.description,
      s.color,
      s.created_at,
      s.updated_at,
      COUNT(DISTINCT n.id) AS note_count,
      COUNT(DISTINCT r.id) AS resource_count
    FROM subjects s
    LEFT JOIN notes n ON n.subject_id = s.id
    LEFT JOIN resources r ON r.subject_id = s.id
    WHERE s.id = ?
    GROUP BY s.id`,
    [id],
  );
  if (!row) throw new Error('Subject not found');
  return row;
}

function getNoteById(id: number): NoteRow {
  const row = selectOne<NoteRow>('SELECT id, subject_id, title, content, created_at, updated_at FROM notes WHERE id = ?', [id]);
  if (!row) throw new Error('Note not found');
  return row;
}

function getResourceById(id: number): ResourceRow {
  const row = selectOne<ResourceRow>('SELECT id, subject_id, kind, title, location, created_at, updated_at FROM resources WHERE id = ?', [id]);
  if (!row) throw new Error('Resource not found');
  return row;
}

function touchSubject(id: number | null | undefined) {
  if (typeof id !== 'number') return;
  runStatement('UPDATE subjects SET updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
}

function selectRows<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  const stmt = getDb().prepare(sql);
  if (params.length > 0) stmt.bind(params);

  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

function selectOne<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
  return selectRows<T>(sql, params)[0] ?? null;
}

function runStatement(sql: string, params: unknown[] = []) {
  const stmt = getDb().prepare(sql);
  stmt.run(params);
  stmt.free();
}

function lastInsertId() {
  return Number(selectOne<{ id: number }>('SELECT last_insert_rowid() AS id')?.id);
}

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function persistDatabase() {
  if (!db || !currentDbPath) return;
  fs.writeFileSync(currentDbPath, Buffer.from(db.export()));
}

function toSubject(row: SubjectRow): VaultSubject {
  return {
    id: Number(row.id),
    name: String(row.name),
    description: String(row.description ?? ''),
    color: String(row.color ?? '#14b8a6'),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    noteCount: Number(row.note_count ?? 0),
    resourceCount: Number(row.resource_count ?? 0),
  };
}

function toNote(row: NoteRow): VaultNote {
  return {
    id: Number(row.id),
    subjectId: row.subject_id === null || row.subject_id === undefined ? null : Number(row.subject_id),
    title: String(row.title),
    content: String(row.content),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toResource(row: ResourceRow): VaultResource {
  return {
    id: Number(row.id),
    subjectId: row.subject_id === null || row.subject_id === undefined ? null : Number(row.subject_id),
    kind: row.kind,
    title: String(row.title),
    location: String(row.location),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

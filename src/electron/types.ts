export type VaultSubject = {
  id: number;
  name: string;
  description: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  noteCount: number;
  resourceCount: number;
};

export type VaultNote = {
  id: number;
  subjectId: number | null;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type ResourceKind = 'pdf' | 'image' | 'video' | 'link';

export type VaultResource = {
  id: number;
  subjectId: number | null;
  kind: ResourceKind;
  title: string;
  location: string;
  createdAt: string;
  updatedAt: string;
};

export type SubjectInput = {
  name: string;
  description: string;
  color: string;
};

export type NoteInput = {
  subjectId: number | null;
  title: string;
  content: string;
};

export type ResourceInput = {
  subjectId: number | null;
  kind: ResourceKind;
  title: string;
  location: string;
};

export type ResourceUploadInput = {
  subjectId: number | null;
  kind: Exclude<ResourceKind, 'link'>;
};

export type VaultSearchResult = {
  notes: VaultNote[];
  resources: VaultResource[];
};

export type VaultAPI = {
  listSubjects: () => Promise<VaultSubject[]>;
  createSubject: (subject: SubjectInput) => Promise<VaultSubject>;
  deleteSubject: (id: number) => Promise<void>;
  listNotes: (subjectId?: number | null) => Promise<VaultNote[]>;
  createNote: (note: NoteInput) => Promise<VaultNote>;
  updateNote: (id: number, note: NoteInput) => Promise<VaultNote>;
  deleteNote: (id: number) => Promise<void>;
  listResources: (subjectId?: number | null) => Promise<VaultResource[]>;
  createLink: (resource: ResourceInput) => Promise<VaultResource>;
  uploadResource: (input: ResourceUploadInput) => Promise<VaultResource | null>;
  deleteResource: (id: number) => Promise<void>;
  openResource: (resource: VaultResource) => Promise<void>;
  searchVault: (query: string, subjectId?: number | null) => Promise<VaultSearchResult>;
};

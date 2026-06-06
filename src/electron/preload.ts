import { contextBridge, ipcRenderer } from 'electron';
import type { NoteInput, ResourceInput, ResourceUploadInput, SubjectInput, VaultAPI, VaultResource } from './types';

const api: VaultAPI = {
  listSubjects: () => ipcRenderer.invoke('subjects:list'),
  createSubject: (subject: SubjectInput) => ipcRenderer.invoke('subjects:create', subject),
  deleteSubject: (id: number) => ipcRenderer.invoke('subjects:delete', id),
  listNotes: (subjectId?: number | null) => ipcRenderer.invoke('notes:list', subjectId),
  createNote: (note: NoteInput) => ipcRenderer.invoke('notes:create', note),
  updateNote: (id: number, note: NoteInput) => ipcRenderer.invoke('notes:update', id, note),
  deleteNote: (id: number) => ipcRenderer.invoke('notes:delete', id),
  listResources: (subjectId?: number | null) => ipcRenderer.invoke('resources:list', subjectId),
  createLink: (resource: ResourceInput) => ipcRenderer.invoke('resources:create-link', resource),
  uploadResource: (input: ResourceUploadInput) => ipcRenderer.invoke('resources:upload', input),
  deleteResource: (id: number) => ipcRenderer.invoke('resources:delete', id),
  openResource: (resource: VaultResource) => ipcRenderer.invoke('resources:open', resource),
  searchVault: (query: string, subjectId?: number | null) => ipcRenderer.invoke('vault:search', query, subjectId),
};

contextBridge.exposeInMainWorld('vault', api);

declare global {
  interface Window {
    vault: VaultAPI;
  }
}

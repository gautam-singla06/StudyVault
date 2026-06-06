import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {
  createNote,
  createResource,
  createSubject,
  deleteNote,
  deleteResource,
  deleteSubject,
  initDatabase,
  listNotes,
  listResources,
  listSubjects,
  searchVault,
  updateNote,
} from './db';
import type { ResourceKind, VaultResource } from './types';

const preloadPath = path.join(__dirname, 'preload.js');
const shortcutName = 'StudyVault.lnk';

function createWindow() {
  const rendererPath = path.join(__dirname, '../dist/index.html');

  console.log('[StudyVault] createWindow called');
  console.log('[StudyVault] __dirname:', __dirname);
  console.log('[StudyVault] app.isPackaged:', app.isPackaged);
  console.log('[StudyVault] Renderer path:', rendererPath);
  console.log('[StudyVault] Renderer exists:', fs.existsSync(rendererPath));

  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: '#020617',
    title: 'StudyVault',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged) {
    win.loadURL('http://127.0.0.1:5173');
  } else {
    win.loadFile(rendererPath);
  }
}

app.whenReady().then(async () => {
  console.log('[StudyVault] app.whenReady fired');

  try {
    ensureDesktopShortcut();
  } catch (err) {
    console.error('[StudyVault] Desktop shortcut error (non-fatal):', err);
  }

  try {
    await initDatabase();
    console.log('[StudyVault] Database initialized');
  } catch (err) {
    console.error('[StudyVault] Database init error (non-fatal):', err);
  }

  ipcMain.handle('subjects:list', () => listSubjects());
  ipcMain.handle('subjects:create', (_event, subject) => {
    try {
      return createSubject(subject);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Subject could not be created.');
    }
  });
  ipcMain.handle('subjects:delete', (_event, id) => deleteSubject(id));
  ipcMain.handle('notes:list', (_event, subjectId) => listNotes(subjectId));
  ipcMain.handle('notes:create', (_event, note) => createNote(note));
  ipcMain.handle('notes:update', (_event, id, note) => updateNote(id, note));
  ipcMain.handle('notes:delete', (_event, id) => deleteNote(id));
  ipcMain.handle('resources:list', (_event, subjectId) => listResources(subjectId));
  ipcMain.handle('resources:create-link', (_event, resource) => createResource(resource));
  ipcMain.handle('resources:upload', async (_event, input: { subjectId: number | null; kind: Exclude<ResourceKind, 'link'> }) => {
    const filters = {
      pdf: [{ name: 'PDF Documents', extensions: ['pdf'] }],
      image: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
      video: [{ name: 'Videos', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v'] }],
    }[input.kind];

    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters,
    });

    if (result.canceled || result.filePaths.length === 0) return null;
    const sourcePath = result.filePaths[0];
    const location = copyUploadToVault(sourcePath);
    return createResource({
      subjectId: input.subjectId,
      kind: input.kind,
      title: path.basename(sourcePath),
      location,
    });
  });
  ipcMain.handle('resources:delete', (_event, id) => deleteResource(id));
  ipcMain.handle('resources:open', async (_event, resource: VaultResource) => {
    if (resource.kind === 'link') {
      await shell.openExternal(resource.location);
      return;
    }
    await shell.openPath(resource.location);
  });
  ipcMain.handle('vault:search', (_event, query, subjectId) => searchVault(query, subjectId));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function copyUploadToVault(sourcePath: string) {
  const uploadDir = path.join(app.getPath('userData'), 'uploads');
  fs.mkdirSync(uploadDir, { recursive: true });

  const parsed = path.parse(sourcePath);
  const safeName = parsed.name.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'resource';
  const targetPath = path.join(uploadDir, `${safeName}-${Date.now()}${parsed.ext}`);
  fs.copyFileSync(sourcePath, targetPath);
  return targetPath;
}

function ensureDesktopShortcut() {
  if (!app.isPackaged || process.platform !== 'win32') return;

  const shortcutPath = path.join(app.getPath('desktop'), shortcutName);
  if (fs.existsSync(shortcutPath)) return;

  const target = getPackagedExecutablePath();
  const created = shell.writeShortcutLink(shortcutPath, {
    target,
    cwd: path.dirname(target),
    description: 'StudyVault',
    icon: target,
    iconIndex: 0,
  });

  if (!created) {
    console.warn(`Unable to create desktop shortcut at ${shortcutPath}`);
  }
}

function getPackagedExecutablePath() {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

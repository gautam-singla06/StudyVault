import { useEffect, useMemo, useState } from 'react';
import type { NoteInput, ResourceKind, VaultNote, VaultResource, VaultSubject } from '../shared/types';

const subjectColors = ['#14b8a6', '#f59e0b', '#ef4444', '#84cc16', '#06b6d4', '#d946ef'];
const emptyNote = (subjectId: number | null): NoteInput => ({ subjectId, title: '', content: '' });

type ViewMode = 'notes' | 'resources';

export default function App() {
  const [subjects, setSubjects] = useState<VaultSubject[]>([]);
  const [notes, setNotes] = useState<VaultNote[]>([]);
  const [resources, setResources] = useState<VaultResource[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [draft, setDraft] = useState<NoteInput>(emptyNote(null));
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewMode>('notes');
  const [newSubject, setNewSubject] = useState({ name: '', description: '', color: subjectColors[0] });
  const [subjectError, setSubjectError] = useState('');
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const [linkDraft, setLinkDraft] = useState({ title: '', location: '' });

  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? null;

  async function refresh(subjectId = selectedSubjectId, search = query) {
    const allSubjects = await window.vault.listSubjects();
    setSubjects(allSubjects);

    if (search.trim()) {
      const results = await window.vault.searchVault(search, subjectId);
      setNotes(results.notes);
      setResources(results.resources);
      return;
    }

    const [nextNotes, nextResources] = await Promise.all([
      window.vault.listNotes(subjectId),
      window.vault.listResources(subjectId),
    ]);
    setNotes(nextNotes);
    setResources(nextResources);
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    refresh(selectedSubjectId, query);
  }, [selectedSubjectId, query]);

  useEffect(() => {
    if (selectedNote) {
      setDraft({
        subjectId: selectedNote.subjectId,
        title: selectedNote.title,
        content: selectedNote.content,
      });
    }
  }, [selectedNoteId]);

  const subjectNameById = useMemo(() => {
    return new Map(subjects.map((subject) => [subject.id, subject.name]));
  }, [subjects]);

  async function handleCreateSubject() {
    if (!newSubject.name.trim()) {
      setSubjectError('Enter a subject name before adding it.');
      return;
    }

    setSubjectError('');
    setIsCreatingSubject(true);

    try {
      const subject = await window.vault.createSubject(newSubject);
      setNewSubject({ name: '', description: '', color: subjectColors[0] });
      setSelectedSubjectId(subject.id);
      await refresh(subject.id);
    } catch (error) {
      setSubjectError(getErrorMessage(error, 'Subject could not be created.'));
    } finally {
      setIsCreatingSubject(false);
    }
  }

  async function handleDeleteSubject() {
    if (!selectedSubject) return;
    await window.vault.deleteSubject(selectedSubject.id);
    setSelectedSubjectId(null);
    setSelectedNoteId(null);
    setDraft(emptyNote(null));
    await refresh(null);
  }

  async function handleSaveNote() {
    if (!draft.title.trim()) return;
    const payload = { ...draft, subjectId: draft.subjectId ?? selectedSubjectId };
    const saved = selectedNote
      ? await window.vault.updateNote(selectedNote.id, payload)
      : await window.vault.createNote(payload);
    setSelectedNoteId(saved.id);
    await refresh(selectedSubjectId);
  }

  async function handleDeleteNote() {
    if (!selectedNote) return;
    await window.vault.deleteNote(selectedNote.id);
    setSelectedNoteId(null);
    setDraft(emptyNote(selectedSubjectId));
    await refresh(selectedSubjectId);
  }

  async function handleUpload(kind: Exclude<ResourceKind, 'link'>) {
    const uploaded = await window.vault.uploadResource({ subjectId: selectedSubjectId, kind });
    if (uploaded) await refresh(selectedSubjectId);
  }

  async function handleCreateLink() {
    if (!linkDraft.title.trim() || !linkDraft.location.trim()) return;
    await window.vault.createLink({
      subjectId: selectedSubjectId,
      kind: 'link',
      title: linkDraft.title,
      location: linkDraft.location,
    });
    setLinkDraft({ title: '', location: '' });
    await refresh(selectedSubjectId);
  }

  async function handleDeleteResource(id: number) {
    await window.vault.deleteResource(id);
    await refresh(selectedSubjectId);
  }

  return (
    <div className="min-h-screen bg-[#f6f2e8] text-stone-950">
      <div className="grid min-h-screen lg:grid-cols-[300px_1fr]">
        <aside className="border-r border-stone-300 bg-[#171612] p-5 text-stone-50">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.3em] text-teal-300">StudyVault</p>
            <h1 className="mt-2 text-2xl font-semibold">Library</h1>
          </div>

          <button
            onClick={() => {
              setSelectedSubjectId(null);
              setSelectedNoteId(null);
              setDraft(emptyNote(null));
            }}
            className={`mb-3 w-full rounded-lg px-3 py-3 text-left text-sm transition ${
              selectedSubjectId === null ? 'bg-stone-50 text-stone-950' : 'bg-white/5 text-stone-300 hover:bg-white/10'
            }`}
          >
            All subjects
          </button>

          <div className="space-y-2">
            {subjects.map((subject) => (
              <button
                key={subject.id}
                onClick={() => {
                  setSelectedSubjectId(subject.id);
                  setSelectedNoteId(null);
                  setDraft(emptyNote(subject.id));
                }}
                className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                  selectedSubjectId === subject.id
                    ? 'border-white/40 bg-white/15'
                    : 'border-white/10 bg-transparent hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} />
                  <span className="min-w-0 flex-1 truncate font-medium">{subject.name}</span>
                </div>
                <p className="mt-2 text-xs text-stone-400">
                  {subject.noteCount} notes · {subject.resourceCount} resources
                </p>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-3">
            <input
              value={newSubject.name}
              onChange={(event) => {
                setSubjectError('');
                setNewSubject((prev) => ({ ...prev, name: event.target.value }));
              }}
              placeholder="New subject"
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-stone-500 focus:border-teal-300"
            />
            <input
              value={newSubject.description}
              onChange={(event) => {
                setSubjectError('');
                setNewSubject((prev) => ({ ...prev, description: event.target.value }));
              }}
              placeholder="Description"
              className="mt-2 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-stone-500 focus:border-teal-300"
            />
            <div className="mt-3 flex items-center gap-2">
              {subjectColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewSubject((prev) => ({ ...prev, color }))}
                  className={`h-6 w-6 rounded-full border ${newSubject.color === color ? 'border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                  aria-label={`Use ${color}`}
                />
              ))}
            </div>
            {subjectError && <p className="mt-3 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{subjectError}</p>}
            <button
              onClick={handleCreateSubject}
              disabled={isCreatingSubject}
              className="mt-3 w-full rounded-md bg-teal-300 px-3 py-2 text-sm font-semibold text-stone-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingSubject ? 'Adding...' : 'Add subject'}
            </button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-col">
          <header className="border-b border-stone-300 bg-[#fbf8ef] px-6 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-sm text-stone-500">{selectedSubject ? selectedSubject.description || 'Subject workspace' : 'Newest study material first'}</p>
                <h2 className="mt-1 text-3xl font-semibold">{selectedSubject?.name ?? 'All study materials'}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setView('notes')}
                  className={`rounded-md px-4 py-2 text-sm font-medium ${view === 'notes' ? 'bg-stone-950 text-white' : 'border border-stone-300'}`}
                >
                  Notes
                </button>
                <button
                  onClick={() => setView('resources')}
                  className={`rounded-md px-4 py-2 text-sm font-medium ${view === 'resources' ? 'bg-stone-950 text-white' : 'border border-stone-300'}`}
                >
                  Resources
                </button>
                {selectedSubject && (
                  <button onClick={handleDeleteSubject} className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700">
                    Delete subject
                  </button>
                )}
              </div>
            </div>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notes, files, videos, PDFs, images, and links"
              className="mt-5 w-full rounded-lg border border-stone-300 bg-white px-4 py-3 outline-none focus:border-teal-500"
            />
          </header>

          {view === 'notes' ? (
            <section className="grid flex-1 gap-0 xl:grid-cols-[360px_1fr]">
              <div className="border-r border-stone-300 bg-[#eee7d8] p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold">Notes</h3>
                  <button
                    onClick={() => {
                      setSelectedNoteId(null);
                      setDraft(emptyNote(selectedSubjectId));
                    }}
                    className="rounded-md bg-stone-950 px-3 py-2 text-sm font-medium text-white"
                  >
                    New
                  </button>
                </div>
                <div className="space-y-2">
                  {notes.map((note) => (
                    <button
                      key={note.id}
                      onClick={() => setSelectedNoteId(note.id)}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        selectedNoteId === note.id ? 'border-teal-500 bg-white' : 'border-stone-300 bg-white/50 hover:bg-white'
                      }`}
                    >
                      <p className="truncate font-medium">{note.title}</p>
                      <p className="mt-1 truncate text-sm text-stone-500">{subjectNameById.get(note.subjectId ?? -1) ?? 'Unassigned'}</p>
                      <p className="mt-2 text-xs text-stone-500">{formatDate(note.updatedAt)}</p>
                    </button>
                  ))}
                  {notes.length === 0 && <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">No notes found.</p>}
                </div>
              </div>

              <div className="bg-[#fbf8ef] p-6">
                <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                  <input
                    value={draft.title}
                    onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Note title"
                    className="rounded-lg border border-stone-300 bg-white px-4 py-3 text-lg font-medium outline-none focus:border-teal-500"
                  />
                  <select
                    value={draft.subjectId ?? ''}
                    onChange={(event) => setDraft((prev) => ({ ...prev, subjectId: event.target.value ? Number(event.target.value) : null }))}
                    className="rounded-lg border border-stone-300 bg-white px-4 py-3 outline-none focus:border-teal-500"
                  >
                    <option value="">Unassigned</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={draft.content}
                  onChange={(event) => setDraft((prev) => ({ ...prev, content: event.target.value }))}
                  placeholder="Write notes, summaries, formulas, reading observations..."
                  className="mt-4 min-h-[420px] w-full resize-none rounded-lg border border-stone-300 bg-white px-4 py-3 leading-7 outline-none focus:border-teal-500"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={handleSaveNote} className="rounded-md bg-teal-600 px-4 py-2 font-medium text-white">
                    Save note
                  </button>
                  <button
                    onClick={handleDeleteNote}
                    disabled={!selectedNote}
                    className="rounded-md border border-red-300 px-4 py-2 font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <section className="flex-1 bg-[#fbf8ef] p-6">
              <div className="mb-5 flex flex-wrap gap-2">
                <button onClick={() => handleUpload('file')} className="rounded-md bg-stone-950 px-4 py-2 text-sm font-medium text-white">
                  Upload File
                </button>
                <button onClick={() => handleUpload('image')} className="rounded-md bg-stone-950 px-4 py-2 text-sm font-medium text-white">
                  Upload image
                </button>
                <button onClick={() => handleUpload('video')} className="rounded-md bg-stone-950 px-4 py-2 text-sm font-medium text-white">
                  Upload video
                </button>
              </div>

              <div className="mb-5 grid gap-3 rounded-lg border border-stone-300 bg-white p-4 md:grid-cols-[1fr_1fr_auto]">
                <input
                  value={linkDraft.title}
                  onChange={(event) => setLinkDraft((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Link title"
                  className="rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-teal-500"
                />
                <input
                  value={linkDraft.location}
                  onChange={(event) => setLinkDraft((prev) => ({ ...prev, location: event.target.value }))}
                  placeholder="https://example.com"
                  className="rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-teal-500"
                />
                <button onClick={handleCreateLink} className="rounded-md bg-teal-600 px-4 py-2 font-medium text-white">
                  Add link
                </button>
              </div>

              <div className="grid gap-3">
                {resources.map((resource) => (
                  <article key={resource.id} className="grid gap-3 rounded-lg border border-stone-300 bg-white p-4 md:grid-cols-[120px_1fr_auto] md:items-center">
                    <span className="w-fit rounded-md bg-[#eee7d8] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-stone-700">
                      {resource.kind}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{resource.title}</h3>
                      <p className="mt-1 truncate text-sm text-stone-500">{resource.location}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {subjectNameById.get(resource.subjectId ?? -1) ?? 'Unassigned'} · {formatDate(resource.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => window.vault.openResource(resource)} className="rounded-md bg-stone-950 px-3 py-2 text-sm font-medium text-white">
                        Open
                      </button>
                      <button onClick={() => handleDeleteResource(resource.id)} className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700">
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
                {resources.length === 0 && <p className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-stone-500">No resources found.</p>}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
  }
  return fallback;
}

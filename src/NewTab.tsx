/**
 * Duvo Dual — New Tab / Home Screen
 * Copyright © 2026 MavTiN. All rights reserved.
 * https://github.com/mavtin/Duvo-Dual
 */
import React, { useState, useCallback, useRef } from 'react';

import { Plus, Pencil, Trash2, X, Check, Globe, Play, Clock, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import type { HistoryEntry } from './App';

// ── Types ──────────────────────────────────────────────────────
export interface Bookmark {
  id: string;
  name: string;
  url: string;
}

interface Props {
  panelId: 'A' | 'B';
  panelLabel: string;
  onNavigate: (url: string) => void;
  history: HistoryEntry[];
  onDeleteHistory: (id: string) => void;
  onClearHistory: () => void;
}

// ── Helpers ────────────────────────────────────────────────────
const DEFAULT_BOOKMARKS: Bookmark[] = [
  { id: 'yt',      name: 'YouTube',  url: 'https://youtube.com'  },
  { id: 'netflix', name: 'Netflix',  url: 'https://netflix.com'  },
  { id: 'espn',    name: 'ESPN',     url: 'https://espn.com'     },
  { id: 'twitch',  name: 'Twitch',   url: 'https://twitch.tv'    },
];

const STORAGE_KEY = 'duvo-bookmarks';

function loadBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return DEFAULT_BOOKMARKS;
}

function saveBookmarks(bms: Bookmark[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bms));
}

function faviconUrl(url: string): string {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch { return ''; }
}

function uid() { return Math.random().toString(36).slice(2, 10); }

function timeAgo(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Modal ──────────────────────────────────────────────────────
interface ModalProps {
  initial?: Partial<Bookmark>;
  onSave: (bm: Bookmark) => void;
  onClose: () => void;
}

const BookmarkModal: React.FC<ModalProps> = ({ initial, onSave, onClose }) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [url,  setUrl]  = useState(initial?.url  ?? '');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = url.trim().startsWith('http') ? url.trim() : 'https://' + url.trim();
    if (!cleaned || !name.trim()) return;
    onSave({ id: initial?.id ?? uid(), name: name.trim(), url: cleaned });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{initial?.id ? 'Edit Bookmark' : 'Add Bookmark'}</span>
          <button className="modal-close" onClick={onClose}><X size={14} /></button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          <label className="modal-label">Name</label>
          <input className="modal-input" type="text" placeholder="e.g. Prime Video"
            value={name} onChange={e => setName(e.target.value)} autoFocus required />
          <label className="modal-label">URL</label>
          <input className="modal-input" type="text" placeholder="e.g. primevideo.com"
            value={url} onChange={e => setUrl(e.target.value)} required />
          <button className="modal-submit" type="submit">
            <Check size={14} /> Save Bookmark
          </button>
        </form>
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────
const NewTab: React.FC<Props> = ({ panelId, panelLabel, onNavigate, history, onDeleteHistory, onClearHistory }) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(loadBookmarks);
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; bm?: Bookmark } | null>(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [faviconErrors, setFaviconErrors] = useState<Set<string>>(new Set());
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // ── Drag state ──────────────────────────────────────────────
  const dragId  = useRef<string | null>(null);
  const overId  = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overDropId, setOverDropId] = useState<string | null>(null);

  const onDragStart = (id: string) => {
    dragId.current = id;
    setDraggingId(id);
  };

  const onDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== overId.current) {
      overId.current = id;
      setOverDropId(id);
    }
  };

  // onDrop on the TARGET card — this is where the reorder actually happens.
  // Without this, Electron treats the drop as cancelled and onDragEnd
  // fires before overId is reliably set.
  const onDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = dragId.current;
    if (!sourceId || sourceId === targetId) return;
    setBookmarks(prev => {
      const next = [...prev];
      const fromIdx = next.findIndex(b => b.id === sourceId);
      const toIdx   = next.findIndex(b => b.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      saveBookmarks(next);
      return next;
    });
    dragId.current = null;
    overId.current = null;
    setDraggingId(null);
    setOverDropId(null);
  };

  // onDragEnd fires on the SOURCE card — only used for cleanup now
  const onDragEnd = () => {
    dragId.current = null;
    overId.current = null;
    setDraggingId(null);
    setOverDropId(null);
  };

  // ── Bookmark actions ────────────────────────────────────────
  const handleStreamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = streamUrl.trim();
    if (!raw) return;
    // Pass raw input — App.tsx's normalizeUrl() will detect URL vs Google search
    onNavigate(raw);
  };

  const openAdd  = () => setModal({ mode: 'add' });
  const openEdit = (bm: Bookmark) => setModal({ mode: 'edit', bm });
  const closeModal = () => setModal(null);

  const saveModal = (bm: Bookmark) => {
    const next = modal?.mode === 'edit'
      ? bookmarks.map(b => b.id === bm.id ? bm : b)
      : [...bookmarks, bm];
    setBookmarks(next);
    saveBookmarks(next);
    closeModal();
  };

  const remove = (id: string) => {
    const next = bookmarks.filter(b => b.id !== id);
    setBookmarks(next);
    saveBookmarks(next);
  };

  const onFaviconError = useCallback((id: string) => {
    setFaviconErrors(prev => new Set(prev).add(id));
  }, []);

  const handleClearHistory = () => {
    if (confirmClear) { onClearHistory(); setConfirmClear(false); }
    else { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3000); }
  };

  const HISTORY_PREVIEW = 8;
  const shownHistory = historyExpanded ? history.slice(0, HISTORY_PREVIEW) : [];

  return (
    <div className="newtab">
      {/* Stream URL hero */}
      <section className="nt-hero">
        <p className="nt-eyebrow">{panelLabel}</p>
        <h2 className="nt-heading">Where do you want to watch?</h2>
        <form className="nt-stream-form" onSubmit={handleStreamSubmit}>
          <div className="nt-stream-input-wrap">
            <Globe size={15} className="nt-stream-icon" />
            <input
              className="nt-stream-input"
              type="text"
              value={streamUrl}
              onChange={e => setStreamUrl(e.target.value)}
              placeholder="Paste any stream URL or search…"
              spellCheck={false}
            />
          </div>
          <button className="nt-stream-btn" type="submit" title="Load stream">
            <Play size={15} />
          </button>
        </form>
      </section>

      {/* Bookmarks */}
      <section className="nt-bookmarks">
        <div className="nt-bookmarks-header">
          <span className="nt-section-label">Bookmarks</span>
          <button className="nt-add-btn" onClick={openAdd}>
            <Plus size={13} /> Add
          </button>
        </div>

        <div className="nt-grid">
          {bookmarks.map(bm => (
            <BookmarkCard
              key={bm.id}
              bm={bm}
              isDragging={draggingId === bm.id}
              isDropTarget={overDropId === bm.id && draggingId !== bm.id}
              faviconError={faviconErrors.has(bm.id)}
              onFaviconError={onFaviconError}
              onOpen={() => { if (!draggingId) onNavigate(bm.url); }}
              onEdit={() => openEdit(bm)}
              onRemove={() => remove(bm.id)}
              onDragStart={() => onDragStart(bm.id)}
              onDragOver={e => onDragOver(e, bm.id)}
              onDrop={e => onDrop(e, bm.id)}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      </section>

      {/* History */}
      <section className="nt-history">
        <div className="nt-bookmarks-header">
          <div className="nt-history-title-row" onClick={() => setHistoryExpanded(e => !e)}>
            <Clock size={11} className="nt-history-icon" />
            <span className="nt-section-label">Recent</span>
            {historyExpanded
              ? <ChevronUp size={12} className="nt-chevron" />
              : <ChevronDown size={12} className="nt-chevron" />}
          </div>
          {history.length > 0 && (
            <button
              className={`nt-clear-btn${confirmClear ? ' nt-clear-btn--confirm' : ''}`}
              onClick={handleClearHistory}
            >
              {confirmClear ? 'Confirm clear' : 'Clear all'}
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="nt-history-empty">No history yet. Start browsing!</p>
        ) : historyExpanded ? (
          <ul className="nt-history-list">
            {shownHistory.map(entry => (
              <HistoryRow
                key={entry.id}
                entry={entry}
                onOpen={() => onNavigate(entry.url)}
                onDelete={() => onDeleteHistory(entry.id)}
              />
            ))}
            {history.length > HISTORY_PREVIEW && (
              <p className="nt-history-more">+ {history.length - HISTORY_PREVIEW} more entries</p>
            )}
          </ul>
        ) : null}
      </section>

      {modal && (
        <BookmarkModal initial={modal.bm} onSave={saveModal} onClose={closeModal} />
      )}
    </div>
  );
};

// ── Bookmark card ──────────────────────────────────────────────
interface CardProps {
  bm: Bookmark;
  isDragging: boolean;
  isDropTarget: boolean;
  faviconError: boolean;
  onFaviconError: (id: string) => void;
  onOpen: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

const BookmarkCard: React.FC<CardProps> = ({
  bm, isDragging, isDropTarget, faviconError,
  onFaviconError, onOpen, onEdit, onRemove,
  onDragStart, onDragOver, onDrop, onDragEnd,
}) => {
  return (
    <div
      className={`bm-card${isDragging ? ' bm-card--dragging' : ''}${isDropTarget ? ' bm-card--droptarget' : ''}`}
      draggable
      onClick={onOpen}
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* Drag handle */}
      <div className="bm-drag-handle" onClick={e => e.stopPropagation()} title="Drag to reorder">
        <GripVertical size={12} />
      </div>

      <div className="bm-favicon-wrap">
        {faviconError ? (
          <Globe size={22} className="bm-favicon-fallback" />
        ) : (
          <img
            className="bm-favicon"
            src={faviconUrl(bm.url)}
            alt=""
            onError={() => onFaviconError(bm.id)}
            draggable={false}
          />
        )}
      </div>
      <span className="bm-name">{bm.name}</span>
      <div className="bm-actions" onClick={e => e.stopPropagation()}>
        <button className="bm-action-btn" onClick={onEdit} title="Edit">
          <Pencil size={11} />
        </button>
        <button className="bm-action-btn bm-action-btn--danger" onClick={onRemove} title="Remove">
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
};

// ── History row ────────────────────────────────────────────────
interface HistoryRowProps {
  entry: HistoryEntry;
  onOpen: () => void;
  onDelete: () => void;
}

const HistoryRow: React.FC<HistoryRowProps> = ({ entry, onOpen, onDelete }) => {
  const [imgError, setImgError] = useState(false);
  return (
    <li className="hist-row" onClick={onOpen}>
      <div className="hist-favicon-wrap">
        {imgError ? (
          <Globe size={13} className="hist-favicon-fallback" />
        ) : (
          <img className="hist-favicon" src={faviconUrl(entry.url)} alt=""
            onError={() => setImgError(true)} draggable={false} />
        )}
      </div>
      <div className="hist-info">
        <span className="hist-host">{entry.host}</span>
        <span className="hist-url">{entry.url}</span>
      </div>
      <span className="hist-time">{timeAgo(entry.timestamp)}</span>
      <button className="hist-delete" onClick={e => { e.stopPropagation(); onDelete(); }} title="Remove">
        <X size={11} />
      </button>
    </li>
  );
};

export default NewTab;

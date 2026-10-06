import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  RefreshCw,
  Trash2,
  Check,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ArrowRight,
  Database,
  Layers,
} from 'lucide-react';
import { api } from '../../api/client.js';

export function SheetSyncModal({
  isOpen,
  onClose,
  contexts = [],
  projects = [],
  activeContextId,
  onSyncComplete,
}) {
  const [sources, setSources] = useState([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [activeTab, setActiveTab] = useState('connect'); // 'connect' | 'manage'

  // Form State
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [name, setName] = useState('');
  const [selectedContextId, setSelectedContextId] = useState(
    activeContextId || contexts[0]?.id || ''
  );
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // Preview & Mapping State
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [columnMapping, setColumnMapping] = useState({
    title: '',
    status: '',
    priority: '',
    dueDate: '',
    estimatedMinutes: '',
    waitingReason: '',
    description: '',
    assignee: '',
    assigneeFilter: 'King',
  });

  // Syncing State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (activeContextId) {
      setSelectedContextId(activeContextId);
    } else if (contexts.length > 0 && !selectedContextId) {
      setSelectedContextId(contexts[0].id);
    }
  }, [activeContextId, contexts]);

  // Load existing sheet sources when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSources();
      setErrorMsg(null);
      setSyncStatusMsg(null);
    }
  }, [isOpen]);

  const loadSources = async () => {
    setIsLoadingSources(true);
    try {
      const res = await api.get('/sheets/sources');
      setSources(res.data.sources || []);
    } catch (err) {
      console.error('Failed to load sheet sources:', err);
    } finally {
      setIsLoadingSources(false);
    }
  };

  if (!isOpen) return null;

  // Auto-detect column headers based on common names
  const autoDetectColumns = (headers) => {
    const findHeader = (patterns) => {
      return (
        headers.find((h) =>
          patterns.some((p) => h.toLowerCase().includes(p.toLowerCase()))
        ) || ''
      );
    };

    setColumnMapping((prev) => ({
      title: findHeader(['task', 'title', 'name', 'action', 'item']),
      status: findHeader(['status', 'state', 'stage']),
      priority: findHeader(['priority', 'prio', 'urgency', 'level']),
      dueDate: findHeader(['due', 'deadline', 'date', 'target']),
      estimatedMinutes: findHeader(['estimate', 'duration', 'minutes', 'hours', 'time']),
      waitingReason: findHeader(['blocker', 'waiting', 'blocked', 'reviewer']),
      description: findHeader(['desc', 'notes', 'detail', 'summary']),
      assignee: findHeader(['assignee', 'assigned', 'owner', 'who', 'person', 'lead', 'member']),
      assigneeFilter: prev.assigneeFilter || 'King',
    }));
  };

  const handlePreview = async () => {
    if (!spreadsheetUrl.trim()) {
      setErrorMsg('Please enter a valid Google Sheet URL.');
      return;
    }
    setErrorMsg(null);
    setIsPreviewing(true);
    try {
      const res = await api.post('/sheets/preview', {
        spreadsheetUrl: spreadsheetUrl.trim(),
      });
      setPreviewData(res.data);
      autoDetectColumns(res.data.headers || []);
      if (!name) {
        setName(`Sheet Sync (${res.data.headers.length} cols)`);
      }
    } catch (err) {
      console.error('Sheet preview failed:', err);
      setErrorMsg(
        err.response?.data?.error ||
          'Could not access Google Sheet. Please check the URL or ensure link sharing allows view access.'
      );
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSaveAndSync = async () => {
    if (!spreadsheetUrl.trim() || !name.trim() || !selectedContextId) {
      setErrorMsg('Please provide a name, sheet URL, and select a context.');
      return;
    }

    if (!columnMapping.title) {
      setErrorMsg('Please select at least a Task Title column.');
      return;
    }

    setErrorMsg(null);
    setIsSyncing(true);
    setSyncStatusMsg('Connecting and syncing tasks from sheet...');

    try {
      // 1. Create or register sheet source
      const createRes = await api.post('/sheets/sources', {
        contextId: selectedContextId,
        projectId: selectedProjectId || null,
        name: name.trim(),
        spreadsheetUrl: spreadsheetUrl.trim(),
        columnMapping,
        autoSync: true,
      });

      const sourceId = createRes.data.source.id;

      // 2. Trigger initial ingestion sync
      const syncRes = await api.post(`/sheets/sources/${sourceId}/sync`);

      setSyncStatusMsg(
        `🎉 Successfully ingested ${syncRes.data.ingestedCount} task(s)!`
      );
      await loadSources();

      if (onSyncComplete) {
        onSyncComplete(syncRes.data);
      }

      // Reset form after short delay
      setTimeout(() => {
        setPreviewData(null);
        setSpreadsheetUrl('');
        setName('');
        setActiveTab('manage');
        setSyncStatusMsg(null);
      }, 1500);
    } catch (err) {
      console.error('Failed to register and sync sheet:', err);
      setErrorMsg(
        err.response?.data?.error || 'Failed to ingest tasks from sheet.'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncSource = async (sourceId) => {
    setIsSyncing(true);
    setErrorMsg(null);
    setSyncStatusMsg('Syncing latest updates...');
    try {
      const res = await api.post(`/sheets/sources/${sourceId}/sync`);
      setSyncStatusMsg(`Ingested ${res.data.ingestedCount} task(s)!`);
      await loadSources();
      if (onSyncComplete) onSyncComplete(res.data);
      setTimeout(() => setSyncStatusMsg(null), 3000);
    } catch (err) {
      console.error('Sync failed:', err);
      setErrorMsg('Failed to sync sheet source.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteSource = async (sourceId) => {
    if (!window.confirm('Remove this sheet source? Existing ingested tasks will remain.')) return;
    try {
      await api.delete(`/sheets/sources/${sourceId}`);
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
    } catch (err) {
      console.error('Delete failed:', err);
      setErrorMsg('Failed to delete sheet source.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100">
                Google Sheets Ingestion
              </h2>
              <p className="text-[11px] text-neutral-400">
                Sync tasks from view-only or shared spreadsheets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-neutral-800 px-5 pt-2">
          <button
            onClick={() => setActiveTab('connect')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'connect'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-300'
            }`}
          >
            Connect New Sheet
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'manage'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-300'
            }`}
          >
            <span>Connected Sheets</span>
            {sources.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-neutral-800 text-neutral-300 font-mono">
                {sources.length}
              </span>
            )}
          </button>
        </div>

        {/* Status & Error Feedbacks */}
        <div className="px-5 pt-3">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {syncStatusMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
              <span>{syncStatusMsg}</span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 no-scrollbar">
          {activeTab === 'connect' ? (
            <div className="space-y-4">
              {/* Sheet URL Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">
                  Google Sheet URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                    value={spreadsheetUrl}
                    onChange={(e) => setSpreadsheetUrl(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={isPreviewing || !spreadsheetUrl}
                    className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                  >
                    {isPreviewing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5" />
                    )}
                    <span>Preview</span>
                  </button>
                </div>
                <p className="text-[10px] text-neutral-500">
                  Works with view-only links, personal sheets, and external sprint trackers.
                </p>
              </div>

              {/* Source Name & Context Target */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">
                    Source Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Job A Backlog"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">
                    Target Workspace/Context
                  </label>
                  <select
                    value={selectedContextId}
                    onChange={(e) => setSelectedContextId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                  >
                    {contexts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Previewed Columns & Mapping */}
              {previewData && (
                <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-800/60 pb-2">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5" />
                      Detected {previewData.headers.length} Columns ({previewData.totalRows} rows)
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      Sheet ID: {previewData.spreadsheetId.slice(0, 8)}...
                    </span>
                  </div>

                  <p className="text-[11px] text-neutral-400">
                    Map sheet columns to task attributes:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Task Title */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-neutral-300 font-medium">
                        Task Title <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={columnMapping.title}
                        onChange={(e) =>
                          setColumnMapping((prev) => ({ ...prev, title: e.target.value }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-200"
                      >
                        <option value="">-- Select Column --</option>
                        {previewData.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Status */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-neutral-300 font-medium">
                        Status / Stage
                      </label>
                      <select
                        value={columnMapping.status}
                        onChange={(e) =>
                          setColumnMapping((prev) => ({ ...prev, status: e.target.value }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-200"
                      >
                        <option value="">-- Optional --</option>
                        {previewData.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Waiting Reason / Blocker */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-neutral-300 font-medium">
                        Waiting / Blocker Reason
                      </label>
                      <select
                        value={columnMapping.waitingReason}
                        onChange={(e) =>
                          setColumnMapping((prev) => ({
                            ...prev,
                            waitingReason: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-200"
                      >
                        <option value="">-- Optional --</option>
                        {previewData.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Due Date */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-neutral-300 font-medium">
                        Due Date
                      </label>
                      <select
                        value={columnMapping.dueDate}
                        onChange={(e) =>
                          setColumnMapping((prev) => ({ ...prev, dueDate: e.target.value }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-200"
                      >
                        <option value="">-- Optional --</option>
                        {previewData.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Priority */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-neutral-300 font-medium">
                        Priority
                      </label>
                      <select
                        value={columnMapping.priority}
                        onChange={(e) =>
                          setColumnMapping((prev) => ({ ...prev, priority: e.target.value }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-200"
                      >
                        <option value="">-- Optional --</option>
                        {previewData.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Estimate */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-neutral-300 font-medium">
                        Estimate (Minutes)
                      </label>
                      <select
                        value={columnMapping.estimatedMinutes}
                        onChange={(e) =>
                          setColumnMapping((prev) => ({
                            ...prev,
                            estimatedMinutes: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-200"
                      >
                        <option value="">-- Optional --</option>
                        {previewData.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Assignee / Owner Column */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-neutral-300 font-medium">
                        Assignee / Owner Column
                      </label>
                      <select
                        value={columnMapping.assignee}
                        onChange={(e) =>
                          setColumnMapping((prev) => ({
                            ...prev,
                            assignee: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-200"
                      >
                        <option value="">-- Optional (Import All) --</option>
                        {previewData.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Filter for Assignee (e.g. King) */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-neutral-300 font-medium flex items-center justify-between">
                        <span>Only Ingest Tasks Assigned To:</span>
                        <span className="text-[10px] text-emerald-400 font-mono">Filter</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. King"
                        value={columnMapping.assigneeFilter}
                        onChange={(e) =>
                          setColumnMapping((prev) => ({
                            ...prev,
                            assigneeFilter: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Sample rows snippet */}
                  {previewData.sampleRows && previewData.sampleRows.length > 0 && (
                    <div className="pt-2 border-t border-neutral-800/60">
                      <span className="text-[10px] text-neutral-500 font-medium">
                        Sample Ingested Rows:
                      </span>
                      <div className="mt-1 max-h-24 overflow-y-auto rounded bg-neutral-900/80 p-2 text-[10px] text-neutral-400 font-mono space-y-1">
                        {previewData.sampleRows.map((row, i) => (
                          <div key={i} className="truncate">
                            • {columnMapping.title ? row[columnMapping.title] : Object.values(row)[0]}
                            {columnMapping.status ? ` [${row[columnMapping.status]}]` : ''}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={handleSaveAndSync}
                disabled={isSyncing || !previewData || !columnMapping.title}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-neutral-950 font-bold text-xs shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSyncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Save & Ingest Tasks Now</span>
              </button>
            </div>
          ) : (
            /* Tab 2: Manage Connected Sheets */
            <div className="space-y-3">
              {isLoadingSources ? (
                <div className="text-center py-8 text-neutral-500 text-xs">
                  Loading connected sheets...
                </div>
              ) : sources.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <FileSpreadsheet className="w-8 h-8 text-neutral-600 mx-auto" />
                  <p className="text-xs text-neutral-400">
                    No Google Sheets connected yet.
                  </p>
                  <button
                    onClick={() => setActiveTab('connect')}
                    className="text-xs text-emerald-400 hover:underline"
                  >
                    Connect your first spreadsheet
                  </button>
                </div>
              ) : (
                sources.map((src) => (
                  <div
                    key={src.id}
                    className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800/80 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: src.context?.color || '#10b981' }}
                        />
                        <span className="text-xs font-bold text-neutral-200">
                          {src.name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400">
                          {src.context?.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleSyncSource(src.id)}
                          disabled={isSyncing}
                          className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-emerald-400 transition-colors cursor-pointer"
                          title="Sync tasks now"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${
                              isSyncing ? 'animate-spin' : ''
                            }`}
                          />
                        </button>
                        <button
                          onClick={() => handleDeleteSource(src.id)}
                          className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Remove source"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] text-neutral-400 flex items-center justify-between">
                      <span>Last sync: {src.lastSyncedAt ? new Date(src.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}</span>
                      <span className="font-mono text-emerald-400">{src.lastSyncCount || 0} tasks synced</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

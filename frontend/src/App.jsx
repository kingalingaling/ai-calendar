import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/layout/Header.jsx';
import { BottomNav } from './components/layout/BottomNav.jsx';
import { BrainDumpInput } from './components/input/BrainDumpInput.jsx';
import { DayTimeline } from './components/agenda/DayTimeline.jsx';
import { RolloverBanner } from './components/agenda/RolloverBanner.jsx';
import { MultiDayPreviewModal } from './components/modal/MultiDayPreviewModal.jsx';
import { ContextBar } from './components/contexts/ContextBar.jsx';
import { CreateContextModal } from './components/contexts/CreateContextModal.jsx';
import { TasksView } from './components/tasks/TasksView.jsx';
import { WaitingForView } from './components/waiting/WaitingForView.jsx';
import { SheetSyncModal } from './components/sheets/SheetSyncModal.jsx';
import { GamificationBar } from './components/gamification/GamificationBar.jsx';
import { GamificationModal } from './components/gamification/GamificationModal.jsx';
import { AutoBlockModal } from './components/scheduling/AutoBlockModal.jsx';
import { api } from './api/client.js';
import { DateTime } from 'luxon';

export function App() {
  const watNow = DateTime.now().setZone('Africa/Lagos');
  const todayStr = watNow.toFormat('yyyy-MM-dd');

  // Navigation & View state
  const [activeTab, setActiveTab] = useState('agenda'); // 'agenda' | 'tasks' | 'waiting' | 'schedule' | 'rollover'
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('day');

  // User auth state
  const [user, setUser] = useState(null);

  // Agenda events
  const [events, setEvents] = useState([]);
  const [isLoadingAgenda, setIsLoadingAgenda] = useState(true);

  // Phase 1 & 2: Contexts, Projects, Tasks & Sheet Modals
  const [contexts, setContexts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeContextId, setActiveContextId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [waitingTasks, setWaitingTasks] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);

  // Phase 3 & 4: Gamification & Auto-Blocking Modals
  const [gamificationProfile, setGamificationProfile] = useState(null);
  const [gamificationStamina, setGamificationStamina] = useState(null);
  const [isGamificationModalOpen, setIsGamificationModalOpen] = useState(false);
  const [isAutoBlockModalOpen, setIsAutoBlockModalOpen] = useState(false);

  // AI Scheduling & Preview modal state
  const [isParsing, setIsParsing] = useState(false);
  const [proposalData, setProposalData] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch current user auth status
  const checkAuth = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch (e) {
      console.warn('Failed to fetch auth status:', e);
    }
  }, []);

  // Fetch Gamification stats & Daily Stamina
  const fetchGamification = useCallback(async () => {
    try {
      const res = await api.get('/gamification/stats', {
        params: { date: selectedDate },
      });
      setGamificationProfile(res.data.profile);
      setGamificationStamina(res.data.stamina);
    } catch (e) {
      console.error('Failed to load gamification stats:', e);
    }
  }, [selectedDate]);

  // Fetch agenda events for selected date
  const fetchAgenda = useCallback(async () => {
    setIsLoadingAgenda(true);
    try {
      const res = await api.get('/agenda', {
        params: { date: selectedDate, view: viewMode },
      });
      setEvents(res.data.events || []);
    } catch (e) {
      console.error('Failed to load agenda:', e);
    } finally {
      setIsLoadingAgenda(false);
    }
  }, [selectedDate, viewMode]);

  // Fetch Contexts
  const fetchContexts = useCallback(async () => {
    try {
      const res = await api.get('/contexts');
      setContexts(res.data.contexts || []);
    } catch (e) {
      console.error('Failed to load contexts:', e);
    }
  }, []);

  // Fetch Projects
  const fetchProjects = useCallback(async () => {
    try {
      const params = activeContextId ? { contextId: activeContextId } : {};
      const res = await api.get('/projects', { params });
      setProjects(res.data.projects || []);
    } catch (e) {
      console.error('Failed to load projects:', e);
    }
  }, [activeContextId]);

  // Fetch Active Tasks (excluding waiting_for)
  const fetchTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    try {
      const params = { excludeWaiting: true };
      if (activeContextId) params.contextId = activeContextId;
      const res = await api.get('/tasks', { params });
      setTasks(res.data.tasks || []);
    } catch (e) {
      console.error('Failed to load tasks:', e);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [activeContextId]);

  // Fetch Waiting Tasks
  const fetchWaitingTasks = useCallback(async () => {
    try {
      const res = await api.get('/tasks', { params: { waitingOnly: true } });
      setWaitingTasks(res.data.tasks || []);
    } catch (e) {
      console.error('Failed to load waiting tasks:', e);
    }
  }, []);

  // Initial loads
  useEffect(() => {
    checkAuth();
    fetchContexts();
    fetchGamification();
  }, [checkAuth, fetchContexts, fetchGamification]);

  useEffect(() => {
    fetchProjects();
    fetchTasks();
    fetchWaitingTasks();
  }, [fetchProjects, fetchTasks, fetchWaitingTasks]);

  useEffect(() => {
    fetchAgenda();
    fetchGamification();
  }, [fetchAgenda, fetchGamification]);

  // Handle OAuth callback parameters (?auth=success or ?auth=failed)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get('auth');
    const reason = params.get('reason');
    const token = params.get('token');

    if (token) {
      localStorage.setItem('ai_calendar_token', token);
    }

    if (authStatus === 'success') {
      showToast('🎉 Google Calendar connected successfully!');
      checkAuth();
      fetchAgenda();
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authStatus === 'failed') {
      showToast(`Google Sign-In failed: ${reason || 'Access denied'}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [checkAuth, fetchAgenda]);

  // Google OAuth redirect
  const handleLogin = async () => {
    try {
      const res = await api.get('/auth/google/url');
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        showToast(res.data?.message || 'Google OAuth not configured in backend/.env yet.');
      }
    } catch (e) {
      showToast('Authentication initialization failed.');
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('ai_calendar_token');
      await api.post('/auth/logout');
      await checkAuth();
      await fetchAgenda();
      showToast('Logged out of Google Calendar.');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  // Toggle agenda event / task complete
  const handleToggleAgendaTask = async (id) => {
    const target = events.find((e) => e.id === id);
    if (!target) return;
    const nextStatus = !target.completed;

    // Optimistic UI update
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, completed: nextStatus } : e))
    );

    if (nextStatus && 'vibrate' in navigator) {
      navigator.vibrate(20);
    }

    try {
      const res = await api.patch(`/agenda/items/${id}/toggle`, { completed: nextStatus });
      fetchGamification();

      if (res.data?.gamification) {
        const g = res.data.gamification;
        showToast(`✨ Task completed! +${g.xpEarned} XP • 🔥 ${g.streakCount}d streak`);
      } else {
        showToast(nextStatus ? 'Task marked complete ✓' : 'Task marked pending');
      }
    } catch (e) {
      console.error('Failed to toggle task status:', e);
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, completed: !nextStatus } : e))
      );
      showToast('Failed to update task status.');
    }
  };

  // Tasks View Handlers
  const handleToggleTaskComplete = async (task) => {
    const isDone = task.status === 'done';
    const nextStatus = isDone ? 'todo' : 'done';

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );

    if (!isDone && 'vibrate' in navigator) {
      navigator.vibrate(20);
    }

    try {
      const res = await api.patch(`/tasks/${task.id}`, { status: nextStatus });
      fetchContexts();
      fetchGamification();

      if (res.data?.gamification) {
        const g = res.data.gamification;
        showToast(`✨ Quest complete! +${g.xpEarned} XP • 🔥 ${g.streakCount}d streak`);
      } else {
        showToast(nextStatus === 'done' ? 'Task completed ✓' : 'Task pending');
      }
    } catch (e) {
      console.error('Failed to update task status:', e);
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      );
      showToast('Failed to update task.');
    }
  };

  const handleMarkTaskWaiting = async (taskId, reason) => {
    try {
      await api.post(`/tasks/${taskId}/waiting`, { waitingReason: reason });
      showToast('Task moved to Waiting For list ⏳');
      fetchTasks();
      fetchWaitingTasks();
      fetchContexts();
    } catch (e) {
      console.error('Failed to mark task waiting:', e);
      showToast('Failed to mark task as waiting.');
    }
  };

  const handleUnblockTask = async (taskId) => {
    try {
      await api.post(`/tasks/${taskId}/unblock`);
      showToast('Approved! Moved back to active To-Do list 🎉');
      fetchTasks();
      fetchWaitingTasks();
      fetchContexts();
    } catch (e) {
      console.error('Failed to unblock task:', e);
      showToast('Failed to move task back.');
    }
  };

  const handleCreateTask = async (taskData) => {
    try {
      const res = await api.post('/tasks', taskData);
      showToast('Task created successfully');
      if (taskData.status === 'waiting_for') {
        fetchWaitingTasks();
      } else {
        fetchTasks();
      }
      fetchContexts();
      fetchGamification();
      return res.data;
    } catch (e) {
      console.error('Failed to create task:', e);
      showToast('Failed to create task.');
      throw e;
    }
  };

  const handleCreateContext = async (contextData) => {
    try {
      const res = await api.post('/contexts', contextData);
      showToast(`Context "${contextData.name}" created!`);
      fetchContexts();
      return res.data;
    } catch (e) {
      console.error('Failed to create context:', e);
      showToast('Failed to create context.');
      throw e;
    }
  };

  const handleCreateProject = async (projectData) => {
    try {
      const res = await api.post('/projects', projectData);
      showToast(`Project "${projectData.name}" created!`);
      fetchProjects();
      return res.data;
    } catch (e) {
      console.error('Failed to create project:', e);
      showToast('Failed to create project.');
      throw e;
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setWaitingTasks((prev) => prev.filter((t) => t.id !== taskId));
      fetchContexts();
      fetchGamification();
      showToast('Task deleted.');
    } catch (e) {
      console.error('Failed to delete task:', e);
      showToast('Failed to delete task.');
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      await api.patch(`/tasks/${taskId}`, updates);
      fetchTasks();
      fetchWaitingTasks();
      fetchGamification();
    } catch (e) {
      console.error('Failed to update task:', e);
      showToast('Failed to update task.');
    }
  };

  // Trigger AI parsing (Brain dump)
  const handleParseSchedule = async ({ prompt, targetDate, allowSpillover }) => {
    setIsParsing(true);
    try {
      const res = await api.post('/schedule/parse', {
        prompt,
        targetDate,
        allowSpillover,
      });

      setProposalData(res.data);
      setIsPreviewOpen(true);
    } catch (err) {
      console.error('Parsing failed:', err);
      showToast(
        err.response?.data?.message || 'Failed to analyze schedule. Please try again.'
      );
    } finally {
      setIsParsing(false);
    }
  };

  // Commit proposed schedule to Google Calendar
  const handleConfirmSchedule = async (eventsToCommit) => {
    setIsCommitting(true);
    try {
      const res = await api.post('/schedule/commit', { events: eventsToCommit });
      setIsPreviewOpen(false);
      setProposalData(null);
      await fetchAgenda();
      await fetchGamification();
      setActiveTab('agenda');
      showToast(`✨ Successfully added ${res.data.count} item(s) to your calendar!`);

      if ('vibrate' in navigator) {
        navigator.vibrate([15, 30, 15]);
      }
    } catch (err) {
      console.error('Commit failed:', err);
      showToast('Failed to save items to calendar.');
    } finally {
      setIsCommitting(false);
    }
  };

  // Delete an event or task from agenda
  const handleDeleteAgendaEvent = async (id) => {
    try {
      await api.delete(`/agenda/events/${id}`);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      fetchGamification();
      showToast('Item removed from calendar.');
    } catch (e) {
      console.error('Delete failed:', e);
      showToast('Failed to delete item.');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col antialiased">
      {/* Top Header */}
      <Header user={user} onLogin={handleLogin} onLogout={handleLogout} />

      {/* Main Scrollable Viewport */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4 pb-28">
        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 border border-emerald-500/50 text-emerald-300 text-xs font-medium px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md animate-fade-in flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Phase 4: RPG Gamification Bar & Daily Energy Gauge */}
        <GamificationBar
          profile={gamificationProfile}
          stamina={gamificationStamina}
          onOpenModal={() => setIsGamificationModalOpen(true)}
        />

        {/* Tab 1: Agenda */}
        {activeTab === 'agenda' && (
          <div className="space-y-4 animate-fade-in">
            <RolloverBanner onRolloverSuccess={fetchAgenda} />

            <DayTimeline
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              viewMode={viewMode}
              onChangeView={setViewMode}
              events={events}
              isLoading={isLoadingAgenda}
              onDeleteEvent={handleDeleteAgendaEvent}
              onToggleTask={handleToggleAgendaTask}
            />
          </div>
        )}

        {/* Tab 2: Tasks & Contexts */}
        {activeTab === 'tasks' && (
          <div className="space-y-4 animate-fade-in">
            {/* Horizontal Context Bar */}
            <ContextBar
              contexts={contexts}
              activeContextId={activeContextId}
              onSelectContext={setActiveContextId}
              onOpenCreateContext={() => setIsContextModalOpen(true)}
            />

            {/* Unified Tasks View */}
            <TasksView
              tasks={tasks}
              projects={projects}
              contexts={contexts}
              activeContextId={activeContextId}
              onToggleTaskComplete={handleToggleTaskComplete}
              onMarkTaskWaiting={handleMarkTaskWaiting}
              onDeleteTask={handleDeleteTask}
              onCreateTask={handleCreateTask}
              onCreateProject={handleCreateProject}
              onOpenSheetsSync={() => setIsSheetsModalOpen(true)}
              onOpenAutoBlock={() => setIsAutoBlockModalOpen(true)}
              isLoading={isLoadingTasks}
            />
          </div>
        )}

        {/* Tab 3: Dedicated Waiting For View */}
        {activeTab === 'waiting' && (
          <div className="space-y-4 animate-fade-in">
            <WaitingForView
              waitingTasks={waitingTasks}
              onUnblockTask={handleUnblockTask}
              onDeleteTask={handleDeleteTask}
              onUpdateTask={handleUpdateTask}
              isLoading={isLoadingTasks}
            />
          </div>
        )}

        {/* Tab 4: AI Schedule Brain Dump */}
        {activeTab === 'schedule' && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center space-y-1 py-1">
              <h2 className="text-lg font-bold text-neutral-100">
                Brain Dump to Schedule
              </h2>
              <p className="text-xs text-neutral-400">
                Dictate or type your schedule. Gemini automatically differentiates
                between meetings and checkable tasks, finds optimal slots, and overflows
                to Tomorrow if full.
              </p>
            </div>

            <BrainDumpInput
              onParseSchedule={handleParseSchedule}
              isSubmitting={isParsing}
            />
          </div>
        )}

        {/* Tab 5: Rollover Dedicated Screen */}
        {activeTab === 'rollover' && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center space-y-1 py-1">
              <h2 className="text-lg font-bold text-neutral-100">
                Task Rollover & Backlog
              </h2>
              <p className="text-xs text-neutral-400">
                Automatically allocate unfinished or deferred tasks into upcoming open
                calendar windows.
              </p>
            </div>

            <RolloverBanner onRolloverSuccess={fetchAgenda} />
          </div>
        )}
      </main>

      {/* Two-Phase Commit Preview Modal */}
      <MultiDayPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        proposalData={proposalData}
        onConfirmSchedule={handleConfirmSchedule}
        isCommitting={isCommitting}
      />

      {/* Create Context Modal */}
      <CreateContextModal
        isOpen={isContextModalOpen}
        onClose={() => setIsContextModalOpen(false)}
        onCreateContext={handleCreateContext}
      />

      {/* Google Sheets Ingestion Modal */}
      <SheetSyncModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        contexts={contexts}
        projects={projects}
        activeContextId={activeContextId}
        onSyncComplete={() => {
          fetchTasks();
          fetchWaitingTasks();
          fetchContexts();
          fetchGamification();
          showToast('Tasks synchronized from Google Sheet!');
        }}
      />

      {/* Gamification Modal (RPG Badges, Streaks, Energy & Themes) */}
      <GamificationModal
        isOpen={isGamificationModalOpen}
        onClose={() => setIsGamificationModalOpen(false)}
        profile={gamificationProfile}
        stamina={gamificationStamina}
        onThemeChanged={(newTheme) => {
          fetchGamification();
          showToast(`Theme changed to ${newTheme}!`);
        }}
      />

      {/* Auto-Block into Calendar Modal (Phase 3) */}
      <AutoBlockModal
        isOpen={isAutoBlockModalOpen}
        onClose={() => setIsAutoBlockModalOpen(false)}
        contexts={contexts}
        activeContextId={activeContextId}
        onCommitSuccess={(result) => {
          fetchAgenda();
          fetchTasks();
          fetchGamification();
          showToast(`⚡ Successfully scheduled ${result.count} tasks into calendar!`);
        }}
      />

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        waitingCount={waitingTasks.length}
      />
    </div>
  );
}

export default App;

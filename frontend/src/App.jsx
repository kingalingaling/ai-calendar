import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/layout/Header.jsx';
import { BottomNav } from './components/layout/BottomNav.jsx';
import { BrainDumpInput } from './components/input/BrainDumpInput.jsx';
import { DayTimeline } from './components/agenda/DayTimeline.jsx';
import { RolloverBanner } from './components/agenda/RolloverBanner.jsx';
import { MultiDayPreviewModal } from './components/modal/MultiDayPreviewModal.jsx';
import { api } from './api/client.js';
import { DateTime } from 'luxon';

export function App() {
  const watNow = DateTime.now().setZone('Africa/Lagos');
  const todayStr = watNow.toFormat('yyyy-MM-dd');

  // Navigation & View state
  const [activeTab, setActiveTab] = useState('agenda');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('day');

  // User auth state
  const [user, setUser] = useState(null);

  // Agenda events
  const [events, setEvents] = useState([]);
  const [isLoadingAgenda, setIsLoadingAgenda] = useState(true);

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

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    fetchAgenda();
  }, [fetchAgenda]);

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
      await api.post('/auth/logout');
      await checkAuth();
      await fetchAgenda();
      showToast('Logged out of Google Calendar.');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  // Trigger AI parsing
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
      showToast(err.response?.data?.message || 'Failed to analyze schedule. Please try again.');
    } finally {
      setIsParsing(false);
    }
  };

  // Commit proposed schedule to Google Calendar / demo store
  const handleConfirmSchedule = async (eventsToCommit) => {
    setIsCommitting(true);
    try {
      const res = await api.post('/schedule/commit', { events: eventsToCommit });
      setIsPreviewOpen(false);
      setProposalData(null);
      await fetchAgenda();
      setActiveTab('agenda');
      showToast(`✨ Successfully added ${res.data.count} event(s) to your calendar!`);

      // Trigger haptic feedback if mobile supported
      if ('vibrate' in navigator) {
        navigator.vibrate([15, 30, 15]);
      }
    } catch (err) {
      console.error('Commit failed:', err);
      showToast('Failed to save events to calendar.');
    } finally {
      setIsCommitting(false);
    }
  };

  // Delete an event
  const handleDeleteEvent = async (id) => {
    try {
      await api.delete(`/agenda/events/${id}`);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      showToast('Event removed from calendar.');
    } catch (e) {
      console.error('Delete failed:', e);
      showToast('Failed to delete event.');
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
              onDeleteEvent={handleDeleteEvent}
            />
          </div>
        )}

        {/* Tab 2: AI Schedule Brain Dump */}
        {activeTab === 'schedule' && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center space-y-1 py-1">
              <h2 className="text-lg font-bold text-neutral-100">Brain Dump to Schedule</h2>
              <p className="text-xs text-neutral-400">
                Dictate or type your tasks. Zero timestamps needed — Gemini automatically finds your optimal slots and overflows to Tomorrow if full.
              </p>
            </div>

            <BrainDumpInput
              onParseSchedule={handleParseSchedule}
              isSubmitting={isParsing}
            />
          </div>
        )}

        {/* Tab 3: Rollover Dedicated Screen */}
        {activeTab === 'rollover' && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center space-y-1 py-1">
              <h2 className="text-lg font-bold text-neutral-100">Task Rollover & Backlog</h2>
              <p className="text-xs text-neutral-400">
                Automatically allocate unfinished or deferred tasks into upcoming open calendar windows.
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

      {/* Mobile Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default App;

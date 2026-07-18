import React, { useState } from 'react';
import { Schedule, Content } from '../types.js';
import { Clock, Calendar, Trash2, PlusCircle, Sparkles, Edit2, Check, X } from 'lucide-react';

interface ScheduleGridProps {
  schedules: Schedule[];
  contents: Content[];
  isEditable?: boolean;
  onDeleteSchedule?: (id: string) => void;
  onAddSchedule?: (data: { contentId: string; dayOfWeek: number; startTime: string; endTime: string }) => void;
  onUpdateSchedule?: (id: string, data: { contentId?: string; dayOfWeek?: number; startTime?: string; endTime?: string; isActive?: boolean }) => void;
  onPreviewSchedule?: (sched: Schedule) => void;
  isAdminOrOwner?: boolean;
}

const DAYS_OF_WEEK = [
  'Domenica',
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato'
];

export default function ScheduleGrid({
  schedules,
  contents,
  isEditable = false,
  onDeleteSchedule,
  onAddSchedule,
  onUpdateSchedule,
  onPreviewSchedule,
  isAdminOrOwner = false
}: ScheduleGridProps) {
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  
  // State for adding a new schedule slot
  const [newContentId, setNewContentId] = useState('');
  const [newDay, setNewDay] = useState(selectedDay);
  const [newStart, setNewStart] = useState('08:00');
  const [newEnd, setNewEnd] = useState('09:00');
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');

  // State for editing an existing schedule slot
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContentId, setEditContentId] = useState('');
  const [editDay, setEditDay] = useState<number>(0);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editError, setEditError] = useState('');

  // Find contents related to the active schedules for selected day
  const dailySchedules = schedules
    .filter(s => s.dayOfWeek === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Check if a slot is currently "on air"
  const isCurrentlyOnAir = (sched: Schedule) => {
    const now = new Date();
    const currentDay = now.getDay();
    if (sched.dayOfWeek !== currentDay) return false;
    
    const currentHour = String(now.getHours()).padStart(2, '0');
    const currentMin = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHour}:${currentMin}`;
    return sched.startTime <= currentTimeStr && currentTimeStr < sched.endTime;
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newContentId) {
      setError('Seleziona un contenuto video');
      return;
    }

    if (newStart >= newEnd) {
      setError("L'ora di fine deve essere successiva all'ora di inizio");
      return;
    }

    // Check overlaps
    const overlaps = schedules.some(
      s =>
        s.dayOfWeek === Number(newDay) &&
        ((newStart >= s.startTime && newStart < s.endTime) ||
          (newEnd > s.startTime && newEnd <= s.endTime) ||
          (newStart <= s.startTime && newEnd >= s.endTime))
    );

    if (overlaps) {
      setError('Attenzione: questa fascia oraria si sovrappone a un altro programma esistente.');
      return;
    }

    if (onAddSchedule) {
      onAddSchedule({
        contentId: newContentId,
        dayOfWeek: Number(newDay),
        startTime: newStart,
        endTime: newEnd
      });
      setShowAddForm(false);
      setNewContentId('');
    }
  };

  const startEdit = (sched: Schedule) => {
    setEditingId(sched.id);
    setEditContentId(sched.contentId);
    setEditDay(sched.dayOfWeek);
    setEditStart(sched.startTime);
    setEditEnd(sched.endTime);
    setEditError('');
  };

  const handleSaveEdit = (id: string) => {
    setEditError('');

    if (!editContentId) {
      setEditError('Seleziona un contenuto video');
      return;
    }

    if (editStart >= editEnd) {
      setEditError("L'ora di fine deve essere successiva all'ora di inizio");
      return;
    }

    // Check overlaps (excluding the current one we are editing)
    const overlaps = schedules.some(
      s =>
        s.id !== id &&
        s.dayOfWeek === Number(editDay) &&
        ((editStart >= s.startTime && editStart < s.endTime) ||
          (editEnd > s.startTime && editEnd <= s.endTime) ||
          (editStart <= s.startTime && editEnd >= s.endTime))
    );

    if (overlaps) {
      setEditError('Fascia oraria sovrapposta a un altro programma.');
      return;
    }

    if (onUpdateSchedule) {
      onUpdateSchedule(id, {
        contentId: editContentId,
        dayOfWeek: Number(editDay),
        startTime: editStart,
        endTime: editEnd
      });
      setEditingId(null);
    }
  };

  return (
    <div className="w-full bg-[#111114] border border-slate-800 rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <Calendar className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-bold font-display text-white uppercase tracking-tight">Programmazione Settimanale</h3>
        </div>

        {isEditable && onAddSchedule && (
          <button
            onClick={() => {
              setNewDay(selectedDay);
              setShowAddForm(!showAddForm);
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md self-start uppercase tracking-wider"
          >
            <PlusCircle className="w-4 h-4" />
            Nuovo Slot Orario
          </button>
        )}
      </div>

      {/* Weekdays tabs selector */}
      <div className="flex overflow-x-auto gap-2 pb-3 mb-6 scrollbar-thin scrollbar-thumb-slate-800">
        {DAYS_OF_WEEK.map((day, idx) => (
          <button
            key={idx}
            onClick={() => {
              setSelectedDay(idx);
              setNewDay(idx);
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all uppercase tracking-wider ${
              selectedDay === idx
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/10'
                : 'bg-[#0A0A0B] text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {day}
            {new Date().getDay() === idx && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px] uppercase tracking-wider animate-pulse">
                Oggi
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Quick Add Schedule Form Modal/Accordion */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="bg-[#0E0E12] border border-slate-800 rounded-xl p-5 mb-6 text-left">
          <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-tight">Aggiungi Fascia Oraria</h4>
          
          {error && <p className="text-xs text-red-400 mb-4 font-medium">{error}</p>}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Giorno</label>
              <select
                value={newDay}
                onChange={e => setNewDay(Number(e.target.value))}
                className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {DAYS_OF_WEEK.map((day, idx) => (
                  <option key={idx} value={idx}>
                    {day}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Contenuto Video</label>
              <select
                value={newContentId}
                onChange={e => setNewContentId(e.target.value)}
                className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="">-- Seleziona un Video --</option>
                {contents.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.durationMinutes} min) {c.isVertical ? '[Vertical]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Inizio (HH:MM)</label>
              <input
                type="time"
                value={newStart}
                onChange={e => setNewStart(e.target.value)}
                className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Fine (HH:MM)</label>
              <input
                type="time"
                value={newEnd}
                onChange={e => setNewEnd(e.target.value)}
                className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 mt-5 border-t border-slate-800/60 pt-4">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3.5 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 uppercase tracking-wider"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
            >
              Conferma Slot
            </button>
          </div>
        </form>
      )}

      {/* Timetable List */}
      <div className="space-y-3 text-left">
        {dailySchedules.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-800 rounded-xl">
            <Clock className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-xs text-slate-500">Nessuna trasmissione programmata per {DAYS_OF_WEEK[selectedDay]}</p>
            {isEditable && (
              <p className="text-[11px] text-slate-600 mt-1">Clicca su "Nuovo Slot Orario" per iniziare ad aggiungere video.</p>
            )}
          </div>
        ) : (
          dailySchedules.map(sched => {
            const video = contents.find(c => c.id === sched.contentId);
            const onAir = isCurrentlyOnAir(sched);

            if (editingId === sched.id) {
              return (
                <div
                  key={sched.id}
                  className="p-4 rounded-xl border border-indigo-500/80 bg-[#0E0E12] flex flex-col gap-4 text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Modifica Fascia Oraria</span>
                    {editError && <span className="text-xs text-red-450 font-semibold">{editError}</span>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Giorno</label>
                      <select
                        value={editDay}
                        onChange={e => setEditDay(Number(e.target.value))}
                        className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                      >
                        {DAYS_OF_WEEK.map((day, idx) => (
                          <option key={idx} value={idx}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Video</label>
                      <select
                        value={editContentId}
                        onChange={e => setEditContentId(e.target.value)}
                        className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                      >
                        {contents.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.title} ({c.durationMinutes} min) {c.isVertical ? '[Vertical]' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Inizio</label>
                        <input
                          type="time"
                          value={editStart}
                          onChange={e => setEditStart(e.target.value)}
                          className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Fine</label>
                        <input
                          type="time"
                          value={editEnd}
                          onChange={e => setEditEnd(e.target.value)}
                          className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-slate-850 pt-3">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" /> Annulla
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(sched.id)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Salva
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={sched.id}
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border transition-all ${
                  onAir
                    ? 'bg-indigo-600/10 border-indigo-500/40 shadow-md ring-1 ring-indigo-500/20'
                    : 'bg-[#0E0E12] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-4.5 w-full sm:w-auto">
                  {/* Time Badge */}
                  {isAdminOrOwner && onPreviewSchedule ? (
                    <button
                      onClick={() => onPreviewSchedule(sched)}
                      className="flex flex-col justify-center items-center bg-[#0A0A0B] hover:bg-indigo-600/15 border border-slate-800 hover:border-indigo-500/50 rounded-lg p-2 min-w-[76px] cursor-pointer transition-all duration-200 group text-center"
                      title="Clicca per testare e caricare questo contenuto nel player"
                    >
                      <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500 group-hover:text-indigo-400 transition-colors flex items-center gap-0.5 justify-center">
                        <span className="group-hover:inline hidden">TEST ▶</span>
                        <span className="group-hover:hidden">ORARIO</span>
                      </span>
                      <span className="text-xs font-bold font-mono text-white mt-0.5 group-hover:text-indigo-300">
                        {sched.startTime} - {sched.endTime}
                      </span>
                    </button>
                  ) : (
                    <div className="flex flex-col justify-center items-center bg-[#0A0A0B] border border-slate-800 rounded-lg p-2 min-w-[76px] text-center">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold">ORARIO</span>
                      <span className="text-xs font-bold font-mono text-white mt-0.5">
                        {sched.startTime} - {sched.endTime}
                      </span>
                    </div>
                  )}

                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white truncate max-w-md">
                        {video?.title || 'Contenuto Rimosso'}
                      </h4>
                      {onAir && (
                        <span className="flex items-center gap-1 text-[9px] font-bold tracking-widest text-red-550 uppercase bg-red-500/15 border border-red-500/20 px-1.5 py-0.5 rounded-full animate-pulse">
                          <Sparkles className="w-2.5 h-2.5" />
                          IN ONDA ORA
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate max-w-sm mt-0.5">
                      {video?.description || 'Nessuna descrizione del contenuto disponibile.'}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] text-slate-500 font-mono">
                        Durata: {video?.durationMinutes || '??'} min
                      </span>
                      {video?.isVertical && (
                        <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded border">
                          Vertical Reel
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 sm:mt-0 self-end sm:self-auto">
                  {isEditable && onUpdateSchedule && (
                    <button
                      onClick={() => startEdit(sched)}
                      className="p-2 rounded-lg bg-[#0A0A0B] hover:bg-indigo-600/20 hover:text-indigo-400 text-slate-500 border border-slate-800 hover:border-indigo-500/30 transition-all cursor-pointer"
                      title="Modifica Orario/Giorno/Video"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isEditable && onDeleteSchedule && (
                    <button
                      onClick={() => onDeleteSchedule(sched.id)}
                      className="p-2 rounded-lg bg-[#0A0A0B] hover:bg-red-500/20 hover:text-red-400 text-slate-500 border border-slate-800 hover:border-red-500/30 transition-all cursor-pointer"
                      title="Rimuovi Slot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

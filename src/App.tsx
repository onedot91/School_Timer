import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Coffee, Utensils, CalendarClock, Timer, Settings, X, Plus, Trash2, Download, Upload, ChevronDown, Volume2, VolumeX } from 'lucide-react';

type TimerType = 'break' | 'lunch' | 'class' | 'morning' | 'none';
type Mode = 'schedule' | 'manual';

interface ScheduleSlot {
  id: string;
  name: string;
  type: TimerType;
  start: number; // minutes from 00:00
  end: number;
}

type WeeklySchedule = {
  [key: number]: ScheduleSlot[]; // 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri
};

const MORNING_ACTIVITY_LABEL = '\uC544\uCE68\uD65C\uB3D9';
const MORNING_DEFAULT_DURATION = 15;
const CLASS_DURATION = 40;
const BREAK_DURATION = 10;
const BACKGROUND_MUSIC_VOLUME = 0.24;
const WEEKDAYS = [1, 2, 3, 4, 5];

const createSlotId = () => Math.random().toString(36).slice(2, 11);

const getFixedDurationByType = (type: TimerType) => {
  if (type === 'class') return CLASS_DURATION;
  if (type === 'break') return BREAK_DURATION;
  return null;
};

const isMorningSlot = (slot: ScheduleSlot) => slot.type === 'morning' || slot.name === MORNING_ACTIVITY_LABEL;

const normalizeDaySchedule = (daySchedule: ScheduleSlot[]) => {
  const cloned = (daySchedule || []).map((slot) => ({ ...slot }));
  const morningSlots = cloned.filter(isMorningSlot);
  const morningSlot =
    morningSlots[0] || {
      id: createSlotId(),
      name: MORNING_ACTIVITY_LABEL,
      type: 'morning' as TimerType,
      start: 540 - MORNING_DEFAULT_DURATION,
      end: 540,
    };

  const others = cloned
    .filter((slot) => !isMorningSlot(slot))
    .map((slot) => {
      const fixedDuration = getFixedDurationByType(slot.type);
      if (fixedDuration !== null) {
        return { ...slot, end: slot.start + fixedDuration };
      }
      if (slot.end <= slot.start) {
        return { ...slot, end: slot.start + 1 };
      }
      return slot;
    })
    .sort((a, b) => a.start - b.start);

  const ordered = [
    {
      ...morningSlot,
      id: morningSlot.id || createSlotId(),
      name: MORNING_ACTIVITY_LABEL,
      type: 'morning' as TimerType,
    },
    ...others,
  ];

  const normalized: ScheduleSlot[] = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const slot = ordered[i];
    const fixedDuration = getFixedDurationByType(slot.type);
    const rawDuration = slot.end - slot.start;
    const fallbackDuration = rawDuration > 0 ? rawDuration : (slot.type === 'morning' ? MORNING_DEFAULT_DURATION : 1);
    const duration = Math.max(1, fixedDuration ?? fallbackDuration);

    const startFallback = slot.type === 'morning' ? 540 - MORNING_DEFAULT_DURATION : 540;
    const start = Math.max(0, Number.isFinite(slot.start) ? slot.start : startFallback);
    normalized.push({ ...slot, start, end: start + duration });
  }

  return normalized;
};

const normalizeWeeklySchedule = (schedule: WeeklySchedule): WeeklySchedule => {
  const normalized: WeeklySchedule = {};
  WEEKDAYS.forEach((day) => {
    const daySchedule = Array.isArray(schedule?.[day]) ? schedule[day] : [];
    normalized[day] = normalizeDaySchedule(daySchedule);
  });
  return normalized;
};
const defaultDailySchedule: ScheduleSlot[] = [
  { id: 'm0', name: MORNING_ACTIVITY_LABEL, type: 'morning', start: 525, end: 540 },
  { id: '1', name: '1교시', type: 'class', start: 540, end: 580 },
  { id: '2', name: '쉬는 시간', type: 'break', start: 580, end: 590 },
  { id: '3', name: '2교시', type: 'class', start: 590, end: 630 },
  { id: '4', name: '쉬는 시간', type: 'break', start: 630, end: 640 },
  { id: '5', name: '3교시', type: 'class', start: 640, end: 680 },
  { id: '6', name: '쉬는 시간', type: 'break', start: 680, end: 690 },
  { id: '7', name: '4교시', type: 'class', start: 690, end: 730 },
  { id: '8', name: '점심시간', type: 'lunch', start: 730, end: 780 },
  { id: '9', name: '5교시', type: 'class', start: 780, end: 820 },
  { id: '10', name: '쉬는 시간', type: 'break', start: 820, end: 830 },
  { id: '11', name: '6교시', type: 'class', start: 830, end: 870 },
];

const defaultWeeklySchedule: WeeklySchedule = normalizeWeeklySchedule({
  1: defaultDailySchedule.map((slot) => ({ ...slot, id: createSlotId() })),
  2: defaultDailySchedule.map((slot) => ({ ...slot, id: createSlotId() })),
  3: defaultDailySchedule.map((slot) => ({ ...slot, id: createSlotId() })),
  4: defaultDailySchedule.map((slot) => ({ ...slot, id: createSlotId() })),
  5: defaultDailySchedule.map((slot) => ({ ...slot, id: createSlotId() })),
});
const DAYS = ['\uC77C', '\uC6D4', '\uD654', '\uC218', '\uBAA9', '\uAE08', '\uD1A0'];

const playAlarm = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gain.gain.setValueAtTime(0.3, startTime + duration - 0.1);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // Westminster Quarters (School Bell Style)
    playTone(659.25, now, 0.5);
    playTone(523.25, now + 0.5, 0.5);
    playTone(587.33, now + 1.0, 0.5);
    playTone(392.00, now + 1.5, 1.0);
    
    playTone(392.00, now + 3.0, 0.5);
    playTone(587.33, now + 3.5, 0.5);
    playTone(659.25, now + 4.0, 0.5);
    playTone(523.25, now + 4.5, 1.0);
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

const getInitialAppState = () => {
  const saved = localStorage.getItem('timerAppStateV2');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      let manual = parsed.manual || { totalTime: 600, timeLeft: 600, isRunning: false, endTime: null };
      
      if (manual.isRunning && manual.endTime) {
         manual.timeLeft = Math.max(0, Math.floor((manual.endTime - Date.now()) / 1000));
         if (manual.timeLeft === 0) {
           manual.isRunning = false;
           manual.endTime = null;
         }
      }
      return { mode: parsed.mode || 'manual', manual };
    } catch (e) {}
  }
  return { mode: 'manual' as Mode, manual: { totalTime: 600, timeLeft: 600, isRunning: false, endTime: null } };
};

export default function App() {
  const initialState = getInitialAppState();
  const [mode, setMode] = useState<Mode>(initialState.mode);
  const [scheduleNotice, setScheduleNotice] = useState(() => localStorage.getItem('scheduleNotice') || '');
  const [isNoticeEnabled, setIsNoticeEnabled] = useState(() => {
    const saved = localStorage.getItem('scheduleNoticeEnabled');
    if (saved !== null) return saved === 'true';
    const legacy = localStorage.getItem('scheduleNoticeVisible');
    if (legacy !== null) return legacy === 'true';
    return (localStorage.getItem('scheduleNotice') || '').trim().length > 0;
  });
  const [noticeDraft, setNoticeDraft] = useState(() => localStorage.getItem('scheduleNotice') || '');
  const [isEditingNotice, setIsEditingNotice] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isMusicLoading, setIsMusicLoading] = useState(false);
  const [isMusicAvailable, setIsMusicAvailable] = useState(true);
  
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const prevSlotIdRef = useRef<string | null>(null);
  const prevSlotTypeRef = useRef<TimerType>('none');

  // Manual Timer State
  const [manualTotalTime, setManualTotalTime] = useState(initialState.manual.totalTime);
  const [manualTimeLeft, setManualTimeLeft] = useState(initialState.manual.timeLeft);
  const [manualIsRunning, setManualIsRunning] = useState(initialState.manual.isRunning);
  const [manualEndTime, setManualEndTime] = useState<number | null>(initialState.manual.endTime);

  // Schedule Timer State
  const [scheduleTotalTime, setScheduleTotalTime] = useState(0);
  const [scheduleTimeLeft, setScheduleTimeLeft] = useState(0);
  const [scheduleIsRunning, setScheduleIsRunning] = useState(false);
  const [currentSlotName, setCurrentSlotName] = useState<string>('');
  const [timerType, setTimerType] = useState<TimerType>('break');
  
  // Custom Time Input State
  const [customMinutes, setCustomMinutes] = useState(Math.floor(initialState.manual.totalTime / 60).toString());
  const [customSeconds, setCustomSeconds] = useState((initialState.manual.totalTime % 60).toString());
  
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(() => {
    try {
      const saved = localStorage.getItem('weeklySchedule');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return normalizeWeeklySchedule(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to parse schedule from local storage", e);
    }
    return defaultWeeklySchedule;
  });
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingDay, setEditingDay] = useState<number>(1);
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  const [characterImageError, setCharacterImageError] = useState(false);
  const [scheduleFocusTick, setScheduleFocusTick] = useState(() => Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noticeInputRef = useRef<HTMLTextAreaElement>(null);
  const backgroundMusicRef = useRef<HTMLAudioElement>(null);
  const skipNoticeAutoSaveRef = useRef(false);
  const scheduleListRef = useRef<HTMLUListElement>(null);
  const scheduleSlotRefs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    localStorage.setItem('weeklySchedule', JSON.stringify(weeklySchedule));
  }, [weeklySchedule]);

  useEffect(() => {
    localStorage.setItem('scheduleNotice', scheduleNotice);
  }, [scheduleNotice]);

  useEffect(() => {
    localStorage.setItem('scheduleNoticeEnabled', String(isNoticeEnabled));
  }, [isNoticeEnabled]);

  useEffect(() => {
    if (!isEditingNotice) {
      setNoticeDraft(scheduleNotice);
    }
  }, [scheduleNotice, isEditingNotice]);

  useEffect(() => {
    if (!isEditingNotice) return;
    noticeInputRef.current?.focus();
    noticeInputRef.current?.select();
  }, [isEditingNotice]);

  useEffect(() => {
    if (!isEditingNotice) return;
    const textarea = noticeInputRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [isEditingNotice, noticeDraft]);

  useEffect(() => {
    if (mode !== 'schedule') return;
    const interval = window.setInterval(() => {
      setScheduleFocusTick(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [mode]);

  // Persist App State
  useEffect(() => {
    localStorage.setItem('timerAppStateV2', JSON.stringify({
      mode,
      manual: {
        totalTime: manualTotalTime,
        timeLeft: manualTimeLeft,
        isRunning: manualIsRunning,
        endTime: manualEndTime
      }
    }));
  }, [mode, manualTotalTime, manualTimeLeft, manualIsRunning, manualEndTime]);

  // Manual Mode Timer Logic
  useEffect(() => {
    let interval: number;
    if (manualIsRunning && manualEndTime) {
      interval = window.setInterval(() => {
        const remaining = Math.max(0, Math.floor((manualEndTime - Date.now()) / 1000));
        setManualTimeLeft(remaining);
        if (remaining === 0) {
          setManualIsRunning(false);
          setManualEndTime(null);
          if (modeRef.current === 'manual') {
            playAlarm();
          }
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [manualIsRunning, manualEndTime]);

  // Schedule Mode Timer Logic
  useEffect(() => {
    const checkSchedule = () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const currentSeconds = now.getSeconds();

      const todaysSchedule = weeklySchedule[dayOfWeek] || [];
      const activeSlot = todaysSchedule.find(s => currentMinutes >= s.start && currentMinutes < s.end);
      const nextSlotId = activeSlot ? activeSlot.id : null;
      const nextSlotType: TimerType = activeSlot ? (activeSlot.type as TimerType) : 'none';

      // Play alarm only when a non-class slot ends.
      if (
        prevSlotIdRef.current !== null &&
        prevSlotIdRef.current !== nextSlotId &&
        prevSlotTypeRef.current !== 'none' &&
        prevSlotTypeRef.current !== 'class' &&
        modeRef.current === 'schedule'
      ) {
        playAlarm();
      }

      prevSlotIdRef.current = nextSlotId;
      prevSlotTypeRef.current = nextSlotType;

      if (activeSlot) {
        const slotTotalSeconds = (activeSlot.end - activeSlot.start) * 60;
        const elapsedSeconds = (currentMinutes - activeSlot.start) * 60 + currentSeconds;
        setScheduleTotalTime(slotTotalSeconds);
        setScheduleTimeLeft(slotTotalSeconds - elapsedSeconds);
        setCurrentSlotName(activeSlot.name);
        setTimerType(activeSlot.type as TimerType);
        setScheduleIsRunning(true);
      } else {
        setScheduleTotalTime(0);
        setScheduleTimeLeft(0);
        setCurrentSlotName('일정 없음');
        setTimerType('none');
        setScheduleIsRunning(false);
      }
    };

    checkSchedule(); // Run immediately
    const interval = window.setInterval(checkSchedule, 1000);

    return () => clearInterval(interval);
  }, [weeklySchedule]);

  const handleModeSwitch = (newMode: Mode) => {
    setMode(newMode);
  };

  const applyCustomTime = () => {
    const m = parseInt(customMinutes) || 0;
    const s = parseInt(customSeconds) || 0;
    const totalSeconds = m * 60 + s;
    if (totalSeconds > 0) {
      setManualTotalTime(totalSeconds);
      setManualTimeLeft(totalSeconds);
      setManualIsRunning(false);
      setManualEndTime(null);
      setTimerType('none');
    }
  };

  const toggleTimer = () => {
    if (mode !== 'manual') return;
    if (manualIsRunning) {
      setManualIsRunning(false);
      setManualEndTime(null);
    } else {
      if (manualTimeLeft > 0) {
        setManualIsRunning(true);
        setManualEndTime(Date.now() + manualTimeLeft * 1000);
      }
    }
  };

  const resetTimer = () => {
    if (mode !== 'manual') return;
    setManualTimeLeft(manualTotalTime);
    setManualIsRunning(false);
    setManualEndTime(null);
  };

  const updateSlot = (day: number, id: string, field: keyof ScheduleSlot, value: any) => {
    setWeeklySchedule(prev => {
      const daySchedule = [...(prev[day] || [])];
      const slotIndex = daySchedule.findIndex(s => s.id === id);
      if (slotIndex > -1) {
        const nextSlot = { ...daySchedule[slotIndex], [field]: value } as ScheduleSlot;

        if (field === 'type' || field === 'start') {
          const fixedDuration = getFixedDurationByType(nextSlot.type);
          if (fixedDuration !== null) {
            nextSlot.end = nextSlot.start + fixedDuration;
          }
        }

        if (field === 'end' && nextSlot.end <= nextSlot.start) {
          nextSlot.end = nextSlot.start + 1;
        }

        if (isMorningSlot(nextSlot)) {
          nextSlot.type = 'morning';
          nextSlot.name = MORNING_ACTIVITY_LABEL;
        }

        daySchedule[slotIndex] = nextSlot;
      }
      return { ...prev, [day]: normalizeDaySchedule(daySchedule) };
    });
  };

  const addSlot = (day: number) => {
    setWeeklySchedule(prev => {
      const daySchedule = [...(prev[day] || [])];
      const lastSlot = daySchedule[daySchedule.length - 1];
      const start = lastSlot ? lastSlot.end : 540;
      daySchedule.push({
        id: createSlotId(),
        name: '새 일정',
        type: 'class',
        start: start,
        end: start + CLASS_DURATION
      });
      return { ...prev, [day]: normalizeDaySchedule(daySchedule) };
    });
  };

  const removeSlot = (day: number, id: string) => {
    setWeeklySchedule(prev => {
      const targetSlot = (prev[day] || []).find((s) => s.id === id);
      if (targetSlot && isMorningSlot(targetSlot)) {
        return prev;
      }
      const daySchedule = (prev[day] || []).filter(s => s.id !== id);
      return { ...prev, [day]: normalizeDaySchedule(daySchedule) };
    });
  };

  const exportSchedule = () => {
    const exportPayload = {
      weeklySchedule,
      scheduleNotice,
      scheduleNoticeEnabled: isNoticeEnabled,
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "timer_schedule.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importSchedule = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object') {
          const nextSchedule = parsed.weeklySchedule && typeof parsed.weeklySchedule === 'object'
            ? parsed.weeklySchedule
            : parsed;
          const nextNotice = typeof parsed.scheduleNotice === 'string' ? parsed.scheduleNotice : '';
          const nextNoticeEnabled = typeof parsed.scheduleNoticeEnabled === 'boolean'
            ? parsed.scheduleNoticeEnabled
            : nextNotice.trim().length > 0;
          setWeeklySchedule(normalizeWeeklySchedule(nextSchedule));
          setScheduleNotice(nextNotice);
          setIsNoticeEnabled(nextNoticeEnabled);
          alert('시간표를 성공적으로 불러왔습니다.');
        } else {
          alert('잘못된 파일 형식입니다.');
        }
      } catch (error) {
        alert('파일을 읽는 중 오류가 발생했습니다.');
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const startNoticeEdit = () => {
    skipNoticeAutoSaveRef.current = false;
    setNoticeDraft(scheduleNotice);
    setIsEditingNotice(true);
  };

  const openNoticePanel = () => {
    if ((scheduleNotice || '').trim().length > 0) {
      setIsNoticeEnabled(true);
      return;
    }
    startNoticeEdit();
  };

  const saveNotice = () => {
    skipNoticeAutoSaveRef.current = false;
    const nextNotice = noticeDraft.trim();
    setScheduleNotice(nextNotice);
    if (nextNotice.length > 0) {
      setIsNoticeEnabled(true);
    }
    setIsEditingNotice(false);
  };

  const cancelNoticeEdit = () => {
    skipNoticeAutoSaveRef.current = true;
    setNoticeDraft(scheduleNotice);
    setIsEditingNotice(false);
  };

  const handleNoticeBlur = () => {
    if (skipNoticeAutoSaveRef.current) {
      skipNoticeAutoSaveRef.current = false;
      return;
    }
    saveNotice();
  };

  const toggleBackgroundMusic = async () => {
    const audio = backgroundMusicRef.current;
    if (!audio || isMusicLoading) return;

    if (!audio.paused) {
      audio.pause();
      return;
    }

    try {
      setIsMusicLoading(true);
      setIsMusicAvailable(true);
      if (audio.error || audio.readyState === 0) {
        audio.load();
      }
      audio.volume = BACKGROUND_MUSIC_VOLUME;
      await audio.play();
    } catch (error) {
      console.error('Background music playback failed', error);
      setIsMusicAvailable(false);
    } finally {
      setIsMusicLoading(false);
    }
  };

  // Visual calculations
  const displayTotalTime = mode === 'manual' ? manualTotalTime : scheduleTotalTime;
  const displayTimeLeft = mode === 'manual' ? manualTimeLeft : scheduleTimeLeft;
  const displayIsRunning = mode === 'manual' ? manualIsRunning : scheduleIsRunning;

  const percentage = displayTotalTime > 0 ? displayTimeLeft / displayTotalTime : 0;
  const warningThreshold = 0.5;
  const urgentThreshold = 0.2;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = -(circumference - percentage * circumference);

  let colorClass = "text-[#587052]";
  let strokeColor = "#587052";
  let pulseClass = "";
  let bgClass = "app-tone-calm";

  let characterMessage = "";
  let showCharacter = false;
  let characterMotionStyle: React.CSSProperties = {};
  let speechBubbleSizeClass = "px-7 py-4 md:px-10 md:py-6";
  let speechTextSizeClass = "text-2xl md:text-4xl";
  let characterWrapSizeClass = "w-48 h-48 md:w-64 md:h-64";
  let characterImageScaleClass = "scale-[1.15] md:scale-[1.25]";
  const isScheduleBreak = mode === 'schedule' && timerType === 'break';
  const isScheduleLunch = mode === 'schedule' && timerType === 'lunch';
  const shouldShowTimedMessage = mode === 'manual' || isScheduleBreak || isScheduleLunch;
  const scheduleTypeLabel =
    timerType === 'class'
      ? "\uC218\uC5C5\uC2DC\uAC04"
      : timerType === 'break'
        ? "\uC26C\uB294\uC2DC\uAC04"
        : timerType === 'morning'
          ? MORNING_ACTIVITY_LABEL
        : timerType === 'lunch'
          ? "\uC810\uC2EC\uC2DC\uAC04"
          : "\uC77C\uC815 \uC5C6\uC74C";
  const scheduleTypeBadgeClass =
    timerType === 'class'
      ? 'bg-[#EEF5EA] text-[#466146] border-[#CADABD]'
      : timerType === 'break'
        ? 'bg-[#F7FBF4] text-[#5C7A4B] border-[#D5E6CA]'
        : timerType === 'morning'
          ? 'bg-[#FFF7E3] text-[#8D6C37] border-[#EBCF93]'
        : timerType === 'lunch'
          ? 'bg-[#FFF0E3] text-[#A46943] border-[#EDC7A8]'
          : 'bg-[#F7F0E9] text-[#8A6347]/70 border-[#E8D7C5]';

  const getCharacterMessage = (stage: 'warning' | 'urgent' | 'end') => {
    if (mode === 'manual') {
      if (stage === 'warning') return "\uB9C8\uBB34\uB9AC\uD560 \uC2DC\uAC04\uC774 \uB2E4\uAC00\uC624\uACE0 \uC788\uC5B4\uC694.";
      if (stage === 'urgent') return "\uC774\uC81C \uAC70\uC758 \uB05D\uB098\uC694.";
      return "\uC2DC\uAC04\uC774 \uB05D\uB0AC\uC5B4\uC694!";
    }

    if (isScheduleBreak) {
      if (stage === 'warning') return "\uC26C\uB294 \uC2DC\uAC04\uC774 \uB05D\uB098\uAC00\uC694. \uD654\uC7A5\uC2E4\uC740 \uBBF8\uB9AC \uB2E4\uB140\uC624\uC138\uC694.";
      if (stage === 'urgent') return "\uC774\uC81C \uACF3 \uC218\uC5C5\uC774 \uC2DC\uC791\uD574\uC694. \uAD50\uACFC\uC11C\uB97C \uCC45\uC0C1 \uC704\uC5D0 \uC62C\uB824 \uB450\uC138\uC694.";
      return "\uC26C\uB294 \uC2DC\uAC04\uC774 \uB05D\uB0AC\uC5B4\uC694!";
    }

    if (isScheduleLunch) {
      if (stage === 'warning') return "\uC810\uC2EC\uC2DC\uAC04\uC774 \uB05D\uB098\uAC00\uC694. \uD654\uC7A5\uC2E4\uC740 \uBBF8\uB9AC \uB2E4\uB140\uC624\uC138\uC694.";
      if (stage === 'urgent') return "\uC774\uC81C \uC815\uB9AC\uD560 \uC2DC\uAC04\uC774\uC5D0\uC694. \uAD50\uACFC\uC11C\uB97C \uCC45\uC0C1 \uC704\uC5D0 \uC62C\uB824 \uB450\uC138\uC694.";
      return "\uC810\uC2EC\uC2DC\uAC04\uC774 \uB05D\uB0AC\uC5B4\uC694!";
    }

    return "";
  };

  if (displayTotalTime === 0) {
    colorClass = "text-[#CEBFA8]";
    strokeColor = "#CEBFA8";
    bgClass = "app-tone-idle";
  } else if (shouldShowTimedMessage && displayTimeLeft === 0) {
    colorClass = "text-[#B55E4C]";
    strokeColor = "#B55E4C";
    showCharacter = true;
    bgClass = "app-tone-finished";
    characterMessage = getCharacterMessage('end');
    speechBubbleSizeClass = "px-8 py-5 md:px-12 md:py-7";
    speechTextSizeClass = "text-3xl md:text-5xl";
    characterWrapSizeClass = "w-56 h-56 md:w-80 md:h-80";
    characterImageScaleClass = "scale-125 md:scale-[1.45]";
  } else if (shouldShowTimedMessage && percentage <= urgentThreshold) {
    colorClass = "text-[#B55E4C]";
    strokeColor = "#B55E4C";
    showCharacter = true;
    bgClass = "app-tone-urgent";
    speechBubbleSizeClass = "px-8 py-5 md:px-12 md:py-7";
    speechTextSizeClass = "text-3xl md:text-5xl";
    characterWrapSizeClass = "w-56 h-56 md:w-80 md:h-80";
    characterImageScaleClass = "scale-125 md:scale-[1.45]";
    characterMessage = getCharacterMessage('urgent');
    if (displayIsRunning) {
      pulseClass = "mascot-alert-pulse";
    }
  } else if (shouldShowTimedMessage && percentage <= warningThreshold) {
    colorClass = "text-[#C58747]";
    strokeColor = "#C58747";
    showCharacter = true;
    bgClass = "app-tone-warning";
    speechBubbleSizeClass = "px-7 py-4 md:px-10 md:py-6";
    speechTextSizeClass = "text-2xl md:text-4xl";
    characterWrapSizeClass = "w-48 h-48 md:w-64 md:h-64";
    characterImageScaleClass = "scale-[1.15] md:scale-[1.25]";
    characterMessage = getCharacterMessage('warning');
  }

  if (showCharacter && displayIsRunning) {
    const bobOffset = Math.sin((displayTimeLeft || 0) * 0.8) * 10;
    const tilt = Math.sin((displayTimeLeft || 0) * 1.3) * (percentage <= urgentThreshold ? 6 : 3);
    characterMotionStyle = {
      transform: `translateY(${bobOffset}px) rotate(${tilt}deg)`,
      transition: "transform 220ms ease-out",
    };
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatMinutesToTime = (mins: number) => {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const parseTimeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const today = new Date().getDay();
  const currentDaySchedule = weeklySchedule[today] || [];
  const nowForScheduleView = new Date(scheduleFocusTick);
  const currentMinsForScheduleView = nowForScheduleView.getHours() * 60 + nowForScheduleView.getMinutes();
  const activeSlotIndex = currentDaySchedule.findIndex(
    (slot) => currentMinsForScheduleView >= slot.start && currentMinsForScheduleView < slot.end
  );
  const nextSlotIndex = currentDaySchedule.findIndex((slot) => currentMinsForScheduleView < slot.start);
  const focusSlotIndex =
    activeSlotIndex !== -1
      ? activeSlotIndex
      : nextSlotIndex !== -1
        ? nextSlotIndex
        : currentDaySchedule.length - 1;

  useEffect(() => {
    if (mode !== 'schedule' || focusSlotIndex < 0) return;
    const focusSlot = currentDaySchedule[focusSlotIndex];
    if (!focusSlot) return;
    const node = scheduleSlotRefs.current[focusSlot.id];
    const list = scheduleListRef.current;
    if (!node || !list) return;

    const nodeTop = node.offsetTop;
    const nodeBottom = nodeTop + node.offsetHeight;
    const viewportTop = list.scrollTop;
    const viewportBottom = viewportTop + list.clientHeight;
    const isVisible = nodeTop >= viewportTop && nodeBottom <= viewportBottom;

    if (!isVisible) {
      const targetTop = nodeTop - (list.clientHeight - node.offsetHeight) / 2;
      const maxTop = Math.max(0, list.scrollHeight - list.clientHeight);
      list.scrollTo({
        top: Math.min(Math.max(0, targetTop), maxTop),
        behavior: 'smooth',
      });
    }
  }, [mode, today, currentSlotName, weeklySchedule, focusSlotIndex, currentDaySchedule, scheduleFocusTick]);

  const trimmedNotice = scheduleNotice.trim();
  const hasScheduleNotice = trimmedNotice.length > 0;
  const getNoticeTextClass = (text: string) => {
    const length = text.replace(/\s+/g, '').length;
    if (length <= 6) return 'text-[clamp(2rem,4.8vw,2.4rem)] leading-[1.18] tracking-[-0.01em]';
    if (length <= 10) return 'text-[clamp(1.75rem,4.1vw,2.05rem)] leading-[1.24] tracking-[-0.01em]';
    if (length <= 16) return 'text-[clamp(1.48rem,3.5vw,1.78rem)] leading-[1.34] tracking-[0em]';
    if (length <= 24) return 'text-[clamp(1.28rem,3vw,1.52rem)] leading-[1.46] tracking-[0em]';
    return 'text-[clamp(1.08rem,2.4vw,1.24rem)] leading-[1.58] tracking-[0em]';
  };
  const studentNoticeTextClass = getNoticeTextClass(trimmedNotice);
  const draftNoticeTextClass = getNoticeTextClass(noticeDraft);
  const shouldCenterNoticeText = trimmedNotice.replace(/\s+/g, '').length <= 12;
  const shouldCenterNoticeDraft = noticeDraft.trim().length > 0 && noticeDraft.replace(/\s+/g, '').length <= 12;
  const shouldShowNoticeCard = isEditingNotice || (isNoticeEnabled && hasScheduleNotice);
  const shouldShowNoticeHandle = !shouldShowNoticeCard;
  const noticeCardStyle = shouldShowNoticeCard
    ? { animation: `${isEditingNotice ? 'noticeFadeIn 220ms ease-out' : 'studentNoticeEnter 420ms ease-out, studentNoticeFloat 2.6s ease-in-out infinite'}` }
    : undefined;
  const noticeHandleButtonClass = "notice-toggle group relative inline-flex h-8 min-w-[3.2rem] items-center justify-center rounded-[1rem] border-2 border-[#E4C48A] bg-[linear-gradient(180deg,#FFFDF8_0%,#F7E6BF_100%)] px-2.5 text-[#A36A28] shadow-[0_5px_12px_rgba(181,134,58,0.12)] transition-all hover:-translate-y-px hover:shadow-[0_8px_16px_rgba(181,134,58,0.16)] active:translate-y-0";
  const noticeHandleIconClass = "inline-flex h-5 min-w-[1.85rem] items-center justify-center rounded-full border border-white/85 bg-white/58 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]";
  const musicButtonLabel = isMusicPlaying ? '배경 음악 끄기' : '배경 음악 켜기';

  return (
    <div className="mascot-app h-[100dvh] w-full overflow-hidden p-3 sm:p-4 md:p-8">
      <audio
        ref={backgroundMusicRef}
        src="/background_music.mp3"
        loop
        preload="auto"
        className="hidden"
        onCanPlay={() => setIsMusicAvailable(true)}
        onPlay={() => setIsMusicPlaying(true)}
        onPause={() => setIsMusicPlaying(false)}
        onError={() => {
          setIsMusicAvailable(false);
          setIsMusicPlaying(false);
          setIsMusicLoading(false);
        }}
      />
      <div className={`mascot-shell relative flex h-full w-full max-w-screen-2xl flex-col overflow-hidden rounded-[2rem] shadow-2xl transition-colors duration-1000 md:rounded-[3rem] ${bgClass}`}>
        <style>{`
          @keyframes noticeFadeIn {
            0% {
              opacity: 0;
            }
            100% {
              opacity: 1;
            }
          }
          @keyframes studentNoticeEnter {
            0% {
              opacity: 0;
              transform: translateY(-10px) scale(0.96);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          @keyframes studentNoticeFloat {
            0%, 100% {
              transform: translateY(0);
              box-shadow: 0 18px 36px rgba(165, 122, 48, 0.18);
            }
            50% {
              transform: translateY(-4px);
              box-shadow: 0 24px 44px rgba(165, 122, 48, 0.24);
            }
          }
        `}</style>
        <div aria-hidden="true" className="mascot-orb mascot-orb-one" />
        <div aria-hidden="true" className="mascot-orb mascot-orb-two" />
        <div aria-hidden="true" className="mascot-leaf mascot-leaf-one" />
        <div aria-hidden="true" className="mascot-leaf mascot-leaf-two" />
        <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_29rem] xl:grid-cols-[minmax(0,1fr)_32rem] 2xl:grid-cols-[minmax(0,1fr)_34rem] min-h-0">
          {/* Left: Timer Display */}
          <div className="timer-pane relative flex h-full min-h-0 flex-col items-center justify-center p-5 md:p-8 lg:px-8 lg:py-10 xl:px-10 xl:py-12">
            <div className={`timer-ring-stage relative flex min-h-0 w-full flex-1 items-center justify-center ${pulseClass}`}>
              <svg viewBox="0 0 200 200" className="timer-ring-svg aspect-square h-auto w-full max-h-full max-w-[34rem] -rotate-90 transform rounded-full shadow-inner xl:max-w-[40rem]">
                <circle cx="100" cy="100" r="50" fill="none" stroke="#E6D5C9" strokeWidth="100" />
                <circle
                  cx="100"
                  cy="100"
                  r="50"
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="100"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
            </div>
            <div className={`clock-display mt-4 shrink-0 text-[clamp(3.7rem,8.5vw,9.8rem)] leading-none font-bold tracking-tight transition-colors duration-1000 md:mt-6 xl:text-[clamp(4.1rem,7.8vw,10.2rem)] lg:mt-7 ${colorClass}`}>
              {formatTime(displayTimeLeft)}
            </div>

            {/* Character Notification Overlay (independent from right controls) */}
            <div className={`absolute inset-0 z-20 flex items-center justify-center p-4 transition-all duration-500 ${showCharacter ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>
              <div className="flex flex-col items-center pointer-events-none">
                {/* Speech Bubble */}
                <div className={`speech-card relative mb-4 max-w-[min(92vw,56rem)] rounded-3xl border-4 border-[#E6D5C9] bg-white text-center shadow-xl md:mb-6 ${speechBubbleSizeClass}`} style={characterMotionStyle}>
                  <p className={`font-bold whitespace-normal break-keep text-center ${speechTextSizeClass} ${colorClass}`}>{characterMessage}</p>
                  {/* Bubble Tail (pointing down) */}
                  <div className="speech-tail-fill absolute -bottom-[14px] left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[12px] border-x-transparent border-t-[14px] border-t-white"></div>
                  <div className="speech-tail-outline absolute -bottom-[19px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[15px] border-x-transparent border-t-[17px] border-t-[#E6D5C9]"></div>
                </div>

                {/* Character Image or Placeholder */}
                <div className={`mascot-figure-stage relative shrink-0 ${characterWrapSizeClass}`} style={characterMotionStyle}>
                  {characterImageError && (
                    <div className="absolute inset-0 bg-[#8A6347]/10 rounded-3xl border-2 border-dashed border-[#8A6347]/40 flex flex-col items-center justify-center text-[#8A6347]/60">
                      <span className="text-5xl md:text-7xl mb-2">?</span>
                      <span className="text-sm md:text-base font-bold text-center leading-tight">Character<br/>Area</span>
                    </div>
                  )}
                  <img
                    src="/character.png?v=20260301"
                    alt="character notification"
                    className={`absolute inset-0 w-full h-full object-contain drop-shadow-2xl z-10 ${characterImageScaleClass}`}
                    referrerPolicy="no-referrer"
                    onLoad={() => setCharacterImageError(false)}
                    onError={(e) => {
                      // Fallback if image is not found
                      setCharacterImageError(true);
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Controls & Presets */}
          <div className="control-pane relative flex min-h-0 w-full flex-col gap-6 overflow-hidden border-t border-[#E6D5C9]/50 p-5 sm:p-6 lg:w-auto lg:border-l lg:border-t-0 lg:px-8 lg:py-9 xl:px-10 xl:py-10">
            
            {/* Character Notification Overlay */}
            <div className="hidden">
              {/* Speech Bubble */}
              <div className="relative bg-white px-6 py-4 md:px-8 md:py-6 rounded-3xl shadow-xl border-4 border-[#E6D5C9] mb-6 animate-bounce text-center max-w-[min(92vw,56rem)]">
                <p className={`font-bold text-lg md:text-2xl whitespace-normal break-keep text-center ${colorClass}`}>{characterMessage}</p>
                {/* Bubble Tail (pointing down) */}
                <div className="absolute -bottom-[14px] left-1/2 -translate-x-1/2 w-0 h-0 border-x-[12px] border-x-transparent border-t-[14px] border-t-white z-10"></div>
                <div className="absolute -bottom-[19px] left-1/2 -translate-x-1/2 w-0 h-0 border-x-[15px] border-x-transparent border-t-[17px] border-t-[#E6D5C9]"></div>
              </div>
              
              {/* Character Image or Placeholder */}
              <div className="relative w-48 h-48 md:w-64 md:h-64 shrink-0">
                {/* 임시 영역 (Placeholder) */}
                <div className="absolute inset-0 bg-[#8A6347]/10 rounded-3xl border-2 border-dashed border-[#8A6347]/40 flex flex-col items-center justify-center text-[#8A6347]/60">
                  <span className="text-5xl md:text-7xl mb-2">🎨</span>
                  <span className="text-sm md:text-base font-bold text-center leading-tight">캐릭터<br/>영역</span>
                </div>
                {/* 실제 이미지 (있을 경우 덮어씀) */}
                <img 
                  src="/character.png?v=20260301" 
                  alt="알림 캐릭터"
                  className="absolute inset-0 w-full h-full object-contain drop-shadow-2xl z-10"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // Fallback if image is not found
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>

            {/* Controls Content (Fades out when character shows) */}
            <div className={`flex flex-col flex-1 min-h-0 ${mode === 'schedule' ? 'gap-4' : 'gap-6'}`}>
              {/* Mode Switcher */}
            <div className="flex shrink-0 items-center gap-3">
              <div className="mode-switch flex flex-1 rounded-2xl p-1.5">
                <button
                  onClick={() => handleModeSwitch('schedule')}
                  className={`mode-toggle flex flex-1 items-center justify-center gap-2 rounded-[1.1rem] py-3 text-sm font-bold transition-all lg:text-base ${
                    mode === 'schedule' ? 'mode-toggle-active' : 'mode-toggle-inactive'
                  }`}
                >
                  <CalendarClock size={20} />
                  시간표 모드
                </button>
                <button
                  onClick={() => handleModeSwitch('manual')}
                  className={`mode-toggle flex flex-1 items-center justify-center gap-2 rounded-[1.1rem] py-3 text-sm font-bold transition-all lg:text-base ${
                    mode === 'manual' ? 'mode-toggle-active' : 'mode-toggle-inactive'
                  }`}
                >
                  <Timer size={20} />
                  수동 모드
                </button>
              </div>
              <button
                onClick={toggleBackgroundMusic}
                disabled={isMusicLoading}
                className={`sound-toggle inline-flex h-[3.55rem] w-[3.55rem] shrink-0 items-center justify-center rounded-2xl transition-all ${
                  isMusicPlaying ? 'sound-toggle-active' : 'sound-toggle-inactive'
                } ${isMusicLoading ? 'cursor-not-allowed opacity-45' : ''}`}
                title={isMusicAvailable ? musicButtonLabel : '배경 음악 다시 시도'}
                aria-label={isMusicAvailable ? musicButtonLabel : '배경 음악 다시 시도'}
              >
                {isMusicPlaying ? <Volume2 size={22} /> : <VolumeX size={22} />}
              </button>
            </div>

            <div className={`flex-1 flex flex-col min-h-0 ${mode === 'schedule' ? 'justify-start gap-4' : 'justify-center gap-8'}`}>
              {mode === 'manual' ? (
                <>
                  <div className="flex justify-center items-center gap-6">
                    <button
                      onClick={toggleTimer}
                      className={`round-action flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-white shadow-xl transition-transform hover:scale-105 active:scale-95 lg:h-32 lg:w-32 ${
                        manualIsRunning ? 'round-action-pause' : 'round-action-play'
                      }`}
                    >
                      {manualIsRunning ? <Pause size={48} className="lg:w-14 lg:h-14" /> : <Play size={48} className="ml-2 lg:w-14 lg:h-14 lg:ml-3" />}
                    </button>
                    <button
                      onClick={resetTimer}
                      className="round-action round-action-reset flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-[#8A6347] shadow-lg transition-transform hover:scale-105 active:scale-95 lg:h-20 lg:w-20"
                    >
                      <RotateCcw size={32} className="lg:w-10 lg:h-10" />
                    </button>
                  </div>

                  <div className="panel-divider h-px w-full shrink-0"></div>

                  <div className="flex flex-col gap-4 shrink-0">
                    <div className="paper-card rounded-3xl border-2 border-[#E6D5C9] p-5 shadow-sm">
                      <h3 className="section-title mb-4 text-center font-bold text-[#8A6347]">직접 시간 설정</h3>
                      <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="flex flex-col items-center">
                          <input 
                            type="number" 
                            value={customMinutes}
                            onChange={(e) => setCustomMinutes(e.target.value)}
                            className="time-input w-20 rounded-xl border border-[#E6D5C9] bg-white px-2 py-3 text-center font-mono text-2xl font-bold text-[#8A6347] outline-none transition-all focus:border-[#5C8D5D] focus:ring-2 focus:ring-[#5C8D5D]/20"
                            min="0"
                            max="999"
                          />
                          <span className="text-[#8A6347]/70 font-bold text-sm mt-1">분</span>
                        </div>
                        <span className="text-2xl font-bold text-[#8A6347] mb-6">:</span>
                        <div className="flex flex-col items-center">
                          <input 
                            type="number" 
                            value={customSeconds}
                            onChange={(e) => setCustomSeconds(e.target.value)}
                            className="time-input w-20 rounded-xl border border-[#E6D5C9] bg-white px-2 py-3 text-center font-mono text-2xl font-bold text-[#8A6347] outline-none transition-all focus:border-[#5C8D5D] focus:ring-2 focus:ring-[#5C8D5D]/20"
                            min="0"
                            max="59"
                          />
                          <span className="text-[#8A6347]/70 font-bold text-sm mt-1">초</span>
                        </div>
                      </div>
                      <button 
                        onClick={applyCustomTime}
                        className="primary-cta w-full rounded-xl py-3 text-lg font-bold text-white shadow-md transition-colors active:scale-95"
                      >
                        타이머 설정
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="relative flex h-full min-h-0 w-full flex-col items-stretch justify-start gap-3 pt-2 text-left">
                  <div className="hidden w-24 h-24 rounded-full bg-[#F0F5F0] items-center justify-center text-[#5C8D5D] mb-2 shadow-inner">
                    <CalendarClock size={48} />
                  </div>
                  <div className={`flex flex-col items-center ${shouldShowNoticeHandle ? 'gap-1' : 'gap-3'}`}>
                    <h2 className="hidden text-2xl lg:text-3xl font-bold text-[#8A6347] mb-2">자동 시간표 모드</h2>
                    <p className="hidden text-lg lg:text-xl text-[#8A6347]/70 font-medium">
                      {currentSlotName === '일정 없음'
                        ? '현재 예정된 일정이 없습니다.'
                        : `현재: ${currentSlotName}`}
                    </p>
                    <div className={`status-medallion inline-flex items-center justify-center gap-4 rounded-full border-2 px-7 py-5 text-[clamp(2.5rem,4.8vw,3.8rem)] font-extrabold leading-[0.95] tracking-[-0.01em] whitespace-nowrap shadow-sm ${scheduleTypeBadgeClass}`}>
                      {timerType === 'break' ? <Coffee size={48} strokeWidth={2.25} /> : timerType === 'lunch' ? <Utensils size={48} strokeWidth={2.25} /> : timerType === 'class' || timerType === 'morning' ? <CalendarClock size={48} strokeWidth={2.25} /> : <Timer size={48} strokeWidth={2.25} />}
                      <span className="whitespace-nowrap leading-none">{scheduleTypeLabel}</span>
                    </div>

                    {shouldShowNoticeCard ? (
                      <div
                        className={`notice-card relative z-30 w-full overflow-visible rounded-[1.85rem] border-2 border-[#D2A055] bg-[linear-gradient(180deg,#FFF8E6_0%,#F4E2AF_100%)] px-1.5 pb-1.5 pt-1.5 text-left shadow-[0_16px_30px_rgba(165,122,48,0.16)] ${isEditingNotice ? 'notice-card-editing' : 'notice-card-reading mb-[-1.1rem] sm:mb-[-1.35rem]'}`}
                        style={noticeCardStyle}
                      >
                        {isEditingNotice ? (
                          <>
                            <div className="notice-editor min-h-[5.5rem] rounded-[1.45rem] border border-[#E7D8BA] bg-[#FFFDF9] px-1 py-1.5 transition-colors focus-within:border-[#C58A38] focus-within:ring-2 focus-within:ring-[#C58A38]/20 sm:min-h-[6rem]">
                              <textarea
                                ref={noticeInputRef}
                                value={noticeDraft}
                                onChange={(e) => setNoticeDraft(e.target.value)}
                                onBlur={handleNoticeBlur}
                                onKeyDown={(e) => {
                                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                    e.preventDefault();
                                    saveNotice();
                                  }
                                  if (e.key === 'Escape') {
                                    e.preventDefault();
                                    cancelNoticeEdit();
                                  }
                                }}
                                rows={1}
                                maxLength={160}
                                className={`notice-draft-body block min-h-[3.5rem] w-full resize-none overflow-hidden bg-transparent p-0 break-keep font-bold text-[#5B4327] outline-none placeholder:text-[#B48D55]/65 ${shouldCenterNoticeDraft ? 'text-center' : 'text-left'} ${draftNoticeTextClass}`}
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="absolute left-1/2 top-0 z-20 flex -translate-x-1/2 -translate-y-[42%] flex-col items-center">
                              <button
                                onClick={() => setIsNoticeEnabled(false)}
                                className={noticeHandleButtonClass}
                                title="공지 닫기"
                                aria-label="공지 닫기"
                              >
                                <span aria-hidden="true" className="pointer-events-none absolute inset-x-1.5 top-[3px] h-px rounded-full bg-white/95" />
                                <span aria-hidden="true" className={noticeHandleIconClass}>
                                  <ChevronDown
                                    size={10}
                                    strokeWidth={2.7}
                                    className="rotate-180"
                                  />
                                </span>
                              </button>
                            </div>
                            <button
                              onClick={startNoticeEdit}
                              className="notice-content flex min-h-[5.5rem] w-full items-center rounded-[1.45rem] border border-[#E7D8BA] bg-[#FFFDF9] px-1 py-1.5 text-left transition-colors hover:bg-white sm:min-h-[6rem]"
                              title="공지 수정"
                            >
                              <p className={`notice-text-body w-full break-keep whitespace-pre-line font-bold text-[#5B4327] ${shouldCenterNoticeText ? 'text-center' : 'text-left'} ${studentNoticeTextClass}`}>
                                {trimmedNotice}
                              </p>
                            </button>
                          </>
                        )}
                      </div>
                    ) : shouldShowNoticeHandle ? (
                      <div className="relative h-0 w-full overflow-visible">
                        <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-[42%]">
                          <button
                            onClick={openNoticePanel}
                            className={noticeHandleButtonClass}
                            title={hasScheduleNotice ? '공지 열기' : '공지 편집 열기'}
                            aria-label={hasScheduleNotice ? '공지 열기' : '공지 편집 열기'}
                          >
                            <span aria-hidden="true" className="pointer-events-none absolute inset-x-1.5 top-[3px] h-px rounded-full bg-white/95" />
                            <span aria-hidden="true" className={noticeHandleIconClass}>
                              <ChevronDown size={10} strokeWidth={2.7} />
                            </span>
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  
                  <div className={`schedule-board flex min-h-0 w-full flex-[0.9] flex-col rounded-3xl border-2 border-[#E6D5C9] bg-[#FDFBF7] p-5 text-left shadow-sm ${shouldShowNoticeCard && !isEditingNotice ? 'schedule-board-muted pt-9 sm:pt-10' : ''}`}>
                    <div className="mb-3 flex items-center justify-between gap-2 shrink-0">
                      <h3 className="section-title flex items-center gap-2 text-lg font-bold text-[#8A6347] lg:text-xl">
                        <CalendarClock size={18} />
                        오늘({DAYS[today]}요일) 시간표
                      </h3>
                      <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="icon-button rounded-lg p-2 text-[#8A6347]/60 transition-colors hover:bg-[#E6D5C9]/30 hover:text-[#8A6347]"
                        title="시간표 설정"
                      >
                        <Settings size={22} />
                      </button>
                    </div>
                    <ul ref={scheduleListRef} className="schedule-scroll custom-scrollbar flex-1 space-y-2 overflow-y-auto pr-2 text-base text-[#8A6347]/90 lg:text-lg">
                      {currentDaySchedule.length === 0 ? (
                        <li className="text-center py-4 opacity-60">일정이 없습니다.</li>
                      ) : (
                        currentDaySchedule.map((s) => {
                          const now = new Date();
                          const currentMins = now.getHours() * 60 + now.getMinutes();
                          const isThisSlot = currentMins >= s.start && currentMins < s.end;

                          return (
                            <li
                              key={s.id}
                              ref={(el) => {
                                scheduleSlotRefs.current[s.id] = el;
                              }}
                              className={`schedule-row flex items-center justify-between rounded-xl p-3 transition-colors ${isThisSlot ? 'schedule-row-active font-bold text-white shadow-md' : 'schedule-row-idle'}`}
                            >
                              <span className="font-semibold">{s.name}</span>
                              <span className="font-mono text-sm lg:text-base">{formatMinutesToTime(s.start)} - {formatMinutesToTime(s.end)}</span>
                            </li>
                          )
                        })
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="settings-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm md:p-8">
          <div className="settings-dialog flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border-4 border-[#E6D5C9] bg-[#FDFBF7] shadow-2xl">
            <div className="settings-header flex shrink-0 items-center justify-between border-b border-[#E6D5C9] bg-white p-5 md:p-6">
              <h2 className="section-title flex items-center gap-2 text-xl font-bold text-[#8A6347] md:text-2xl">
                <Settings size={24} className="md:w-7 md:h-7" />
                시간표 설정
              </h2>
              <div className="flex items-center gap-2 md:gap-4">
                <button 
                  onClick={exportSchedule}
                  className="toolbar-button toolbar-button-green flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold text-[#5C8D5D] transition-colors"
                  title="시간표 내보내기"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">백업</span>
                </button>
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="toolbar-button toolbar-button-neutral flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold text-[#8A6347] transition-colors"
                  title="시간표 불러오기"
                >
                  <Upload size={16} />
                  <span className="hidden sm:inline">복구</span>
                </button>
                <input 
                  type="file" 
                  accept=".json" 
                  ref={fileInputRef} 
                  onChange={importSchedule} 
                  className="hidden" 
                />

                <div className="w-px h-6 bg-[#E6D5C9] mx-1"></div>
                
                <button onClick={() => setIsSettingsOpen(false)} className="icon-button rounded-full p-2 text-[#8A6347]/60 transition-colors hover:bg-[#FDFBF7] hover:text-[#8A6347]">
                  <X size={24} className="md:w-7 md:h-7" />
                </button>
              </div>
            </div>
            
            <div className="tab-strip custom-scrollbar flex shrink-0 overflow-x-auto border-b border-[#E6D5C9] bg-white">
              {[1, 2, 3, 4, 5].map(day => (
                <button
                  key={day}
                  onClick={() => setEditingDay(day)}
                  className={`day-tab min-w-[80px] flex-1 py-3 text-base font-bold transition-colors md:py-4 md:text-lg ${
                    editingDay === day ? 'day-tab-active text-white' : 'day-tab-inactive text-[#8A6347]'
                  }`}
                >
                  {DAYS[day]}요일
                </button>
              ))}
            </div>

            <div className="settings-body custom-scrollbar flex-1 overflow-y-auto bg-[#FDFBF7] p-4 md:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="section-title text-lg font-bold text-[#8A6347]">{DAYS[editingDay]}요일 일정</h3>
                <button 
                  onClick={() => setShowCopyConfirm(true)}
                  className="toolbar-button toolbar-button-green rounded-lg px-3 py-1.5 text-sm font-bold text-[#5C8D5D] transition-colors"
                >
                  다른 요일로 복사
                </button>
              </div>

              {showCopyConfirm && (
                <div className="confirm-box mb-4 flex flex-col items-center justify-between gap-4 rounded-xl border border-[#C65D47]/30 bg-[#FFF5F3] p-4 sm:flex-row">
                  <span className="text-[#C65D47] font-bold text-sm">
                    현재 요일의 일정을 다른 모든 평일(월~금)에 덮어쓰시겠습니까?
                  </span>
                  <div className="flex gap-2 shrink-0">
                    <button 
                      onClick={() => setShowCopyConfirm(false)}
                      className="toolbar-button toolbar-button-neutral rounded-lg px-3 py-1.5 text-sm font-bold text-[#8A6347]"
                    >
                      취소
                    </button>
                    <button 
                      onClick={() => {
                        setWeeklySchedule(prev => {
                          const current = prev[editingDay] || [];
                          const createCopy = () => normalizeDaySchedule(current.map(slot => ({ ...slot, id: createSlotId() })));
                          return {
                            ...prev,
                            1: editingDay === 1 ? current : createCopy(),
                            2: editingDay === 2 ? current : createCopy(),
                            3: editingDay === 3 ? current : createCopy(),
                            4: editingDay === 4 ? current : createCopy(),
                            5: editingDay === 5 ? current : createCopy(),
                          };
                        });
                        setShowCopyConfirm(false);
                      }}
                      className="toolbar-button toolbar-button-danger rounded-lg px-3 py-1.5 text-sm font-bold text-white"
                    >
                      복사하기
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {(weeklySchedule[editingDay] || []).length === 0 ? (
                  <div className="empty-slot-state rounded-2xl border border-dashed border-[#E6D5C9] bg-white py-10 text-center font-medium text-[#8A6347]/60">
                    일정이 없습니다. 아래 버튼을 눌러 추가해보세요.
                  </div>
                ) : (
                  (weeklySchedule[editingDay] || []).map((slot, index) => {
                    const isMorningRow = index === 0;
                    const isFixedDurationRow = !isMorningRow && (slot.type === 'class' || slot.type === 'break');
                    return (
                    <div key={slot.id} className="slot-card group flex flex-wrap items-center gap-2 rounded-2xl border border-[#E6D5C9] bg-white p-3 shadow-sm transition-all hover:border-[#B58363] md:gap-3 md:p-4 lg:flex-nowrap">
                      <input
                        type="text"
                        value={slot.name}
                        readOnly={isMorningRow}
                        onChange={(e) => updateSlot(editingDay, slot.id, 'name', e.target.value)}
                        className="slot-name-input -ml-2 min-w-[120px] flex-1 rounded-lg border-none bg-transparent px-2 py-1 text-base font-bold text-[#8A6347] outline-none focus:ring-2 focus:ring-[#5C8D5D]/20 md:text-lg"
                        placeholder="일정 이름"
                      />
                      <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end mt-2 lg:mt-0">
                        <select
                          value={isMorningRow ? 'morning' : slot.type}
                          disabled={isMorningRow}
                          onChange={(e) => updateSlot(editingDay, slot.id, 'type', e.target.value)}
                          className="slot-select cursor-pointer rounded-xl border-none bg-[#F0F5F0] px-2 py-2 text-sm font-bold text-[#3A5A3B] outline-none transition-colors hover:bg-[#E2EFE2] md:px-3 md:text-base"
                        >
                          {isMorningRow && <option value="morning">{MORNING_ACTIVITY_LABEL}</option>}
                          <option value="class">수업</option>
                          <option value="break">쉬는시간</option>
                          <option value="lunch">점심시간</option>
                          <option value="none">기타</option>
                        </select>
                        <div className="flex items-center gap-1 md:gap-2 shrink-0">
                          <input
                            type="time"
                            value={formatMinutesToTime(slot.start)}
                            onChange={(e) => updateSlot(editingDay, slot.id, 'start', parseTimeToMinutes(e.target.value))}
                            className="slot-time-input cursor-pointer rounded-xl border border-[#E6D5C9] bg-[#FDFBF7] px-2 py-2 font-mono text-sm font-bold text-[#8A6347] outline-none transition-colors hover:border-[#B58363] md:px-3 md:text-base"
                          />
                          <span className="text-[#8A6347] font-bold">-</span>
                          <input
                            type="time"
                            value={formatMinutesToTime(slot.end)}
                            disabled={isFixedDurationRow}
                            onChange={(e) => updateSlot(editingDay, slot.id, 'end', parseTimeToMinutes(e.target.value))}
                            className="slot-time-input cursor-pointer rounded-xl border border-[#E6D5C9] bg-[#FDFBF7] px-2 py-2 font-mono text-sm font-bold text-[#8A6347] outline-none transition-colors hover:border-[#B58363] md:px-3 md:text-base"
                          />
                        </div>
                        <button
                          disabled={isMorningRow}
                          onClick={() => removeSlot(editingDay, slot.id)}
                          className="slot-delete shrink-0 rounded-xl p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                          title="일정 삭제"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  )})
                )}
              </div>
              
              <button
                onClick={() => addSlot(editingDay)}
                className="add-slot-button mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#5C8D5D] py-4 text-lg font-bold text-[#5C8D5D] transition-all hover:bg-[#5C8D5D] hover:text-white"
              >
                <Plus size={24} />
                새로운 일정 추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Coffee, Utensils, CalendarClock, Timer, Settings, X, Plus, Trash2, Download, Upload } from 'lucide-react';

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
  const scheduleListRef = useRef<HTMLUListElement>(null);
  const scheduleSlotRefs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    localStorage.setItem('weeklySchedule', JSON.stringify(weeklySchedule));
  }, [weeklySchedule]);

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
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(weeklySchedule));
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
          setWeeklySchedule(normalizeWeeklySchedule(parsed));
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

  // Visual calculations
  const displayTotalTime = mode === 'manual' ? manualTotalTime : scheduleTotalTime;
  const displayTimeLeft = mode === 'manual' ? manualTimeLeft : scheduleTimeLeft;
  const displayIsRunning = mode === 'manual' ? manualIsRunning : scheduleIsRunning;

  const percentage = displayTotalTime > 0 ? displayTimeLeft / displayTotalTime : 0;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = -(circumference - percentage * circumference);

  let colorClass = "text-[#5C8D5D]";
  let strokeColor = "#5C8D5D";
  let pulseClass = "";
  let bgClass = "bg-white";

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
      ? 'bg-[#EAF1FF] text-[#3F5D9A] border-[#C8D6F5]'
      : timerType === 'break'
        ? 'bg-[#ECF8EE] text-[#3F7A46] border-[#CBE8CF]'
        : timerType === 'morning'
          ? 'bg-[#FFF8DF] text-[#8E6A2D] border-[#F0DFAE]'
        : timerType === 'lunch'
          ? 'bg-[#FFF4E8] text-[#9A6432] border-[#F1D5B8]'
          : 'bg-[#F6F2EE] text-[#8A6347]/70 border-[#E6D5C9]';

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
    colorClass = "text-[#E6D5C9]";
    strokeColor = "#E6D5C9";
  } else if (shouldShowTimedMessage && displayTimeLeft === 0) {
    colorClass = "text-[#C65D47]";
    strokeColor = "#C65D47";
    showCharacter = true;
    characterMessage = getCharacterMessage('end');
    speechBubbleSizeClass = "px-8 py-5 md:px-12 md:py-7";
    speechTextSizeClass = "text-3xl md:text-5xl";
    characterWrapSizeClass = "w-56 h-56 md:w-80 md:h-80";
    characterImageScaleClass = "scale-125 md:scale-[1.45]";
  } else if (shouldShowTimedMessage && percentage <= 0.1) {
    colorClass = "text-[#C65D47]";
    strokeColor = "#C65D47";
    showCharacter = true;
    speechBubbleSizeClass = "px-8 py-5 md:px-12 md:py-7";
    speechTextSizeClass = "text-3xl md:text-5xl";
    characterWrapSizeClass = "w-56 h-56 md:w-80 md:h-80";
    characterImageScaleClass = "scale-125 md:scale-[1.45]";
    characterMessage = getCharacterMessage('urgent');
    if (displayIsRunning) {
      pulseClass = "animate-pulse";
      bgClass = "bg-[#FFF5F3]";
    }
  } else if (shouldShowTimedMessage && percentage <= 0.3) {
    colorClass = "text-[#D97736]";
    strokeColor = "#D97736";
    showCharacter = true;
    speechBubbleSizeClass = "px-7 py-4 md:px-10 md:py-6";
    speechTextSizeClass = "text-2xl md:text-4xl";
    characterWrapSizeClass = "w-48 h-48 md:w-64 md:h-64";
    characterImageScaleClass = "scale-[1.15] md:scale-[1.25]";
    characterMessage = getCharacterMessage('warning');
    if (displayIsRunning) {
      bgClass = "bg-[#FFF9F0]";
    }
  }

  if (showCharacter && displayIsRunning) {
    const bobOffset = Math.sin((displayTimeLeft || 0) * 0.8) * 10;
    const tilt = Math.sin((displayTimeLeft || 0) * 1.3) * (percentage <= 0.1 ? 6 : 3);
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

  return (
    <div className="h-[100dvh] w-full bg-[#FDFBF7] p-3 sm:p-4 md:p-8 font-sans overflow-hidden flex items-center justify-center">
      <div className={`w-full h-full max-w-screen-2xl rounded-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col transition-colors duration-1000 ${bgClass}`}>
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Left: Timer Display */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative min-w-0 h-full">
            <div className={`relative flex-1 w-full min-h-0 flex items-center justify-center ${pulseClass}`}>
              <svg viewBox="0 0 200 200" className="max-h-full max-w-full aspect-square transform -rotate-90 rounded-full shadow-inner bg-[#FDFBF7]">
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
            <div className={`mt-4 md:mt-8 text-[clamp(4rem,10vw,11rem)] leading-none font-mono font-bold tracking-tight transition-colors duration-1000 shrink-0 ${colorClass}`}>
              {formatTime(displayTimeLeft)}
            </div>

            {/* Character Notification Overlay (independent from right controls) */}
            <div className={`absolute inset-0 z-20 flex items-center justify-center p-4 transition-all duration-500 ${showCharacter ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>
              <div className="flex flex-col items-center pointer-events-none">
                {/* Speech Bubble */}
                <div className={`relative bg-white rounded-3xl shadow-xl border-4 border-[#E6D5C9] mb-4 md:mb-6 text-center ${speechBubbleSizeClass}`} style={characterMotionStyle}>
                  <p className={`font-bold whitespace-nowrap ${speechTextSizeClass} ${colorClass}`}>{characterMessage}</p>
                  {/* Bubble Tail (pointing down) */}
                  <div className="absolute -bottom-[14px] left-1/2 -translate-x-1/2 w-0 h-0 border-x-[12px] border-x-transparent border-t-[14px] border-t-white z-10"></div>
                  <div className="absolute -bottom-[19px] left-1/2 -translate-x-1/2 w-0 h-0 border-x-[15px] border-x-transparent border-t-[17px] border-t-[#E6D5C9]"></div>
                </div>

                {/* Character Image or Placeholder */}
                <div className={`relative shrink-0 ${characterWrapSizeClass}`} style={characterMotionStyle}>
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
          <div className={`w-full lg:w-[400px] bg-white/60 border-t lg:border-t-0 lg:border-l border-[#E6D5C9]/50 p-5 sm:p-6 lg:p-10 flex flex-col gap-6 shrink-0 relative min-h-0 overflow-hidden`}>
            
            {/* Character Notification Overlay */}
            <div className="hidden">
              {/* Speech Bubble */}
              <div className="relative bg-white px-6 py-4 md:px-8 md:py-6 rounded-3xl shadow-xl border-4 border-[#E6D5C9] mb-6 animate-bounce text-center">
                <p className={`font-bold text-lg md:text-2xl whitespace-nowrap ${colorClass}`}>{characterMessage}</p>
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
            <div className="flex bg-[#E6D5C9]/30 p-1.5 rounded-2xl shrink-0">
              <button
                onClick={() => handleModeSwitch('schedule')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm lg:text-base transition-all ${
                  mode === 'schedule' ? 'bg-white text-[#8A6347] shadow-sm' : 'text-[#8A6347]/60 hover:text-[#8A6347]'
                }`}
              >
                <CalendarClock size={20} />
                시간표 모드
              </button>
              <button
                onClick={() => handleModeSwitch('manual')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm lg:text-base transition-all ${
                  mode === 'manual' ? 'bg-white text-[#8A6347] shadow-sm' : 'text-[#8A6347]/60 hover:text-[#8A6347]'
                }`}
              >
                <Timer size={20} />
                수동 모드
              </button>
            </div>

            <div className={`flex-1 flex flex-col min-h-0 ${mode === 'schedule' ? 'justify-start gap-4' : 'justify-center gap-8'}`}>
              {mode === 'manual' ? (
                <>
                  <div className="flex justify-center items-center gap-6">
                    <button
                      onClick={toggleTimer}
                      className={`w-24 h-24 lg:w-32 lg:h-32 rounded-full flex items-center justify-center text-white shadow-xl transition-transform hover:scale-105 active:scale-95 shrink-0 ${
                        manualIsRunning ? 'bg-[#D97736] hover:bg-[#C0662A]' : 'bg-[#5C8D5D] hover:bg-[#4A734B]'
                      }`}
                    >
                      {manualIsRunning ? <Pause size={48} className="lg:w-14 lg:h-14" /> : <Play size={48} className="ml-2 lg:w-14 lg:h-14 lg:ml-3" />}
                    </button>
                    <button
                      onClick={resetTimer}
                      className="w-16 h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center bg-[#E6D5C9] text-[#8A6347] shadow-lg transition-transform hover:scale-105 active:scale-95 hover:bg-[#D4BCA9] shrink-0"
                    >
                      <RotateCcw size={32} className="lg:w-10 lg:h-10" />
                    </button>
                  </div>

                  <div className="w-full h-px bg-[#E6D5C9] shrink-0"></div>

                  <div className="flex flex-col gap-4 shrink-0">
                    <div className="bg-[#FDFBF7] p-5 rounded-3xl border-2 border-[#E6D5C9] shadow-sm">
                      <h3 className="font-bold text-[#8A6347] mb-4 text-center">직접 시간 설정</h3>
                      <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="flex flex-col items-center">
                          <input 
                            type="number" 
                            value={customMinutes}
                            onChange={(e) => setCustomMinutes(e.target.value)}
                            className="w-20 text-center bg-white text-[#8A6347] font-mono font-bold text-2xl rounded-xl px-2 py-3 outline-none border border-[#E6D5C9] focus:border-[#5C8D5D] focus:ring-2 focus:ring-[#5C8D5D]/20 transition-all"
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
                            className="w-20 text-center bg-white text-[#8A6347] font-mono font-bold text-2xl rounded-xl px-2 py-3 outline-none border border-[#E6D5C9] focus:border-[#5C8D5D] focus:ring-2 focus:ring-[#5C8D5D]/20 transition-all"
                            min="0"
                            max="59"
                          />
                          <span className="text-[#8A6347]/70 font-bold text-sm mt-1">초</span>
                        </div>
                      </div>
                      <button 
                        onClick={applyCustomTime}
                        className="w-full py-3 rounded-xl bg-[#5C8D5D] text-white font-bold text-lg hover:bg-[#4A734B] transition-colors shadow-md active:scale-95"
                      >
                        타이머 설정
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-stretch justify-start h-full gap-3 text-left relative w-full pt-2 min-h-0">
                  <div className="hidden w-24 h-24 rounded-full bg-[#F0F5F0] items-center justify-center text-[#5C8D5D] mb-2 shadow-inner">
                    <CalendarClock size={48} />
                  </div>
                  <div className="flex justify-center">
                    <h2 className="hidden text-2xl lg:text-3xl font-bold text-[#8A6347] mb-2">자동 시간표 모드</h2>
                    <p className="hidden text-lg lg:text-xl text-[#8A6347]/70 font-medium">
                      {currentSlotName === '일정 없음'
                        ? '현재 예정된 일정이 없습니다.'
                        : `현재: ${currentSlotName}`}
                    </p>
                    <div className={`inline-flex items-center justify-center gap-5 px-10 py-5 rounded-full border-2 text-[clamp(2.5rem,4.8vw,3.8rem)] font-extrabold leading-[0.95] tracking-[-0.01em] whitespace-nowrap shadow-sm ${scheduleTypeBadgeClass}`}>
                      {timerType === 'break' ? <Coffee size={48} strokeWidth={2.25} /> : timerType === 'lunch' ? <Utensils size={48} strokeWidth={2.25} /> : timerType === 'class' || timerType === 'morning' ? <CalendarClock size={48} strokeWidth={2.25} /> : <Timer size={48} strokeWidth={2.25} />}
                      <span className="whitespace-nowrap leading-none">{scheduleTypeLabel}</span>
                    </div>
                  </div>
                  
                  <div className="p-5 bg-[#FDFBF7] rounded-3xl border-2 border-[#E6D5C9] w-full text-left shadow-sm flex flex-col flex-[0.9] min-h-0">
                    <div className="mb-3 flex items-center justify-between gap-2 shrink-0">
                      <h3 className="font-bold text-[#8A6347] text-lg lg:text-xl flex items-center gap-2">
                        <CalendarClock size={18} />
                        오늘({DAYS[today]}요일) 시간표
                      </h3>
                      <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-2 text-[#8A6347]/60 hover:text-[#8A6347] transition-colors rounded-lg hover:bg-[#E6D5C9]/30"
                        title="시간표 설정"
                      >
                        <Settings size={22} />
                      </button>
                    </div>
                    <ul ref={scheduleListRef} className="space-y-2 text-[#8A6347]/90 pr-2 text-base lg:text-lg flex-1 overflow-y-auto">
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
                              className={`flex justify-between items-center p-3 rounded-xl transition-colors ${isThisSlot ? 'bg-[#5C8D5D] text-white font-bold shadow-md' : 'hover:bg-[#E6D5C9]/30'}`}
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 md:p-8">
          <div className="bg-[#FDFBF7] rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border-4 border-[#E6D5C9]">
            <div className="p-5 md:p-6 border-b border-[#E6D5C9] flex justify-between items-center bg-white shrink-0">
              <h2 className="text-xl md:text-2xl font-bold text-[#8A6347] flex items-center gap-2">
                <Settings size={24} className="md:w-7 md:h-7" />
                시간표 설정
              </h2>
              <div className="flex items-center gap-2 md:gap-4">
                <button 
                  onClick={exportSchedule}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold text-[#5C8D5D] bg-[#F0F5F0] hover:bg-[#E2EFE2] transition-colors"
                  title="시간표 내보내기"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">백업</span>
                </button>
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold text-[#8A6347] bg-[#FDFBF7] border border-[#E6D5C9] hover:bg-[#F0F5F0] transition-colors"
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
                
                <button onClick={() => setIsSettingsOpen(false)} className="text-[#8A6347]/60 hover:text-[#8A6347] p-2 rounded-full hover:bg-[#FDFBF7] transition-colors">
                  <X size={24} className="md:w-7 md:h-7" />
                </button>
              </div>
            </div>
            
            <div className="flex border-b border-[#E6D5C9] bg-white overflow-x-auto shrink-0 custom-scrollbar">
              {[1, 2, 3, 4, 5].map(day => (
                <button
                  key={day}
                  onClick={() => setEditingDay(day)}
                  className={`flex-1 min-w-[80px] py-3 md:py-4 font-bold text-base md:text-lg transition-colors ${
                    editingDay === day ? 'bg-[#5C8D5D] text-white' : 'text-[#8A6347] hover:bg-[#F0F5F0]'
                  }`}
                >
                  {DAYS[day]}요일
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#FDFBF7] custom-scrollbar">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-[#8A6347] text-lg">{DAYS[editingDay]}요일 일정</h3>
                <button 
                  onClick={() => setShowCopyConfirm(true)}
                  className="text-sm font-bold text-[#5C8D5D] hover:text-[#3A5A3B] bg-[#F0F5F0] px-3 py-1.5 rounded-lg transition-colors"
                >
                  다른 요일로 복사
                </button>
              </div>

              {showCopyConfirm && (
                <div className="mb-4 p-4 bg-[#FFF5F3] border border-[#C65D47]/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <span className="text-[#C65D47] font-bold text-sm">
                    현재 요일의 일정을 다른 모든 평일(월~금)에 덮어쓰시겠습니까?
                  </span>
                  <div className="flex gap-2 shrink-0">
                    <button 
                      onClick={() => setShowCopyConfirm(false)}
                      className="px-3 py-1.5 rounded-lg text-sm font-bold text-[#8A6347] bg-white border border-[#E6D5C9] hover:bg-[#FDFBF7]"
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
                      className="px-3 py-1.5 rounded-lg text-sm font-bold text-white bg-[#C65D47] hover:bg-[#A84A36]"
                    >
                      복사하기
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {(weeklySchedule[editingDay] || []).length === 0 ? (
                  <div className="text-center py-10 text-[#8A6347]/60 font-medium bg-white rounded-2xl border border-[#E6D5C9] border-dashed">
                    일정이 없습니다. 아래 버튼을 눌러 추가해보세요.
                  </div>
                ) : (
                  (weeklySchedule[editingDay] || []).map((slot, index) => {
                    const isMorningRow = index === 0;
                    const isFixedDurationRow = !isMorningRow && (slot.type === 'class' || slot.type === 'break');
                    return (
                    <div key={slot.id} className="flex flex-wrap lg:flex-nowrap items-center gap-2 md:gap-3 bg-white p-3 md:p-4 rounded-2xl border border-[#E6D5C9] shadow-sm group transition-all hover:border-[#B58363]">
                      <input
                        type="text"
                        value={slot.name}
                        readOnly={isMorningRow}
                        onChange={(e) => updateSlot(editingDay, slot.id, 'name', e.target.value)}
                        className="flex-1 min-w-[120px] bg-transparent border-none outline-none font-bold text-[#8A6347] text-base md:text-lg focus:ring-2 focus:ring-[#5C8D5D]/20 rounded-lg px-2 py-1 -ml-2"
                        placeholder="일정 이름"
                      />
                      <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end mt-2 lg:mt-0">
                        <select
                          value={isMorningRow ? 'morning' : slot.type}
                          disabled={isMorningRow}
                          onChange={(e) => updateSlot(editingDay, slot.id, 'type', e.target.value)}
                          className="bg-[#F0F5F0] text-[#3A5A3B] font-bold rounded-xl px-2 md:px-3 py-2 outline-none border-none text-sm md:text-base cursor-pointer hover:bg-[#E2EFE2] transition-colors"
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
                            className="bg-[#FDFBF7] text-[#8A6347] font-mono font-bold rounded-xl px-2 md:px-3 py-2 outline-none border border-[#E6D5C9] text-sm md:text-base cursor-pointer hover:border-[#B58363] transition-colors"
                          />
                          <span className="text-[#8A6347] font-bold">-</span>
                          <input
                            type="time"
                            value={formatMinutesToTime(slot.end)}
                            disabled={isFixedDurationRow}
                            onChange={(e) => updateSlot(editingDay, slot.id, 'end', parseTimeToMinutes(e.target.value))}
                            className="bg-[#FDFBF7] text-[#8A6347] font-mono font-bold rounded-xl px-2 md:px-3 py-2 outline-none border border-[#E6D5C9] text-sm md:text-base cursor-pointer hover:border-[#B58363] transition-colors"
                          />
                        </div>
                        <button
                          disabled={isMorningRow}
                          onClick={() => removeSlot(editingDay, slot.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors shrink-0 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100"
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
                className="mt-4 w-full py-4 rounded-2xl border-2 border-dashed border-[#5C8D5D] text-[#5C8D5D] font-bold text-lg flex items-center justify-center gap-2 hover:bg-[#5C8D5D] hover:text-white transition-all"
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



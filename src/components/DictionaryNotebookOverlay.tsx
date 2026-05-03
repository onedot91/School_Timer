import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  ChevronRight,
  CircleAlert,
  Coffee,
  LoaderCircle,
  Search,
  Timer,
  Utensils,
  X,
} from 'lucide-react';
import {
  DictionaryLookupError,
  type DictionaryResult,
  type Meaning,
  type Syllable,
  createDictionaryResult,
  getDictionaryErrorMessage,
  getWordMeanings,
  getWordSyllables,
} from '../lib/dictionary';

type TimerType = 'break' | 'lunch' | 'class' | 'morning' | 'none';

interface LiveTimerState {
  isVisible: boolean;
  timeText: string;
  progress: number;
  timerType: TimerType;
  timerTypeLabel: string;
  currentSlotName: string;
}

interface DictionaryNotebookOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  liveTimer: LiveTimerState;
}

function NotebookOverlayTimerBadge({
  liveTimer,
}: {
  liveTimer: LiveTimerState;
}) {
  const shouldShowLiveTimerSlotName =
    liveTimer.currentSlotName.length > 0 &&
    liveTimer.currentSlotName !== '일정 없음' &&
    liveTimer.currentSlotName.replace(/\s+/g, '') !== liveTimer.timerTypeLabel.replace(/\s+/g, '');
  const liveTimerBadgeLabel = shouldShowLiveTimerSlotName ? liveTimer.currentSlotName : liveTimer.timerTypeLabel;
  const liveTimerProgress = Math.max(0, Math.min(1, liveTimer.progress));
  const liveTimerRadius = 40;
  const liveTimerCircumference = 2 * Math.PI * liveTimerRadius;
  const liveTimerStrokeDashoffset = liveTimerCircumference * (1 - liveTimerProgress);
  const liveTimerStrokeColor =
    liveTimer.timerType === 'class'
      ? '#5C8D6D'
      : liveTimer.timerType === 'break'
        ? '#7AA160'
        : liveTimer.timerType === 'morning'
          ? '#D19A43'
          : liveTimer.timerType === 'lunch'
            ? '#C47A52'
            : '#B89E87';

  if (!liveTimer.isVisible) return null;

  return (
    <div className="announcement-date-badge" aria-label={`${liveTimerBadgeLabel} ${liveTimer.timeText}`}>
      <svg viewBox="0 0 100 100" className="announcement-date-badge-ring" aria-hidden="true">
        <circle className="announcement-date-badge-track" cx="50" cy="50" r={liveTimerRadius} />
        <circle
          className="announcement-date-badge-fill"
          cx="50"
          cy="50"
          r={liveTimerRadius}
          stroke={liveTimerStrokeColor}
          strokeDasharray={liveTimerCircumference}
          strokeDashoffset={liveTimerStrokeDashoffset}
        />
      </svg>
      <div className="announcement-date-badge-content">
        <span className="announcement-date-badge-icon">
          {liveTimer.timerType === 'break' ? (
            <Coffee size={15} strokeWidth={2.2} />
          ) : liveTimer.timerType === 'lunch' ? (
            <Utensils size={15} strokeWidth={2.2} />
          ) : liveTimer.timerType === 'class' || liveTimer.timerType === 'morning' ? (
            <CalendarClock size={15} strokeWidth={2.2} />
          ) : (
            <Timer size={15} strokeWidth={2.2} />
          )}
        </span>
        <span className="announcement-date-badge-time">{liveTimer.timeText}</span>
        <span className="announcement-date-badge-label">{liveTimerBadgeLabel}</span>
      </div>
    </div>
  );
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightWordInExample = (text: string, word: string) => {
  if (!word) return text;

  const matcher = new RegExp(`(${escapeRegExp(word)})`, 'g');
  const pieces = text.split(matcher);

  return pieces.map((piece, index) =>
    piece === word ? (
      <mark
        key={`${word}-example-${index}`}
        className="rounded-full bg-[#EAF2E4] px-1.5 py-0.5 font-extrabold text-[#4E6846]"
      >
        {piece}
      </mark>
    ) : (
      <React.Fragment key={`${word}-text-${index}`}>{piece}</React.Fragment>
    ),
  );
};

const buildDisplaySyllables = (word: string, syllables: Syllable[] | null) => {
  if (syllables && syllables.length > 0) return syllables;

  return Array.from(word).map((char) => ({
    char,
    isHanja: false,
  })) as Syllable[];
};

const buildCaseHanjaPreview = (syllables: Syllable[]) =>
  syllables
    .filter((syllable) => syllable.isHanja && syllable.hanjaChar)
    .map((syllable) => `${syllable.char}(${syllable.hanjaChar})`)
    .join(' · ');

const normalizeDisplaySyllableNote = (note: string | null) => {
  if (!note) return null;

  const trimmedNote = note.trim();
  if (!trimmedNote) return null;

  const lowerNote = trimmedNote.toLowerCase();
  if (
    lowerNote.includes('native korean') ||
    lowerNote.includes('pure korean') ||
    lowerNote.includes('not a hanja') ||
    lowerNote.includes('not hanja')
  ) {
    return '이 낱말은 고유어라서 한자로 풀이하지 않아요.';
  }

  if (
    lowerNote.includes('homonym') ||
    lowerNote.includes('ambiguous') ||
    lowerNote.includes('context') ||
    lowerNote.includes('multiple hanja')
  ) {
    return '동형이의어일 수 있어서 문맥이 있어야 정확한 한자를 정할 수 있어요.';
  }

  return trimmedNote;
};

const renderRelatedWordChip = (word: string, focusChar: string, isExpanded = false) => {
  const focusIndex = word.indexOf(focusChar);
  const chipClass = isExpanded
    ? 'rounded-[1.55rem] px-5 py-3.5 text-[1.18rem] sm:px-6 sm:py-4 sm:text-[1.3rem]'
    : 'rounded-[1.2rem] px-4 py-3 text-[1.04rem] sm:text-[1.1rem]';
  const focusClass = isExpanded
    ? 'h-11 min-w-11 px-3.5 text-[1.14rem] sm:h-12 sm:min-w-12 sm:text-[1.2rem]'
    : 'h-10 min-w-10 px-3 text-[1rem]';

  if (focusIndex === -1) {
    return (
      <span
        className={`dictionary-related-chip inline-flex items-center border-2 border-[#D5E2CE] bg-white font-extrabold text-[#3F2B20] ${chipClass}`}
      >
        {word}
      </span>
    );
  }

  const before = word.slice(0, focusIndex);
  const after = word.slice(focusIndex + focusChar.length);

  return (
    <span
      className={`dictionary-related-chip inline-flex items-center gap-2 border-2 border-[#D5E2CE] bg-white font-extrabold text-[#3F2B20] ${chipClass}`}
    >
      {before ? <span>{before}</span> : null}
      <span
        className={`dictionary-related-focus inline-flex items-center justify-center rounded-full bg-[#F7E1D5] text-[#C7684A] ${focusClass}`}
      >
        {focusChar}
      </span>
      {after ? <span>{after}</span> : null}
    </span>
  );
};

interface MeaningChoiceItem {
  title: string;
  example: string;
  badge: number;
  subtitle?: string;
  preview?: string;
}

const DICTIONARY_LOADING_MESSAGES = [
  '사전에서 낱말을 찾고 있어요.',
  '뜻과 예문을 차근차근 정리하고 있어요.',
  '글자마다 어떤 한자가 어울리는지 살펴보고 있어요.',
];
const SYLLABLE_LOOKUP_FALLBACK_NOTE = '글자별 한자 풀이는 아직 찾지 못했어요. 뜻부터 먼저 볼 수 있어요.';

function MeaningPanel({
  word,
  meanings,
  isMeaningLoading,
  meaningError,
  onRetry,
  selectionTitle,
  selectionHint,
  selectableItems,
  onSelectMeaning,
}: {
  word: string;
  meanings: Meaning[] | null;
  isMeaningLoading: boolean;
  meaningError: string | null;
  onRetry: () => void;
  selectionTitle?: string;
  selectionHint?: string;
  selectableItems?: MeaningChoiceItem[] | null;
  onSelectMeaning?: (index: number) => void;
}) {
  return (
    <section className="dictionary-card paper-card flex h-full min-h-0 flex-col rounded-[2rem] border border-[#E6D5C9] p-4 sm:p-5 lg:p-6">
      {isMeaningLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={`meaning-loading-${index}`}
              className="dictionary-skeleton-card animate-pulse rounded-[1.5rem] border border-[#E6D5C9] bg-white/90 p-4 sm:p-5"
            >
              <div className="h-6 w-2/3 rounded-full bg-[#E7DACB]" />
              <div className="mt-4 h-4.5 w-full rounded-full bg-[#EEE4D6]" />
              <div className="mt-3 h-4.5 w-5/6 rounded-full bg-[#EEE4D6]" />
            </div>
          ))}
        </div>
      ) : meaningError ? (
        <div className="dictionary-error-card rounded-[1.5rem] border border-[#E8C9B8] bg-[#FFF8F3] p-4 sm:p-5 text-[#B75F47]">
          <div className="flex items-start gap-3">
            <CircleAlert size={24} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[1.08rem] font-extrabold leading-8">{meaningError}</p>
              <button
                type="button"
                onClick={onRetry}
                className="dictionary-secondary-button mt-4 inline-flex items-center gap-2 rounded-full border border-[#D9C8B6] bg-white px-5 py-2.5 text-[0.98rem] font-extrabold text-[#8A6347]"
              >
                다시 보기
              </button>
            </div>
          </div>
        </div>
      ) : selectableItems && selectableItems.length > 0 && onSelectMeaning ? (
        <div className="grid gap-4">
          {selectionTitle || selectionHint ? (
            <div className="px-2 text-center">
              {selectionTitle ? (
                <p className="text-[1.14rem] font-extrabold tracking-[-0.03em] text-[#5F7458] sm:text-[1.22rem]">
                  {selectionTitle}
                </p>
              ) : null}
              {selectionHint ? (
                <p className="mt-2 text-[1rem] font-bold leading-7 text-[#7B8C75]">{selectionHint}</p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-5">
            {selectableItems.map((item, index) => (
              <button
                key={`${word}-meaning-choice-${index}`}
                type="button"
                onClick={() => onSelectMeaning(index)}
                className="dictionary-choice-card overflow-hidden rounded-[2rem] border border-[#E6D8C9] bg-white/95 text-left transition-all hover:border-[#D9C9B8] hover:shadow-[0_14px_26px_rgba(143,113,88,0.1)]"
              >
                <div className="flex items-start gap-5 px-7 py-6 sm:px-8 sm:py-7">
                  <span className="dictionary-badge inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#F7E1D5] text-[1.35rem] font-extrabold text-[#C7684A] sm:h-16 sm:w-16 sm:text-[1.5rem]">
                    {item.badge}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[1.34rem] font-extrabold leading-9 tracking-[-0.04em] text-[#3F2B20] sm:text-[1.5rem]">
                      {item.title}
                    </p>
                    {item.subtitle ? (
                      <p className="mt-3 text-[0.98rem] font-extrabold tracking-[-0.02em] text-[#8A7767]">
                        {item.subtitle}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="border-t border-[#EEE4D6] px-7 py-6 sm:px-8 sm:py-7">
                  <p className="text-[1.12rem] font-bold leading-9 text-[#6E5A49] sm:text-[1.2rem]">
                    {highlightWordInExample(item.example, word)}
                  </p>
                  {item.preview ? (
                    <p className="mt-4 text-[1rem] font-extrabold tracking-[-0.02em] text-[#6E8B63]">
                      {item.preview}
                    </p>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : meanings && meanings.length > 0 ? (
        <div className="grid gap-4">
          {meanings.map((item, index) => (
            <article
              key={`${word}-meaning-${index}`}
              className="dictionary-meaning-card overflow-hidden rounded-[1.65rem] border border-[#E6D5C9] bg-white/94"
            >
              <div className="flex items-center gap-4 px-5 py-4 sm:px-6 sm:py-5">
                <span className="dictionary-badge inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F7E1D5] text-[1.08rem] font-extrabold text-[#C7684A]">
                  {index + 1}
                </span>
                <p className="text-[1.14rem] font-extrabold leading-8 text-[#3F2B20] sm:text-[1.22rem]">{item.meaning}</p>
              </div>

              <div className="border-t border-[#EEE4D6] bg-[#FCF8F2] px-5 py-4 sm:px-6 sm:py-5">
                <p className="text-[1.02rem] font-bold leading-8 text-[#6E5A49] sm:text-[1.08rem]">
                  {highlightWordInExample(item.example, word)}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="dictionary-empty-card rounded-[1.6rem] border border-dashed border-[#E6D5C9] bg-white/70 px-5 py-6 text-center text-[1.08rem] font-bold text-[#8A6347]">
          뜻풀이를 열어 보세요.
        </div>
      )}
    </section>
  );
}

export default function DictionaryNotebookOverlay({
  isOpen,
  onClose,
  liveTimer,
}: DictionaryNotebookOverlayProps) {
  const [searchInput, setSearchInput] = useState('');
  const [dictionaryResult, setDictionaryResult] = useState<DictionaryResult>(() => createDictionaryResult(''));
  const [hasSearched, setHasSearched] = useState(false);
  const [isSyllableLoading, setIsSyllableLoading] = useState(false);
  const [isMeaningLoading, setIsMeaningLoading] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [syllableError, setSyllableError] = useState<string | null>(null);
  const [meaningError, setMeaningError] = useState<string | null>(null);
  const [isMeaningChoiceStage, setIsMeaningChoiceStage] = useState(false);
  const [selectedCaseOptionIndex, setSelectedCaseOptionIndex] = useState<number | null>(null);
  const [selectedSyllableIndex, setSelectedSyllableIndex] = useState<number | null>(null);
  const [revealedSyllableMeaningMap, setRevealedSyllableMeaningMap] = useState<Record<number, boolean>>({});
  const [isMeaningPanelOpen, setIsMeaningPanelOpen] = useState(false);

  const activeRequestIdRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchedWord = dictionaryResult.word;
  const meanings = dictionaryResult.meanings;
  const caseOptions = dictionaryResult.caseOptions;
  const syllableNote = dictionaryResult.syllableNote;
  const displaySyllableNote = normalizeDisplaySyllableNote(syllableNote);
  const displaySyllables = useMemo(
    () => buildDisplaySyllables(searchedWord, dictionaryResult.syllables),
    [dictionaryResult.syllables, searchedWord],
  );
  const hasMeaningResult = Array.isArray(meanings) && meanings.length > 0;
  const hasCaseOptions = Array.isArray(caseOptions) && caseOptions.length > 0;
  const selectedCaseOption =
    selectedCaseOptionIndex !== null ? caseOptions?.[selectedCaseOptionIndex] || null : null;
  const requiresMeaningChoice = isMeaningChoiceStage && (hasCaseOptions || hasMeaningResult);
  const meaningChoiceItems = useMemo<MeaningChoiceItem[]>(() => {
    if (!requiresMeaningChoice) return [];

    if (hasCaseOptions) {
      return (caseOptions || []).map((caseOption, index) => ({
        title: caseOption.meanings[0]?.meaning || caseOption.description,
        example: caseOption.meanings[0]?.example || caseOption.description,
        badge: index + 1,
        subtitle: caseOption.label,
        preview: buildCaseHanjaPreview(caseOption.syllables) || undefined,
      }));
    }

    return (meanings || []).map((meaning, index) => ({
      title: meaning.meaning,
      example: meaning.example,
      badge: index + 1,
    }));
  }, [caseOptions, hasCaseOptions, meanings, requiresMeaningChoice]);
  const hasAnyHanjaSyllable = displaySyllables.some((syllable) => syllable.isHanja);
  const selectedSyllable =
    selectedSyllableIndex !== null ? displaySyllables[selectedSyllableIndex] || null : null;
  const shouldUseMeaningOnlyLayout =
    !isSyllableLoading &&
    !syllableError &&
    !hasAnyHanjaSyllable &&
    (hasMeaningResult || isMeaningLoading || Boolean(meaningError));
  const shouldShowMeaningColumn =
    shouldUseMeaningOnlyLayout || isMeaningPanelOpen || isMeaningLoading || Boolean(meaningError);
  const isExpandedLayout = !shouldShowMeaningColumn;

  const applySyllableError = (error: unknown) => {
    setSyllableError(getDictionaryErrorMessage(error));
  };

  const applyMeaningError = (error: unknown) => {
    setMeaningError(getDictionaryErrorMessage(error));
  };

  const resetSearchUiState = () => {
    setSearchInput('');
    setDictionaryResult(createDictionaryResult(''));
    setHasSearched(false);
    setIsSyllableLoading(false);
    setIsMeaningLoading(false);
    setSyllableError(null);
    setMeaningError(null);
    setIsMeaningChoiceStage(false);
    setSelectedCaseOptionIndex(null);
    setSelectedSyllableIndex(null);
    setRevealedSyllableMeaningMap({});
    setIsMeaningPanelOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;

    activeRequestIdRef.current += 1;
    resetSearchUiState();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      onClose();
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isSyllableLoading) {
      setLoadingMessageIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setLoadingMessageIndex((previous) => (previous + 1) % DICTIONARY_LOADING_MESSAGES.length);
    }, 1450);

    return () => window.clearInterval(interval);
  }, [isSyllableLoading]);

  const openMeaningPanel = async (word: string, requestId: number, forceLoad = false) => {
    setIsMeaningPanelOpen(true);
    setMeaningError(null);

    if (!forceLoad && (isMeaningLoading || hasMeaningResult)) {
      return;
    }

    setIsMeaningLoading(true);

    try {
      const meaningResult = await getWordMeanings(word);
      if (requestId !== activeRequestIdRef.current) return;

      setDictionaryResult((previous) => ({
        word: meaningResult.word,
        syllables: previous.syllables,
        meanings: meaningResult.meanings,
        syllableNote: previous.syllableNote,
        caseOptions: previous.caseOptions,
        entry: {
          ...meaningResult.entry,
          syllables: previous.syllables,
          syllableNote: previous.syllableNote,
          caseOptions: previous.caseOptions,
        },
      }));
    } catch (error) {
      if (requestId !== activeRequestIdRef.current) return;
      applyMeaningError(error);
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setIsMeaningLoading(false);
      }
    }
  };

  const runDictionarySearch = async (rawWord: string) => {
    const word = rawWord.trim();
    const nextRequestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = nextRequestId;

    setHasSearched(true);
    setSearchInput(word);
    setDictionaryResult(createDictionaryResult(word));
    setIsMeaningChoiceStage(false);
    setSelectedCaseOptionIndex(null);
    setSelectedSyllableIndex(null);
    setRevealedSyllableMeaningMap({});
    setIsMeaningPanelOpen(false);
    setSyllableError(null);
    setMeaningError(null);
    setIsMeaningLoading(false);

    if (!word) {
      setHasSearched(false);
      applySyllableError(new DictionaryLookupError('empty_word'));
      return;
    }

    setIsSyllableLoading(true);

    try {
      const [syllableResultState, meaningResultState] = await Promise.allSettled([
        getWordSyllables(word),
        getWordMeanings(word),
      ]);
      if (nextRequestId !== activeRequestIdRef.current) return;

      if (
        syllableResultState.status === 'rejected' &&
        meaningResultState.status === 'fulfilled'
      ) {
        setDictionaryResult({
          word: meaningResultState.value.word,
          syllables: null,
          meanings: meaningResultState.value.meanings,
          syllableNote: SYLLABLE_LOOKUP_FALLBACK_NOTE,
          caseOptions: null,
          entry: {
            ...meaningResultState.value.entry,
            syllables: null,
            syllableNote: SYLLABLE_LOOKUP_FALLBACK_NOTE,
            caseOptions: null,
          },
        });
        setSelectedSyllableIndex(null);
        setIsMeaningChoiceStage(true);
        return;
      }

      if (syllableResultState.status === 'rejected') {
        applySyllableError(syllableResultState.reason);
        return;
      }

      const syllableResult = syllableResultState.value;
      const firstHanjaIndex = syllableResult.syllables.findIndex((syllable) => syllable.isHanja);

      if (syllableResult.status === 'ambiguous' && syllableResult.caseOptions?.length) {
        setDictionaryResult({
          word: syllableResult.word,
          syllables: syllableResult.syllables,
          meanings: null,
          syllableNote: syllableResult.syllableNote,
          caseOptions: syllableResult.caseOptions,
          entry: null,
        });
        setSelectedSyllableIndex(null);
        setIsMeaningChoiceStage(true);
        return;
      }

      if (meaningResultState.status === 'rejected') {
        setDictionaryResult({
          word: syllableResult.word,
          syllables: syllableResult.syllables,
          meanings: null,
          syllableNote: syllableResult.syllableNote,
          caseOptions: syllableResult.caseOptions,
          entry: null,
        });
        setSelectedSyllableIndex(firstHanjaIndex >= 0 ? firstHanjaIndex : null);
        applyMeaningError(meaningResultState.reason);
        setIsMeaningChoiceStage(true);
        return;
      }

      setDictionaryResult({
        word: syllableResult.word,
        syllables: syllableResult.syllables,
        meanings: meaningResultState.value.meanings,
        syllableNote: syllableResult.syllableNote,
        caseOptions: syllableResult.caseOptions,
        entry: {
          ...meaningResultState.value.entry,
          syllables: syllableResult.syllables,
          syllableNote: syllableResult.syllableNote,
          caseOptions: syllableResult.caseOptions,
        },
      });
      setSelectedSyllableIndex(firstHanjaIndex >= 0 ? firstHanjaIndex : null);
      setIsMeaningChoiceStage(true);
    } catch (error) {
      if (nextRequestId !== activeRequestIdRef.current) return;
      applySyllableError(error);
    } finally {
      if (nextRequestId === activeRequestIdRef.current) {
        setIsSyllableLoading(false);
      }
    }
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runDictionarySearch(searchInput);
  };

  const handleMeaningPanelOpen = async () => {
    if (!searchedWord) return;
    if (requiresMeaningChoice && hasMeaningResult) return;

    if (hasMeaningResult) {
      setIsMeaningPanelOpen(true);
      setMeaningError(null);
      return;
    }

    await openMeaningPanel(searchedWord, activeRequestIdRef.current);
  };

  const handleMeaningChoiceSelect = (index: number) => {
    if (hasCaseOptions) {
      const caseOption = caseOptions?.[index];
      if (!caseOption) return;

      const firstHanjaIndex = caseOption.syllables.findIndex((syllable) => syllable.isHanja);

      setSelectedCaseOptionIndex(index);
      setSelectedSyllableIndex(firstHanjaIndex >= 0 ? firstHanjaIndex : null);
      setRevealedSyllableMeaningMap({});
      setMeaningError(null);
      setIsMeaningPanelOpen(false);
      setDictionaryResult((previous) => ({
        word: previous.word,
        syllables: caseOption.syllables,
        meanings: caseOption.meanings,
        syllableNote: null,
        caseOptions: previous.caseOptions,
        entry: previous.entry
          ? {
              ...previous.entry,
              senses: caseOption.senses || previous.entry.senses,
              syllables: caseOption.syllables,
              syllableNote: null,
              caseOptions: previous.caseOptions,
            }
          : previous.entry,
      }));
      setIsMeaningChoiceStage(false);
      return;
    }

    setRevealedSyllableMeaningMap({});
    setMeaningError(null);
    setIsMeaningPanelOpen(false);
    setIsMeaningChoiceStage(false);
  };

  const revealSelectedMeaning = () => {
    if (selectedSyllableIndex === null) return;

    setRevealedSyllableMeaningMap((previous) => ({
      ...previous,
      [selectedSyllableIndex]: true,
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="announcement-overlay fixed inset-0 z-[60] p-1.5 sm:p-2 md:p-3">
      <div className="dictionary-shell mascot-shell app-tone-calm relative mx-auto flex h-[calc(100dvh-0.75rem)] w-full max-w-[1500px] flex-col overflow-hidden rounded-[2rem] md:rounded-[3rem]">
        <div aria-hidden="true" className="mascot-orb mascot-orb-one" />
        <div aria-hidden="true" className="mascot-orb mascot-orb-two" />
        <div aria-hidden="true" className="mascot-leaf mascot-leaf-one" />
        <div aria-hidden="true" className="mascot-leaf mascot-leaf-two" />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-1.5 sm:p-2.5 lg:p-3">
          <div className="mx-auto flex h-full w-full max-w-[1440px] min-h-0 flex-col">
            <div className="dictionary-stage-card paper-card relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2.4rem] border-2 border-[#E6D5C9] bg-[#FFFCF8]">
              <div className={`dictionary-search-header shrink-0 px-3 py-2.5 sm:px-4 sm:py-3 lg:px-5 ${hasSearched ? 'dictionary-search-header-active' : 'dictionary-search-header-idle'}`}>
                <div className="dictionary-search-corner dictionary-search-corner-left">
                  <div className="shrink-0">
                    <NotebookOverlayTimerBadge liveTimer={liveTimer} />
                  </div>
                </div>

                  <form onSubmit={handleSearchSubmit} className={`dictionary-search-form min-w-0 ${hasSearched ? 'dictionary-search-form-active' : 'dictionary-search-form-idle'}`}>
                    <div className={`dictionary-search-bar flex items-center gap-2.5 border-2 border-[#E4D9CB] bg-[#FFFDF9] shadow-[inset_0_1px_0_rgba(255,255,255,0.86)] ${hasSearched ? 'dictionary-search-bar-active' : 'dictionary-search-bar-idle'}`}>
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="궁금한 낱말을 적어 보세요"
                        className="min-w-0 flex-1 bg-transparent text-[clamp(1.8rem,3vw,2.6rem)] font-extrabold tracking-[-0.04em] text-[#3F2B20] outline-none placeholder:text-[#A7B0BD]"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button
                        type="submit"
                        className={`dictionary-search-button inline-flex shrink-0 items-center justify-center border border-[#E8D5C9] bg-[#FFF1EA] text-[#C7684A] shadow-[0_10px_18px_rgba(215,124,96,0.12)] transition-transform hover:scale-[1.02] active:scale-[0.98] ${hasSearched ? 'h-[3.75rem] w-[3.75rem] rounded-[1.25rem] sm:h-[3.95rem] sm:w-[3.95rem]' : 'h-[4.8rem] w-[4.8rem] rounded-[1.55rem] sm:h-[5.05rem] sm:w-[5.05rem]'}`}
                        aria-label="낱말 검색"
                      >
                        {isSyllableLoading ? <LoaderCircle size={hasSearched ? 24 : 28} className="animate-spin" /> : <Search size={hasSearched ? 24 : 28} />}
                      </button>
                    </div>
                  </form>

                  <div className="dictionary-search-corner dictionary-search-corner-right">
                  <button
                    onClick={onClose}
                    className="announcement-close-button memo-close-button shrink-0"
                    type="button"
                    title="돌아가기"
                    aria-label="돌아가기"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className={`dictionary-search-body custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2.5 sm:px-4 sm:py-3 lg:px-5 xl:overflow-hidden ${hasSearched ? 'dictionary-search-body-active' : 'dictionary-search-body-idle'}`}>
                {!hasSearched ? (
                  <div className="dictionary-search-empty-state flex min-h-[13rem] items-center justify-center">
                    <div className="dictionary-empty-card rounded-[1.6rem] border border-dashed border-[#E5D7C8] bg-white/70 px-6 py-7 text-center text-[0.98rem] font-bold text-[#8A6347]">
                      낱말을 찾아 보세요.
                    </div>
                  </div>
                ) : (
                  <div
                    className={`dictionary-results-stage grid h-full min-h-0 gap-2.5 lg:gap-3 ${
                      requiresMeaningChoice || shouldUseMeaningOnlyLayout
                        ? ''
                        : shouldShowMeaningColumn
                          ? 'xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]'
                          : ''
                    }`}
                  >
                    {requiresMeaningChoice ? (
                      <MeaningPanel
                        word={searchedWord}
                        meanings={meanings}
                        isMeaningLoading={isMeaningLoading}
                        meaningError={meaningError}
                        onRetry={() => {
                          void handleMeaningPanelOpen();
                        }}
                        selectionTitle="뜻을 먼저 골라 주세요."
                        selectionHint="선택한 뜻에 맞춰 글자별 한자 풀이를 보여줘요."
                        selectableItems={meaningChoiceItems}
                        onSelectMeaning={handleMeaningChoiceSelect}
                      />
                    ) : shouldUseMeaningOnlyLayout ? (
                      <MeaningPanel
                        word={searchedWord}
                        meanings={meanings}
                        isMeaningLoading={isMeaningLoading}
                        meaningError={meaningError}
                        onRetry={() => {
                          void handleMeaningPanelOpen();
                        }}
                      />
                    ) : (
                      <>
                        <section
                          className={`dictionary-card paper-card flex min-h-0 flex-col rounded-[2rem] border border-[#E6D5C9] ${
                            isExpandedLayout ? 'p-5 sm:p-6 lg:p-8' : 'p-4 sm:p-5 lg:p-6'
                          }`}
                        >
                          {isSyllableLoading ? (
                            <div
                              className={`dictionary-loading-stage ${
                                isExpandedLayout ? 'dictionary-loading-stage-expanded' : 'dictionary-loading-stage-compact'
                              }`}
                              role="status"
                              aria-label="사전에서 낱말을 찾고 있습니다."
                            >
                              <div aria-hidden="true" className="dictionary-loading-glow dictionary-loading-glow-left" />
                              <div aria-hidden="true" className="dictionary-loading-glow dictionary-loading-glow-right" />

                              <div className={`dictionary-loading-track ${isExpandedLayout ? 'gap-4' : 'gap-3'}`}>
                                {Array.from(searchedWord).map((char, index) => (
                                  <div
                                    key={`${char}-${index}`}
                                    className={`dictionary-loading-card inline-flex items-center justify-center border-2 border-[#CFE0C4] bg-white font-extrabold tracking-[-0.06em] text-[#5C8D6D] shadow-[0_14px_24px_rgba(93,118,84,0.12)] ${
                                      isExpandedLayout
                                        ? 'h-[6.2rem] w-[6.2rem] rounded-[1.8rem] text-[3.25rem] sm:h-[7.2rem] sm:w-[7.2rem] sm:text-[3.9rem] lg:h-[8rem] lg:w-[8rem] lg:text-[4.35rem]'
                                        : 'h-[5.3rem] w-[5.3rem] rounded-[1.55rem] text-[2.7rem] sm:h-[5.8rem] sm:w-[5.8rem] sm:text-[2.95rem]'
                                    }`}
                                    style={{ animationDelay: `${index * 120}ms` }}
                                  >
                                    <span className="dictionary-loading-card-text" style={{ animationDelay: `${index * 120}ms` }}>
                                      {char}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              <div className="dictionary-loading-wave" aria-hidden="true">
                                {Array.from({ length: 3 }).map((_, index) => (
                                  <span
                                    key={`dictionary-loading-dot-${index}`}
                                    className="dictionary-loading-wave-dot"
                                    style={{ animationDelay: `${index * 120}ms` }}
                                  />
                                ))}
                              </div>

                              <div className="dictionary-loading-copy">
                                <p key={loadingMessageIndex} className="dictionary-loading-copy-text">
                                  {DICTIONARY_LOADING_MESSAGES[loadingMessageIndex]}
                                </p>
                                <p className="dictionary-loading-copy-subtext">
                                  뜻, 예문, 글자별 한자를 차례대로 살펴보고 있어요.
                                </p>
                              </div>
                            </div>
                          ) : syllableError ? (
                            <div className="dictionary-error-card mt-4 rounded-[1.45rem] border border-[#E8C9B8] bg-[#FFF8F3] p-4 text-[#B75F47]">
                              <div className="flex items-start gap-3">
                                <CircleAlert size={20} className="mt-0.5 shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[0.95rem] font-extrabold">{syllableError}</p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void handleMeaningPanelOpen();
                                    }}
                                    className="dictionary-primary-button mt-3 inline-flex items-center gap-2 rounded-full bg-[#6F8A65] px-4 py-2 text-[0.88rem] font-extrabold text-white shadow-[0_10px_18px_rgba(95,133,79,0.16)]"
                                  >
                                    뜻부터 보기
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div
                                className={`flex flex-wrap items-center justify-center ${
                                  isExpandedLayout ? 'mt-7 gap-5 lg:gap-6' : 'mt-5 gap-4'
                                }`}
                              >
                                {displaySyllables.map((syllable, index) => {
                                  const isSelected = selectedSyllableIndex === index;
                                  const tileClass = isSelected
                                    ? 'border-[#7DA36C] bg-[#6F8A65] text-white shadow-[0_18px_30px_rgba(93,118,84,0.22)]'
                                    : syllable.isHanja
                                      ? 'border-[#CFE0C4] bg-white text-[#5C8D6D] shadow-[0_14px_24px_rgba(93,118,84,0.1)]'
                                      : 'border-[#E6D8C9] bg-[#F7F1E8] text-[#B9A491] opacity-80';

                                  return (
                                    <React.Fragment key={`${syllable.char}-${index}`}>
                                      {index > 0 ? (
                                        <span
                                          className={`inline-flex items-center justify-center rounded-full border border-[#F0D6C8] bg-white font-extrabold text-[#E3B6A0] ${
                                            isExpandedLayout
                                              ? 'h-[3.3rem] w-[3.3rem] text-[2.25rem] sm:h-[3.55rem] sm:w-[3.55rem] sm:text-[2.45rem] lg:h-[3.8rem] lg:w-[3.8rem] lg:text-[2.7rem]'
                                              : 'h-10 w-10 text-[1.9rem] sm:h-11 sm:w-11 sm:text-[2rem]'
                                          }`}
                                        >
                                          +
                                        </span>
                                      ) : null}
                                      <button
                                        type="button"
                                        disabled={!syllable.isHanja}
                                        onClick={() => setSelectedSyllableIndex(index)}
                                        className={`dictionary-syllable-tile inline-flex items-center justify-center border-2 font-extrabold tracking-[-0.06em] transition-all ${
                                          isExpandedLayout
                                            ? 'h-[7rem] w-[7rem] rounded-[1.9rem] text-[3.5rem] sm:h-[8rem] sm:w-[8rem] sm:text-[4.1rem] lg:h-[9.2rem] lg:w-[9.2rem] lg:text-[4.8rem]'
                                            : 'h-[5.5rem] w-[5.5rem] rounded-[1.6rem] text-[2.7rem] sm:h-[6rem] sm:w-[6rem] sm:text-[3rem]'
                                        } ${tileClass}`}
                                      >
                                        {syllable.char}
                                      </button>
                                    </React.Fragment>
                                  );
                                })}
                              </div>

                              {hasAnyHanjaSyllable && selectedSyllable?.isHanja ? (
                                <div
                                  className={`dictionary-answer-panel border-2 border-[#D6E4CE] bg-[#F5FAF4] ${
                                    isExpandedLayout ? 'mt-7 rounded-[2rem] p-6 sm:p-7' : 'mt-4 rounded-[1.7rem] p-4'
                                  }`}
                                >
                                  <div className="flex flex-wrap items-end gap-2">
                                    <span
                                      className={`font-extrabold tracking-[-0.05em] text-[#3F2B20] ${
                                        isExpandedLayout ? 'text-[2.8rem] sm:text-[3.2rem]' : 'text-[2.1rem]'
                                      }`}
                                    >
                                      {selectedSyllable.char}
                                    </span>
                                    <span
                                      className={`font-extrabold tracking-[-0.04em] text-[#C7684A] ${
                                        isExpandedLayout ? 'text-[2.15rem] sm:text-[2.45rem]' : 'text-[1.6rem]'
                                      }`}
                                    >
                                      {selectedSyllable.hanjaChar}
                                    </span>
                                    <span
                                      className={`font-extrabold text-[#5C8D6D] ${
                                        isExpandedLayout ? 'pb-1.5 text-[1.32rem]' : 'pb-1 text-[1.04rem]'
                                      }`}
                                    >
                                      함께 쓰는 낱말
                                    </span>
                                  </div>

                                  <div
                                    className={`dictionary-related-panel border-2 border-[#D7E5D0] bg-white/94 ${
                                      isExpandedLayout ? 'mt-5 rounded-[1.6rem] p-5 sm:p-6' : 'mt-4 rounded-[1.35rem] p-4'
                                    }`}
                                  >
                                    {(selectedSyllable.relatedWords || []).length > 0 ? (
                                      <div className={`flex flex-wrap ${isExpandedLayout ? 'gap-3' : 'gap-2'}`}>
                                        {(selectedSyllable.relatedWords || []).map((relatedWord) => (
                                          <React.Fragment key={`${selectedSyllable.char}-${relatedWord}`}>
                                            {renderRelatedWordChip(relatedWord, selectedSyllable.char, isExpandedLayout)}
                                          </React.Fragment>
                                        ))}
                                      </div>
                                    ) : (
                                      <p
                                        className={`font-bold text-[#7A8D72] ${
                                          isExpandedLayout ? 'text-[1.2rem] sm:text-[1.28rem]' : 'text-[1.04rem]'
                                        }`}
                                      >
                                        비슷한 낱말을 아직 찾지 못했어요.
                                      </p>
                                    )}
                                  </div>

                                  <p
                                    className={`font-extrabold tracking-[-0.03em] text-[#C7684A] ${
                                      isExpandedLayout ? 'mt-6 text-[1.6rem] sm:text-[1.78rem]' : 'mt-4 text-[1.18rem]'
                                    }`}
                                  >
                                    무슨 뜻일까요?
                                  </p>

                                  {revealedSyllableMeaningMap[selectedSyllableIndex || 0] ? (
                                    <div
                                      className={`dictionary-answer-reveal rounded-[1.35rem] bg-[#6F8A65] text-center font-extrabold tracking-[-0.04em] text-white shadow-[0_18px_30px_rgba(93,118,84,0.22)] ${
                                        isExpandedLayout
                                          ? 'mt-5 px-7 py-5 text-[1.78rem] sm:text-[2rem]'
                                          : 'mt-4 px-6 py-4 text-[1.4rem]'
                                      }`}
                                    >
                                      {selectedSyllable.hanjaMeaning}
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={revealSelectedMeaning}
                                      className={`dictionary-answer-button inline-flex items-center justify-center gap-2 rounded-full bg-[#D97D67] font-extrabold text-white shadow-[0_14px_24px_rgba(199,104,74,0.24)] ${
                                        isExpandedLayout
                                          ? 'mt-5 w-full px-7 py-5 text-[1.42rem] sm:text-[1.56rem]'
                                          : 'mt-4 px-6 py-3 text-[1.12rem]'
                                      }`}
                                    >
                                      정답 확인하기
                                      <ChevronRight size={18} />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <>
                                  {displaySyllableNote ? (
                                    <div
                                      className={`rounded-[1.3rem] border border-dashed border-[#D8E3D1] bg-[#FAFCF8] px-4 text-center font-bold text-[#6C7E67] ${
                                        isExpandedLayout ? 'mt-6 py-6 text-[1.24rem]' : 'mt-4 py-4 text-[1.06rem]'
                                      }`}
                                    >
                                      {displaySyllableNote}
                                    </div>
                                  ) : null}
                                  <div
                                    className={`rounded-[1.3rem] border border-dashed border-[#D8E3D1] bg-[#FAFCF8] px-4 text-center font-bold text-[#6C7E67] ${
                                      isExpandedLayout ? 'mt-6 py-6 text-[1.24rem]' : 'mt-4 py-4 text-[1.06rem]'
                                    } ${displaySyllableNote ? 'hidden' : ''}`}
                                  >
                                    {hasAnyHanjaSyllable ? '글자를 눌러 보세요.' : '뜻부터 바로 보여줄게요.'}
                                  </div>
                                </>
                              )}
                            </>
                          )}
                        </section>

                        {shouldShowMeaningColumn ? (
                          <MeaningPanel
                            word={searchedWord}
                            meanings={meanings}
                            isMeaningLoading={isMeaningLoading}
                            meaningError={meaningError}
                            onRetry={() => {
                              void handleMeaningPanelOpen();
                            }}
                          />
                        ) : null}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


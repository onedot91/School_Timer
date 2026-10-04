import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { QuestionSubmissionStatus } from '../../lib/questionSubmissionStatus';

export default function TeacherQuestionSubmissionGrid({ statuses }: {
  statuses: readonly QuestionSubmissionStatus[];
}) {
  const [activeNumber, setActiveNumber] = useState<number | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const previewId = useId();
  const activeStatus = statuses.find(status => status.number === activeNumber);

  const cancelClose = () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };
  const closePreview = () => {
    cancelClose();
    setActiveNumber(null);
    setPosition(null);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(closePreview, 120);
  };
  const showPreview = (number: number, anchor: HTMLDivElement) => {
    cancelClose();
    anchorRef.current = anchor;
    setActiveNumber(number);
  };

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  useLayoutEffect(() => {
    if (!activeStatus) return;
    const placePreview = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const preview = previewRef.current?.getBoundingClientRect();
      if (!anchor || !preview) return;
      const margin = 12;
      const gap = 10;
      const roomOnLeft = anchor.left - margin;
      const roomOnRight = window.innerWidth - anchor.right - margin;
      const beside = Math.max(roomOnLeft, roomOnRight) >= preview.width + gap;
      const left = beside
        ? roomOnLeft >= preview.width + gap ? anchor.left - preview.width - gap : anchor.right + gap
        : anchor.left + (anchor.width - preview.width) / 2;
      const top = beside
        ? anchor.top
        : anchor.bottom + gap + preview.height <= window.innerHeight - margin
          ? anchor.bottom + gap
          : anchor.top - preview.height - gap;
      setPosition({
        left: Math.max(margin, Math.min(left, window.innerWidth - preview.width - margin)),
        top: Math.max(margin, Math.min(top, window.innerHeight - preview.height - margin)),
      });
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      closePreview();
    };
    const dismissOnScroll = (event: Event) => {
      if (event.target instanceof Node && previewRef.current?.contains(event.target)) return;
      closePreview();
    };
    placePreview();
    window.addEventListener('resize', placePreview);
    window.addEventListener('scroll', dismissOnScroll, true);
    window.addEventListener('keydown', dismissOnEscape, true);
    return () => {
      window.removeEventListener('resize', placePreview);
      window.removeEventListener('scroll', dismissOnScroll, true);
      window.removeEventListener('keydown', dismissOnEscape, true);
    };
  }, [activeStatus]);

  return <>
    <div className="question-submission-grid grid grid-cols-[repeat(auto-fit,minmax(4.85rem,1fr))] gap-2">
      {statuses.map(status => (
        <div
          key={status.number}
          className={`question-submission-status-card flex min-h-[5.25rem] flex-col items-center justify-between rounded-[0.9rem] border-2 px-2 py-2.5 shadow-[0_6px_14px_rgba(31,24,18,0.045)] ${
            status.personalSubmitted || status.topicSubmitted ? 'border-[#8FD6BB] bg-[#E8F9F0]' : 'border-[#DCCCA8] bg-white'
          }`}
          role="group"
          tabIndex={0}
          aria-label={`${status.number}번 개인질문 ${status.personalSubmitted ? '제출' : '미제출'}, 주제질문 ${status.topicSubmitted ? '제출' : '미제출'}`}
          aria-describedby={activeNumber === status.number ? previewId : undefined}
          onMouseEnter={event => showPreview(status.number, event.currentTarget)}
          onMouseLeave={scheduleClose}
          onFocus={event => showPreview(status.number, event.currentTarget)}
          onBlur={scheduleClose}
          onClick={event => showPreview(status.number, event.currentTarget)}
        >
          <span className={`font-mono text-[1.45rem] font-black leading-none ${
            status.personalSubmitted || status.topicSubmitted ? 'text-[#176244]' : 'text-[#665F56]'
          }`}>{status.number}</span>
          <span className="flex items-center justify-center gap-2" aria-hidden="true">
            <span className={`h-3.5 w-3.5 rounded-full ${status.personalSubmitted ? 'bg-[#168657]' : 'bg-[#DDE5EC]'}`} />
            <span className={`h-3.5 w-3.5 rounded-full ${status.topicSubmitted ? 'bg-[#347FC4]' : 'bg-[#DDE5EC]'}`} />
          </span>
        </div>
      ))}
    </div>
    {activeStatus ? createPortal(
      <div
        ref={previewRef}
        id={previewId}
        role="tooltip"
        className="question-submission-preview"
        style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? 'visible' : 'hidden' }}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
      >
        <strong className="question-submission-preview-number">{activeStatus.number}번</strong>
        <section className="question-submission-preview-section is-personal">
          <h3>개인 질문</h3>
          <p>{activeStatus.personalQuestion ?? '미제출'}</p>
        </section>
        <section className="question-submission-preview-section is-topic">
          <h3>주제 질문</h3>
          <p>{activeStatus.topicQuestion ?? '미제출'}</p>
        </section>
      </div>, document.body,
    ) : null}
  </>;
}

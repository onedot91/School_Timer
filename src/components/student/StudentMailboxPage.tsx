import { useMemo, useState, type KeyboardEvent } from 'react';
import { Inbox, Mail, MailOpen, PenLine, Reply, Send, SendHorizontal, Stamp, X } from 'lucide-react';
import { CLASS_DONATION_MAIL_IMAGE_SOURCE, CLASS_DONATION_MAIL_SENDER_LABEL } from '../../lib/classDonation';
import { TEACHER_LETTER_RECIPIENT, type StudentLetter } from '../../lib/studentLife';
import StudentHeader from './StudentHeader';

interface StudentMailboxPageProps {
  readonly studentNumber: number;
  readonly letters: readonly StudentLetter[];
  readonly sentLetters: readonly StudentLetter[];
  readonly unreadCount: number;
  readonly isSaving: boolean;
  readonly onRead: (letterId: string) => Promise<void>;
  readonly onSend: (recipient: number, title: string, content: string, replyToId?: string) => Promise<boolean>;
  readonly onBack: () => void;
}

type MailboxFolder = 'inbox' | 'sent';
type MailboxMode = MailboxFolder | 'compose';
type MailKind = 'system' | 'teacher' | 'friend-pink' | 'friend-blue';

const MAILBOX_MODES: readonly MailboxMode[] = ['inbox', 'sent', 'compose'];

const formatLetterDate = (createdAt: string): string => new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
}).format(new Date(createdAt));

const getMailKind = (letter: StudentLetter): MailKind => {
  if (letter.senderLabel.includes('은행') || letter.senderLabel.includes('시스템') || letter.senderLabel.includes('돝돝') || letter.senderLabel === CLASS_DONATION_MAIL_SENDER_LABEL) return 'system';
  if (letter.senderLabel.includes('선생님')) return 'teacher';
  return (letter.senderStudentNumber ?? letter.recipient) % 2 === 0 ? 'friend-blue' : 'friend-pink';
};

const isBankLetter = (letter: StudentLetter): boolean => (
  letter.senderLabel.includes('은행') || letter.senderLabel.includes('돝돝')
);

const isDonationLetter = (letter: StudentLetter): boolean => (
  letter.senderLabel === CLASS_DONATION_MAIL_SENDER_LABEL
);

const getStampLabel = (kind: MailKind): string => {
  if (kind === 'system') return '은행';
  if (kind === 'teacher') return '선생';
  return '친구';
};

const getRecipientLabel = (letter: StudentLetter): string => (
  letter.recipient === TEACHER_LETTER_RECIPIENT ? '선생님' : `${letter.recipient}번`
);

const getLetterDisplayTitle = (title: string): string => (
  title.trim().replace(/^[◆◇▶▷•·]\s*/, '') || '편지가 도착했어요'
);

const preserveKoreanPhraseSpacing = (content: string): string => content
  .replace(/([가-힣]+의) (?=[가-힣])/g, '$1\u00a0')
  .replace(/([가-힣]+(?:을|를)) (?=[가-힣])/g, '$1\u00a0')
  .replace(/(^|\s)(왜|어떻게|언제|어디서|무엇을|누가) (?=[가-힣])/g, '$1$2\u00a0')
  .replace(
    /(^|\s)(이번|다음|저번|지난|오는) (주(?:에는|는|에|부터|까지)?|달(?:에는|은|에|부터|까지)?|학기(?:에는|는|에|부터|까지)?)(?: ([가-힣]+))?/g,
    (_match, leadingSpace: string, determiner: string, period: string, following = '') => (
      `${leadingSpace}${determiner}\u00a0${period}${following ? `\u00a0${following}` : ''}`
    ),
  )
  .replace(/([가-힣]+) (시간(?:에는|은|에|부터|까지)?)/g, '$1\u00a0$2')
  .replace(/([가-힣]+) 한 ([가-힣]+)/g, '$1\u00a0한\u00a0$2')
  .replace(/([가-힣]+(?:을|ㄹ)) 수 ([가-힣]+)/g, '$1\u00a0수\u00a0$2');

export default function StudentMailboxPage({
  studentNumber,
  letters,
  sentLetters,
  unreadCount,
  isSaving,
  onRead,
  onSend,
  onBack,
}: StudentMailboxPageProps) {
  const [mode, setMode] = useState<MailboxMode>('inbox');
  const [folder, setFolder] = useState<MailboxFolder>('inbox');
  const [selectedId, setSelectedId] = useState('');
  const [recipient, setRecipient] = useState(studentNumber === 1 ? 2 : 1);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [replyToId, setReplyToId] = useState<string | undefined>();
  const activeLetters = folder === 'inbox' ? letters : sentLetters;
  const selectedLetter = useMemo(
    () => activeLetters.find((letter) => letter.id === selectedId) ?? null,
    [activeLetters, selectedId],
  );
  const selectedIsBankLetter = selectedLetter !== null && isBankLetter(selectedLetter);
  const selectedIsDonationLetter = selectedLetter !== null && isDonationLetter(selectedLetter);

  const changeFolder = (nextFolder: MailboxFolder) => {
    setFolder(nextFolder);
    setMode(nextFolder);
    setSelectedId('');
  };

  const openLetter = (letter: StudentLetter) => {
    setMode(folder);
    setSelectedId(letter.id);
    if (folder === 'inbox' && letter.readAt === null) void onRead(letter.id);
  };

  const startCompose = () => {
    setReplyToId(undefined);
    setTitle('');
    setContent('');
    setMode('compose');
  };

  const cancelCompose = () => {
    setReplyToId(undefined);
    setTitle('');
    setContent('');
    setMode(folder);
  };

  const activateMode = (nextMode: MailboxMode) => {
    if (nextMode === 'compose') {
      startCompose();
      return;
    }
    changeFolder(nextMode);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentMode: MailboxMode) => {
    let nextIndex: number | null = null;
    const currentIndex = MAILBOX_MODES.indexOf(currentMode);

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % MAILBOX_MODES.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + MAILBOX_MODES.length) % MAILBOX_MODES.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = MAILBOX_MODES.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextMode = MAILBOX_MODES[nextIndex];
    activateMode(nextMode);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`#student-mailbox-tab-${nextMode}`)
      ?.focus();
  };

  const startReply = (letter: StudentLetter) => {
    const replyRecipient = letter.senderStudentNumber
      ?? (letter.senderLabel === '선생님' ? TEACHER_LETTER_RECIPIENT : null);
    if (replyRecipient === null) return;
    setRecipient(replyRecipient);
    const displayTitle = getLetterDisplayTitle(letter.title);
    setTitle(displayTitle.startsWith('답장:') ? displayTitle : `답장: ${displayTitle}`);
    setContent('');
    setReplyToId(letter.id);
    setMode('compose');
  };

  return (
    <div className="student-view student-mailbox-view">
      <StudentHeader
        title="우편함"
        onBack={onBack}
        actions={(
          <div className="student-header-segmented student-mailbox-tabs" role="tablist" aria-label="우편함 메뉴">
            <button
              id="student-mailbox-tab-inbox"
              type="button"
              role="tab"
              aria-controls="student-mailbox-panel"
              aria-selected={mode === 'inbox'}
              aria-label={unreadCount > 0 ? `받은 편지, 새 편지 ${unreadCount}개` : '받은 편지'}
              tabIndex={mode === 'inbox' ? 0 : -1}
              onClick={() => changeFolder('inbox')}
              onKeyDown={(event) => handleTabKeyDown(event, 'inbox')}
            >
              <Inbox size={18} aria-hidden="true" />
              <span>받은 편지</span>
              {unreadCount > 0 ? <span className="student-mail-unread-badge" aria-hidden="true">{unreadCount}</span> : null}
            </button>
            <button id="student-mailbox-tab-sent" type="button" role="tab" aria-controls="student-mailbox-panel" aria-selected={mode === 'sent'} tabIndex={mode === 'sent' ? 0 : -1} onClick={() => changeFolder('sent')} onKeyDown={(event) => handleTabKeyDown(event, 'sent')}>
              <SendHorizontal size={18} aria-hidden="true" />
              <span>보낸 편지</span>
            </button>
            <button id="student-mailbox-tab-compose" type="button" role="tab" aria-controls="student-mailbox-panel" aria-selected={mode === 'compose'} tabIndex={mode === 'compose' ? 0 : -1} onClick={startCompose} onKeyDown={(event) => handleTabKeyDown(event, 'compose')}>
              <PenLine size={18} aria-hidden="true" />
              <span>편지 쓰기</span>
            </button>
          </div>
        )}
      />

      <section
        id="student-mailbox-panel"
        className="student-mailbox-layout"
        role="tabpanel"
        aria-label="고마 우체국"
        aria-labelledby={`student-mailbox-tab-${mode}`}
      >
        <div className="student-mailbox-tray" aria-label={folder === 'inbox' ? '받은 편지 목록' : '보낸 편지 목록'}>
          <div className="student-mailbox-tray-heading">
            {folder === 'inbox' ? <Mail size={20} aria-hidden="true" /> : <SendHorizontal size={20} aria-hidden="true" />}
            <h2>{folder === 'inbox' ? '받은 편지' : '보낸 편지'}</h2>
            <span>{activeLetters.length}</span>
          </div>
          <div className="student-letter-list">
            {activeLetters.length === 0 ? (
              <div className="student-mail-list-empty">
                <MailOpen size={42} aria-hidden="true" />
                <p>{folder === 'inbox' ? '아직 받은 편지가 없어요.' : '아직 보낸 편지가 없어요.'}</p>
              </div>
            ) : activeLetters.map((letter, index) => {
              const kind = getMailKind(letter);
              const isSelected = letter.id === selectedLetter?.id;
              const isUnread = folder === 'inbox' && letter.readAt === null;
              const isFromBank = isBankLetter(letter);
              const isFromDonation = isDonationLetter(letter);
              const senderOrRecipient = folder === 'inbox' ? letter.senderLabel : `받는 사람 ${getRecipientLabel(letter)}`;
              const displayTitle = getLetterDisplayTitle(letter.title);
              return (
                <button
                  key={letter.id}
                  type="button"
                  className="student-mail-envelope"
                  data-kind={kind}
                  data-open={isUnread ? 'false' : 'true'}
                  data-unread={isUnread ? 'true' : undefined}
                  data-selected={isSelected ? 'true' : undefined}
                  aria-label={isUnread
                    ? `새 편지, ${formatLetterDate(letter.createdAt)}`
                    : `${senderOrRecipient}, ${displayTitle}, ${formatLetterDate(letter.createdAt)}`}
                  aria-pressed={isSelected}
                  onClick={() => openLetter(letter)}
                  style={{ zIndex: activeLetters.length - index }}
                >
                  <span className="student-mail-envelope-flap" aria-hidden="true" />
                  <span className="student-mail-envelope-stamp" data-bank={isFromBank ? 'true' : undefined} data-donation={isFromDonation ? 'true' : undefined} aria-hidden="true">
                    {isFromBank ? (
                      <img src="/mail-bank-dol-dol.png" alt="" draggable={false} />
                    ) : isFromDonation ? (
                      <img src={CLASS_DONATION_MAIL_IMAGE_SOURCE} alt="" draggable={false} />
                    ) : (
                      <Stamp size={22} />
                    )}
                  </span>
                  <span className="student-mail-envelope-copy">
                    {isUnread ? null : (
                      <>
                        <span>{senderOrRecipient}</span>
                        <strong>{displayTitle}</strong>
                      </>
                    )}
                    <time dateTime={letter.createdAt}>{formatLetterDate(letter.createdAt)}</time>
                  </span>
                  {isUnread ? <span className="student-mail-wax-seal" aria-hidden="true"><Mail size={14} /></span> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="student-mail-reader-stage">
          {mode === 'compose' ? (
            <form className="student-compose-card student-letter-paper student-letter-compose-paper" onSubmit={(event) => {
              event.preventDefault();
              void onSend(recipient, title, content, replyToId).then((saved) => {
                if (!saved) return;
                setTitle('');
                setContent('');
                setReplyToId(undefined);
                setFolder('inbox');
                setMode('inbox');
                setSelectedId('');
              });
            }}>
              <div className="student-compose-heading">
                <div>
                  <span>{replyToId ? '답장' : '새 편지'}</span>
                  <h2>{replyToId ? '마음을 이어 써요' : '마음을 담아 보내요'}</h2>
                </div>
                <Stamp size={36} aria-hidden="true" />
              </div>
              <label>
                <span>받는 사람</span>
                <select value={recipient} onChange={(event) => setRecipient(Number(event.target.value))}>
                  <option value={TEACHER_LETTER_RECIPIENT}>선생님</option>
                  {Array.from({ length: 23 }, (_, index) => index + 1)
                    .filter((number) => number !== studentNumber)
                    .map((number) => <option key={number} value={number}>{number}번</option>)}
                </select>
              </label>
              <label>
                <span>제목</span>
                <input value={title} maxLength={40} onChange={(event) => setTitle(event.target.value)} placeholder="제목을 적어 주세요" />
              </label>
              <label className="student-compose-body-field">
                <span>내용</span>
                <textarea value={content} maxLength={300} required onChange={(event) => setContent(event.target.value)} placeholder="전하고 싶은 마음을 적어 주세요" />
              </label>
              <div className="student-compose-actions">
                <button type="button" className="student-secondary-action" onClick={cancelCompose} disabled={isSaving}>
                  <X size={20} aria-hidden="true" />취소
                </button>
                <button type="submit" className="student-primary-action" disabled={isSaving || content.trim().length === 0}>
                  <Send size={20} aria-hidden="true" />{isSaving ? '보내는 중' : '보내기'}
                </button>
              </div>
            </form>
          ) : selectedLetter ? (
            <div className="student-mail-opened-envelope" key={selectedLetter.id}>
              <div className="student-mail-reader-envelope" aria-hidden="true" />
              <article className="student-letter-detail student-letter-paper" aria-labelledby="student-mail-letter-title">
                <header className="student-letter-heading">
                  <h2 id="student-mail-letter-title">{getLetterDisplayTitle(selectedLetter.title)}</h2>
                  <span className="student-mail-postmark" data-kind={getMailKind(selectedLetter)} data-bank={selectedIsBankLetter ? 'true' : undefined} data-donation={selectedIsDonationLetter ? 'true' : undefined} aria-label={selectedIsBankLetter ? '은행원 돝돝' : selectedIsDonationLetter ? CLASS_DONATION_MAIL_SENDER_LABEL : `${getStampLabel(getMailKind(selectedLetter))} 우표`}>
                    {selectedIsBankLetter ? (
                      <img src="/mail-bank-dol-dol.png" alt="" draggable={false} />
                    ) : selectedIsDonationLetter ? (
                      <img src={CLASS_DONATION_MAIL_IMAGE_SOURCE} alt="" draggable={false} />
                    ) : (
                      <Stamp size={28} aria-hidden="true" />
                    )}
                  </span>
                </header>
                <p>{preserveKoreanPhraseSpacing(selectedLetter.content)}</p>
                <footer className="student-letter-footer">
                  <strong>{mode === 'sent' ? `${studentNumber}번 드림` : `${selectedLetter.senderLabel} 드림`}</strong>
                </footer>
                {mode === 'inbox' && (selectedLetter.senderStudentNumber !== null || selectedLetter.senderLabel === '선생님') ? (
                  <button type="button" className="student-letter-reply" onClick={() => startReply(selectedLetter)}>
                    <Reply size={20} aria-hidden="true" />답장하기
                  </button>
                ) : null}
              </article>
            </div>
          ) : (
            <div className="student-mail-empty-stage">
              <img src="/mail-carrier-totgi.png" alt="" draggable={false} />
              <p>{activeLetters.length === 0
                ? (folder === 'inbox' ? '도착한 편지가 없어요' : '아직 보낸 편지가 없어요')
                : '편지를 골라 보세요'}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

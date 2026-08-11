import { useMemo, useState } from 'react';
import { Mail, PenLine, Reply, Send } from 'lucide-react';
import { TEACHER_LETTER_RECIPIENT, type StudentLetter } from '../../lib/studentLife';
import StudentHeader from './StudentHeader';

interface StudentMailboxPageProps {
  readonly studentNumber: number;
  readonly letters: readonly StudentLetter[];
  readonly isSaving: boolean;
  readonly onRead: (letterId: string) => Promise<void>;
  readonly onSend: (recipient: number, title: string, content: string, replyToId?: string) => Promise<boolean>;
  readonly onBack: () => void;
}

export default function StudentMailboxPage({ studentNumber, letters, isSaving, onRead, onSend, onBack }: StudentMailboxPageProps) {
  const [mode, setMode] = useState<'inbox' | 'compose'>('inbox');
  const [selectedId, setSelectedId] = useState('');
  const [recipient, setRecipient] = useState(studentNumber === 1 ? 2 : 1);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [replyToId, setReplyToId] = useState<string | undefined>();
  const selectedLetter = useMemo(() => letters.find((letter) => letter.id === selectedId) ?? null, [letters, selectedId]);

  const openLetter = (letter: StudentLetter) => {
    setSelectedId(letter.id);
    if (letter.readAt === null) void onRead(letter.id);
  };

  const startCompose = () => {
    setReplyToId(undefined);
    setTitle('');
    setContent('');
    setMode('compose');
  };

  const startReply = (letter: StudentLetter) => {
    const replyRecipient = letter.senderStudentNumber
      ?? (letter.senderLabel === '선생님' ? TEACHER_LETTER_RECIPIENT : null);
    if (replyRecipient === null) return;
    setRecipient(replyRecipient);
    setTitle(letter.title.startsWith('답장:') ? letter.title : `답장: ${letter.title || '편지'}`);
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
          <div className="student-header-segmented">
            <button type="button" aria-pressed={mode === 'inbox'} onClick={() => setMode('inbox')}><Mail size={18} />받은 편지</button>
            <button type="button" aria-pressed={mode === 'compose'} onClick={startCompose}><PenLine size={18} />편지 쓰기</button>
          </div>
        )}
      />

      {mode === 'inbox' ? (
        <section className="student-mailbox-layout" aria-label="받은 편지">
          <div className="student-letter-list">
            {letters.length === 0 ? <p className="student-empty-state">아직 편지가 없어요.</p> : letters.map((letter) => (
              <button key={letter.id} type="button" className={letter.id === selectedLetter?.id ? 'is-selected' : ''} onClick={() => openLetter(letter)}>
                <span className={letter.readAt === null ? 'student-letter-unread-dot' : ''}>{letter.senderLabel}</span>
                <strong>{letter.title || '편지가 도착했어요'}</strong>
                <time>{new Date(letter.createdAt).toLocaleDateString('ko-KR')}</time>
              </button>
            ))}
          </div>
          <article className="student-letter-detail student-letter-paper">
            {selectedLetter ? (
              <>
                <span>{selectedLetter.senderLabel}</span>
                <h2>{selectedLetter.title || '편지가 도착했어요'}</h2>
                <p>{selectedLetter.content}</p>
                {(selectedLetter.senderStudentNumber !== null || selectedLetter.senderLabel === '선생님') ? (
                  <button type="button" className="student-letter-reply" onClick={() => startReply(selectedLetter)}>
                    <Reply size={20} aria-hidden="true" />답장하기
                  </button>
                ) : null}
              </>
            ) : <p className="student-empty-state">{letters.length === 0 ? '받은 편지가 여기에 모여요.' : '편지를 선택해 주세요.'}</p>}
          </article>
        </section>
      ) : (
        <form className="student-compose-card student-letter-paper student-letter-compose-paper" onSubmit={(event) => {
          event.preventDefault();
          void onSend(recipient, title, content, replyToId).then((saved) => {
            if (!saved) return;
            setTitle('');
            setContent('');
            setReplyToId(undefined);
            setMode('inbox');
          });
        }}>
          {replyToId ? <p className="student-compose-reply-label"><Reply size={18} aria-hidden="true" />답장을 쓰고 있어요</p> : null}
          <label><span>받는 사람</span><select value={recipient} onChange={(event) => setRecipient(Number(event.target.value))}><option value={TEACHER_LETTER_RECIPIENT}>선생님</option>{Array.from({ length: 23 }, (_, index) => index + 1).filter((number) => number !== studentNumber).map((number) => <option key={number} value={number}>{number}번</option>)}</select></label>
          <label><span>제목</span><input value={title} maxLength={40} onChange={(event) => setTitle(event.target.value)} placeholder="제목" /></label>
          <label><span>내용</span><textarea value={content} maxLength={300} required onChange={(event) => setContent(event.target.value)} placeholder="마음을 짧게 전해 보세요" /></label>
          <button type="submit" className="student-primary-action" disabled={isSaving || content.trim().length === 0}><Send size={20} />{isSaving ? '보내는 중' : '보내기'}</button>
        </form>
      )}
    </div>
  );
}

import { ALL_STUDENTS_LETTER_RECIPIENT, getTeacherLetterRecipients, TEACHER_MAIL_STUDENT_NUMBERS } from '../../lib/studentLife';
import { formatStudentNumberLabel } from '../../lib/studentIdentity';

interface TeacherMailRecipientPickerProps {
  readonly recipients: readonly number[];
  readonly isSending: boolean;
  readonly onChange: (recipients: readonly number[]) => void;
}

export default function TeacherMailRecipientPicker({ recipients, isSending, onChange }: TeacherMailRecipientPickerProps) {
  return (
    <fieldset className="teacher-mail-recipient-picker" disabled={isSending}>
      <legend className="sr-only">받는 학생 · {recipients.length}명</legend>
      <div className="teacher-mail-recipient-header">
        <strong aria-hidden="true">받는 학생 · {recipients.length}명</strong>
        <div className="teacher-mail-recipient-tools">
          <button type="button" onClick={() => onChange(getTeacherLetterRecipients(ALL_STUDENTS_LETTER_RECIPIENT))}>전체 학생</button>
          <button type="button" disabled={recipients.length === 0} onClick={() => onChange([])}>선택 해제</button>
        </div>
      </div>
      <div className="teacher-mail-recipient-grid">
        {TEACHER_MAIL_STUDENT_NUMBERS.map((number) => (
          <label key={number} className="teacher-mail-recipient-option">
            <input
              type="checkbox"
              checked={recipients.includes(number)}
              onChange={(event) => onChange(getTeacherLetterRecipients(event.target.checked
                ? [...recipients, number]
                : recipients.filter((recipient) => recipient !== number)))}
            />
            <span>{formatStudentNumberLabel(number)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

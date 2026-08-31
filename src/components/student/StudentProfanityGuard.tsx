import { TriangleAlert } from 'lucide-react';
import {
  useRef,
  useState,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';

import {
  findStudentForbiddenTerm,
  isStudentFreeTextInputType,
  shouldBlockStudentTextWhileTyping,
} from '../../lib/studentProfanity';

type StudentProfanityGuardProps = {
  readonly children: ReactNode;
};

type StudentTextControl = HTMLInputElement | HTMLTextAreaElement;

const getStudentTextControl = (target: EventTarget | null): StudentTextControl | null => {
  if (target instanceof HTMLTextAreaElement) return target;
  if (target instanceof HTMLInputElement && isStudentFreeTextInputType(target.type)) return target;
  return null;
};

const setNativeControlValue = (control: StudentTextControl, value: string) => {
  const prototype = control instanceof HTMLInputElement
    ? HTMLInputElement.prototype
    : HTMLTextAreaElement.prototype;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (valueSetter) {
    valueSetter.call(control, value);
    return;
  }
  control.value = value;
};

const findBlockedControl = (scope: HTMLElement): StudentTextControl | null => {
  for (const input of scope.querySelectorAll('input')) {
    if (!isStudentFreeTextInputType(input.type)) continue;
    if (findStudentForbiddenTerm(input.value) !== null) return input;
  }
  for (const textarea of scope.querySelectorAll('textarea')) {
    if (findStudentForbiddenTerm(textarea.value) !== null) return textarea;
  }
  return null;
};

export const StudentProfanityGuard = ({ children }: StudentProfanityGuardProps) => {
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const acceptedValuesRef = useRef(new WeakMap<StudentTextControl, string>());
  const isRestoringRef = useRef(false);
  const blockNextClickRef = useRef(false);

  const showWarning = () => setIsWarningVisible(true);

  const restoreCommittedValue = (control: StudentTextControl) => {
    const acceptedValue = acceptedValuesRef.current.get(control) ?? '';
    showWarning();
    queueMicrotask(() => {
      isRestoringRef.current = true;
      setNativeControlValue(control, acceptedValue);
      control.dispatchEvent(new Event('input', { bubbles: true }));
      isRestoringRef.current = false;
      control.focus({ preventScroll: true });
    });
  };

  const handleFocusCapture = (event: FocusEvent<HTMLDivElement>) => {
    const control = getStudentTextControl(event.target);
    if (!control || findStudentForbiddenTerm(control.value) !== null) return;
    acceptedValuesRef.current.set(control, control.value);
  };

  const handleInputCapture = (event: FormEvent<HTMLDivElement>) => {
    const control = getStudentTextControl(event.target);
    if (!control) return;
    if (isRestoringRef.current) {
      acceptedValuesRef.current.set(control, control.value);
      return;
    }

    const forbiddenTerm = findStudentForbiddenTerm(control.value);
    if (!shouldBlockStudentTextWhileTyping(control.value)) {
      if (forbiddenTerm === null) {
        acceptedValuesRef.current.set(control, control.value);
        setIsWarningVisible(false);
      }
      return;
    }

    setNativeControlValue(control, acceptedValuesRef.current.get(control) ?? '');
    event.preventDefault();
    event.stopPropagation();
    showWarning();
  };

  const handleBlurCapture = (event: FocusEvent<HTMLDivElement>) => {
    const control = getStudentTextControl(event.target);
    if (!control || findStudentForbiddenTerm(control.value) === null) return;
    event.preventDefault();
    event.stopPropagation();
    restoreCommittedValue(control);
    blockNextClickRef.current = true;
    window.setTimeout(() => {
      blockNextClickRef.current = false;
    }, 0);
  };

  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter') return;
    const control = getStudentTextControl(event.target);
    if (!control || findStudentForbiddenTerm(control.value) === null) return;
    event.preventDefault();
    event.stopPropagation();
    restoreCommittedValue(control);
  };

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (blockNextClickRef.current) {
      blockNextClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('button')) return;
    const blockedControl = findBlockedControl(event.currentTarget);
    if (!blockedControl) return;
    event.preventDefault();
    event.stopPropagation();
    restoreCommittedValue(blockedControl);
  };

  const handleSubmitCapture = (event: FormEvent<HTMLDivElement>) => {
    const blockedControl = findBlockedControl(event.currentTarget);
    if (!blockedControl) return;
    event.preventDefault();
    event.stopPropagation();
    restoreCommittedValue(blockedControl);
  };

  return (
    <div
      className="student-profanity-guard"
      onFocusCapture={handleFocusCapture}
      onInputCapture={handleInputCapture}
      onKeyDownCapture={handleKeyDownCapture}
      onBlurCapture={handleBlurCapture}
      onClickCapture={handleClickCapture}
      onSubmitCapture={handleSubmitCapture}
    >
      {children}
      {isWarningVisible ? (
        <div className="student-profanity-warning" role="alert">
          <TriangleAlert aria-hidden="true" />
          <span><strong>사용할 수 없는 표현이에요.</strong> 다른 말로 바꿔 주세요.</span>
        </div>
      ) : null}
    </div>
  );
};

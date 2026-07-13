import { useLayoutEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type ModalFocusOptions = {
  readonly dialogRef: RefObject<HTMLElement | null>;
  readonly isOpen: boolean;
  readonly onDismiss: () => void;
  readonly initialFocusRef?: RefObject<HTMLElement | null>;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
  readonly isDismissible?: boolean;
};

type IsolatedElementState = {
  readonly element: HTMLElement;
};

type InertOwnership = {
  count: number;
  readonly inert: boolean;
};

const inertOwnership = new WeakMap<HTMLElement, InertOwnership>();

const getFocusableElements = (dialog: HTMLElement): HTMLElement[] => (
  Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => (
    element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true'
  ))
);

const isolateOutsideDialog = (dialog: HTMLElement): IsolatedElementState[] => {
  const isolatedElements: IsolatedElementState[] = [];
  let branch: HTMLElement = dialog;

  while (branch.parentElement) {
    const parent = branch.parentElement;
    for (const sibling of parent.children) {
      if (!(sibling instanceof HTMLElement) || sibling === branch) continue;
      const ownership = inertOwnership.get(sibling);
      if (ownership) ownership.count += 1;
      else inertOwnership.set(sibling, { count: 1, inert: sibling.inert });
      isolatedElements.push({ element: sibling });
      sibling.inert = true;
    }
    branch = parent;
    if (parent === document.body) break;
  }

  return isolatedElements;
};

export const useModalFocus = ({
  dialogRef,
  isOpen,
  onDismiss,
  initialFocusRef,
  returnFocusRef,
  isDismissible = true,
}: ModalFocusOptions): void => {
  const onDismissRef = useRef(onDismiss);
  const isDismissibleRef = useRef(isDismissible);
  onDismissRef.current = onDismiss;
  isDismissibleRef.current = isDismissible;

  useLayoutEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const activeElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const isolatedElements = isolateOutsideDialog(dialog);
    const previousTabIndex = dialog.getAttribute('tabindex');
    const initialFocus = initialFocusRef?.current ?? getFocusableElements(dialog)[0] ?? dialog;

    if (initialFocus === dialog && previousTabIndex === null) dialog.tabIndex = -1;
    initialFocus.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isDismissibleRef.current) {
        event.preventDefault();
        event.stopPropagation();
        onDismissRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusableElements = getFocusableElements(dialog);
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const focusedElement = document.activeElement;
      const shouldWrapBackward = event.shiftKey && focusedElement === firstElement;
      const shouldWrapForward = !event.shiftKey && focusedElement === lastElement;

      if (shouldWrapBackward && lastElement) {
        event.preventDefault();
        lastElement.focus({ preventScroll: true });
      } else if (shouldWrapForward && firstElement) {
        event.preventDefault();
        firstElement.focus({ preventScroll: true });
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);

    return () => {
      dialog.removeEventListener('keydown', handleKeyDown);
      for (const { element } of isolatedElements) {
        const ownership = inertOwnership.get(element);
        if (!ownership) continue;
        ownership.count -= 1;
        if (ownership.count === 0) {
          element.inert = ownership.inert;
          inertOwnership.delete(element);
        }
      }
      if (previousTabIndex === null) dialog.removeAttribute('tabindex');
      else dialog.setAttribute('tabindex', previousTabIndex);

      const requestedReturnTarget = returnFocusRef?.current;
      const topModal = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'))
        .find((element) => element !== dialog && element.isConnected);
      if (topModal && !topModal.contains(requestedReturnTarget ?? null)) return;

      const requestedTargetCanFocus = requestedReturnTarget?.isConnected
        && !requestedReturnTarget.matches(':disabled, [aria-disabled="true"]');
      const parentDialog = requestedReturnTarget?.closest<HTMLElement>('[role="dialog"], .settings-dialog');
      const returnTarget = requestedTargetCanFocus
        ? requestedReturnTarget
        : parentDialog?.isConnected
          ? parentDialog
          : activeElement;
      if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
    };
  }, [dialogRef, initialFocusRef, isOpen, returnFocusRef]);
};

import { motion, useReducedMotion } from 'motion/react';
import { forwardRef, type TextareaHTMLAttributes } from 'react';

interface FailureAutosizeTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly value: string;
}

export const FailureAutosizeTextarea = forwardRef<HTMLTextAreaElement, FailureAutosizeTextareaProps>(
  function FailureAutosizeTextarea({ value, ...props }, ref) {
    const reduceMotion = useReducedMotion();

    return (
      <motion.textarea
        {...props}
        ref={ref}
        value={value}
        rows={1}
        layout={reduceMotion ? false : 'size'}
        transition={{ layout: { type: 'spring', stiffness: 460, damping: 38 } }}
      />
    );
  },
);

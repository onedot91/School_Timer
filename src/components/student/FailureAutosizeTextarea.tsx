import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import { forwardRef } from 'react';

interface FailureAutosizeTextareaProps extends Omit<HTMLMotionProps<'textarea'>, 'value'> {
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

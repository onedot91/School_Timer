import { createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';

import StudentDonationPage from '../../src/components/student/StudentDonationPage.tsx';
import '../../src/index.css';

const isCompleted = new URLSearchParams(window.location.search).get('completed') === '1';
const root = document.getElementById('root');

if (root) {
  createRoot(root).render(createElement('main', { className: 'student-mode-page qa-donation-harness' }, createElement(StudentDonationPage, {
    totalAmount: isCompleted ? 600 : 439,
    targetAmount: 600,
    canDonate: !isCompleted,
    isCompleted,
    triggerRef: createRef<HTMLButtonElement>(),
    onDonate: () => {},
  })));
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import StudentProfileGachaDialog from '../../../src/components/student/StudentProfileGachaDialog';
import { FAILURE_PROFILE_OPTIONS } from '../../../src/lib/failureExhibition';
import '../../../src/index.css';

const resultProfile = FAILURE_PROFILE_OPTIONS[8];

function Harness() {
  return (
    <main className="student-mode-page" style={{ minHeight: '100dvh', background: 'var(--apple-canvas-warm)' }}>
      <StudentProfileGachaDialog
        isOpen
        price={0}
        availableProfiles={FAILURE_PROFILE_OPTIONS}
        onPurchase={async () => {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 80));
          return { ok: true, profileImage: resultProfile.imageSrc, price: 0 };
        }}
        onClose={() => undefined}
      />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);

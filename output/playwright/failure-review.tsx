import React from 'react';
import { createRoot } from 'react-dom/client';
import StudentFailureExhibitionPage from '../../src/components/student/StudentFailureExhibitionPage';
import '../../src/index.css';

const timestamp = new Date().toISOString();
createRoot(document.getElementById('root')!).render(
  <div className="student-canvas-library">
    <StudentFailureExhibitionPage embedded studentNumber={1} profileAssignments={{}}
      stories={Array.from({ length: 6 }, (_, index) => ({
        id: `qa-${index}`, studentNumber: index + 2,
        failure: index % 2 ? '발표를 하다가 준비한 말을 잊어버렸어요. 다음에는 끝까지 말하고 싶어요.' : '축구를 하다가 공을 놓쳤어요.',
        lesson: '다음에는 천천히 다시 도전하면서 연습해 보려고 해요.',
        stamps: [], createdAt: timestamp, updatedAt: timestamp,
      }))}
      isSaving={false} onCreate={async () => false} onStamp={async () => false}
      onOpenBookshelf={() => undefined} onBack={() => undefined} onRequestClose={() => undefined}
    />
  </div>,
);

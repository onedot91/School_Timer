import {
  NUMBER_BASEBALL_REWARD_TIERS,
  evaluateNumberBaseballGuess,
  type NumberBaseballAttempt,
  type NumberBaseballGuess,
} from '../../lib/numberBaseball';
import StudentNumberBaseballResult from './StudentNumberBaseballResult';

type StudentNumberBaseballHistoryProps = {
  readonly answer: NumberBaseballGuess;
  readonly attempts: readonly NumberBaseballAttempt[];
};

export function StudentNumberBaseballHistory({ answer, attempts }: StudentNumberBaseballHistoryProps) {
  const latestAttempt = attempts.at(-1);
  const isComplete = latestAttempt
    ? evaluateNumberBaseballGuess(answer, latestAttempt.guess).strikes === 3
    : false;
  const currentAttempt = !isComplete && attempts.length < 9 ? attempts.length + 1 : null;
  const rewardForAttempt = (attemptNumber: number) => (
    NUMBER_BASEBALL_REWARD_TIERS.find(({ startAttempt, endAttempt }) => (
      attemptNumber >= startAttempt && attemptNumber <= endAttempt
    ))?.reward ?? 5
  );

  return (
    <section className="student-baseball-history" aria-label="내 기록">
      <header className="student-baseball-history-header">
        <h2>도전 기록</h2>
        <div className="student-baseball-reward-guide" aria-label="정답 보상">
          {NUMBER_BASEBALL_REWARD_TIERS.map(({ startAttempt, endAttempt, reward }) => (
            <span key={startAttempt} className={`student-baseball-reward-guide-item is-reward-${reward}`}>
              <b>{startAttempt}~{endAttempt}회</b>
              <strong>+{reward}고마</strong>
            </span>
          ))}
        </div>
      </header>
      <ol className="student-baseball-history-list">
        {Array.from({ length: 9 }, (_, index) => {
          const attemptNumber = index + 1;
          const reward = rewardForAttempt(attemptNumber);
          const attempt = attempts[index];
          if (!attempt) {
            const isCurrent = attemptNumber === currentAttempt;
            return (
              <li
                key={attemptNumber}
                className={`is-empty is-reward-${reward}${isCurrent ? ' is-current' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`${attemptNumber}회, ${isCurrent ? `지금 도전, 맞히면 ${reward} 고마` : '아직 도전하지 않음'}`}
              >
                <span className="student-baseball-history-order">{attemptNumber}</span>
                {isCurrent ? (
                  <span className="student-baseball-history-placeholder">
                    <b>지금 도전</b>
                    <strong>+{reward}고마</strong>
                  </span>
                ) : null}
              </li>
            );
          }
          return (
            <li key={attemptNumber} className={`is-reward-${reward}`}>
              <span className="student-baseball-history-order">{attemptNumber}</span>
              <div className="student-baseball-attempt-summary">
                <strong>{attempt.guess.join('')}</strong>
                <div className="student-baseball-attempt-result">
                  <span aria-hidden="true">↓</span>
                  <StudentNumberBaseballResult result={evaluateNumberBaseballGuess(answer, attempt.guess)} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

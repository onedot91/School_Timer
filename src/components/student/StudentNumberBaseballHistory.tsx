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

  return (
    <section className="student-baseball-history" aria-label="내 기록">
      <div className="student-baseball-history-groups">
        {NUMBER_BASEBALL_REWARD_TIERS.map(({ startAttempt, endAttempt, reward }) => (
          <section
            key={startAttempt}
            className={`student-baseball-history-tier is-reward-${reward}`}
            aria-label={`${startAttempt}회부터 ${endAttempt}회까지, 성공하면 ${reward} 고마`}
          >
            <header>
              <span>+{reward} 고마</span>
            </header>
            <ol start={startAttempt}>
              {Array.from({ length: endAttempt - startAttempt + 1 }, (_, offset) => {
                const attemptNumber = startAttempt + offset;
                const attempt = attempts[attemptNumber - 1];
                if (!attempt) {
                  const isCurrent = attemptNumber === currentAttempt;
                  return (
                    <li
                      key={attemptNumber}
                      className={`is-empty${isCurrent ? ' is-current' : ''}`}
                      aria-current={isCurrent ? 'step' : undefined}
                      aria-label={`${attemptNumber}회, ${isCurrent ? '다음 입력' : '입력 전'}`}
                    >
                      <span className="student-baseball-history-order">{attemptNumber}회</span>
                      <span className="student-baseball-history-placeholder">
                        {isCurrent ? '다음 입력' : '입력 전'}
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={attemptNumber}>
                    <span className="student-baseball-history-order">{attemptNumber}회</span>
                    <strong>{attempt.guess.join('')}</strong>
                    <StudentNumberBaseballResult result={evaluateNumberBaseballGuess(answer, attempt.guess)} />
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </section>
  );
}

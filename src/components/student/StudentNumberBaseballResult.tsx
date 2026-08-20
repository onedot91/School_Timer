import {
  getNumberBaseballResultDisplays,
  type NumberBaseballResult,
} from '../../lib/numberBaseball';

type StudentNumberBaseballResultProps = {
  readonly result: NumberBaseballResult;
};

export default function StudentNumberBaseballResult({ result }: StudentNumberBaseballResultProps) {
  const displays = getNumberBaseballResultDisplays(result);
  const labels = { strike: '스트라이크', ball: '볼', out: '아웃' } as const;

  return (
    <div
      className="student-baseball-result-chips"
      aria-label={displays.map((display) => (
        display.kind === 'out' ? labels.out : `${display.value.slice(0, -1)} ${labels[display.kind]}`
      )).join(', ')}
    >
      {displays.map((display) => (
        <span key={display.kind} className={`student-baseball-result-chip is-${display.kind}`}>
          <strong>{display.value}</strong>
          <small>{labels[display.kind]}</small>
        </span>
      ))}
    </div>
  );
}

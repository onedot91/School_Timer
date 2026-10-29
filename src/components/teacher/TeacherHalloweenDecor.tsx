import '../../teacherHalloween.css';

const RIB_RADII = [34, 64, 88];

export function TeacherHalloweenPumpkin() {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 200" className="halloween-pumpkin-overlay">
      {RIB_RADII.map((rx) => (
        <ellipse key={rx} className="halloween-pumpkin-rib" cx="100" cy="100" rx={rx} ry="98" />
      ))}
      <path className="halloween-pumpkin-vine" d="M108 4 C120 -6 134 -2 132 8 C130 16 120 14 123 8" />
      <path className="halloween-pumpkin-leaf" d="M110 2 C118 -12 140 -14 148 -6 C138 -2 124 4 110 2 Z" />
      <path className="halloween-pumpkin-stem" d="M92 8 C93 -4 94 -12 99 -18 L108 -14 C104 -8 104 0 106 8 C102 11 96 11 92 8 Z" />
    </svg>
  );
}

function Bat({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 64 32" className={`halloween-bat ${className}`}>
      <g className="halloween-bat-wing halloween-bat-wing-left">
        <path d="M30 16 C24 6 14 4 2 10 C8 12 9 16 8 20 C13 16 17 18 19 22 C22 17 26 17 30 19 Z" />
      </g>
      <g className="halloween-bat-wing halloween-bat-wing-right">
        <path d="M34 16 C40 6 50 4 62 10 C56 12 55 16 56 20 C51 16 47 18 45 22 C42 17 38 17 34 19 Z" />
      </g>
      <ellipse cx="32" cy="18" rx="5" ry="6.5" />
      <path d="M28 12 L29 7 L31 11 Z M36 12 L35 7 L33 11 Z" />
      <circle className="halloween-bat-eye" cx="30.2" cy="16.5" r="1.1" />
      <circle className="halloween-bat-eye" cx="33.8" cy="16.5" r="1.1" />
    </svg>
  );
}

export function TeacherHalloweenScenery() {
  return (
    <div aria-hidden="true" className="halloween-scenery">
      <svg viewBox="0 0 120 120" className="halloween-web">
        <g className="halloween-web-threads">
          <path d="M0 0 L120 6 M0 0 L110 46 M0 0 L84 84 M0 0 L46 110 M0 0 L6 120" />
          <path d="M28 1.4 Q24 12 26 10.6 Q19 19 19.8 19.8 Q13 24 10.6 26 Q4 28 1.4 28" />
          <path d="M58 2.9 Q50 25 53.6 22.4 Q40 40 41 41 Q26 50 22.4 53.6 Q8 58 2.9 58" />
          <path d="M90 4.5 Q78 36 82 34 Q62 60 62 62 Q38 76 34 82 Q12 88 4.5 90" />
        </g>
      </svg>
      <div className="halloween-spider">
        <span className="halloween-spider-thread" />
        <svg viewBox="0 0 40 36" className="halloween-spider-body">
          <path className="halloween-spider-legs" d="M14 16 L4 8 M14 19 L2 18 M14 22 L4 30 M26 16 L36 8 M26 19 L38 18 M26 22 L36 30" />
          <circle cx="20" cy="20" r="9" />
          <circle cx="20" cy="10" r="5" />
          <circle className="halloween-spider-eye" cx="18" cy="9.5" r="1.4" />
          <circle className="halloween-spider-eye" cx="22" cy="9.5" r="1.4" />
        </svg>
      </div>
      <div className="halloween-moon" />
      <Bat className="halloween-bat-one" />
      <Bat className="halloween-bat-two" />
      <Bat className="halloween-bat-three" />
      <svg viewBox="0 0 80 96" className="halloween-ghost">
        <path className="halloween-ghost-body" d="M40 4 C20 4 8 20 8 42 L8 86 L18 78 L28 88 L40 78 L52 88 L62 78 L72 86 L72 42 C72 20 60 4 40 4 Z" />
        <ellipse className="halloween-ghost-eye" cx="30" cy="40" rx="4" ry="5.5" />
        <ellipse className="halloween-ghost-eye" cx="50" cy="40" rx="4" ry="5.5" />
        <ellipse className="halloween-ghost-mouth" cx="40" cy="54" rx="4.5" ry="3.5" />
        <ellipse className="halloween-ghost-cheek" cx="22" cy="50" rx="5" ry="3" />
        <ellipse className="halloween-ghost-cheek" cx="58" cy="50" rx="5" ry="3" />
      </svg>
      <svg viewBox="0 0 150 80" className="halloween-pumpkin-patch">
        <g transform="translate(6 22)">
          <ellipse className="halloween-patch-pumpkin" cx="40" cy="34" rx="38" ry="24" />
          <path className="halloween-patch-rib" d="M40 10 C30 20 30 48 40 58 M40 10 C50 20 50 48 40 58 M22 13 C12 24 14 46 24 56 M58 13 C68 24 66 46 56 56" />
          <path className="halloween-patch-stem" d="M37 12 C37 6 38 2 42 0 L46 3 C43 5 42 8 43 12 Z" />
          <path className="halloween-patch-face" d="M26 28 L32 20 L38 28 Z M42 28 L48 20 L54 28 Z M24 38 Q40 52 56 38 L50 40 L46 36 L40 41 L34 36 L30 40 Z" />
        </g>
        <g transform="translate(88 42)">
          <ellipse className="halloween-patch-pumpkin halloween-patch-pumpkin-small" cx="26" cy="20" rx="25" ry="16" />
          <path className="halloween-patch-rib" d="M26 4 C19 11 19 29 26 36 M26 4 C33 11 33 29 26 36" />
          <path className="halloween-patch-stem" d="M24 5 C24 1 25 -2 28 -3 L31 -1 C29 0 28 2 29 5 Z" />
        </g>
      </svg>
    </div>
  );
}

export default function LoadingLabel({ children = '불러오는 중' }: { readonly children?: string }) {
  const letters = Array.from(children);
  const dotsStart = .15 + Math.max(0, letters.length - 1) * .09 + .65;
  return (
    <span className="goma-loading-label">
      <span className="sr-only">{children}</span>
      <span className="goma-loading-letters" aria-hidden="true">
        {letters.map((letter, index) => (
          <span className="goma-loading-letter" key={index} style={{ animationDelay: `${.15 + index * .09}s` }}>{letter === ' ' ? '\u00a0' : letter}</span>
        ))}
      </span>
      <span className="goma-loading-dots" aria-hidden="true">
        {[0, 1, 2].map((index) => <span key={index} style={{ animationDelay: `${dotsStart + index * .14}s` }}>.</span>)}
      </span>
    </span>
  );
}

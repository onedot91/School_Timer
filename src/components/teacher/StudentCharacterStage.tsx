import { useEffect, useRef, type ReactNode } from 'react';

export default function StudentCharacterStage({ children, lookBackProbability = .4 }: { children: ReactNode; lookBackProbability?: number }) {
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    const seen = new WeakMap<HTMLElement, number>();
    const looked = new WeakSet<HTMLElement>();
    const greeted = new WeakSet<HTMLElement>();
    const encounters = new WeakMap<HTMLElement, WeakSet<HTMLElement>>();
    const active = new Map<HTMLElement, { start: number; kind: 'look' | 'greet' }>();
    const clear = (node: HTMLElement) => {
      delete node.dataset.encounter;
      delete node.dataset.encounterPhase;
      delete node.dataset.greetingSpeaker;
      active.delete(node);
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const timer = window.setInterval(() => {
      const now = performance.now();
      if (document.hidden || reduced.matches) {
        active.forEach((_, node) => clear(node));
        return;
      }
      const nodes = Array.from(root.querySelectorAll<HTMLElement>('.student-character-showcase'));
      active.forEach((action, node) => {
        const age = now - action.start;
        if (!node.isConnected || age >= (action.kind === 'look' ? 1800 : 2200)) clear(node);
        else {
          const phase = age < 250 ? 'pause' : age < (action.kind === 'look' ? 1450 : 1800) ? 'act' : 'settle';
          if (node.dataset.encounterPhase !== phase) node.dataset.encounterPhase = phase;
        }
      });
      const positions = nodes.map(node => ({ node, box: (node.querySelector('.student-character-image') ?? node).getBoundingClientRect() }));
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const a = positions[i], b = positions[j];
          if (active.has(a.node) || active.has(b.node) || greeted.has(a.node) || greeted.has(b.node)) continue;
          const [left, right] = a.box.x < b.box.x ? [a, b] : [b, a];
          const distance = right.box.x + right.box.width / 2 - left.box.x - left.box.width / 2;
          const sameLevel = a.node.dataset.walkLane !== undefined && a.node.dataset.walkLane === b.node.dataset.walkLane;
          if (left.node.dataset.direction !== 'right' || right.node.dataset.direction !== 'left' || !sameLevel) continue;
          if (left.box.x < 0 || right.box.right > innerWidth || distance > (a.box.width + b.box.width) * .6) continue;
          if (encounters.get(a.node)?.has(b.node)) continue;
          const partners = encounters.get(a.node) ?? new WeakSet<HTMLElement>();
          partners.add(b.node);
          encounters.set(a.node, partners);
          for (const { node } of [left, right]) {
            greeted.add(node);
            node.dataset.greetingSpeaker = 'true';
            node.dataset.encounter = 'greet';
            node.dataset.encounterPhase = 'pause';
            active.set(node, { start: now, kind: 'greet' });
          }
        }
      }
      positions.forEach(({ node, box }, index) => {
        if (!seen.has(node)) {
          seen.set(node, now);
          if (Math.random() >= lookBackProbability) looked.add(node);
        }
        if (active.has(node) || looked.has(node) || greeted.has(node) || box.left < 0 || box.right > innerWidth) return;
        if (now - (seen.get(node) ?? now) < 6000 + index * 3000) return;
        looked.add(node);
        node.dataset.encounter = 'look';
        node.dataset.encounterPhase = 'pause';
        active.set(node, { start: now, kind: 'look' });
      });
    }, 100);
    return () => { window.clearInterval(timer); active.forEach((_, node) => clear(node)); };
  }, [lookBackProbability]);
  return <div ref={stage} className="student-character-stage pointer-events-none absolute inset-0 overflow-hidden">{children}</div>;
}

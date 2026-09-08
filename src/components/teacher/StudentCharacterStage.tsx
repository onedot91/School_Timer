import { shouldCharactersGreet } from '../../lib/studentCharacterEncounter';
import { useEffect, useRef, type ReactNode } from 'react';

export default function StudentCharacterStage({ children, lookBackProbability = .3 }: { children: ReactNode; lookBackProbability?: number }) {
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    const previousCenters = new WeakMap<HTMLElement, number>();
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
      if (document.hidden) {
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
          if (active.get(a.node)?.kind === 'greet' || active.get(b.node)?.kind === 'greet') continue;
          if (!shouldCharactersGreet(
            { lane: a.node.dataset.walkLane, direction: a.node.dataset.direction, left: a.box.left, right: a.box.right, previousCenter: previousCenters.get(a.node) },
            { lane: b.node.dataset.walkLane, direction: b.node.dataset.direction, left: b.box.left, right: b.box.right, previousCenter: previousCenters.get(b.node) },
            innerWidth,
          )) continue;
          if (encounters.get(a.node)?.has(b.node)) continue;
          const partners = encounters.get(a.node) ?? new WeakSet<HTMLElement>();
          partners.add(b.node);
          encounters.set(a.node, partners);
          const reversePartners = encounters.get(b.node) ?? new WeakSet<HTMLElement>();
          reversePartners.add(a.node);
          encounters.set(b.node, reversePartners);
          for (const { node } of [a, b]) {
            clear(node);
            looked.add(node);
            greeted.add(node);
            node.dataset.greetingSpeaker = 'true';
            node.dataset.encounter = 'greet';
            node.dataset.encounterPhase = 'pause';
            active.set(node, { start: now, kind: 'greet' });
          }
        }
      }
      positions.forEach(({ node, box }, index) => {
        previousCenters.set(node, box.left + box.width / 2);
        if (reduced.matches) return;
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

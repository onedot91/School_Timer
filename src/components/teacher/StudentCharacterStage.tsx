import { shouldCharactersGreet } from '../../lib/studentCharacterEncounter';
import { useEffect, useRef, type ReactNode } from 'react';

export default function StudentCharacterStage({ children }: { children: ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    const previousCenters = new WeakMap<HTMLElement, number>();
    const encounters = new WeakMap<HTMLElement, WeakSet<HTMLElement>>();
    const active = new Map<HTMLElement, { start: number; kind: 'look' | 'greet' }>();
    const isTornado = (node: HTMLElement) => node.dataset.walkStyle === 'tornado';
    const isBlown = (node: HTMLElement) => node.dataset.tornadoBlown === 'true';
    const getImageBox = (node: HTMLElement) => (node.querySelector('.student-character-image') ?? node).getBoundingClientRect();
    // 토네이도 바람이 닿는 거리 안에 같은 방향 캐릭터가 들어오면 토네이도 쪽으로 빨려 들어가 날아간다.
    // 뒤처진 캐릭터도, 따라잡기 전에 화면을 벗어날 앞 캐릭터도 놓치지 않도록 겹칠 때까지 기다리지 않는다.
    const sweepTornadoes = () => {
      const nodes = Array.from(root.querySelectorAll<HTMLElement>('.student-character-showcase')).filter(node => !isBlown(node));
      const isOnScreen = (box: DOMRect) => box.left + box.width / 2 > 0 && box.left + box.width / 2 < innerWidth;
      nodes.filter(isTornado).forEach(tornado => {
        const tornadoBox = getImageBox(tornado);
        if (!isOnScreen(tornadoBox)) return;
        const tornadoCenter = tornadoBox.left + tornadoBox.width / 2;
        nodes.forEach(node => {
          if (node === tornado || isTornado(node) || isBlown(node) || node.dataset.direction !== tornado.dataset.direction) return;
          const box = getImageBox(node);
          const pull = tornadoCenter - (box.left + box.width / 2);
          if (!isOnScreen(box) || Math.abs(pull) > innerWidth * .35) return;
          clear(node);
          delete node.dataset.spacingWait;
          node.style.setProperty('--student-character-blow-pull-x', `${Math.round(pull)}px`);
          node.dataset.tornadoBlown = 'true';
        });
      });
    };
    const clear = (node: HTMLElement) => {
      delete node.dataset.encounter;
      delete node.dataset.encounterPhase;
      delete node.dataset.greetingSpeaker;
      delete node.dataset.lookFlip;
      active.delete(node);
    };
    // 모서리 빼꼼이 나오면 가장 가까이 걷던 캐릭터가 멈춰서 그쪽을 보며 "뭐지?" 한다.
    const onPeek = (event: Event) => {
      const detail = (event as CustomEvent<{ x: number; y: number }>).detail;
      // 걷기·빼꼼처럼 동작 줄이기 설정에서도 반응한다.
      if (!detail || document.hidden) return;
      const now = performance.now();
      let nearest: { node: HTMLElement; distance: number; center: number } | null = null;
      root.querySelectorAll<HTMLElement>('.student-character-showcase').forEach(node => {
        // 토네이도는 멈추지 않고, 날아가는 캐릭터는 돌아볼 틈이 없다.
        if (active.has(node) || isTornado(node) || isBlown(node)) return;
        const box = (node.querySelector('.student-character-image') ?? node).getBoundingClientRect();
        if (box.right <= 0 || box.left >= innerWidth) return;
        const center = box.left + box.width / 2;
        const distance = Math.abs(center - detail.x);
        if (distance > innerWidth * .75) return;
        if (!nearest || distance < nearest.distance) nearest = { node, distance, center };
      });
      if (!nearest) return;
      const { node, center } = nearest as { node: HTMLElement; distance: number; center: number };
      const peekIsBehind = node.dataset.direction === 'left' ? detail.x > center : detail.x < center;
      node.dataset.lookFlip = peekIsBehind ? 'true' : 'false';
      node.dataset.encounter = 'look';
      node.dataset.encounterPhase = 'pause';
      active.set(node, { start: now, kind: 'look' });
    };
    root.addEventListener('studentcharacterpeek', onPeek);
    const timer = window.setInterval(() => {
      const now = performance.now();
      // 일부 화면(앱 안 미리보기 등)은 보이는 중에도 hidden으로 알려 오므로 토네이도는 항상 판정한다.
      sweepTornadoes();
      if (document.hidden) {
        active.forEach((_, node) => clear(node));
        return;
      }
      const nodes = Array.from(root.querySelectorAll<HTMLElement>('.student-character-showcase')).filter(node => !isBlown(node));
      active.forEach((action, node) => {
        const age = now - action.start;
        // "뭐지?"는 빼꼼이 다 나와 있는 동안 읽을 수 있게 약 2.6초 보여 준다.
        if (!node.isConnected || age >= (action.kind === 'look' ? 3200 : 2200)) clear(node);
        else {
          const phase = age < 250 ? 'pause' : age < (action.kind === 'look' ? 2850 : 1800) ? 'act' : 'settle';
          if (node.dataset.encounterPhase !== phase) node.dataset.encounterPhase = phase;
        }
      });
      const positions = nodes.map(node => ({ node, box: (node.querySelector('.student-character-image') ?? node).getBoundingClientRect() }));
      const waiting = new Set<HTMLElement>();
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const a = positions[i], b = positions[j];
          const direction = a.node.dataset.direction;
          if (direction !== b.node.dataset.direction || (direction !== 'left' && direction !== 'right')) continue;
          if ([a, b].some(({ box }) => box.right <= 0 || box.left >= innerWidth)) continue;
          const delta = (a.box.left + a.box.right - b.box.left - b.box.right) / 2;
          const follower = (direction === 'right' ? delta < 0 : delta > 0) ? a.node : b.node;
          const gap = (a.box.width + b.box.width) / 2 + 24;
          // 토네이도는 간격을 두고 기다리지 않는다(같은 방향 캐릭터는 sweepTornadoes가 날려 보낸다).
          if (isTornado(a.node) || isTornado(b.node)) continue;
          if (Math.abs(delta) < gap + (follower.dataset.spacingWait ? 24 : 0)) waiting.add(follower);
        }
      }
      nodes.forEach(node => {
        if (waiting.has(node) && !isBlown(node)) node.dataset.spacingWait = 'true';
        else delete node.dataset.spacingWait;
      });
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const a = positions[i], b = positions[j];
          if (active.get(a.node)?.kind === 'greet' || active.get(b.node)?.kind === 'greet') continue;
          if (isTornado(a.node) || isTornado(b.node) || isBlown(a.node) || isBlown(b.node)) continue;
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
            node.dataset.greetingSpeaker = 'true';
            node.dataset.encounter = 'greet';
            node.dataset.encounterPhase = 'pause';
            active.set(node, { start: now, kind: 'greet' });
          }
        }
      }
      // "뭐지?" 돌아보기는 모서리 빼꼼이 나올 때만 한다(onPeek). 혼자 걷다 갑자기 돌아보지 않는다.
      positions.forEach(({ node, box }) => {
        previousCenters.set(node, box.left + box.width / 2);
      });
    }, 100);
    return () => {
      window.clearInterval(timer);
      root.removeEventListener('studentcharacterpeek', onPeek);
      active.forEach((_, node) => clear(node));
      root.querySelectorAll<HTMLElement>('[data-spacing-wait]').forEach(node => delete node.dataset.spacingWait);
    };
  }, []);
  return <div ref={stage} className="student-character-stage pointer-events-none absolute inset-0 overflow-hidden">{children}</div>;
}

import { useId, useState } from 'react';
import {
  GOMA_FLIGHT_ARTWORK_SRC,
  gomaKineticArtworkSrc,
  gomaLoadingVariants,
  type GomaLoadingVariant,
} from '../lib/gomaLoadingArt';

export { gomaLoadingVariants, type GomaLoadingVariant };

const scarfOutline = 'M38 41H55L61 47V54L56 56L49 59H38Z';

export default function GomaLoadingAnimation({ variant = 'random' }: {
  readonly variant?: GomaLoadingVariant | 'random';
}) {
  const [randomVariant] = useState(() => gomaLoadingVariants[Math.floor(Math.random() * gomaLoadingVariants.length)]);
  const selected = variant === 'random' ? randomVariant : variant;
  return selected === 'flight' ? <GomaFlight /> : <GomaKineticScene key={selected} variant={selected} />;
}

function GomaKineticScene({ variant }: { readonly variant: Exclude<GomaLoadingVariant, 'flight'> }) {
  const jumping = variant === 'jumping';
  const particlePositions = variant === 'train' ? [[24, 67], [33, 46], [18, 89], [128, 33], [141, 74]] : variant === 'carrot' ? [[26, 90], [38, 102], [21, 109], [130, 95], [144, 71]] : variant === 'sailing' ? [[32, 96], [127, 95], [20, 104], [140, 90], [114, 106]] : jumping ? [[35, 105], [120, 107], [24, 75], [134, 58], [52, 40]] : [[22, 22], [129, 67], [36, 105], [133, 12], [15, 70]];
  const starParticles = jumping || variant === 'skating' || variant === 'moon' || variant === 'rocket';
  const actorClass = { jumping: 'goma-jumper', parachute: 'goma-parachutist', skating: 'goma-skater', sailing: 'goma-sailor', bubble: 'goma-bubble-rider', train: 'goma-cloud-train', moon: 'goma-moon-swing', rocket: 'goma-star-rocket', carrot: 'goma-carrot-car' }[variant];
  const size = jumping ? 90 : variant === 'parachute' ? 112 : 128;
  const x = (160 - size) / 2;
  const y = jumping ? 25 : variant === 'parachute' ? 8 : 0;
  return (
    <div className="goma-loading goma-kinetic" aria-hidden="true" data-variant={variant}>
      <svg viewBox="0 0 160 128" focusable="false">
        {jumping && <g shapeRendering="crispEdges">
          <path className="goma-jump-shadow" fill="#d9d6bc" d="M48 117h64v3H48z" />
          <g className="goma-spring-book" stroke="#382a1c" strokeWidth="2" strokeLinejoin="miter">
            <path fill="#61a544" d="M42 103h76v12H42z" />
            <path fill="#fff0c7" d="M46 106h70v6H46z" />
            <path stroke="#d5bc83" strokeWidth="1" d="M49 109h64" />
          </g>
        </g>}
        {(variant === 'skating' || variant === 'carrot' || variant === 'train') && <g className="goma-speed-lines" fill="none" stroke="#b8c99b" strokeWidth="2" shapeRendering="crispEdges">
          <path className="goma-speed-line" d="M115 112h30m-8-44h20M18 94h18" />
          <path className="goma-speed-line goma-speed-line-late" d="M110 117h38m-16-65h22M8 77h18" />
        </g>}
        {variant === 'sailing' && <g fill="none" strokeWidth="2" shapeRendering="crispEdges">
          <path className="goma-water-wave" stroke="#b6d9cf" d="M-20 103h12v-3H4v3h12v3h12v-3h12v-3h12v3h12v3h12v-3h12v-3h12v3h12v3h12v-3h12v-3h12v3h12v3h12v-3h12v-3h12v3h12" />
          <path className="goma-water-wave goma-water-wave-near" stroke="#7eb9b5" d="M-20 115h12v-3H4v3h12v3h12v-3h12v-3h12v3h12v3h12v-3h12v-3h12v3h12v3h12v-3h12v-3h12v3h12v3h12v-3h12v-3h12v3h12" />
        </g>}
        <g className={actorClass}>
          <foreignObject x={x} y={y} width={size} height={size}>
            <img
              className="goma-kinetic-actor"
              src={gomaKineticArtworkSrc(variant)}
              alt=""
              width={size}
              height={size}
              decoding="async"
              fetchPriority="high"
              draggable={false}
            />
          </foreignObject>
        </g>
        <g shapeRendering="crispEdges" strokeWidth="1" strokeLinejoin="miter">
          {particlePositions.map(([x, y], index) => (
            <g key={index} transform={`translate(${x} ${y})`}>
              <g className={`goma-scene-particle goma-scene-particle-${index}`}>
                {starParticles
                  ? <path fill="#f5ca53" stroke="#cba043" d="M0-4h2v4h4v2H2v4H0V2h-4V0h4Z" />
                  : variant === 'sailing' ? <path fill="#b2e2e4" stroke="#70b6be" d="M0-5h2v3h2v5H2v2h-3V3h-2v-5h3Z" />
                  : variant === 'bubble' ? <path fill="none" stroke="#a5cfdc" d="M-3-5h6v2h2v6H3v2h-6V3h-2v-6h2Z" />
                  : variant === 'train' ? <path fill="#e5eddf" stroke="#c3d2bd" d="M-5 0v-3h3v-2h4v2h3v3h2v4H-7V0Z" />
                  : variant === 'carrot' ? <g><path fill="#8dbc64" stroke="#5e914d" d="M-4 2v-4h3v-2h6v4H2v3h-6Z" /><path fill="none" stroke="#5e914d" d="M-3 2L3-2" /></g>
                  : <g stroke="#b4ad8d"><path fill="#fff9e4" d="M-4 0v-2h2v-2h4v2h2v2Z" /><path fill="none" d="M0 0v7l-2 2" /></g>}
              </g>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

function GomaFlight() {
  const id = useId();
  return (
    <div className="goma-loading" aria-hidden="true">
      <svg viewBox="0 0 160 107" focusable="false">
        <defs>
          <mask id={`${id}-body`} maskUnits="userSpaceOnUse" x="0" y="0" width="160" height="107">
            <rect width="160" height="107" fill="white" />
            <path d={scarfOutline} fill="black" />
            <rect x="72" y="36" width="3.6" height="4.2" fill="black" />
            <rect x="87.8" y="36" width="3.6" height="4.2" fill="black" />
          </mask>
          <clipPath id={`${id}-eyes`}><rect x="72" y="36" width="3.6" height="4.2" /><rect x="87.8" y="36" width="3.6" height="4.2" /></clipPath>
          <clipPath id={`${id}-scarf`}><path d={scarfOutline} /></clipPath>
        </defs>
        <g className="goma-flight goma-artwork">
          <image href={GOMA_FLIGHT_ARTWORK_SRC} y="5" width="160" height="106.667" clipPath={`url(#${id}-eyes)`} />
          <image href={GOMA_FLIGHT_ARTWORK_SRC} width="160" height="106.667" mask={`url(#${id}-body)`} />
          <g className="goma-eyes"><image href={GOMA_FLIGHT_ARTWORK_SRC} width="160" height="106.667" clipPath={`url(#${id}-eyes)`} /></g>
          <g className="goma-scarf-tail"><image href={GOMA_FLIGHT_ARTWORK_SRC} width="160" height="106.667" clipPath={`url(#${id}-scarf)`} /></g>
        </g>
        <g fill="#f4ce68" stroke="#cba043" strokeWidth="1" strokeLinejoin="miter" shapeRendering="crispEdges">
          {['one', 'two', 'three'].map((star) => (
            <g className={`goma-spark goma-spark-${star}`} key={star}>
              <path d="M0 0h2v2H0Z" />
              <path className="goma-spark-flash" d="M0-3h2v3h3v2H2v3H0V2h-3V0h3Z" />
            </g>
          ))}
        </g>
        <g fill="#eee4cb" stroke="#d9ccb1" strokeWidth="1" shapeRendering="crispEdges">
          <path className="goma-cloud goma-cloud-far" d="M0 0h4v-3h6v3h4v2h3v4H-3V2h3Z" />
          <path className="goma-cloud goma-cloud-near" d="M0 0h6v-4h10v4h6v4h4v5H-4V4h4Z" />
          <path className="goma-cloud goma-cloud-low" d="M0 0h8v-5h12v5h8v4h5v6H-5V4h5Z" />
        </g>

      </svg>
    </div>
  );
}

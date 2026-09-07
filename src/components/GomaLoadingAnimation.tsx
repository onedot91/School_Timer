import { useId } from 'react';

const artwork = '/images/loading/goma-pencil.png';
const scarfOutline = 'M38 41H55L61 47V54L56 56L49 59H38Z';

export default function GomaLoadingAnimation() {
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
          <image href={artwork} y="5" width="160" height="106.667" clipPath={`url(#${id}-eyes)`} />
          <image href={artwork} width="160" height="106.667" mask={`url(#${id}-body)`} />
          <g className="goma-eyes"><image href={artwork} width="160" height="106.667" clipPath={`url(#${id}-eyes)`} /></g>
          <g className="goma-scarf-tail"><image href={artwork} width="160" height="106.667" clipPath={`url(#${id}-scarf)`} /></g>
        </g>
        <g fill="#f4ce68" stroke="#cba043" strokeWidth="1" strokeLinejoin="miter" shapeRendering="crispEdges">
          <path className="goma-spark goma-spark-one" d="M0-4h2v3h3v2H2v3H0V1h-3v-2h3Z" />
          <path className="goma-spark goma-spark-two" d="M0-3h2v2h2v2H2v2H0V1h-2v-2h2Z" />
          <path className="goma-spark goma-spark-three" d="M0 0h2v2H0Z" />
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

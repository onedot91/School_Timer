import {
  CURRENCY_BALANCE_MAX,
  CURRENCY_BALANCE_STEP,
  clampAuctionMissionRewardAmount,
  type AuctionMissionRewardAmount,
} from '../../lib/currency';

const MISSION_REWARD_PRESETS = [5, 10, 15, 20] as const;

interface MissionRewardInputProps {
  readonly missionIndex: number;
  readonly value: AuctionMissionRewardAmount;
  readonly onValueChange: (value: AuctionMissionRewardAmount) => void;
  readonly onFocus: () => void;
  readonly onBlur: () => void;
}

export function MissionRewardInput({
  missionIndex,
  value,
  onValueChange,
  onFocus,
  onBlur,
}: MissionRewardInputProps) {
  const inputId = `mission-${missionIndex}-reward`;
  const isRange = typeof value !== 'number';

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={isRange ? `${inputId}-minimum` : inputId} className="section-title text-[0.74rem] font-black text-[#6F7D70]">
          보상
        </label>
        <div className="inline-grid grid-cols-2 overflow-hidden rounded-full border border-[#CFE3D8] bg-[#F6FAF7]" role="group" aria-label={`미션 ${missionIndex} 보상 방식`}>
          <button
            type="button"
            data-reward-mode="single"
            aria-pressed={!isRange}
            onClick={() => onValueChange(isRange ? value[0] : value)}
            className={`min-h-8 px-2.5 text-[0.7rem] font-black transition-colors ${!isRange ? 'bg-[#007A57] text-white' : 'text-[#39705B] hover:bg-[#EAF6F0]'}`}
          >
            단일
          </button>
          <button
            type="button"
            data-reward-mode="range"
            aria-pressed={isRange}
            onClick={() => onValueChange(isRange ? value : [value, value])}
            className={`min-h-8 border-l border-[#CFE3D8] px-2.5 text-[0.7rem] font-black transition-colors ${isRange ? 'bg-[#007A57] text-white' : 'text-[#39705B] hover:bg-[#EAF6F0]'}`}
          >
            범위
          </button>
        </div>
      </div>
      {isRange ? (
        <div className="grid grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)_2.8rem] overflow-hidden rounded-[0.85rem] border border-[#CFE3D8] bg-[#FAFCFB] focus-within:border-[#7FB59F] focus-within:bg-white">
          <input
            id={`${inputId}-minimum`}
            data-reward-bound="minimum"
            type="number"
            min={0}
            max={CURRENCY_BALANCE_MAX}
            step={CURRENCY_BALANCE_STEP}
            value={value[0]}
            onChange={(event) => onValueChange([clampAuctionMissionRewardAmount(event.target.value), value[1]])}
            onFocus={onFocus}
            onBlur={onBlur}
            className="h-11 min-w-0 bg-transparent px-2 text-right font-mono text-[0.9rem] font-black text-[#006241] outline-none"
            aria-label={`미션 ${missionIndex} 최소 보상`}
          />
          <span className="flex h-11 items-center justify-center text-[#829087]" aria-hidden="true">~</span>
          <input
            id={`${inputId}-maximum`}
            data-reward-bound="maximum"
            type="number"
            min={0}
            max={CURRENCY_BALANCE_MAX}
            step={CURRENCY_BALANCE_STEP}
            value={value[1]}
            onChange={(event) => onValueChange([value[0], clampAuctionMissionRewardAmount(event.target.value)])}
            onFocus={onFocus}
            onBlur={onBlur}
            className="h-11 min-w-0 bg-transparent px-2 text-right font-mono text-[0.9rem] font-black text-[#006241] outline-none"
            aria-label={`미션 ${missionIndex} 최대 보상`}
          />
          <span className="flex h-11 items-center justify-center border-l border-[#CFE3D8] text-[0.78rem] font-extrabold text-[#6F7D70]">고마</span>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(7rem,1fr)_repeat(4,2.75rem)] gap-2">
          <div className="grid grid-cols-[minmax(0,1fr)_2.8rem] overflow-hidden rounded-[0.85rem] border border-[#CFE3D8] bg-[#FAFCFB] focus-within:border-[#7FB59F] focus-within:bg-white">
            <input
              id={inputId}
              type="number"
              min={0}
              max={CURRENCY_BALANCE_MAX}
              step={CURRENCY_BALANCE_STEP}
              value={value}
              onChange={(event) => onValueChange(clampAuctionMissionRewardAmount(event.target.value))}
              onFocus={onFocus}
              onBlur={onBlur}
              className="h-11 min-w-0 bg-transparent px-3 text-right font-mono text-[0.95rem] font-black text-[#006241] outline-none"
              aria-label={`미션 ${missionIndex} 보상`}
            />
            <span className="flex h-11 items-center justify-center border-l border-[#CFE3D8] text-[0.78rem] font-extrabold text-[#6F7D70]">고마</span>
          </div>
          {MISSION_REWARD_PRESETS.map((preset) => {
            const isSelected = value === preset;
            return (
              <button
                key={preset}
                type="button"
                data-reward-preset={preset}
                aria-pressed={isSelected}
                aria-label={`${preset}고마로 설정`}
                onClick={() => onValueChange(preset)}
                className={`h-11 rounded-[0.85rem] border font-mono text-[0.8rem] font-black transition-[background-color,border-color,color,transform] active:translate-y-px ${
                  isSelected
                    ? 'border-[#007A57] bg-[#007A57] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]'
                    : 'border-[#CFE3D8] bg-[#F6FAF7] text-[#39705B] hover:border-[#9CCDBE] hover:bg-[#EAF6F0]'
                }`}
              >
                {preset}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

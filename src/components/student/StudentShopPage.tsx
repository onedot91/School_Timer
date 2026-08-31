import { useRef, useState, type KeyboardEvent } from 'react';
import { ArrowRight, Gamepad2, Hammer, LockKeyhole, Users } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import {
  STUDENT_CUSTOM_HOUSE_COUPON_PRICE,
  STUDENT_HOUSE_DESIGNS,
  STUDENT_SHOP_ITEMS,
  type StudentCustomHouseTheme,
  type StudentEconomyAction,
  type StudentEconomyState,
} from '../../lib/studentEconomy';
import StudentConfirmDialog from './StudentConfirmDialog';
import StudentCharacterGacha from './StudentCharacterGacha';
import StudentProfileGachaDialog from './StudentProfileGachaDialog';
import {
  FAILURE_PROFILE_OPTIONS,
  FAILURE_PROFILE_IMAGES,
  FAILURE_RANDOM_PROFILE_OPTION,
  getAssignedFailureProfileImage,
  type FailureProfileAssignments,
} from '../../lib/failureExhibition';
import {
  RANDOM_PROFILE_CHANGE_PRICE,
  SELECTED_PROFILE_CHANGE_PRICE,
  type StudentProfilePurchase,
  type StudentProfilePurchaseOutcome,
} from '../../lib/studentProfilePurchase';
import { STUDENT_CUSTOM_HOUSE_RELEASED } from '../../lib/studentFeatureRelease';

interface StudentShopPageProps {
  studentNumber: number;
  profileAssignments: FailureProfileAssignments;
  state: StudentEconomyState;
  availableBalance: number;
  isSaving: boolean;
  onAction: (action: StudentEconomyAction) => Promise<boolean>;
  onSelectProfile: (purchase: StudentProfilePurchase) => Promise<StudentProfilePurchaseOutcome>;
}

type ShopTab = 'items' | 'characters' | 'houses';
const SHOP_TABS: readonly ShopTab[] = ['items', 'characters', 'houses'];
const PROFILE_ONLY_SHOP_TABS: readonly ShopTab[] = ['items'];

export function getVisibleStudentShopTabs(hasProfile: boolean): readonly ShopTab[] {
  return hasProfile ? SHOP_TABS : PROFILE_ONLY_SHOP_TABS;
}

type PendingPurchase = {
  readonly kind: 'economy';
  readonly action: StudentEconomyAction;
  readonly name: string;
  readonly price: number;
} | {
  readonly kind: 'profile';
  readonly purchase: StudentProfilePurchase;
  readonly name: string;
  readonly profileImage: string;
  readonly profileLabel: string;
  readonly price: number;
};

export default function StudentShopPage({
  studentNumber,
  profileAssignments,
  state,
  availableBalance,
  isSaving,
  onAction,
  onSelectProfile,
}: StudentShopPageProps) {
  const reduceMotion = useReducedMotion();
  const [tab, setTab] = useState<ShopTab>('items');
  const [houseName, setHouseName] = useState(state.customHouseDesign?.name ?? '나의 집');
  const [houseTheme, setHouseTheme] = useState<StudentCustomHouseTheme>(state.customHouseDesign?.theme ?? 'natural');
  const [pendingPurchase, setPendingPurchase] = useState<PendingPurchase | null>(null);
  const [profileGachaPrice, setProfileGachaPrice] = useState<number | null>(null);
  const randomProfileButtonRef = useRef<HTMLButtonElement>(null);
  const repaired = (state.inventory.house_repair ?? 0) > 0;
  const repairItem = STUDENT_SHOP_ITEMS.find((item) => item.id === 'house_repair');
  const activeProfile = getAssignedFailureProfileImage(studentNumber, profileAssignments);
  const activeProfileLabel = FAILURE_PROFILE_OPTIONS.find((profile) => profile.imageSrc === activeProfile)?.label ?? '현재';
  const hasProfile = activeProfile !== null;
  const randomProfilePrice = hasProfile ? RANDOM_PROFILE_CHANGE_PRICE : 0;
  const usedProfiles = new Set(Object.values(profileAssignments));
  const hasRandomProfile = FAILURE_PROFILE_IMAGES.some((image) => !usedProfiles.has(image));
  const visibleTabs = getVisibleStudentShopTabs(hasProfile);
  const orderedProfiles = FAILURE_PROFILE_OPTIONS.map((profile) => {
    const isActive = profile.imageSrc === activeProfile;
    const status = isActive ? 'active' : usedProfiles.has(profile.imageSrc) ? 'used' : 'available';
    return { ...profile, status };
  }).sort((left, right) => {
    const statusRank = { available: 0, active: 1, used: 2 } as const;
    return statusRank[left.status] - statusRank[right.status];
  });

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentTab: ShopTab) => {
    const currentIndex = visibleTabs.indexOf(currentTab);
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % visibleTabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + visibleTabs.length) % visibleTabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = visibleTabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = visibleTabs[nextIndex];
    setTab(nextTab);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`#student-shop-tab-${nextTab}`)
      ?.focus();
  };

  return (
    <section className="student-shop-hub" data-shop-tab={tab} data-has-profile={hasProfile ? 'true' : 'false'} aria-labelledby="student-shop-title">
      <h2 id="student-shop-title" className="sr-only">상점</h2>
      {hasProfile ? (
        <nav className="student-shop-tabs" aria-label="상점 종류" role="tablist">
          <button id="student-shop-tab-items" type="button" role="tab" aria-controls="student-shop-panel-items" aria-selected={tab === 'items'} tabIndex={tab === 'items' ? 0 : -1} className={tab === 'items' ? 'is-active' : ''} onKeyDown={(event) => handleTabKeyDown(event, 'items')} onClick={() => setTab('items')}><Users aria-hidden="true" />프로필</button>
          <>
            <button id="student-shop-tab-characters" type="button" role="tab" aria-controls="student-shop-panel-characters" aria-selected={tab === 'characters'} tabIndex={tab === 'characters' ? 0 : -1} className={tab === 'characters' ? 'is-active' : ''} onKeyDown={(event) => handleTabKeyDown(event, 'characters')} onClick={() => setTab('characters')}><Gamepad2 aria-hidden="true" />고마 스킨 뽑기</button>
            <button id="student-shop-tab-houses" type="button" role="tab" aria-controls="student-shop-panel-houses" aria-selected={tab === 'houses'} tabIndex={tab === 'houses' ? 0 : -1} className={tab === 'houses' ? 'is-active' : ''} onKeyDown={(event) => handleTabKeyDown(event, 'houses')} onClick={() => setTab('houses')}><Hammer aria-hidden="true" />집</button>
          </>
        </nav>
      ) : null}

      {tab === 'items' ? (
        <div
          id="student-shop-panel-items"
          className="student-shop-items-panel"
          role={hasProfile ? 'tabpanel' : undefined}
          aria-labelledby={hasProfile ? 'student-shop-tab-items' : 'student-profile-shop-title'}
        >
          <section className="student-profile-shop" data-has-profile={hasProfile ? 'true' : 'false'} aria-labelledby="student-profile-shop-title">
            {!hasProfile ? (
              <div className="student-profile-onboarding">
                <div className="student-profile-onboarding-art" aria-hidden="true">
                  <img src={FAILURE_RANDOM_PROFILE_OPTION.imageSrc} alt="" width={192} height={192} decoding="async" />
                </div>
                <div className="student-profile-onboarding-copy">
                  <span>첫 방문 선물</span>
                  <h3 id="student-profile-shop-title">동물 친구 <span className="student-profile-nowrap">한 명</span>을 만나 보세요</h3>
                  <p>어떤 동물이 나올지는 뽑은 뒤 확인할 수 있어요.</p>
                  <button
                    ref={randomProfileButtonRef}
                    type="button"
                    className="student-profile-onboarding-action"
                    aria-label="첫 랜덤 프로필 무료로 받기"
                    disabled={isSaving || !hasRandomProfile}
                    onClick={() => setProfileGachaPrice(0)}
                  >
                    무료로 뽑기
                  </button>
                </div>
                <aside className="student-profile-onboarding-unlocks" aria-label="프로필을 받은 뒤 열리는 상점">
                  <p><LockKeyhole aria-hidden="true" />프로필을 받으면 열려요</p>
                  <div><Gamepad2 aria-hidden="true" /><span>고마 스킨 뽑기</span><small>잠김</small></div>
                  <div><Hammer aria-hidden="true" /><span>건축 사무소</span><small>잠김</small></div>
                </aside>
              </div>
            ) : (
              <>
                <header>
                  <div>
                    <h3 id="student-profile-shop-title" className="sr-only">프로필 선택</h3>
                    <p>랜덤 교체는 30고마, 원하는 프로필 교체는 50고마예요.</p>
                  </div>
                </header>
                <div className="student-profile-shop-grid" data-has-profile="true">
              <button
                ref={randomProfileButtonRef}
                type="button"
                className="student-profile-shop-option"
                data-status="available"
                aria-label={`랜덤 프로필로 교체, ${randomProfilePrice} 고마`}
                disabled={isSaving || !hasRandomProfile || availableBalance < randomProfilePrice}
                onClick={() => setProfileGachaPrice(randomProfilePrice)}
              >
                <img src={FAILURE_RANDOM_PROFILE_OPTION.imageSrc} alt="" width={192} height={192} decoding="async" />
                <span className="student-profile-shop-option-copy">
                  <strong>랜덤 교체</strong>
                  <small>{hasRandomProfile ? `${randomProfilePrice} 고마` : '선택 불가'}</small>
                </span>
              </button>
              {orderedProfiles.map((profile) => {
                const isActive = profile.status === 'active';
                const isUsed = profile.status === 'used';
                return (
                  <button
                    type="button"
                    key={profile.id}
                    className="student-profile-shop-option"
                    data-status={profile.status}
                    aria-label={`${profile.label} ${isActive ? '현재 사용 중' : isUsed ? '다른 학생이 사용 중' : `${SELECTED_PROFILE_CHANGE_PRICE} 고마로 교체`}`}
                    aria-pressed={isActive}
                    disabled={isSaving || isActive || isUsed || availableBalance < SELECTED_PROFILE_CHANGE_PRICE}
                    onClick={() => setPendingPurchase({
                      kind: 'profile',
                      purchase: { type: 'selected', profileImage: profile.imageSrc },
                      name: `${profile.label} 프로필 교체`,
                      profileImage: profile.imageSrc,
                      profileLabel: profile.label,
                      price: SELECTED_PROFILE_CHANGE_PRICE,
                    })}
                  >
                    <img src={profile.imageSrc} alt="" width={192} height={192} loading="lazy" decoding="async" />
                    <span className="student-profile-shop-option-copy">
                      <strong>{profile.label}</strong>
                      <small>{isActive ? '내 프로필' : isUsed ? '사용 중' : `${SELECTED_PROFILE_CHANGE_PRICE} 고마`}</small>
                    </span>
                  </button>
                );
              })}
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      {hasProfile && tab === 'characters' ? (
        <StudentCharacterGacha tabPanelId="student-shop-panel-characters" tabPanelLabelledBy="student-shop-tab-characters" state={state} availableBalance={availableBalance} isSaving={isSaving} onAction={onAction} />
      ) : null}

      {hasProfile && tab === 'houses' ? (
        repaired ? (
          <div id="student-shop-panel-houses" className="student-house-workshop" role="tabpanel" aria-labelledby="student-shop-tab-houses">
            <div className="student-house-market">
              <article className={`student-custom-house-card${STUDENT_CUSTOM_HOUSE_RELEASED ? '' : ' is-coming-soon'}`}>
                <div className="student-custom-house-card-content" aria-hidden={!STUDENT_CUSTOM_HOUSE_RELEASED}>
                  <Hammer />
                  <h3>집 건축하기</h3>
                  {state.hasCustomHouseCoupon ? (
                    <>
                      <input aria-label="집 이름" value={houseName} maxLength={20} disabled={!STUDENT_CUSTOM_HOUSE_RELEASED} onChange={(event) => setHouseName(event.target.value)} />
                      <div className="student-house-theme-picker">
                        {(['natural', 'blue', 'green'] as const).map((theme) => (
                          <button type="button" key={theme} className={houseTheme === theme ? 'is-active' : ''} aria-label={`${theme} 색상`} aria-pressed={houseTheme === theme} disabled={!STUDENT_CUSTOM_HOUSE_RELEASED} onClick={() => setHouseTheme(theme)} />
                        ))}
                      </div>
                      <button type="button" disabled={!STUDENT_CUSTOM_HOUSE_RELEASED || isSaving || !houseName.trim()} onClick={() => void onAction({ type: 'register_custom_house', name: houseName, theme: houseTheme })}>디자인 적용</button>
                    </>
                  ) : (
                    <button type="button" aria-label={`집 건축하기, ${STUDENT_CUSTOM_HOUSE_COUPON_PRICE} 고마로 구매`} disabled={!STUDENT_CUSTOM_HOUSE_RELEASED || isSaving} onClick={() => setPendingPurchase({ kind: 'economy', action: { type: 'buy_custom_house_coupon' }, name: '집 건축하기', price: STUDENT_CUSTOM_HOUSE_COUPON_PRICE })}>{STUDENT_CUSTOM_HOUSE_COUPON_PRICE} 고마</button>
                  )}
                </div>
                {!STUDENT_CUSTOM_HOUSE_RELEASED ? (
                  <div className="student-custom-house-preview" role="status">
                    <img src="/student-house-carpenter-elephant.png" alt="" width={1254} height={1254} decoding="async" />
                    <p className="student-custom-house-speech">
                      <span>뚝딱뚝딱…</span>
                      <strong>멋진 집 짓는 중!</strong>
                    </p>
                  </div>
                ) : null}
              </article>
              {STUDENT_HOUSE_DESIGNS.map((house) => {
                const owned = state.ownedHouseIds.includes(house.id);
                const active = state.activeHouseId === house.id;
                return <article key={house.id}><img src={house.imageSrc} alt="" /><h3>{house.name}</h3><button type="button" aria-label={`${house.name}, ${active ? '사용 중' : owned ? '사용하기' : `${house.price} 고마로 구매`}`} disabled={isSaving || active} onClick={() => owned ? void onAction({ type: 'select_house', houseId: house.id }) : setPendingPurchase({ kind: 'economy', action: { type: 'buy_house', houseId: house.id }, name: house.name, price: house.price })}>{active ? '사용 중' : owned ? '사용하기' : `${house.price} 고마`}</button></article>;
              })}
            </div>
          </div>
        ) : (
          <div id="student-shop-panel-houses" className="student-house-locked" role="tabpanel" aria-labelledby="student-shop-tab-houses">
            <div className="student-house-repair-guide">
              <img src="/student-house-carpenter-elephant.png" alt="" width={1254} height={1254} decoding="async" />
            </div>
            {repairItem ? (
              <article>
                <img src={repairItem.imageSrc} alt="" />
                <div><strong>{repairItem.name}</strong><span>집 상점을 열 수 있어요</span></div>
                <button type="button" aria-label={`${repairItem.name}, ${repairItem.price} 고마로 구매`} disabled={isSaving} onClick={() => setPendingPurchase({ kind: 'economy', action: { type: 'buy_item', itemId: repairItem.id }, name: repairItem.name, price: repairItem.price })}>{repairItem.price} 고마</button>
              </article>
            ) : null}
          </div>
        )
      ) : null}
      <StudentConfirmDialog
        isOpen={pendingPurchase !== null}
        kicker={pendingPurchase?.kind === 'economy' ? pendingPurchase.name : undefined}
        title={(pendingPurchase?.price ?? 0) === 0 ? '무료로 받을까요?' : `${pendingPurchase?.price ?? 0} 고마를 사용할까요?`}
        description={pendingPurchase?.kind === 'profile'
          ? pendingPurchase.price === 0
            ? '다른 학생이 사용하지 않는 동물 중 하나가 무작위로 정해져요.'
            : undefined
          : '구매할 내용과 금액을 한 번 더 확인해 주세요.'}
        confirmLabel={pendingPurchase?.kind === 'profile'
          ? pendingPurchase.price === 0 ? '프로필 받기' : '교체하기'
          : '구매하기'}
        isPending={isSaving}
        onCancel={() => setPendingPurchase(null)}
        onConfirm={() => {
          if (!pendingPurchase) return;
          const save = pendingPurchase.kind === 'profile'
            ? onSelectProfile(pendingPurchase.purchase)
            : onAction(pendingPurchase.action);
          void save.then((saved) => {
            if (typeof saved === 'boolean' ? saved : saved.ok) setPendingPurchase(null);
          });
        }}
      >
        {pendingPurchase?.kind === 'profile' && activeProfile ? (
          <div
            className="student-confirm-profile-swap"
            role="img"
            aria-label={`${activeProfileLabel} 프로필에서 ${pendingPurchase.profileLabel} 프로필로 교체`}
          >
            <figure className="student-confirm-profile-preview">
              <img src={activeProfile} alt="" width={192} height={192} />
            </figure>
            <motion.span
              className="student-confirm-profile-arrow"
              aria-hidden="true"
              animate={reduceMotion
                ? { transform: 'translate3d(0, 0, 0)' }
                : { transform: ['translate3d(-3px, 0, 0)', 'translate3d(3px, 0, 0)'] }}
              transition={reduceMotion
                ? { duration: 0 }
                : { duration: 0.8, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
            >
              <ArrowRight />
            </motion.span>
            <figure className="student-confirm-profile-preview">
              <img src={pendingPurchase.profileImage} alt="" width={192} height={192} />
            </figure>
          </div>
        ) : null}
      </StudentConfirmDialog>
      <StudentProfileGachaDialog
        isOpen={profileGachaPrice !== null}
        price={profileGachaPrice ?? 0}
        availableProfiles={orderedProfiles.filter((profile) => profile.status === 'available')}
        onPurchase={() => onSelectProfile({ type: 'random' })}
        onClose={() => setProfileGachaPrice(null)}
        returnFocusRef={randomProfileButtonRef}
      />
    </section>
  );
}

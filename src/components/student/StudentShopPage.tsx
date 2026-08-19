import { useState } from 'react';
import { Gamepad2, Hammer, LockKeyhole, Package } from 'lucide-react';
import {
  STUDENT_CUSTOM_HOUSE_COUPON_PRICE,
  STUDENT_HOUSE_DESIGNS,
  STUDENT_SHOP_ITEMS,
  type StudentCustomHouseTheme,
  type StudentEconomyAction,
  type StudentEconomyState,
  type StudentShopCatalogItem,
} from '../../lib/studentEconomy';
import StudentConfirmDialog from './StudentConfirmDialog';
import StudentCharacterGacha from './StudentCharacterGacha';

interface StudentShopPageProps {
  state: StudentEconomyState;
  catalog: StudentShopCatalogItem[];
  availableBalance: number;
  isSaving: boolean;
  onAction: (action: StudentEconomyAction) => Promise<boolean>;
}

type ShopTab = 'items' | 'characters' | 'houses';
type PendingPurchase = {
  readonly action: StudentEconomyAction;
  readonly name: string;
  readonly price: number;
};

export default function StudentShopPage({ state, catalog, availableBalance, isSaving, onAction }: StudentShopPageProps) {
  const [tab, setTab] = useState<ShopTab>('items');
  const [houseName, setHouseName] = useState(state.customHouseDesign?.name ?? '나의 집');
  const [houseTheme, setHouseTheme] = useState<StudentCustomHouseTheme>(state.customHouseDesign?.theme ?? 'natural');
  const [pendingPurchase, setPendingPurchase] = useState<PendingPurchase | null>(null);
  const repaired = (state.inventory.house_repair ?? 0) > 0;
  const repairItem = STUDENT_SHOP_ITEMS.find((item) => item.id === 'house_repair');

  return (
    <section className="student-shop-hub" data-shop-tab={tab} aria-labelledby="student-shop-title">
      <h2 id="student-shop-title" className="sr-only">상점</h2>
      <nav className="student-shop-tabs" aria-label="상점 종류">
        <button className={tab === 'items' ? 'is-active' : ''} onClick={() => setTab('items')}><Package />물품</button>
        <button className={tab === 'characters' ? 'is-active' : ''} onClick={() => setTab('characters')}><Gamepad2 />고마 스킨 뽑기</button>
        <button className={tab === 'houses' ? 'is-active' : ''} onClick={() => setTab('houses')}><Hammer />집</button>
      </nav>

      {tab === 'items' ? (
        <div className="student-shop-goods-grid">
          {catalog.filter((item) => item.isActive).map((item) => (
            <article key={item.id}>
              <Package aria-hidden="true" />
              <div><h3>{item.name}</h3><span>보유 {state.inventory[item.id] ?? 0}</span></div>
              <button disabled={isSaving} onClick={() => setPendingPurchase({ action: { type: 'buy_item', itemId: item.id }, name: item.name, price: item.price })}>{item.price} 고마</button>
            </article>
          ))}
        </div>
      ) : null}

      {tab === 'characters' ? (
        <StudentCharacterGacha state={state} availableBalance={availableBalance} isSaving={isSaving} onAction={onAction} />
      ) : null}

      {tab === 'houses' ? (
        repaired ? (
          <div className="student-house-workshop">
            <div className="student-house-market">
              <article className="student-custom-house-card"><Hammer /><h3>내 집 만들기</h3>{state.hasCustomHouseCoupon ? <><input aria-label="집 이름" value={houseName} maxLength={20} onChange={(event) => setHouseName(event.target.value)} /><div className="student-house-theme-picker">{(['natural', 'blue', 'green'] as const).map((theme) => <button key={theme} className={houseTheme === theme ? 'is-active' : ''} aria-label={`${theme} 색상`} onClick={() => setHouseTheme(theme)} />)}</div><button disabled={isSaving || !houseName.trim()} onClick={() => void onAction({ type: 'register_custom_house', name: houseName, theme: houseTheme })}>디자인 적용</button></> : <button disabled={isSaving} onClick={() => setPendingPurchase({ action: { type: 'buy_custom_house_coupon' }, name: '내 집 만들기', price: STUDENT_CUSTOM_HOUSE_COUPON_PRICE })}>{STUDENT_CUSTOM_HOUSE_COUPON_PRICE} 고마</button>}</article>
              {STUDENT_HOUSE_DESIGNS.map((house) => {
                const owned = state.ownedHouseIds.includes(house.id);
                const active = state.activeHouseId === house.id;
                return <article key={house.id}><img src={house.imageSrc} alt="" /><h3>{house.name}</h3><button disabled={isSaving || active} onClick={() => owned ? void onAction({ type: 'select_house', houseId: house.id }) : setPendingPurchase({ action: { type: 'buy_house', houseId: house.id }, name: house.name, price: house.price })}>{active ? '사용 중' : owned ? '사용하기' : `${house.price} 고마`}</button></article>;
              })}
            </div>
          </div>
        ) : (
          <div className="student-house-locked">
            <LockKeyhole />
            <h3>집 고치기 필요</h3>
            {repairItem ? (
              <article>
                <img src={repairItem.imageSrc} alt="" />
                <div><strong>{repairItem.name}</strong><span>집 상점을 열 수 있어요</span></div>
                <button disabled={isSaving} onClick={() => setPendingPurchase({ action: { type: 'buy_item', itemId: repairItem.id }, name: repairItem.name, price: repairItem.price })}>{repairItem.price} 고마</button>
              </article>
            ) : null}
          </div>
        )
      ) : null}
      <StudentConfirmDialog
        isOpen={pendingPurchase !== null}
        kicker={pendingPurchase?.name}
        title={`${pendingPurchase?.price ?? 0} 고마를 사용할까요?`}
        description="구매할 내용과 금액을 한 번 더 확인해 주세요."
        confirmLabel="구매하기"
        isPending={isSaving}
        onCancel={() => setPendingPurchase(null)}
        onConfirm={() => {
          if (!pendingPurchase) return;
          void onAction(pendingPurchase.action).then((saved) => {
            if (saved) setPendingPurchase(null);
          });
        }}
      />
    </section>
  );
}

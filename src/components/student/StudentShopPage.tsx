import { STUDENT_SHOP_ITEMS, type StudentEconomyAction, type StudentEconomyState } from '../../lib/studentEconomy';

interface StudentShopPageProps {
  state: StudentEconomyState;
  isSaving: boolean;
  onAction: (action: StudentEconomyAction) => Promise<boolean>;
}

export default function StudentShopPage({ state, isSaving, onAction }: StudentShopPageProps) {
  return (
    <section className="student-economy-panel" aria-labelledby="student-shop-title">
      <div className="student-economy-title-row"><h2 id="student-shop-title">상점</h2></div>
      <div className="student-product-grid">
        {STUDENT_SHOP_ITEMS.map((item) => {
          const isHouseRepair = item.id === 'house_repair';
          const isPurchased = isHouseRepair && (state.inventory.house_repair ?? 0) > 0;
          return (
            <article key={item.id}>
              {'imageSrc' in item ? (
                <img className="student-product-image" src={item.imageSrc} alt="" aria-hidden="true" />
              ) : (
                <span className="student-product-emoji" aria-hidden="true">{item.emoji}</span>
              )}
              <div>
                <h3>{item.name}</h3>
                <span>{isHouseRepair ? (isPurchased ? '수리 완료' : '한 번 구매') : `보유 ${state.inventory[item.id] ?? 0}`}</span>
              </div>
              <button
                disabled={isSaving || isPurchased}
                onClick={() => void onAction({ type: 'buy_item', itemId: item.id })}
              >
                {isPurchased ? '완료' : `${item.price} 고마`}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

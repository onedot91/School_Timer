let pendingCount = 0;
const listeners = new Set<() => void>();

export const subscribeSaveProgress = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const getSaveProgress = () => pendingCount > 0;
export const getServerSaveProgress = () => false;

export const beginSaveProgress = () => {
  pendingCount += 1;
  if (pendingCount === 1) listeners.forEach((listener) => listener());
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    pendingCount -= 1;
    if (pendingCount === 0) listeners.forEach((listener) => listener());
  };
};

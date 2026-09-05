import type { LibraryAmbientObject } from './canvasLibraryWorld.js';

export type LibraryAmbientState = {
  readonly lampOn: boolean;
  readonly wateredPlantIds: readonly string[];
  readonly catReactions: number;
  readonly teaFull: boolean;
  readonly benchObjectId: string | null;
};

export type LibraryAmbientAction = {
  readonly objectId: string;
  readonly kind: 'lamp' | 'water' | 'leaves' | 'sit' | 'pet' | 'pour' | 'drink';
  readonly startedAt: number;
  readonly durationMs: number;
};

export const createLibraryAmbientState = (): LibraryAmbientState => ({
  lampOn: true,
  wateredPlantIds: [],
  catReactions: 0,
  teaFull: false,
  benchObjectId: null,
});

const durationByKind: Readonly<Record<LibraryAmbientAction['kind'], number>> = {
  lamp: 450, water: 750, leaves: 400, sit: 500, pet: 700, pour: 850, drink: 800,
};

export const createLibraryAmbientAction = (
  state: LibraryAmbientState, object: LibraryAmbientObject, now: number,
): LibraryAmbientAction => {
  const kind: LibraryAmbientAction['kind'] = object.kind === 'plant'
    ? (state.wateredPlantIds.includes(object.id) ? 'leaves' : 'water')
    : object.kind === 'tea' ? (state.teaFull ? 'drink' : 'pour')
        : object.kind === 'cat' ? 'pet'
          : object.kind === 'bench' ? 'sit' : 'lamp';
  return { objectId: object.id, kind, startedAt: now, durationMs: durationByKind[kind] };
};

export const completeLibraryAmbientAction = (
  state: LibraryAmbientState, action: LibraryAmbientAction,
): { readonly state: LibraryAmbientState; readonly notice: string | null } => {
  switch (action.kind) {
    case 'lamp': return { state: { ...state, lampOn: !state.lampOn }, notice: state.lampOn ? '조명을 껐어요' : '조명을 켰어요' };
    case 'water': return {
      state: state.wateredPlantIds.includes(action.objectId) ? state : { ...state, wateredPlantIds: [...state.wateredPlantIds, action.objectId] },
      notice: '새잎이 돋았어요',
    };
    case 'leaves': return { state, notice: null };
    case 'sit': return { state: { ...state, benchObjectId: action.objectId }, notice: null };
    case 'pet': return { state: { ...state, catReactions: Math.min(3, state.catReactions + 1) }, notice: null };
    case 'pour': return { state: { ...state, teaFull: true }, notice: '차를 따랐어요' };
    case 'drink': return { state: { ...state, teaFull: false }, notice: '따뜻한 차 한 모금' };
  }
};

export const getLibraryAmbientLabel = (object: LibraryAmbientObject, state: LibraryAmbientState): string => {
  switch (object.kind) {
    case 'lamp': return state.lampOn ? '조명 끄기' : '조명 켜기';
    case 'plant': return state.wateredPlantIds.includes(object.id) ? '잎 살펴보기' : '물 주기';
    case 'bench': return state.benchObjectId === object.id ? '일어나기' : '앉기';
    case 'cat': return '쓰다듬기';
    case 'tea': return state.teaFull ? '차 마시기' : '차 따르기';
  }
};

/**
 * usePropertyStore — 楼盘筛选 / 对比列表 / 收藏集合（CLAUDE.md 4.2）
 *
 * 拉出来的核心动因：避免页面之间各持一份 useState 时筛选条件 / 对比列表不共享。
 */
import { create } from 'zustand';

export interface PropertyFilter {
  district?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  keyword?: string;
}

export interface PropertyStoreState {
  filter: PropertyFilter;
  setFilter: (patch: Partial<PropertyFilter>) => void;
  resetFilter: () => void;

  compareIds: number[];
  toggleCompare: (id: number) => void;
  clearCompare: () => void;

  favoriteSet: Set<number>;
  setFavorites: (ids: number[]) => void;
  toggleFavorite: (id: number) => void;
}

const emptyFilter = (): PropertyFilter => ({});

export const usePropertyStore = create<PropertyStoreState>((set, get) => ({
  filter: emptyFilter(),
  setFilter: (patch) => set({ filter: { ...get().filter, ...patch } }),
  resetFilter: () => set({ filter: emptyFilter() }),

  compareIds: [],
  toggleCompare: (id) => {
    const list = get().compareIds.slice();
    const idx = list.indexOf(id);
    if (idx >= 0) list.splice(idx, 1); else list.push(id);
    set({ compareIds: list });
  },
  clearCompare: () => set({ compareIds: [] }),

  favoriteSet: new Set(),
  setFavorites: (ids) => set({ favoriteSet: new Set(ids) }),
  toggleFavorite: (id) => {
    const s = new Set(get().favoriteSet);
    if (s.has(id)) s.delete(id); else s.add(id);
    set({ favoriteSet: s });
  },
}));

/** services/favorites.ts — 收藏、看房计划、配套/风险/图片/操作日志。*/
import api from './http';

export interface FavoriteItem {
  id: number;
  community_id: number;
  community_name: string;
  notes?: string;
  created_at: string;
  unit_id?: number;
  unit?: {
    id: number;
    room_number: string;
    floor?: number;
    total_price?: number;
    status_tag: string;
    building_name?: string;
  } | null;
  property?: {
    id: number;
    name: string;
    district: string;
    total_price_min: number;
    total_price_max: number;
    area_min: number;
    area_max: number;
  };
}

export interface ViewingPlanItem {
  id: number;
  title: string;
  community_ids: number[];
  property_names: string[];
  unit_ids?: number[];
  unit_details?: Array<{
    id: number;
    room_number: string;
    floor?: number;
    building_name?: string;
    total_price?: number;
    status_tag: string;
  }>;
  plan_date?: string;
  notes?: string;
  status: string;
  created_at: string;
}

export const favoriteApi = {
  list: async (): Promise<{ success: boolean; data: FavoriteItem[] }> => {
    const response = await api.get('/favorites');
    return response.data;
  },
  add: async (communityId: number, notes?: string): Promise<unknown> => {
    const response = await api.post('/favorites', { community_id: communityId, notes });
    return response.data;
  },
  remove: async (communityId: number): Promise<unknown> => {
    const response = await api.delete('/favorites', { data: { community_id: communityId } });
    return response.data;
  },
  check: async (communityId: number): Promise<{ success: boolean; is_favorited: boolean }> => {
    const response = await api.get(`/favorites/check/${communityId}`);
    return response.data;
  },
  /** 操作日志 */
  getLogs: async (params?: {
    page?: number;
    page_size?: number;
    module?: string;
    keyword?: string;
  }): Promise<unknown> => {
    const response = await api.get('/logs', { params });
    return response.data;
  },
};

export const viewingPlanApi = {
  list: async (statusFilter?: string): Promise<unknown> => {
    const response = await api.get('/viewing-plans', {
      params: statusFilter ? { status_filter: statusFilter } : undefined,
    });
    return response.data;
  },
  create: async (data: {
    title: string;
    community_ids?: number[];
    unit_ids?: number[];
    plan_date?: string;
    notes?: string;
  }): Promise<unknown> => {
    const response = await api.post('/viewing-plans', data);
    return response.data;
  },
  update: async (
    planId: number,
    data: {
      title?: string;
      community_ids?: number[];
      unit_ids?: number[];
      plan_date?: string;
      notes?: string;
      status?: string;
    },
  ): Promise<unknown> => {
    const response = await api.put(`/viewing-plans/${planId}`, data);
    return response.data;
  },
  delete: async (planId: number): Promise<unknown> => {
    const response = await api.delete(`/viewing-plans/${planId}`);
    return response.data;
  },
};

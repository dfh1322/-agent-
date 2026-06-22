/** services/favorites.ts — 收藏、看房计划、配套/风险/图片/操作日志。*/
import api from './http';

export interface FavoriteItem {
  id: number;
  property_id: number;
  property_name: string;
  notes?: string;
  created_at: string;
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
  property_ids: number[];
  property_names: string[];
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
  add: async (propertyId: number, notes?: string): Promise<unknown> => {
    const response = await api.post('/favorites', { property_id: propertyId, notes });
    return response.data;
  },
  remove: async (propertyId: number): Promise<unknown> => {
    const response = await api.delete('/favorites', { data: { property_id: propertyId } });
    return response.data;
  },
  check: async (propertyId: number): Promise<{ success: boolean; is_favorited: boolean }> => {
    const response = await api.get(`/favorites/check/${propertyId}`);
    return response.data;
  },
  /** 周边配套 */
  getFacilities: async (propertyId: number): Promise<unknown> => {
    const response = await api.get(`/properties/${propertyId}/facilities`);
    return response.data;
  },
  /** 不利因素 */
  getRisks: async (propertyId: number): Promise<unknown> => {
    const response = await api.get(`/properties/${propertyId}/risks`);
    return response.data;
  },
  /** 楼盘图片 */
  getImages: async (propertyId: number): Promise<unknown> => {
    const response = await api.get(`/properties/${propertyId}/images`);
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
    property_ids: number[];
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
      property_ids?: number[];
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

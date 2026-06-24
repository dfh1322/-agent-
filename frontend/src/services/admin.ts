/** services/admin.ts — 后台管理 API（楼盘、知识库、合规、账户、统计）。*/
import api from './http';
import type { PaginationResponse } from './types';
import type { Unit } from '../types/property';

/** 后台管理返回的楼盘 (后端 _serialize_property 字段) — now represents Community data */
export interface AdminProperty {
  id: number;
  name: string;
  district?: string | null;
  district_id: number;
  province?: string | null;
  city?: string | null;
  district_name?: string | null;
  full_path?: string | null;
  address?: string;
  developer?: string;
  price_per_sqm?: number;
  total_price_min?: number;
  total_price_max?: number;
  area_min?: number;
  area_max?: number;
  plot_ratio?: number;
  green_rate?: number;
  property_fee?: number;
  decoration_status?: string;
  school_district?: string;
  metro_distance?: number;
  metro_line?: string;
  status: string;
  tags?: unknown;
  description?: string;
  owner_id?: number;
}

/** Cascader 节点 */
export interface CascaderNode {
  value: string;
  label: string;
  level?: number;
  children?: CascaderNode[];
  city?: string;
  district_id?: number;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  phone?: string;
  role: string;
  company_name?: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

interface ListParams {
  page?: number;
  page_size?: number;
  district?: string;
  status_filter?: string;
  keyword?: string;
  doc_type?: string;
  is_active?: boolean;
  role_filter?: string;
}

export const adminApi = {
  // 社区管理
  listCommunities: async (params?: ListParams): Promise<PaginationResponse<AdminProperty>> => {
    const response = await api.get('/admin/properties', { params });
    return response.data;
  },
  createCommunity: async (data: Partial<AdminProperty>): Promise<unknown> => {
    const response = await api.post('/admin/properties', data);
    return response.data;
  },
  updateCommunity: async (id: number, data: Partial<AdminProperty>): Promise<unknown> => {
    const response = await api.put(`/admin/properties/${id}`, data);
    return response.data;
  },
  deleteCommunity: async (id: number): Promise<unknown> => {
    const response = await api.delete(`/admin/properties/${id}`);
    return response.data;
  },

  // 区域管理（级联 Cascader 数据源）
  listDistricts: async (keyword?: string): Promise<{
    success: boolean;
    data: Array<{
      id: number;
      name: string;
      city: string;
      full_path: string | null;
      parent_id: number | null;
      level: number;
      code: string | null;
    }>;
  }> => {
    const response = await api.get('/admin/districts', { params: keyword ? { keyword } : {} });
    return response.data;
  },
  getDistrictTree: async (): Promise<{
    success: boolean;
    data: Array<{
      value: string;
      label: string;
      level?: number;
      city?: string;
      district_id?: number;
      children?: any[];
    }>;
  }> => {
    const response = await api.get('/admin/districts/tree');
    return response.data;
  },

  // 知识库
  listKnowledge: async (params?: ListParams): Promise<unknown> => {
    const response = await api.get('/admin/knowledge', { params });
    return response.data;
  },
  createKnowledge: async (data: {
    title: string;
    doc_type: string;
    content: string;
    source?: string;
    doc_metadata?: Record<string, unknown>;
  }): Promise<unknown> => {
    const response = await api.post('/admin/knowledge', data);
    return response.data;
  },
  updateKnowledge: async (
    id: number,
    data: {
      title?: string;
      doc_type?: string;
      content?: string;
      source?: string;
      doc_metadata?: Record<string, unknown>;
      is_active?: boolean;
    },
  ): Promise<unknown> => {
    const response = await api.put(`/admin/knowledge/${id}`, data);
    return response.data;
  },
  deleteKnowledge: async (id: number): Promise<unknown> => {
    const response = await api.delete(`/admin/knowledge/${id}`);
    return response.data;
  },

  // 对话日志
  listConversations: async (params?: ListParams & { user_id?: number; include_closed?: boolean }): Promise<unknown> => {
    const response = await api.get('/admin/conversations', { params });
    return response.data;
  },
  getConversationMessages: async (conversationId: number): Promise<{
    success: boolean;
    data: Array<{
      id: number;
      role: string;
      content: string;
      tool_calls?: unknown;
      tool_responses?: unknown;
      metadata?: unknown;
      created_at: string;
    }>;
  }> => {
    const response = await api.get(`/admin/conversations/${conversationId}/messages`);
    return response.data;
  },
  closeConversation: async (conversationId: number): Promise<{ success: boolean; message: string }> => {
    const response = await api.put(`/admin/conversations/${conversationId}/close`);
    return response.data;
  },
  deleteConversation: async (conversationId: number): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/admin/conversations/${conversationId}`);
    return response.data;
  },

  // 房东楼盘总览
  listLandlordProperties: async (
    params?: ListParams,
  ): Promise<PaginationResponse<AdminProperty>> => {
    const response = await api.get('/admin/landlord/properties', { params });
    return response.data;
  },

  // 合规配置
  getComplianceWords: async (): Promise<unknown> => {
    const response = await api.get('/admin/compliance/words');
    return response.data;
  },
  addComplianceWord: async (data: {
    word: string;
    action?: string;
    replacement?: string;
    category?: string;
  }): Promise<unknown> => {
    const response = await api.post('/admin/compliance/words', data);
    return response.data;
  },
  removeComplianceWord: async (word: string): Promise<unknown> => {
    const response = await api.delete(`/admin/compliance/words/${encodeURIComponent(word)}`);
    return response.data;
  },

  // 账户管理
  listAccounts: async (params?: ListParams): Promise<PaginationResponse<AdminUser>> => {
    const response = await api.get('/admin/accounts', { params });
    return response.data;
  },
  createAccount: async (data: {
    username: string;
    email: string;
    password: string;
    full_name?: string;
    phone?: string;
    role?: string;
    company_name?: string;
  }): Promise<unknown> => {
    const response = await api.post('/admin/accounts', data);
    return response.data;
  },
  toggleAccount: async (userId: number, isActive: boolean): Promise<unknown> => {
    const response = await api.put(`/admin/accounts/${userId}/toggle`, { is_active: isActive });
    return response.data;
  },
  deleteAccount: async (userId: number): Promise<unknown> => {
    const response = await api.delete(`/admin/accounts/${userId}`);
    return response.data;
  },

  // 统计面板
  getStatistics: async (): Promise<unknown> => {
    const response = await api.get('/admin/statistics');
    return response.data;
  },

  // 行政区划
  getDistrictsTree: async (): Promise<{ success: boolean; data: CascaderNode[] }> => {
    const response = await api.get('/admin/districts/tree');
    return response.data;
  },

  // 小区 & 楼栋
  getCommunity: async (id: number): Promise<{
    success: boolean;
    community: {
      id: number;
      name: string;
      buildings: Array<{
        id: number;
        name: string;
        building_number?: string;
        building_type?: string;
        total_floors?: number;
        floor_min?: number;
        floor_max?: number;
        units_per_floor?: number;
        unit_count?: number;
        elevator_count?: number;
        orientation?: string;
        status: string;
        house_types?: Array<{
          id: number;
          name: string;
          bedrooms?: number;
          living_rooms?: number;
          bathrooms?: number;
          area?: number;
          total_price?: number;
          floor_min?: number;
          floor_max?: number;
          orientation?: string;
          units?: any[];
        }>;
      }>;
    };
  }> => {
    const response = await api.get(`/admin/communities/${id}`);
    return response.data;
  },
  deleteBuilding: async (id: number): Promise<{ success: boolean }> => {
    const response = await api.delete(`/admin/buildings/${id}`);
    return response.data;
  },

  // 房间管理
  listUnits: async (
    buildingId: number,
    params?: {
      page?: number;
      page_size?: number;
      status_tag?: string;
      house_type_id?: number;
      floor_min?: number;
      floor_max?: number;
    },
  ): Promise<{
    success: boolean;
    data: Unit[];
    pagination: { page: number; page_size: number; total: number };
  }> => {
    const response = await api.get(`/admin/buildings/${buildingId}/units`, { params });
    return response.data;
  },
  createUnits: async (
    buildingId: number,
    units: Array<{
      house_type_id: number;
      room_number: string;
      floor?: number;
      area?: number;
      total_price?: number;
      orientation?: string;
      status_tag?: string;
      tags?: string[];
      description?: string;
      sort_order?: number;
    }>,
  ): Promise<{ success: boolean; message: string; ids: number[] }> => {
    const response = await api.post(`/admin/buildings/${buildingId}/units`, { units });
    return response.data;
  },
  getUnit: async (unitId: number): Promise<{ success: boolean; unit: Unit }> => {
    const response = await api.get(`/admin/units/${unitId}`);
    return response.data;
  },
  updateUnit: async (unitId: number, data: Partial<Unit>): Promise<{ success: boolean; unit: Unit }> => {
    const response = await api.put(`/admin/units/${unitId}`, data);
    return response.data;
  },
  deleteUnit: async (unitId: number): Promise<{ success: boolean }> => {
    const response = await api.delete(`/admin/units/${unitId}`);
    return response.data;
  },
  batchUpdateUnits: async (
    unitIds: number[],
    updates: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> => {
    const response = await api.patch('/admin/units/batch', { unit_ids: unitIds, updates });
    return response.data;
  },
  generateUnits: async (
    buildingId: number,
    data: {
      house_type_id: number;
      floor_start: number;
      floor_end: number;
      rooms_per_floor?: number;
      room_number_pattern?: string;
      area?: number;
      total_price?: number;
      orientation?: string;
      status_tag?: string;
      tags?: string[];
      price_floor_adjust?: number;
    },
  ): Promise<{ success: boolean; message: string; count: number; ids: number[] }> => {
    const response = await api.post(`/admin/buildings/${buildingId}/units/generate`, data);
    return response.data;
  },
};

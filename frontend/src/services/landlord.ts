/** services/landlord.ts — 房东管理工作台。*/
import api from './http';
import type { Unit } from '../types/property';

export interface CascaderNode {
  value: string;
  label: string;
  children?: CascaderNode[];
  district_id?: number;
}

export interface ContactInfo {
  landlord_id: number;
  full_name: string;
  company_name: string;
  phone_masked: string;
  phone_raw: string;
  wechat: string;
  address: string;
  avatar_url: string | null;
}

export interface ContactInfoResponse {
  success: boolean;
  data: ContactInfo;
}

export interface ContactMessageData {
  landlord_id?: number;
  community_id?: number;
  guest_name: string;
  guest_phone: string;
  message: string;
  preferred_date?: string;
}

export interface LandlordMessage {
  id: number;
  guest_name: string;
  guest_phone: string;
  community_id: number | null;
  message: string;
  preferred_date: string | null;
  created_at: string | null;
}

export const landlordApi = {
  getProfile: async (): Promise<unknown> => {
    const response = await api.get('/landlord/profile');
    return response.data;
  },

  getMyCommunities: async (): Promise<{ communities?: unknown[] }> => {
    const response = await api.get('/landlord/properties');
    return response.data;
  },

  createCommunity: async (data: Record<string, unknown>): Promise<unknown> => {
    const response = await api.post('/landlord/properties', data);
    return response.data;
  },

  updateCommunity: async (id: number, data: Record<string, unknown>): Promise<unknown> => {
    const response = await api.put(`/landlord/properties/${id}`, data);
    return response.data;
  },

  getDistrictTree: async (): Promise<{ success: boolean; data: CascaderNode[] }> => {
    const response = await api.get('/landlord/districts/tree');
    return response.data;
  },

  getContactInfo: async (ownerId: number): Promise<ContactInfoResponse> => {
    const response = await api.get<ContactInfoResponse>(
      `/landlord/${ownerId}/contact`,
    );
    return response.data;
  },

  submitContactMessage: async (
    data: ContactMessageData,
  ): Promise<{ success: boolean; message: string }> => {
    const response = await api.post<{ success: boolean; message: string }>(
      '/landlord/contact/message',
      data,
    );
    return response.data;
  },

  getMyMessages: async (): Promise<{ success: boolean; messages: LandlordMessage[] }> => {
    const response = await api.get<{ success: boolean; messages: LandlordMessage[] }>(
      '/landlord/messages',
    );
    return response.data;
  },

  // -- Community / Building / Unit management (landlord) --

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
        }>;
      }>;
    };
  }> => {
    const response = await api.get(`/landlord/communities/${id}`);
    return response.data;
  },

  deleteBuilding: async (id: number): Promise<{ success: boolean }> => {
    const response = await api.delete(`/landlord/buildings/${id}`);
    return response.data;
  },

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
    const response = await api.get(`/landlord/buildings/${buildingId}/units`, { params });
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
    const response = await api.post(`/landlord/buildings/${buildingId}/units`, { units });
    return response.data;
  },

  updateUnit: async (unitId: number, data: Partial<Unit>): Promise<{ success: boolean; unit: Unit }> => {
    const response = await api.put(`/landlord/units/${unitId}`, data);
    return response.data;
  },

  deleteUnit: async (unitId: number): Promise<{ success: boolean }> => {
    const response = await api.delete(`/landlord/units/${unitId}`);
    return response.data;
  },

  batchUpdateUnits: async (
    unitIds: number[],
    updates: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> => {
    const response = await api.patch('/landlord/units/batch', { unit_ids: unitIds, updates });
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
    const response = await api.post(`/landlord/buildings/${buildingId}/units/generate`, data);
    return response.data;
  },
};

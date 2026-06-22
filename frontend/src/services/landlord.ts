/** services/landlord.ts — 房东管理工作台。*/
import api from './http';

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
  landlord_id: number;
  property_id?: number;
  guest_name: string;
  guest_phone: string;
  message: string;
  preferred_date?: string;
}

export interface LandlordMessage {
  id: number;
  guest_name: string;
  guest_phone: string;
  property_id: number | null;
  message: string;
  preferred_date: string | null;
  created_at: string | null;
}

export const landlordApi = {
  getProfile: async (): Promise<unknown> => {
    const response = await api.get('/landlord/profile');
    return response.data;
  },

  getMyProperties: async (): Promise<{ properties?: unknown[] }> => {
    const response = await api.get('/landlord/properties');
    return response.data;
  },

  createProperty: async (data: Record<string, unknown>): Promise<unknown> => {
    const response = await api.post('/landlord/properties', data);
    return response.data;
  },

  updateProperty: async (id: number, data: Record<string, unknown>): Promise<unknown> => {
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
};

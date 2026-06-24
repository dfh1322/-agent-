/** services/settings.ts — 系统配置、用户偏好/资料、修改密码。*/
import api from './http';
import type { ProfileData } from './types';

export interface UserPreferenceData {
  id?: number;
  budget_min?: number;
  budget_max?: number;
  preferred_districts?: string[];
  preferred_house_types?: string[];
  need_school?: boolean;
  need_metro?: boolean;
  has_provident_fund?: boolean;
  family_members?: number;
  is_first_home?: boolean;
  updated_at?: string;
}

export const settingsApi = {
  // 系统配置
  getConfigs: async (group?: string): Promise<unknown> => {
    const response = await api.get('/configs', {
      params: group ? { config_group: group } : undefined,
    });
    return response.data;
  },
  getConfigGroup: async (group: string): Promise<unknown> => {
    const response = await api.get(`/configs/group/${group}`);
    return response.data;
  },

  // 用户偏好
  getPreference: async (): Promise<{ success: boolean; data: UserPreferenceData | null }> => {
    const response = await api.get('/preferences');
    return response.data;
  },
  updatePreference: async (data: Partial<UserPreferenceData>): Promise<unknown> => {
    const response = await api.put('/preferences', data);
    return response.data;
  },

  // 用户资料
  getProfile: async (): Promise<{ success: boolean; data: ProfileData }> => {
    const response = await api.get('/profile');
    return response.data;
  },
  updateProfile: async (data: {
    full_name?: string;
    phone?: string;
    avatar?: string;
  }): Promise<unknown> => {
    const response = await api.put('/profile', data);
    return response.data;
  },

  // 密码
  changePassword: async (oldPassword: string, newPassword: string): Promise<unknown> => {
    const response = await api.post('/profile/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    });
    return response.data;
  },
};

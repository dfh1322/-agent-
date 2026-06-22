/**
 * services/auth.ts — 登录、注册、token 管理。
 */
import api from './http';
import axios from 'axios';
import type { AuthResponse, LoginData, ProfileData, RegisterData, User } from './types';

export const authApi = {
  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  register: async (data: RegisterData): Promise<User> => {
    const response = await api.post<User>('/auth/register', data);
    return response.data;
  },

  sendVerificationCode: async (phone: string): Promise<{ message: string; code: string }> => {
    const response = await api.post<{ message: string; code: string }>('/auth/send-code', { phone });
    return response.data;
  },

  logout: (): void => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    try {
      delete (api.defaults.headers.common as Record<string, unknown>).Authorization;
    } catch {
      /* ignore */
    }
  },

  getCurrentUser: (): User | null => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      return null;
    }
    try {
      const parsed = JSON.parse(userStr);
      if (parsed && typeof parsed === 'object' && 'id' in parsed) {
        return parsed as User;
      }
      localStorage.removeItem('user');
      return null;
    } catch {
      localStorage.removeItem('user');
      return null;
    }
  },

  setAuth: (auth: AuthResponse): void => {
    localStorage.setItem('token', auth.access_token);
    localStorage.setItem('user', JSON.stringify(auth.user));
    // 把 token 直接同步到 axios 默认头，避免拦截器版本差异导致
    // 下一次请求仍然 401（之前看到的"已登录还是让登录"现象）。
    try {
      api.defaults.headers.common = api.defaults.headers.common || {};
      (api.defaults.headers.common as Record<string, string>).Authorization = `Bearer ${auth.access_token}`;
    } catch {
      /* axios 在某些版本上是 frozen object，忽略 */
    }
  },

  isAuthenticated: (): boolean => Boolean(localStorage.getItem('token')),

  /** 验证 token 有效性并刷新用户资料。失败时返回 ``null``。 */
  getCurrentUserProfile: async (): Promise<ProfileData | null> => {
    const response = await api.get<{ success: boolean; data: ProfileData }>('/profile');
    return response.data?.data ?? null;
  },
};

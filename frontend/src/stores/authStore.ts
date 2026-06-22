/**
 * 认证状态管理（Zustand Store）
 *
 * 职责：
 *   - 管理用户登录/注册/登出状态
 *   - 持久化 token 和用户信息到 localStorage
 *   - 页面刷新时从 localStorage 恢复登录状态
 *   - 通过后端 API 验证 token 有效性，防止未登录直接访问
 *
 * 依赖：
 *   - authApi（API 客户端，负责与后端通信）
 *   - localStorage（浏览器本地存储）
 */
import { create } from 'zustand';
import { authApi } from '../services/api';

/** 用户信息接口 */
interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  phone?: string;
  is_active: boolean;
  is_admin: boolean;
  role?: string;
  company_name?: string;
  created_at: string;
}

/** 认证状态接口 */
interface AuthState {
  /** 当前用户信息，未登录时为 null */
  user: User | null;
  /** 是否已登录 */
  isAuthenticated: boolean;
  /** 登录中 */
  isLoading: boolean;
  /** 登录方法：调用后端登录 API 并保存 token */
  login: (username: string, password: string) => Promise<void>;
  /** 注册方法：调用后端注册 API */
  register: (data: any) => Promise<void>;
  /** 登出方法：清除 token 和本地状态 */
  logout: () => void;
  /** 检查认证状态：从 localStorage 恢复，并验证 token 有效性 */
  checkAuth: () => Promise<void>;
}

/**
 * 验证 JWT token 格式是否合法。
 * JWT 格式为 header.payload.signature（三段 base64 编码）。
 */
function isValidToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const auth = await authApi.login({ username, password });
      authApi.setAuth(auth);
      // 同步读取本地 token，二次验证 setAuth 后 token 已落地。
      // 这一道是为了解决"store 标记已登录但 axios 拿到 401"
      // 之前这条路最诡异的 case 是——浏览器某次 401 后我们清空了 localStorage，
      // 但 store 还没被强制重置，store 和本地状态短暂不同步。
      const tokenAfter = typeof localStorage !== 'undefined'
        ? localStorage.getItem('token')
        : null;
      const userAfter = authApi.getCurrentUser();
      set({
        user: userAfter ?? auth.user,
        isAuthenticated: Boolean(tokenAfter && userAfter),
        isLoading: false,
      });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  register: async (data: any) => {
    const auth = await authApi.register(data);
    authApi.setAuth(auth);
    set({ user: auth.user, isAuthenticated: true });
  },

  logout: () => {
    authApi.logout();
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    const storedUser = authApi.getCurrentUser();

    // 没有 token 或没有用户 → 直接登出
    if (!token || !storedUser || !isValidToken(token)) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      set({ user: null, isAuthenticated: false });
      return;
    }

    // 关键修复：调用后端 /api/profile 验证 token 是否仍然有效
    // 防止 token 过期或被撤销后仍能访问受保护页面
    try {
      const profile = await authApi.getCurrentUserProfile();
      if (profile && profile.id) {
        set({ user: profile as User, isAuthenticated: true });
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ user: null, isAuthenticated: false });
      }
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      set({ user: null, isAuthenticated: false });
    }
  },
}));

/**
 * services/types.ts — 跨模块共享的接口/类型。
 */
export interface User {
  id: number;
  username: string;
  email: string;
  phone?: string;
  full_name?: string;
  role: string;
  company_name?: string;
  is_active: boolean;
  is_admin: boolean;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginData {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  phone?: string;
  full_name?: string;
  role?: string;
  company_name?: string;
  verification_code?: string;
}

export interface ProfileData {
  id: number;
  username: string;
  email: string;
  phone?: string;
  full_name?: string;
  avatar?: string;
  role: string;
  company_name?: string;
  is_admin: boolean;
  created_at?: string;
  success?: boolean;
  data?: unknown;
}

export interface PaginationResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages?: number;
  };
}

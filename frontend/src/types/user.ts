/* types/user.ts */
import type { RoleType } from '../router/RoleBasedRoute';

export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  role?: RoleType | string;
  phone?: string;
  full_name?: string;
  company_name?: string;
  avatar?: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

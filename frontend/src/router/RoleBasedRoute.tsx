/**
 * router/RoleBasedRoute.tsx
 *
 * 路由级别的角色守卫（CLAUDE.md 4.3）：
 *   * 当路由对象 ``meta.roles`` 定义角色时，本组件在渲染前校验；
 *   * ``admin > landlord > user``：admin 自动拥有 landlord / user 的权限；
 *   * 未登录统一跳转 /login，未授权重定向到 /403；
 *   * 与后端 router 的 ``Depends(get_current_admin|landlord|user)`` 双重保险。
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export type RoleType = 'admin' | 'landlord' | 'user';

const ROLE_RANK: Record<RoleType, number> = { user: 1, landlord: 2, admin: 3 };

export interface RoleBasedRouteProps {
  /** 允许的角色列表（任意一个匹配即可）；不传则只要登录即可。 */
  allowedRoles?: RoleType[];
  /** 被保护的子路由内容 */
  children: React.ReactNode;
  /** 角色不匹配时的重定向路径 */
  fallbackPath?: string;
}

export const RoleBasedRoute: React.FC<RoleBasedRouteProps> = ({
  allowedRoles = ['admin', 'landlord', 'user'],
  children,
  fallbackPath = '/403',
}) => {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const userRole = (user.role || 'user') as RoleType;
  const userRank = ROLE_RANK[userRole] || 0;
  const allowed = allowedRoles.some((role) => ROLE_RANK[role] <= userRank);
  if (!allowed) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

export default RoleBasedRoute;

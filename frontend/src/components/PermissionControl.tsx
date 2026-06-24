/**
 * PermissionControl - 权限控制包装器
 *
 * 用途：根据当前用户角色决定是否渲染子内容。
 * 用于后台各页面中的操作按钮/区域的权限控制。
 *
 * 用法：
 *   <PermissionControl allowedRoles={['admin']}>
 *     <Button>删除</Button>
 *   </PermissionControl>
 */
import React from 'react';
import { useAuthStore } from '../stores/authStore';

interface PermissionControlProps {
  /** 允许访问的角色列表，默认为全部角色 */
  allowedRoles?: string[];
  /** 要渲染的子元素 */
  children: React.ReactNode;
  /** 无权限时渲染的内容，默认为 null */
  fallback?: React.ReactNode;
}

const PermissionControl: React.FC<PermissionControlProps> = ({
  allowedRoles = ['user', 'landlord', 'admin'],
  children,
  fallback = null,
}) => {
  const userRole = useAuthStore((state) => state.user?.role || 'user');

  if (!allowedRoles.includes(userRole)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default PermissionControl;

/**
 * 受保护的路由组件
 *
 * 逻辑：
 *   1. 优先信任本地 ``token`` + ``user``：进入受保护路由时，
 *      如果本地缓存表明已登录，先渲染子路由；
 *      ``checkAuth`` 在后台异步刷新 /api/profile，不阻塞首屏渲染。
 *   2. 后端校验确实失败（401 / 无数据）由 ``checkAuth`` 异步清理并
 *      重定向到登录，下一次用户动作之前完成，避免总是瞬时闪到登录页。
 *   3. 本地完全无缓存 → 直接 Navigate to login（不能漏）。
 */
import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const location = useLocation();

  // 只在没有本地登录态时才阻塞渲染；已有 token/user 直接放行，避免
  // 因为 ``/api/profile`` 暂未返回而把已登录用户闪回登录页。
  const trivialAuthenticated = useRef<boolean>(false);
  if (!trivialAuthenticated.current) {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
    if (token && cached) trivialAuthenticated.current = true;
  }

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => checkAuth())
      .finally(() => { /* 不再 setState；store 自己处理 */ });
    return () => {
      cancelled = true;
    };
  }, [checkAuth]);

  // 已登录 → 渲染子路由（不等待后端 profile）
  if (isAuthenticated && user) {
    return <>{children}</>;
  }

  // 本地有 token + user 缓存，但 zustand 还没水合（首屏 race），
  // 仍渲染子路由，避免误踢回登录。
  if (trivialAuthenticated.current) {
    return <>{children}</>;
  }

  return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
};

export default ProtectedRoute;

/**
 * router/index.tsx — 路由集中注册（CLAUDE.md 4.3）
 *
 * 设计原则：
 *   1. 所有路由声明集中在 ``router/index.tsx``；
 *   2. 每个管理端/受限路由都带 ``meta.roles`` 元数据；
 *   3. 兼容 React Router v6 与 v7：使用 ``<Routes>`` 与 ``<Route>`` 显式声明，
 *      避免对 ``useRoutes`` 的内部类型细节做假定；
 *   4. 每个 leaf 路由懒加载，``Suspense`` 由调用方在 ``App.tsx`` 提供。
 */
import React, { lazy } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import { RoleBasedRoute } from './RoleBasedRoute';

// ── 懒加载页面 ──────────────────────────────────────────────────
const Home = lazy(() => import('../pages/Home'));
const Login = lazy(() => import('../pages/Login'));
const Register = lazy(() => import('../pages/Register'));
const Chat = lazy(() => import('../pages/Chat'));
const Properties = lazy(() => import('../pages/Properties'));
const Calculator = lazy(() => import('../pages/Calculator'));
const Compare = lazy(() => import('../pages/Compare'));
const Policy = lazy(() => import('../pages/Policy'));
const Landlord = lazy(() => import('../pages/Landlord'));
const ProfilePage = lazy(() => import('../pages/Profile'));
const FavoritesPage = lazy(() => import('../pages/FavoritesPage'));
const ViewingPlansPage = lazy(() => import('../pages/ViewingPlansPage'));
const ReportView = lazy(() => import('../pages/ReportView'));
const PlanPage = lazy(() => import('../pages/PlanPage'));
const AdminLayout = lazy(() => import('../pages/admin/AdminLayout'));
const AdminProperties = lazy(() => import('../pages/admin/AdminProperties'));
const AdminKnowledge = lazy(() => import('../pages/admin/AdminKnowledge'));
const AdminConversations = lazy(() => import('../pages/admin/AdminConversations'));
const AdminCompliance = lazy(() => import('../pages/admin/AdminCompliance'));
const AdminAccounts = lazy(() => import('../pages/admin/AdminAccounts'));
const AdminStatistics = lazy(() => import('../pages/admin/AdminStatistics'));
const NotFound = lazy(() => import('../pages/NotFound'));

// ── 类型 ──────────────────────────────────────────────────────────
export type RoleType = 'admin' | 'landlord' | 'user';
export interface RouteMeta {
  roles?: RoleType[];
  requireAuth?: boolean;
  title?: string;
  [key: string]: unknown;
}

/**
 * 把 ``node + meta`` 包成最终的路由 element。
 */
function wrap(node: React.ReactNode, meta?: RouteMeta): React.ReactNode {
  const requireAuth = meta?.requireAuth !== false;
  const roles = meta?.roles;
  if (Array.isArray(roles) && roles.length > 0) {
    return (
      <RoleBasedRoute allowedRoles={roles}>
        <>{node}</>
      </RoleBasedRoute>
    );
  }
  if (requireAuth) {
    return (
      <ProtectedRoute>
        <>{node}</>
      </ProtectedRoute>
    );
  }
  return node;
}

interface LeafSpec {
  path: string;
  element: React.ReactNode;
  meta?: RouteMeta;
}

/** 渲染一组平级叶子路由 */
function renderLeaves(items: LeafSpec[]): React.ReactNode {
  return items.map((it) => (
    <Route
      key={it.path}
      path={it.path}
      element={wrap(it.element, it.meta)}
    />
  ));
}

export const AppRoutes: React.FC = () => {
  console.log('[AppRoutes] rendering...');
  const leaves: LeafSpec[] = [
    { path: '/', element: <Home />, meta: { requireAuth: false, title: '首页' } },
    { path: '/login', element: <Login />, meta: { requireAuth: false, title: '登录' } },
    { path: '/register', element: <Register />, meta: { requireAuth: false, title: '注册' } },
    { path: '/403', element: <NotFound />, meta: { requireAuth: false } },

    { path: '/chat', element: <Chat />, meta: { requireAuth: true, title: '智能咨询' } },
    { path: '/properties', element: <Properties />, meta: { requireAuth: true, title: '楼盘列表' } },
    { path: '/properties/compare', element: <Compare />, meta: { requireAuth: true, title: '楼盘对比' } },
    { path: '/policy', element: <Policy />, meta: { requireAuth: true, title: '购房政策' } },
    { path: '/calculator', element: <Calculator />, meta: { requireAuth: true, title: '贷款计算' } },
    { path: '/favorites', element: <FavoritesPage />, meta: { requireAuth: true, title: '我的收藏' } },
    { path: '/viewing-plans', element: <ViewingPlansPage />, meta: { requireAuth: true, title: '看房计划' } },
    { path: '/reports/:reportId', element: <ReportView />, meta: { requireAuth: true, title: '方案预览' } },
    { path: '/plan', element: <PlanPage />, meta: { requireAuth: true, title: '个性化方案' } },
    { path: '/profile', element: <ProfilePage />, meta: { requireAuth: true, title: '个人资料' } },

    { path: '/landlord', element: <Landlord />, meta: { roles: ['landlord', 'admin'], requireAuth: true } },
  ];

  return (
    <Routes>
      {renderLeaves(leaves)}

      {/* 管理后台 */}
      <Route
        path="/admin"
        element={wrap(
          <AdminLayout />,
          { roles: ['admin'], requireAuth: true, title: '后台管理' },
        )}
      >
        <Route index element={<Navigate to="properties" replace />} />
        <Route
          path="properties"
          element={wrap(<AdminProperties />, { roles: ['admin'], requireAuth: true })}
        />
        <Route
          path="knowledge"
          element={wrap(<AdminKnowledge />, { roles: ['admin'], requireAuth: true })}
        />
        <Route
          path="conversations"
          element={wrap(<AdminConversations />, { roles: ['admin', 'landlord'], requireAuth: true })}
        />
        <Route
          path="compliance"
          element={wrap(<AdminCompliance />, { roles: ['admin'], requireAuth: true })}
        />
        <Route
          path="accounts"
          element={wrap(<AdminAccounts />, { roles: ['admin'], requireAuth: true })}
        />
        <Route
          path="statistics"
          element={wrap(<AdminStatistics />, { roles: ['admin'], requireAuth: true })}
        />
      </Route>

      {/* 兜底 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export { RoleBasedRoute };

/**
 * services/http.ts — 共享 axios 实例、拦截器、错误规约。
 *
 * 业务模块（auth/chat/property/landlord/admin/favorites/settings/viewing
 * -plan）只允许从这里导入 ``api`` 实例。所有 axios 配置集中修改。
 *
 * 注意：浏览器侧只能从 axios default 导出拿运行时值；命名类型
 * （``AxiosInstance`` / ``AxiosResponse``）必须用 ``import type``，
 * 不能进入运行时 ESM 命名空间——Vite 在某些 axios 版本会把
 * ``node_modules/.vite/deps/axios.js`` 预构建为仅默认导出，
 * 直接运行时 named import 会报
 *   "SyntaxError: The requested module '/node_modules/.vite/deps/axios.js?v=...'
 *    does not provide an export named 'AxiosInstance'"。
 * ``import type`` 在编译时被 Vite/esbuild 完全擦除，运行时不会触发此错。
 *
 * 拦截器位于 React 组件外，无法调用 ``App.useApp()`` 拿消息实例——
 * 上一版直接 ``import { message } from 'antd'`` 会触发 AntD v5 的
 *   "[antd: message] Static function can not consume context" warning。
 * 改为仅 ``console.error`` 兜底；UI 文案必须由业务组件自己用
 *   ``const { message } = App.useApp(); message.error(...)`` 反馈。
 */
import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';

const API_BASE_URL =
  (import.meta.env?.VITE_API_BASE as string | undefined) ||
  'http://localhost:8000/api';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface ErrorDetail {
  code?: string;
  message?: string;
}

function extractDetailMessage(detail: unknown, fallback: string): string | null {
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (typeof detail === 'object' && detail !== null) {
    const d = detail as ErrorDetail;
    if (d.message) return d.message;
  }
  return null;
}

api.interceptors.request.use(
  (config) => {
    let token: string | null = null;
    try {
      const raw = localStorage.getItem('token');
      if (raw && raw !== 'undefined' && raw !== 'null' && raw !== 'null:null') {
        token = raw;
      } else if (raw) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    } catch {
      /* ignore */
    }

    const authValue = token ? `Bearer ${token}` : null;

    // 通用 set/delete 辅助：axios 1.x 的 ``AxiosHeaders`` 提供 ``set``/``delete``，
    // 早期版本是 plain object。下面用 duck-typing 兼容两套 API，避免
    // "token 已在 localStorage 但请求头没携带 → 401" 这种竞态。
    const writeAuth = (target: unknown): void => {
      if (!target) return;
      const t = target as { set?: (k: string, v: string) => void; delete?: (k: string) => void };
      if (typeof t.set === 'function' && typeof t.delete === 'function') {
        if (authValue) t.set('Authorization', authValue);
        else t.delete('Authorization');
      } else {
        const obj = target as Record<string, string>;
        if (authValue) obj.Authorization = authValue;
        else delete obj.Authorization;
      }
    };

    // 1) 写到 axios 实例默认头：这一份是兜底，下游业务若没显式覆盖，
    //    会自动继承这个 header。
    writeAuth(api.defaults.headers.common);

    // 2) 同时写到当前请求的 config.headers —— 哪怕业务侧单独覆盖了
    //    defaults 也保证本请求能拿到最新 token。
    writeAuth(config.headers);

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    const status = error.response?.status as number | undefined;
    if (status === 401) {
      // 只有真正的"登录失效"才清空 token；token_missing 可能是用户没登录
      // 访问受保护页面，**别**误清，避免用户稍后登录又受到干扰。
      const detail = error.response?.data as
        | { detail?: { code?: string; message?: string } }
        | undefined;
      const code = (detail?.detail as any)?.code ?? (detail as any)?.code;
      if (code === 'token_missing') {
        // 这个分支几乎不会出现，因为受保护路由已经被 ProtectedRoute
        // 拦截；如果出现了，说明本地与后端状态不一致，但仍**不**清空
        // 本地可能存在的合法 token，避免误伤。
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
      if (typeof console !== 'undefined') {
        const label =
          code === 'token_expired' ? '登录已过期' :
          code === 'token_missing' ? '未携带 token' :
          code === 'token_invalid' ? 'token 无效（签名错误）' :
          code === 'token_blacklisted' ? 'token 已被吊销' :
          code === 'user_inactive' ? '用户不存在或已被禁用' :
          '未授权';
        console.warn(
          `[http] 401 [${code ?? '?'}] ${label}：` +
          (detail?.detail?.message ?? '请重新登录'),
        );
      }
    } else if (status === 429) {
      const msg = extractDetailMessage(
        error.response?.data?.detail,
        '请求频率过高，请稍后再试',
      );
      if (typeof console !== 'undefined') console.warn('[http] 429:', msg);
    } else if (status && status >= 500) {
      if (typeof console !== 'undefined') {
        console.error('[http] 服务器错误:', error.response?.status, error.response?.data);
      }
    } else if (!status) {
      if (typeof console !== 'undefined') {
        console.error('[http] 网络层错误:', error.message || error);
      }
    }
    return Promise.reject(error);
  },
);

export default api;


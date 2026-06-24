/**
 * services/api.ts — 聚合重导出层（向后兼容入口）。
 *
 * 历史代码全部以 `import { authApi, chatApi, ... } from '../services/api'`
 * 形式引用，保留默认导出 ``api``（axios 实例）与所有类型，便于平滑迁移
 * 到 ``services/<domain>.ts`` 各模块化对象。
 *
 * 业务新增请直接调用 ``services/<domain>`` 中的具名对象；本文件只在需要
 * 全局类型聚合时使用。
 */
import api from './http';

export { default } from './http';
export { api };

// —— 模块化对象 ——
export { authApi } from './auth';
export { chatApi } from './chat';
export { landlordApi } from './landlord';
export { adminApi } from './admin';
export { favoriteApi, viewingPlanApi } from './favorites';
export { settingsApi } from './settings';

// —— 共享类型 ——
export type {
  User,
  AuthResponse,
  LoginData,
  RegisterData,
  ProfileData,
  PaginationResponse,
} from './types';

// —— 业务类型 ——
export type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  CommunitySummary,
  ModelsResponse,
  ModelInfo,
  SetModelRequest,
  SetModelResponse,
  StreamEvent,
  CommunitySearchParams,
  CalculatorAdviceParams,
} from './chat';

export type { AdminProperty, AdminUser } from './admin';

export type { FavoriteItem, ViewingPlanItem } from './favorites';
export type { UserPreferenceData } from './settings';

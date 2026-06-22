# HouseCodex-Agent — 前端 README

> React 18 + Vite 5 + Ant Design 5 + TypeScript + Zustand。CLAUDE.md 是最高规范，本文做实施补充。

## 快速开始

```bash
npm install
cp .env.example .env       # 默认 dev backend = http://localhost:8000
npm run dev                # http://localhost:5173
npm run build              # 生产构建
npm run preview            # 预览构建产物
```

`.env` 中可调整的变量：

| 变量 | 默认 | 说明 |
|------|------|------|
| `VITE_API_BASE` | `/api` | 经 nginx 反代时使用相对路径；本地 dev 时改为 `http://localhost:8000/api` |
| `VITE_DEV_BACKEND` | `http://localhost:8000` | vite proxy 目标 |

## 目录约定

```
src/
├── components/        # 公共组件（CLAUDE.md §4.1 强制复用）
├── pages/             # 路由页面（admin/* 是后台）
├── stores/            # Zustand store（auth/chat/property，按领域拆分）
├── services/          # Axios 业务模块（http/auth/chat/landlord/admin/favorites/settings）
├── router/            # 路由 + RoleBasedRoute 守卫
├── hooks/             # 自定义 hooks
├── types/             # TypeScript 类型
├── utils/             # 工具函数
└── theme/             # AntD 主题令牌
```

## 强制复用组件（CLAUDE.md §4.1）

下列组件**必须**用，禁止用 Ant Design 原语重写：

| 组件 | 路径 | 用途 |
|------|------|------|
| `ChatBubble` | `components/ChatBubble` | 消息气泡 + Markdown |
| `PropertyCard` | `components/PropertyCard` | 楼盘概要 |
| `PropertyCompareTable` | `components/PropertyCompareTable` | 多楼盘对比 |
| `LoanCalculatorView` | `components/LoanCalculatorView` | 贷款计算（金融测算权威入口） |
| `PolicyReference` | `components/PolicyReference` | 政策引用块 |
| `ReportPreview` | `components/ReportPreview` | 方案预览 + 打印/PDF |
| `DataTable` | `components/DataTable` | 通用表格（二次封装） |
| `BatchImportModal` | `components/BatchImportModal` | 批量导入弹窗 |
| `RoleBasedRoute` | `router/RoleBasedRoute` | 路由级守卫 |
| `PermissionControl` | `components/PermissionControl` | UI 级权限包装 |

## 角色权限

| 角色 | 入口 | 守卫 |
|------|------|------|
| `user`（普通用户） | `/{chat,properties,calculator,favorites}` | `RoleBasedRoute allowedRoles={['user','landlord','admin']}` |
| `landlord`（房东） | `/landlord` | `allowedRoles={['landlord','admin']}` |
| `admin`（管理员） | `/admin/*` | `allowedRoles={['admin']}` |

路由层使用 `RoleBasedRoute`；UI 元素用 `PermissionControl` 包装。后端独立校验，前端隐藏**不是**权限边界。

## 主题与令牌

颜色、字号、间距 token 在 `src/theme/{colors,typography,spacing}.ts` 集中维护。修改前请与设计侧对齐。

## 类型安全

`tsconfig.app.json` 已开 `strict: true`。`any` 是最后兜底 — 提交前用 `grep -rEn ': any\b' src` 复查。

## 已知改进项

- `pages/Chat.tsx` 当前保留本地 `useState` 草稿态；下一 PR 完全迁入 `useChatStore`
- `services/api.ts` 为聚合 layer，新业务请直接 import `services/<domain>` 模块

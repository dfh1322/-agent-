/**
 * theme/typography.ts
 * 后台文字层级 — 与 Ant Design Title 层级对齐（h1-h5 + body），保证
 * 「渲染自然语义」而非每个页面各自指定像素。
 *
 * 每个 token 都同时含 ``fontSize`` + ``fontWeight`` + ``lineHeight``，
 * 调用点只需 ``style={{ fontSize: text.title.fontSize }}`` 即可，避免
 * 出现 ``text.body.fontWeight is undefined`` 类运行时崩溃。
 */
import { fontSize, fontWeight } from './spacing';

/**
 * 兜底：如果上游误传了一个不在 ``text`` 字典中的键（比如 ``text.titlesm``），
 * 退化为 ``body``，避免运行时 ``undefined.fontSize`` 把整个 AdminLayout 打崩。
 */
const FALLBACK = {
  fontSize: fontSize.body,
  lineHeight: 1.6,
  fontWeight: fontWeight.normal,
};

export const text = {
  display: {
    fontSize: fontSize.display,
    lineHeight: 1.2,
    fontWeight: fontWeight.bold,
    letterSpacing: '-0.02em',
  },
  heading: {
    fontSize: fontSize.heading,
    lineHeight: 1.3,
    fontWeight: fontWeight.semibold,
    letterSpacing: '-0.01em',
  },
  title: {
    fontSize: fontSize.title,
    lineHeight: 1.35,
    fontWeight: fontWeight.semibold,
  },
  /**
   * ``titleSm`` — sidebar/logo 等小区域标题用，介于 ``title`` 与 ``subtitle`` 之间。
   * 旧版本 AdminLayout 用了 ``text.titleSm.fontSize``，为避免破坏既有调用点
   * 把该键补齐，并把布局组件里其他 token 缺失也一并兜底。
   */
  titleSm: {
    fontSize: fontSize.titleSm,
    lineHeight: 1.4,
    fontWeight: fontWeight.semibold,
  },
  subtitle: {
    fontSize: fontSize.titleSm,
    lineHeight: 1.5,
    fontWeight: fontWeight.semibold,
  },
  body: {
    fontSize: fontSize.body,
    lineHeight: 1.6,
    fontWeight: fontWeight.normal,
  },
  caption: {
    fontSize: fontSize.caption,
    lineHeight: 1.5,
    fontWeight: fontWeight.normal,
  },
  number: {
    fontVariantNumeric: 'tabular-nums',
    fontSize: fontSize.body,
    lineHeight: 1.4,
    fontWeight: fontWeight.medium,
  },
} as const;

/**
 * ``safeText(key)`` — 真要写 ``text[key]?.fontSize`` 时直接 ``tx`` 帮手更稳。
 * 一律回退到 ``body``，不再抛出 ``undefined.fontSize``。
 */
type TextKey = keyof typeof text;
export function safeText(key: TextKey): typeof FALLBACK {
  const v = text[key] as typeof FALLBACK | undefined;
  return v ?? FALLBACK;
}


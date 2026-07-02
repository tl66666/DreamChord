/**
 * safeJsonParse.ts — 安全的 JSON.parse 封装
 *
 * 包装 JSON.parse，解析失败时返回 fallback 值而非抛出异常。
 * 用于处理来自后端、localStorage 等不可信来源的 JSON 字符串。
 */

/**
 * 安全解析 JSON 字符串
 *
 * @param str 要解析的 JSON 字符串
 * @param fallback 解析失败时返回的默认值
 * @returns 解析结果或 fallback
 */
export function safeJsonParse<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback
  try {
    return JSON.parse(str) as T
  } catch {
    return fallback
  }
}

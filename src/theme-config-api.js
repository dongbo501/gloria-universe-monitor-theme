import { themeShort, configFields, jsonKeys } from './theme-config-schema.js';

export const configUrl = `/api/themes/${encodeURIComponent(themeShort)}/config`;
export const fields = configFields.filter((field) => field.type !== 'title');
export const defaults = Object.fromEntries(fields.map((field) => [field.key, field.default]));
const jsonFields = new Set(jsonKeys);
const maxConfigBytes = 64 * 1024;

export class ThemeConfigError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ThemeConfigError';
    this.status = status;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fits(field, value) {
  switch (field.type) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        && value >= (field.min ?? -Infinity) && value <= (field.max ?? Infinity);
    case 'select':
      return field.options.some((option) => option.value === value);
    default:
      if (typeof value !== 'string' || value.length > maxConfigBytes) return false;
      if (!jsonFields.has(field.key)) return true;
      try {
        const parsed = JSON.parse(value);
        return isObject(parsed) && Object.values(parsed).every((entry) => typeof entry === 'string');
      } catch {
        return false;
      }
  }
}

export function mergeConfig(saved) {
  const values = isObject(saved) ? saved : {};
  return Object.fromEntries(fields.map((field) => [
    field.key,
    Object.hasOwn(values, field.key) && fits(field, values[field.key])
      ? values[field.key] : field.default,
  ]));
}

async function requestConfig(method = 'GET', body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(configUrl, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
      ...(body === undefined ? {} : {
        headers: { 'Content-Type': 'application/json' },
        body,
      }),
    });
    if (!response.ok) {
      const messages = {
        400: '主题尚未安装或配置格式无效，请在后台检查后重试。',
        401: '管理员登录已失效，请在后台重新登录后保存。',
        403: '没有保存主题设置的权限，请在后台重新登录。',
        404: '当前极简探针不支持主题配置接口，请升级 hub 后重试。',
        405: '当前极简探针不支持保存主题配置，请升级 hub 后重试。',
        413: '配置超过 64 KiB，请缩短文本或使用素材地址后重试。',
      };
      throw new ThemeConfigError(response.status,
        messages[response.status] ?? `主题配置请求失败（${response.status}），请稍后重试。`);
    }
    // The hub returns 204 No Content after a successful PUT.
    if (method === 'PUT') return;
    const saved = await response.json();
    if (!isObject(saved)) throw new ThemeConfigError(502, '服务器返回的主题配置不是有效的 JSON 对象。');
    return saved;
  } finally {
    clearTimeout(timeout);
  }
}

export function readRawConfig() {
  return requestConfig();
}

export async function loadThemeConfig({ strict = false } = {}) {
  try {
    return mergeConfig(await readRawConfig());
  } catch (error) {
    // Public pages must still render when configuration is unavailable.
    // Explicit administrator reloads must fail so they do not discard a draft.
    if (strict) throw error;
    return { ...defaults };
  }
}

export async function writeConfig(values, saved) {
  const next = { ...saved };
  for (const field of fields) {
    const value = values[field.key];
    if (!fits(field, value)) throw new Error(`设置“${field.label ?? field.key}”的值无效，请修正后再保存。`);
    if (value === field.default) delete next[field.key];
    else next[field.key] = value;
  }
  // Keep unknown keys: PUT replaces the complete object in the hub database.
  const body = JSON.stringify(next);
  if (new TextEncoder().encode(body).byteLength > maxConfigBytes) {
    throw new ThemeConfigError(413, '配置超过 64 KiB，请缩短文本或使用素材地址后重试。');
  }
  await requestConfig('PUT', body);
}

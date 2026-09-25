import {
  v as validateConfig,
  a5 as verifyLogin,
  M as MonitorError,
} from './v3-services-BR8Lph9F.js';
import { readRawConfig, mergeConfig, writeConfig } from './theme-config-api.js';

let saving = false;

export function themeConfigFingerprint(values) {
  return JSON.stringify(validateConfig(values).config);
}

export async function saveServerTheme(values, expectedFingerprint, onProgress = () => {}) {
  if (saving) throw new Error('主题正在保存，请等待当前操作完成。');
  saving = true;
  const save = async () => {
    const validated = validateConfig(values);
    if (Object.keys(validated.errors).length) throw new Error('设置包含无效内容，请先修正。');
    if (!(await verifyLogin({ force: true })).authenticated) {
      throw new MonitorError(401, '无法验证管理员登录，请在后台重新登录后保存。');
    }
    const saved = await readRawConfig();
    if (themeConfigFingerprint(mergeConfig(saved)) !== expectedFingerprint) {
      throw new Error('服务器配置已被修改，请先导出草稿，再点击“重新读取服务器配置”后合并修改。');
    }
    onProgress(30);
    await writeConfig(validated.config, saved);
    onProgress(80);
    let confirmed;
    try {
      confirmed = mergeConfig(await readRawConfig());
    } catch (error) {
      const failure = new Error('服务器已接收配置，但暂时无法读取确认；请重新读取服务器配置核对。');
      failure.status = error.status;
      throw failure;
    }
    if (themeConfigFingerprint(confirmed) !== themeConfigFingerprint(validated.config)) {
      throw new Error('服务器返回的配置与本次保存不一致，请重新读取服务器配置核对。');
    }
    onProgress(100);
    return confirmed;
  };
  try {
    if (globalThis.navigator?.locks) {
      return await navigator.locks.request('gloria-theme-config', { ifAvailable: true }, async (lock) => {
        if (!lock) throw new Error('另一个页面正在保存主题设置，请稍后重试。');
        return save();
      });
    }
    return await save();
  } catch (error) {
    if (error.status && !(error instanceof MonitorError)) {
      throw new MonitorError(error.status, error.message);
    }
    if (error.name === 'AbortError' || error instanceof TypeError) {
      throw new Error('主题配置请求超时或网络中断，请重新读取服务器配置核对后重试。');
    }
    throw error;
  } finally {
    saving = false;
  }
}

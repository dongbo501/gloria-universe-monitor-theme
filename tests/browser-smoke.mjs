import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const dist = new URL('../theme-api/dist/', import.meta.url);
const apiPath = '/api/themes/gloria-universe/config';
let saved = { rpcTransportMode: 'http', futureSetting: { keep: true } };
let putStatus = 204;
let readStatus = 200;
let authed = true;
const requests = [];
const mime = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  requests.push({ path, method: req.method });
  res.setHeader('Cache-Control', 'no-store');
  const json = (value) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
  if (path === '/api/me') return json({ authed, public_page: true, site_name: 'API 配置测试' });
  if (path === '/api/nodes') return json({ nodes: [] });
  if (path === apiPath) {
    if (req.method === 'PUT') {
      if (putStatus !== 204) { res.writeHead(putStatus); return res.end('save failed'); }
      let body = '';
      for await (const part of req) body += part;
      saved = JSON.parse(body);
      res.writeHead(204);
      return res.end();
    }
    if (readStatus !== 200) { res.writeHead(readStatus); return res.end('read failed'); }
    return json(saved);
  }
  if (path.startsWith('/api/')) { res.writeHead(404); return res.end(); }
  try {
    const file = path === '/' ? 'index.html' : path.slice(1);
    res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
    res.end(await readFile(new URL(file, dist)));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await context.route('**/*', (route) => route.request().url().startsWith(url) ? route.continue() : route.abort());
const button = (name) => page.getByRole('button', { name, exact: true });
const waitText = (text) => page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });
async function openSettings() {
  await page.locator('[title="主题设置"], [aria-label="主题设置"]').first().click();
  await page.locator('#setting-themeMode').waitFor({ state: 'visible' });
}
try {
  await page.goto(url);
  await openSettings();
  await page.locator('#setting-alertTitle').fill('通过 API 保存的公告');
  await page.locator('#setting-alertContent').fill('数据库中的公告正文');
  await page.locator('#setting-alertEnabled').click();
  const saveStart = requests.length;
  await button('保存到服务器').click();
  await waitText('已保存到服务器，所有设备使用同一份配置');
  assert.equal(saved.alertTitle, '通过 API 保存的公告');
  assert.equal(saved.alertEnabled, true);
  assert.deepEqual(saved.futureSetting, { keep: true });
  assert.ok(requests.slice(saveStart).filter((r) => r.method === 'PUT').length === 1);
  assert.ok(!requests.slice(saveStart).some((r) => r.path === '/theme-package.json'));
  await page.reload();
  await waitText('通过 API 保存的公告');
  await openSettings();
  assert.equal(await page.locator('#setting-alertTitle').inputValue(), '通过 API 保存的公告');

  saved.alertTitle = '后台面板修改';
  await button('重新读取服务器配置').click();
  await waitText('已重新读取服务器配置，未保存的修改已撤销。');
  assert.equal(await page.locator('#setting-alertTitle').inputValue(), '后台面板修改');
  await page.locator('#setting-alertTitle').fill('保留草稿');
  readStatus = 500;
  await button('重新读取服务器配置').click();
  await waitText('无法读取服务器配置，草稿已保留');
  assert.equal(await page.locator('#setting-alertTitle').inputValue(), '保留草稿');
  readStatus = 200;
  saved.alertTitle = '另一页面的新值';
  await button('保存到服务器').click();
  await waitText('服务器配置已被修改');
  assert.equal(saved.alertTitle, '另一页面的新值');

  await button('重新读取服务器配置').click();
  await waitText('已重新读取服务器配置，未保存的修改已撤销。');
  await page.locator('#setting-alertTitle').fill('应当保存失败');
  putStatus = 500;
  await button('保存到服务器').click();
  await waitText('主题配置请求失败（500）');
  assert.equal(saved.alertTitle, '另一页面的新值');
  putStatus = 204;

  // Keep the existing resource-and-JSON backup workflow usable after the migration.
  const download = page.waitForEvent('download');
  await button('下载主题与配置备份').click();
  const backup = await download;
  await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
  await backup.saveAs(new URL('../test-results/browser-backup.tar.gz', import.meta.url).pathname);
  await waitText('已下载主题与配置备份');
  await page.screenshot({ path: new URL('../test-results/settings.png', import.meta.url).pathname, fullPage: true });

  await button('载入默认值').click();
  await button('保存到服务器').click();
  await waitText('已保存到服务器，所有设备使用同一份配置');
  assert.deepEqual(saved, { futureSetting: { keep: true } });

  // Guest pages read the same database and expose no administrative settings entry.
  authed = false;
  saved = { rpcTransportMode: 'http', alertEnabled: true, alertTitle: '访客共享配置', alertContent: '共享公告正文' };
  await page.reload();
  await waitText('访客共享配置');
  assert.equal(await page.locator('[title="主题设置"], [aria-label="主题设置"]').count(), 0);
  assert.ok(requests.every((r) => !(r.path === '/api/themes' && r.method === 'POST')));
  assert.deepEqual(errors, []);
  console.log('Browser passed: save, reload, panel changes, retained drafts, conflict, failure, backup, reset and guest display.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

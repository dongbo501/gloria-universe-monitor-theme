import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const base = new URL('../theme-api/dist/', import.meta.url);
const assets = await readdir(new URL('assets/', base));
const asset = (prefix) => new URL('assets/' + assets.find((name) => name.startsWith(prefix)), base);
const api = await import(asset('theme-config-api-'));
const persistence = await import(asset('theme-persistence.service-'));
const services = await import(asset('v3-services-'));
const manifest = JSON.parse(await readFile(new URL('../theme-api/theme.json', import.meta.url)));
const fingerprint = persistence.themeConfigFingerprint;
const originalFetch = globalThis.fetch;

function mockHub(initial = {}, options = {}) {
  let saved = structuredClone(initial);
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    requests.push({ url, ...init, method });
    if (url === '/api/me') return Response.json({ authed: options.authed ?? true, public_page: true });
    assert.equal(url, '/api/themes/gloria-universe/config', 'Saving must only use the config endpoint');
    assert.equal(init.credentials, 'same-origin');
    assert.equal(init.cache, 'no-store');
    if (method === 'PUT') {
      if (options.putStatus) return new Response('rejected', { status: options.putStatus });
      assert.equal(init.headers['Content-Type'], 'application/json');
      saved = JSON.parse(init.body);
      if (options.mutateSaved) saved = options.mutateSaved(saved);
      return new Response(null, { status: 204 });
    }
    if (options.readError) throw options.readError;
    if (options.readStatus) return new Response(null, { status: options.readStatus });
    if (options.invalidJson) return new Response('invalid JSON');
    if (options.afterWriteError && requests.some((r) => r.method === 'PUT')) throw new TypeError('offline');
    return Response.json(saved);
  };
  return { requests, saved: () => saved };
}

test.after(() => { globalThis.fetch = originalFetch; });

test('all 52 editable fields share valid defaults with the hub manifest and original settings', async () => {
  const fields = manifest.config.filter((field) => field.type !== 'title');
  assert.equal(fields.length, 52);
  assert.equal(new Set(fields.map((field) => field.key)).size, fields.length);
  assert.equal(manifest.config.filter((field) => field.type === 'title').length, 8);
  assert.deepEqual(services.q, api.defaults);
  assert.deepEqual(services.v(api.defaults).errors, {});
  assert.deepEqual(JSON.parse(await readFile(new URL('theme-config.json', base))), api.defaults);
  for (const field of fields) {
    assert.ok(['boolean', 'number', 'select', 'string', 'text'].includes(field.type));
    assert.equal(typeof field.label, 'string');
    if (field.type === 'select') assert.ok(field.options.some((option) => option.value === field.default));
  }
});

test('server configuration overrides defaults; invalid old values fall back individually', async () => {
  mockHub({ themeMode: 'light', hideEarth: true, backgroundBlur: 12, homeHighLoadThreshold: 0,
    nodeCardSize: 'unknown', alertTitle: 42, fanAudioTrackSources: 'bad JSON', unrelated: 'keep' });
  const config = await services.l();
  assert.equal(config.themeMode, 'light');
  assert.equal(config.hideEarth, true);
  assert.equal(config.backgroundBlur, 12);
  for (const key of ['homeHighLoadThreshold', 'nodeCardSize', 'alertTitle', 'fanAudioTrackSources']) {
    assert.equal(config[key], api.defaults[key]);
  }
  assert.equal(Object.hasOwn(config, 'unrelated'), false);
});

test('public reads silently use defaults on HTTP failures, network errors and malformed responses', async () => {
  for (const options of [{ readStatus: 401 }, { readStatus: 404 }, { readStatus: 500 },
    { readError: new TypeError('offline') }, { invalidJson: true }]) {
    mockHub({}, options);
    assert.deepEqual(await services.l(), api.defaults);
    await assert.rejects(services.l({ strict: true }));
  }
  for (const invalid of [null, [], 'wrong']) {
    mockHub(invalid);
    assert.deepEqual(await services.l(), api.defaults);
    await assert.rejects(api.readRawConfig());
  }
});

test('GET → PUT → GET saves only overrides, preserves unknown keys and accepts 204', async () => {
  const initial = { themeMode: 'light', futureSetting: { mode: 'keep' }, alertEnabled: true };
  const hub = mockHub(initial);
  const values = { ...api.defaults, alertTitle: '接口保存测试', alertEnabled: true };
  const progress = [];
  const saved = await persistence.saveServerTheme(values, fingerprint(api.mergeConfig(initial)), (value) => progress.push(value));
  assert.deepEqual(saved, values);
  assert.deepEqual(hub.saved(), { futureSetting: { mode: 'keep' }, alertTitle: '接口保存测试', alertEnabled: true });
  assert.deepEqual(hub.requests.map((request) => request.method), ['GET', 'GET', 'PUT', 'GET']);
  assert.deepEqual(progress, [30, 80, 100]);
  assert.deepEqual(await services.l(), values, 'A fresh page load must read the saved configuration');
});

test('restoring defaults deletes declared overrides and preserves unknown keys', async () => {
  const initial = { themeMode: 'light', backgroundBlur: 10, futureSetting: 'keep' };
  const hub = mockHub(initial);
  await persistence.saveServerTheme(api.defaults, fingerprint(api.mergeConfig(initial)));
  assert.deepEqual(hub.saved(), { futureSetting: 'keep' });
});

test('conflicts and unauthenticated sessions never write', async () => {
  const conflict = mockHub({ alertTitle: 'Changed by another page' });
  await assert.rejects(persistence.saveServerTheme(api.defaults, fingerprint(api.defaults)), /服务器配置已被修改/);
  assert.ok(conflict.requests.every((request) => request.method !== 'PUT'));
  const guest = mockHub({}, { authed: false });
  await assert.rejects(persistence.saveServerTheme(api.defaults, fingerprint(api.defaults)), (error) => error.status === 401);
  assert.deepEqual(guest.requests.map((request) => request.url), ['/api/me']);
});

test('failed pre-save reads never overwrite saved values', async () => {
  for (const options of [{ readStatus: 404 }, { readStatus: 500 }, { invalidJson: true }, { readError: new TypeError('offline') }]) {
    const hub = mockHub({}, options);
    await assert.rejects(persistence.saveServerTheme(api.defaults, fingerprint(api.defaults)));
    assert.ok(hub.requests.every((request) => request.method !== 'PUT'));
  }
});

test('PUT errors are reported and preserve authentication status codes', async () => {
  for (const status of [400, 401, 403, 404, 405, 413, 500]) {
    const hub = mockHub({}, { putStatus: status });
    await assert.rejects(persistence.saveServerTheme(api.defaults, fingerprint(api.defaults)), (error) => error.status === status);
    assert.equal(hub.requests.at(-1).method, 'PUT');
  }
});

test('64 KiB limit counts UTF-8 bytes and includes retained unknown values', async () => {
  for (const [initial, values] of [
    [{}, { ...api.defaults, alertContent: '中'.repeat(22000) }],
    [{ futureSetting: 'x'.repeat(65500) }, { ...api.defaults, alertTitle: 'Additional bytes exceed the limit' }],
  ]) {
    const hub = mockHub(initial);
    await assert.rejects(persistence.saveServerTheme(values, fingerprint(api.mergeConfig(initial))), (error) => error.status === 413);
    assert.ok(hub.requests.every((request) => request.method !== 'PUT'));
  }
});

test('a successful PUT followed by a failed read or conflicting value is not reported as confirmed', async () => {
  for (const options of [{ afterWriteError: true }, { mutateSaved: () => ({ alertTitle: 'Other writer' }) }]) {
    mockHub({}, options);
    const progress = [];
    await assert.rejects(persistence.saveServerTheme(api.defaults, fingerprint(api.defaults), (value) => progress.push(value)), /核对/);
    assert.deepEqual(progress, [30, 80]);
  }
});

test('concurrent saves are rejected and the guard is released afterward', async () => {
  const hub = mockHub();
  const pending = persistence.saveServerTheme(api.defaults, fingerprint(api.defaults));
  await assert.rejects(persistence.saveServerTheme(api.defaults, fingerprint(api.defaults)), /正在保存/);
  await pending;
  await persistence.saveServerTheme(api.defaults, fingerprint(api.defaults));
  assert.equal(hub.requests.filter((request) => request.method === 'PUT').length, 2);
});

test('every downloadable asset has matching size and SHA-256; the upload endpoint is absent', async () => {
  const packageInfo = JSON.parse(await readFile(new URL('theme-package.json', base)));
  assert.deepEqual(packageInfo.manifest, manifest);
  for (const file of packageInfo.files) {
    const data = await readFile(new URL(file.name, base));
    assert.equal(data.length, file.bytes, file.name);
    assert.equal(createHash('sha256').update(data).digest('hex'), file.sha256, file.name);
    if (file.name.endsWith('.js')) {
      assert.ok(!data.toString().includes('/api/themes?offset='), file.name);
    }
  }
});

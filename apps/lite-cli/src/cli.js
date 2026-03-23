#!/usr/bin/env -S node --import tsx

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { LiteCore, NostrRelayClient } from '@nostrpass/lite-core';

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'];
const DEFAULT_POLICY_FILE = '.nostrpass-lite-policy.json';
const DEFAULT_STORAGE_PREFIX = 'nostrpass-lite-cli';
const DEFAULT_STORAGE_DIR = path.join(process.cwd(), '.nostrpass-lite');
const POLICY_LEVELS = new Set(['ALLOW', 'ASK_PER_SESSION', 'ASK_EVERYTIME', 'DENY']);
const OPERATION_ALIASES = new Map([
  ['getPublicKey', 'getPublicKey'],
  ['signEvent', 'signEvent'],
  ['nip04.encrypt', 'nip04.encrypt'],
  ['nip04.decrypt', 'nip04.decrypt'],
  ['nip44.encrypt', 'nip44.encrypt'],
  ['nip44.decrypt', 'nip44.decrypt'],
  ['nip04-encrypt', 'nip04.encrypt'],
  ['nip04-decrypt', 'nip04.decrypt'],
  ['nip44-encrypt', 'nip44.encrypt'],
  ['nip44-decrypt', 'nip44.decrypt'],
]);

class JsonFileKeyValueStore {
  constructor(prefix, storageDir) {
    this.filePath = path.join(storageDir, `${prefix}.json`);
  }

  async get(key) {
    const values = await this.readAll();
    return key in values ? values[key] : null;
  }

  async set(key, value) {
    const values = await this.readAll();
    values[key] = value;
    await this.writeAll(values);
  }

  async remove(key) {
    const values = await this.readAll();
    if (key in values) {
      delete values[key];
      await this.writeAll(values);
    }
  }

  async readAll() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      if (isErrno(error, 'ENOENT')) {
        return {};
      }
      throw error;
    }
  }

  async writeAll(values) {
    const directory = path.dirname(this.filePath);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(values, null, 2), 'utf8');
  }
}

function isErrno(error, code) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function fail(message, code = 'CLI_ERROR', detail = undefined) {
  const error = new Error(message);
  error.code = code;
  error.detail = detail;
  throw error;
}

function parseFlags(tokens) {
  const flags = {};
  const positional = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }

    const normalized = token.slice(2);
    if (!normalized) {
      continue;
    }

    const equalsIndex = normalized.indexOf('=');
    if (equalsIndex > -1) {
      const key = normalized.slice(0, equalsIndex);
      const value = normalized.slice(equalsIndex + 1);
      flags[key] = value;
      continue;
    }

    const next = tokens[index + 1];
    if (next && !next.startsWith('--')) {
      flags[normalized] = next;
      index += 1;
      continue;
    }

    flags[normalized] = true;
  }

  return { flags, positional };
}

function parseBoolean(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function parseNumber(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : fallback;
}

function parseCsv(value, fallback) {
  if (!value) {
    return fallback;
  }
  const entries = String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return entries.length ? entries : fallback;
}

function normalizeOrigin(raw) {
  if (!raw) {
    return 'cli://local-agent';
  }
  try {
    return new URL(raw).origin;
  } catch {
    return String(raw);
  }
}

function normalizeOperation(raw) {
  const operation = OPERATION_ALIASES.get(String(raw));
  if (!operation) {
    fail(`Unsupported operation: ${raw}`, 'INVALID_OPERATION');
  }
  return operation;
}

function required(flags, key, label = key) {
  const value = flags[key];
  if (value === undefined || String(value).trim() === '') {
    fail(`Missing required flag --${label}`, 'INVALID_INPUT');
  }
  return String(value);
}

function readSecret(flags, envFlag, defaultEnvName) {
  const envName = String(flags[envFlag] ?? defaultEnvName);
  const value = process.env[envName];
  if (!value) {
    fail(
      `Missing secret in environment variable ${envName} (set --${envFlag} to override)`,
      'MISSING_SECRET'
    );
  }
  return value;
}

function getPolicyFilePath(flags) {
  const configured = flags['policy-file'] ?? process.env.NOSTRPASS_LITE_POLICY_FILE ?? DEFAULT_POLICY_FILE;
  return path.resolve(String(configured));
}

function defaultPolicy() {
  return {
    version: 1,
    default: 'DENY',
    origins: {},
  };
}

function normalizePolicy(policy) {
  const fallback = defaultPolicy();
  if (!policy || typeof policy !== 'object') {
    return fallback;
  }

  const normalized = {
    version: 1,
    default: POLICY_LEVELS.has(policy.default) ? policy.default : fallback.default,
    origins: {},
  };

  const origins = policy.origins;
  if (!origins || typeof origins !== 'object') {
    return normalized;
  }

  for (const [origin, originPolicyRaw] of Object.entries(origins)) {
    if (!originPolicyRaw || typeof originPolicyRaw !== 'object') {
      continue;
    }

    const operations = {};
    for (const [operation, level] of Object.entries(originPolicyRaw.operations ?? {})) {
      if (OPERATION_ALIASES.has(operation) && POLICY_LEVELS.has(level)) {
        operations[normalizeOperation(operation)] = level;
      }
    }

    const kinds = {};
    for (const [kind, level] of Object.entries(originPolicyRaw.kinds ?? {})) {
      if (POLICY_LEVELS.has(level)) {
        kinds[String(kind)] = level;
      }
    }

    normalized.origins[origin] = {
      operations,
      kinds,
      sessionMinutes: parseNumber(originPolicyRaw.sessionMinutes, 60),
    };
  }

  return normalized;
}

async function loadPolicy(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return normalizePolicy(JSON.parse(raw));
  } catch (error) {
    if (isErrno(error, 'ENOENT')) {
      return defaultPolicy();
    }
    throw error;
  }
}

async function savePolicy(filePath, policy) {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(policy, null, 2), 'utf8');
}

function resolvePolicyDecision(policy, origin, operation, payload) {
  const originPolicy = policy.origins[origin] ?? policy.origins['*'] ?? null;
  if (!originPolicy) {
    return {
      level: policy.default,
      source: 'default',
      sessionMinutes: 60,
    };
  }

  if (operation === 'signEvent') {
    const kindValue = payload?.event?.kind;
    const kindNumber = Number(kindValue);
    if (Number.isFinite(kindNumber)) {
      const kindLevel = originPolicy.kinds?.[String(kindNumber)];
      if (kindLevel && POLICY_LEVELS.has(kindLevel)) {
        return {
          level: kindLevel,
          source: 'kind',
          sessionMinutes: parseNumber(originPolicy.sessionMinutes, 60),
        };
      }
    }
  }

  const operationLevel = originPolicy.operations?.[operation];
  if (operationLevel && POLICY_LEVELS.has(operationLevel)) {
    return {
      level: operationLevel,
      source: 'operation',
      sessionMinutes: parseNumber(originPolicy.sessionMinutes, 60),
    };
  }

  return {
    level: policy.default,
    source: 'default',
    sessionMinutes: parseNumber(originPolicy.sessionMinutes, 60),
  };
}

async function askYesNo(prompt) {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`${prompt} [y/N]: `);
    return ['y', 'yes'].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
}

async function executeWithPolicy({
  core,
  policy,
  origin,
  operation,
  payload = {},
  interactive = false,
}) {
  const first = await core.requestOperation({ origin, operation, payload });
  if (first.success) {
    return first.data;
  }

  if (first.errorCode !== 'PERMISSION_REQUIRED' || !first.requestId) {
    fail(first.error ?? 'Operation failed', first.errorCode ?? 'OPERATION_FAILED');
  }

  const decision = resolvePolicyDecision(policy, origin, operation, payload);
  const level = decision.level;

  if (level === 'DENY') {
    await core.resolvePermission({
      requestId: first.requestId,
      granted: false,
      remember: false,
    });
    fail('Permission denied by policy', 'PERMISSION_DENIED', {
      origin,
      operation,
      source: decision.source,
    });
  }

  if (level === 'ASK_EVERYTIME') {
    if (!interactive) {
      fail(
        'Permission requires interactive approval but CLI is running in non-interactive mode',
        'PERMISSION_REQUIRED',
        { origin, operation }
      );
    }

    const granted = await askYesNo(`Allow ${origin} to call ${operation}?`);
    const resolved = await core.resolvePermission({
      requestId: first.requestId,
      granted,
      remember: false,
      level: 'ASK_EVERYTIME',
    });
    if (!resolved.success) {
      fail(resolved.error ?? 'Permission denied', resolved.errorCode ?? 'PERMISSION_DENIED');
    }
    return resolved.data;
  }

  const resolved = await core.resolvePermission({
    requestId: first.requestId,
    granted: true,
    remember: true,
    level,
    sessionDurationMinutes: decision.sessionMinutes,
  });

  if (!resolved.success) {
    fail(resolved.error ?? 'Operation denied', resolved.errorCode ?? 'OPERATION_DENIED');
  }

  return resolved.data;
}

async function createCore(flags) {
  const relays = parseCsv(flags.relays, DEFAULT_RELAYS);
  const storageDir = path.resolve(
    String(flags['storage-dir'] ?? process.env.NOSTRPASS_LITE_HOME ?? DEFAULT_STORAGE_DIR)
  );
  const storagePrefix = String(flags['storage-prefix'] ?? DEFAULT_STORAGE_PREFIX);
  const namespace = String(flags.namespace ?? 'nostrpass-lite');
  const environment = String(flags.environment ?? 'production');

  const core = new LiteCore({
    storage: new JsonFileKeyValueStore(storagePrefix, storageDir),
    relayClient: new NostrRelayClient(relays),
    namespace,
    environment,
    relays,
    allowOffline: parseBoolean(flags['allow-offline'], false),
    minRelayAcks: parseNumber(flags['min-relay-acks'], 1),
  });
  await core.initialize();
  return { core, relays };
}

async function loginFromFlags(core, flags) {
  const identifier = required(flags, 'identifier');
  const authSecret = readSecret(flags, 'auth-secret-env', 'NOSTRPASS_LITE_AUTH_SECRET');
  return core.loginWithPassword({
    identifier,
    authSecret,
  });
}

async function unlockFromFlags(core, flags) {
  await loginFromFlags(core, flags);
  const pin = readSecret(flags, 'pin-env', 'NOSTRPASS_LITE_PIN');
  return core.unlock({ pin });
}

async function readEventFromFlags(flags) {
  if (flags['event-file']) {
    const filePath = path.resolve(String(flags['event-file']));
    const raw = await fs.readFile(filePath, 'utf8');
    const event = JSON.parse(raw);
    return {
      kind: Number(event.kind ?? 1),
      created_at: Number(event.created_at ?? Math.floor(Date.now() / 1000)),
      tags: Array.isArray(event.tags) ? event.tags : [],
      content: String(event.content ?? ''),
    };
  }

  const tagsRaw = flags.tags ? JSON.parse(String(flags.tags)) : [];
  return {
    kind: parseNumber(flags.kind, 1),
    created_at: parseNumber(flags['created-at'], Math.floor(Date.now() / 1000)),
    tags: Array.isArray(tagsRaw) ? tagsRaw : [],
    content: String(flags.content ?? ''),
  };
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printHelp() {
  printJson({
    usage: 'nostrpass-lite <command> [flags]',
    commands: [
      'auth-state',
      'enroll',
      'import-key',
      'login',
      'unlock',
      'lock',
      'logout',
      'get-public-key',
      'sign-event',
      'nip04-encrypt',
      'nip04-decrypt',
      'nip44-encrypt',
      'nip44-decrypt',
      'permissions list|check|set',
    ],
    defaults: {
      authSecretEnv: 'NOSTRPASS_LITE_AUTH_SECRET',
      pinEnv: 'NOSTRPASS_LITE_PIN',
      keyEnv: 'NOSTRPASS_LITE_KEY',
      policyFile: DEFAULT_POLICY_FILE,
    },
  });
}

async function commandPermissions(subcommand, flags) {
  const policyPath = getPolicyFilePath(flags);
  const policy = await loadPolicy(policyPath);

  if (subcommand === 'list') {
    printJson({ success: true, policyPath, policy });
    return;
  }

  if (subcommand === 'check') {
    const origin = normalizeOrigin(required(flags, 'origin'));
    const operation = normalizeOperation(required(flags, 'operation'));
    const payload =
      operation === 'signEvent' && flags.kind !== undefined
        ? { event: { kind: parseNumber(flags.kind, 1) } }
        : {};
    const decision = resolvePolicyDecision(policy, origin, operation, payload);
    printJson({ success: true, origin, operation, decision, policyPath });
    return;
  }

  if (subcommand === 'set') {
    const origin = normalizeOrigin(required(flags, 'origin'));
    const operation = normalizeOperation(required(flags, 'operation'));
    const level = String(required(flags, 'level')).toUpperCase();
    if (!POLICY_LEVELS.has(level)) {
      fail(`Invalid permission level: ${level}`, 'INVALID_PERMISSION_LEVEL');
    }

    const originPolicy = policy.origins[origin] ?? {
      operations: {},
      kinds: {},
      sessionMinutes: 60,
    };

    if (flags.kind !== undefined && operation === 'signEvent') {
      originPolicy.kinds[String(parseNumber(flags.kind, 1))] = level;
    } else {
      originPolicy.operations[operation] = level;
    }

    if (flags['session-minutes'] !== undefined) {
      originPolicy.sessionMinutes = parseNumber(flags['session-minutes'], 60);
    }

    policy.origins[origin] = originPolicy;
    await savePolicy(policyPath, policy);
    printJson({ success: true, policyPath, origin, operation, level });
    return;
  }

  fail(`Unsupported permissions subcommand: ${subcommand}`, 'INVALID_INPUT');
}

async function runCommand(command, flags, positional) {
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'permissions') {
    const subcommand = positional[0] ?? 'list';
    await commandPermissions(subcommand, flags);
    return;
  }

  const { core } = await createCore(flags);
  const interactive = parseBoolean(flags.interactive, false);

  if (command === 'auth-state') {
    printJson({ success: true, data: core.getAuthState() });
    return;
  }

  if (command === 'enroll') {
    const identifier = required(flags, 'identifier');
    const authSecret = readSecret(flags, 'auth-secret-env', 'NOSTRPASS_LITE_AUTH_SECRET');
    const pin = readSecret(flags, 'pin-env', 'NOSTRPASS_LITE_PIN');
    const result = await core.enrollWithPassword({
      identifier,
      authSecret,
      pin,
      overwriteExistingLogin: parseBoolean(flags['overwrite-existing-login'], false),
      overwriteExistingVault: parseBoolean(flags['overwrite-existing-vault'], false),
    });
    printJson({ success: true, data: result });
    return;
  }

  if (command === 'import-key') {
    const identifier = required(flags, 'identifier');
    const authSecret = readSecret(flags, 'auth-secret-env', 'NOSTRPASS_LITE_AUTH_SECRET');
    const pin = readSecret(flags, 'pin-env', 'NOSTRPASS_LITE_PIN');
    const format = String(flags.format ?? 'nsec');
    if (!['nsec', 'hex'].includes(format)) {
      fail(`Invalid key format: ${format}`, 'INVALID_INPUT');
    }
    const value = flags.value
      ? String(flags.value)
      : readSecret(flags, 'key-env', 'NOSTRPASS_LITE_KEY');
    const result = await core.importKey({
      authMethod: 'password',
      format,
      value,
      identifier,
      authSecret,
      pin,
      overwriteExistingLogin: parseBoolean(flags['overwrite-existing-login'], false),
      overwriteExistingVault: parseBoolean(flags['overwrite-existing-vault'], false),
    });
    printJson({ success: true, data: result });
    return;
  }

  if (command === 'login') {
    const result = await loginFromFlags(core, flags);
    printJson({ success: true, data: result });
    return;
  }

  if (command === 'unlock') {
    const result = await unlockFromFlags(core, flags);
    printJson({ success: true, data: result });
    return;
  }

  if (command === 'lock') {
    await loginFromFlags(core, flags);
    const result = await core.lock();
    printJson({ success: true, data: result });
    return;
  }

  if (command === 'logout') {
    const result = await core.logout();
    printJson({ success: true, data: result });
    return;
  }

  if (command === 'get-public-key') {
    await loginFromFlags(core, flags);
    const policy = await loadPolicy(getPolicyFilePath(flags));
    const origin = normalizeOrigin(flags.origin);
    const result = await executeWithPolicy({
      core,
      policy,
      origin,
      operation: 'getPublicKey',
      payload: {},
      interactive,
    });
    printJson({ success: true, data: { pubkey: result } });
    return;
  }

  if (command === 'sign-event') {
    await unlockFromFlags(core, flags);
    const policy = await loadPolicy(getPolicyFilePath(flags));
    const origin = normalizeOrigin(flags.origin);
    const event = await readEventFromFlags(flags);
    const result = await executeWithPolicy({
      core,
      policy,
      origin,
      operation: 'signEvent',
      payload: { event },
      interactive,
    });
    printJson({ success: true, data: result });
    return;
  }

  if (command === 'nip04-encrypt' || command === 'nip04-decrypt') {
    await unlockFromFlags(core, flags);
    const policy = await loadPolicy(getPolicyFilePath(flags));
    const origin = normalizeOrigin(flags.origin);
    const pubkey = required(flags, 'pubkey');
    const field = command.endsWith('encrypt') ? 'plaintext' : 'ciphertext';
    const value = required(flags, field);
    const operation = command === 'nip04-encrypt' ? 'nip04.encrypt' : 'nip04.decrypt';
    const result = await executeWithPolicy({
      core,
      policy,
      origin,
      operation,
      payload: { pubkey, [field]: value },
      interactive,
    });
    printJson({ success: true, data: result });
    return;
  }

  if (command === 'nip44-encrypt' || command === 'nip44-decrypt') {
    await unlockFromFlags(core, flags);
    const policy = await loadPolicy(getPolicyFilePath(flags));
    const origin = normalizeOrigin(flags.origin);
    const pubkey = required(flags, 'pubkey');
    const field = command.endsWith('encrypt') ? 'plaintext' : 'ciphertext';
    const value = required(flags, field);
    const operation = command === 'nip44-encrypt' ? 'nip44.encrypt' : 'nip44.decrypt';
    const result = await executeWithPolicy({
      core,
      policy,
      origin,
      operation,
      payload: { pubkey, [field]: value },
      interactive,
    });
    printJson({ success: true, data: result });
    return;
  }

  fail(`Unknown command: ${command}`, 'INVALID_COMMAND');
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length) {
    printHelp();
    return;
  }

  const command = argv[0];
  if (command === 'permissions') {
    const subcommand = argv[1] ?? 'list';
    const parsed = parseFlags(argv.slice(2));
    await runCommand(command, parsed.flags, [subcommand, ...parsed.positional]);
    return;
  }

  const parsed = parseFlags(argv.slice(1));
  await runCommand(command, parsed.flags, parsed.positional);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : 'CLI_ERROR';
  const detail =
    typeof error === 'object' && error !== null && 'detail' in error
      ? error.detail
      : undefined;
  process.stderr.write(
    `${JSON.stringify({ success: false, error: message, code, detail }, null, 2)}\n`
  );
  process.exit(1);
});

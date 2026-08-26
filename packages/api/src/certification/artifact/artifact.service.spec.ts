import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createHash } from 'crypto';
import { ArtifactService } from './artifact.service';

jest.mock('config', () => ({
  __esModule: true,
  get CERT_BRUNO_SRC_REF() {
    return process.env.CERT_BRUNO_SRC_REF;
  },
  get CERT_BRUNO_SRC_CHECKSUM() {
    return process.env.CERT_BRUNO_SRC_CHECKSUM;
  },
  get CERT_BRUNO_ON_DOWNLOAD_ERROR() {
    return process.env.CERT_BRUNO_ON_DOWNLOAD_ERROR;
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeZipBuffer(): Buffer {
  // Real checksum of an empty-ish buffer - we only test the hash comparison
  // logic, not actual ZIP extraction, so any non-empty buffer works here.
  return Buffer.from('fake-zip-content');
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

// Mirrors the private surface of ArtifactService that these tests exercise
// directly. Kept structurally compatible so we can access private members
// without resorting to `any`.
type ArtifactServiceInternal = {
  targetDownloadRef: string | undefined;
  expectedChecksum: string | undefined;
  onDownloadError: string;
  runtimeRoot: string;
  isRuntimeReady: boolean;
  handleDownloadError(message: string): void;
  downloadArtifact(): Promise<Buffer | null>;
  ensureRuntime(): Promise<void>;
};

const asInternal = (svc: ArtifactService): ArtifactServiceInternal =>
  svc as unknown as ArtifactServiceInternal;

const VALID_ENV: NodeJS.ProcessEnv = {
  CERT_BRUNO_SRC_REF: 'v2.1.0',
  CERT_BRUNO_SRC_CHECKSUM: 'aabbcc',
  CERT_BRUNO_ON_DOWNLOAD_ERROR: 'error',
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  // Clear all CERT_ variables before each test
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('CERT_')) delete process.env[key];
  }
});

afterEach(() => {
  // Restore original environment
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('CERT_')) delete process.env[key];
  }
  Object.assign(process.env, savedEnv);
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Constructor validation
// ---------------------------------------------------------------------------

describe('ArtifactService: constructor validation', () => {
  it('throws when source ref is not configured (error mode)', () => {
    process.env.CERT_BRUNO_ON_DOWNLOAD_ERROR = 'error';
    process.env.CERT_BRUNO_SRC_CHECKSUM = 'aabbcc';
    expect(() => new ArtifactService()).toThrow(/CERT_BRUNO_SRC_REF/);
  });

  it('only warns when source ref is not configured (warning mode)', () => {
    process.env.CERT_BRUNO_ON_DOWNLOAD_ERROR = 'warning';
    process.env.CERT_BRUNO_SRC_CHECKSUM = 'aabbcc';
    expect(() => new ArtifactService()).not.toThrow();
  });

  it('throws when checksum is missing (error mode)', () => {
    process.env.CERT_BRUNO_SRC_REF = 'v2.1.0';
    process.env.CERT_BRUNO_ON_DOWNLOAD_ERROR = 'error';
    expect(() => new ArtifactService()).toThrow(/CERT_BRUNO_SRC_CHECKSUM/);
  });

  it('only warns when checksum is missing (warning mode)', () => {
    process.env.CERT_BRUNO_SRC_REF = 'v2.1.0';
    process.env.CERT_BRUNO_ON_DOWNLOAD_ERROR = 'warning';
    expect(() => new ArtifactService()).not.toThrow();
  });

  it('uses CERT_BRUNO_SRC_REF as targetDownloadRef', () => {
    Object.assign(process.env, VALID_ENV);
    const svc = new ArtifactService();
    expect(asInternal(svc).targetDownloadRef).toBe('v2.1.0');
  });

  it('defaults onDownloadError to "error" when not set', () => {
    Object.assign(process.env, VALID_ENV);
    delete process.env.CERT_BRUNO_ON_DOWNLOAD_ERROR;
    const svc = new ArtifactService();
    expect(asInternal(svc).onDownloadError).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// handleDownloadError
// ---------------------------------------------------------------------------

describe('ArtifactService: handleDownloadError', () => {
  it('throws in error mode', () => {
    Object.assign(process.env, VALID_ENV);
    const svc = new ArtifactService();
    expect(() => asInternal(svc).handleDownloadError('boom')).toThrow('boom');
  });

  it('does not throw in warning mode', () => {
    Object.assign(process.env, { ...VALID_ENV, CERT_BRUNO_ON_DOWNLOAD_ERROR: 'warning' });
    const svc = new ArtifactService();
    expect(() => asInternal(svc).handleDownloadError('soft fail')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// downloadArtifact - fetch mocking
// ---------------------------------------------------------------------------

describe('ArtifactService: downloadArtifact', () => {
  let svc: ArtifactService;
  const fakeZip = makeZipBuffer();
  const correctHash = sha256(fakeZip);

  beforeEach(() => {
    Object.assign(process.env, {
      ...VALID_ENV,
      CERT_BRUNO_SRC_CHECKSUM: correctHash,
    });
    svc = new ArtifactService();
  });

  it('returns a Buffer when metadata and zip fetch succeed and checksums match', async () => {
    const metadata = { zipFileName: 'sis-v2.1.0.zip', sha256: correctHash };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => metadata })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new Uint8Array(fakeZip).buffer });

    const result = await asInternal(svc).downloadArtifact();
    expect(result).toBeInstanceOf(Buffer);
    expect((result as Buffer).equals(fakeZip)).toBe(true);
  });

  it('throws when metadata fetch returns a non-OK status (error mode)', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(asInternal(svc).downloadArtifact()).rejects.toThrow(/HTTP 404/);
  });

  it('throws when ZIP fetch returns a non-OK status (error mode)', async () => {
    const metadata = { zipFileName: 'sis-v2.1.0.zip', sha256: correctHash };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => metadata })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(asInternal(svc).downloadArtifact()).rejects.toThrow(/HTTP 500/);
  });

  it('throws when metadata sha256 does not match downloaded buffer (error mode)', async () => {
    const metadata = { zipFileName: 'sis-v2.1.0.zip', sha256: 'wronghash' };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => metadata })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new Uint8Array(fakeZip).buffer });

    await expect(asInternal(svc).downloadArtifact()).rejects.toThrow(
      /checksum mismatch.*metadata/i
    );
  });

  it('throws when CERT_BRUNO_SRC_CHECKSUM does not match downloaded buffer (error mode)', async () => {
    // metadata hash matches buffer, but the env var checksum doesn't
    const metadata = { zipFileName: 'sis-v2.1.0.zip', sha256: correctHash };
    asInternal(svc).expectedChecksum = 'deadbeef';

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => metadata })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new Uint8Array(fakeZip).buffer });

    await expect(asInternal(svc).downloadArtifact()).rejects.toThrow(/CERT_BRUNO_SRC_CHECKSUM/);
  });

  it('returns null (no throw) in warning mode when fetch fails', async () => {
    Object.assign(process.env, { CERT_BRUNO_ON_DOWNLOAD_ERROR: 'warning' });
    // Re-create service with warning mode
    const warnSvc = new ArtifactService();
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 503 });

    const result = await asInternal(warnSvc).downloadArtifact();
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ensureRuntimeReady - ref-based - skip logic
// ---------------------------------------------------------------------------

describe('ArtifactService: ensureRuntimeReady ref-check', () => {
  let svc: ArtifactService;
  const runtimeRoot = path.join(os.tmpdir(), `cert-test-${Date.now()}`);

  beforeEach(() => {
    Object.assign(process.env, {
      ...VALID_ENV,
    });
    svc = new ArtifactService();
    asInternal(svc).runtimeRoot = runtimeRoot;
  });

  afterEach(() => {
    try {
      fs.rmSync(runtimeRoot, { recursive: true, force: true });
    } catch (_) {
      /* ignore */
    }
  });

  it('skips download when persisted ref matches target download ref and node_modules exists', async () => {
    // Set up the runtime folder with matching .ref and node_modules
    fs.mkdirSync(path.join(runtimeRoot, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(runtimeRoot, '.ref'), 'v2.1.0', 'utf8');
    // targetDownloadRef is 'v2.1.0' (tag, no commit set)

    const ensureRuntime = jest.spyOn(asInternal(svc), 'ensureRuntime');

    await svc.ensureRuntimeReady();

    expect(ensureRuntime).not.toHaveBeenCalled();
    expect(asInternal(svc).isRuntimeReady).toBe(true);
  });

  it('triggers download when persisted ref differs from target download ref', async () => {
    fs.mkdirSync(path.join(runtimeRoot, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(runtimeRoot, '.ref'), 'v1.0.0', 'utf8'); // stale ref

    const ensureRuntime = jest
      .spyOn(asInternal(svc), 'ensureRuntime')
      .mockResolvedValue(undefined);

    await svc.ensureRuntimeReady();

    expect(ensureRuntime).toHaveBeenCalledTimes(1);
  });

  it('triggers download when .ref file is missing', async () => {
    fs.mkdirSync(path.join(runtimeRoot, 'node_modules'), { recursive: true });
    // No .ref file

    const ensureRuntime = jest
      .spyOn(asInternal(svc), 'ensureRuntime')
      .mockResolvedValue(undefined);

    await svc.ensureRuntimeReady();

    expect(ensureRuntime).toHaveBeenCalledTimes(1);
  });

  it('triggers download when node_modules is missing even if ref matches', async () => {
    fs.mkdirSync(runtimeRoot, { recursive: true });
    fs.writeFileSync(path.join(runtimeRoot, '.ref'), 'v2.1.0', 'utf8');
    // No node_modules

    const ensureRuntime = jest
      .spyOn(asInternal(svc), 'ensureRuntime')
      .mockResolvedValue(undefined);

    await svc.ensureRuntimeReady();

    expect(ensureRuntime).toHaveBeenCalledTimes(1);
  });
});

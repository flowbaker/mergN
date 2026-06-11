import { mkdir, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import type { FuncDefinition, FuncContext } from "../atoms/index";
import type { Runtime } from "../engine/index";

interface Carrier {
  __remoteProvider?: boolean;
  clientSource?: string;
  cred?: Record<string, string>;
  egressDomain?: string;
  dependencies?: string[];
}

const IMAGE = process.env.DOCKER_IMAGE ?? "node:22-slim";
const TIMEOUT_SEC = Number(process.env.CODE_TIMEOUT_SEC ?? 30);
const WORK_DIR = process.env.DOCKER_WORK_DIR ?? join(tmpdir(), "fb-docker");
// When the app itself runs inside a container (docker-out-of-docker), set
// DOCKER_VOLUME to the shared named volume mounted at WORK_DIR; run containers
// mount it by name. Otherwise (app on host) we bind the cache dir at its own
// path so the absolute paths match inside the run container.
const VOLUME = process.env.DOCKER_VOLUME;
const MARKER = "__FB_RESULT__";

function mountFor(cacheDir: string): string {
  return VOLUME ? `${VOLUME}:${WORK_DIR}` : `${cacheDir}:${cacheDir}`;
}

const ENTRY = `import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const payload = JSON.parse(raw);
function guardedFetch(domain) {
  return async (i, init) => {
    const url = typeof i === "string" ? i : i instanceof URL ? i.href : i instanceof Request ? i.url : String(i);
    let host;
    try { host = new URL(url).host; } catch { throw new Error("egress blocked: invalid url"); }
    if (domain && host !== domain && !host.endsWith("." + domain)) throw new Error("egress blocked: " + host);
    return fetch(url, init);
  };
}
const connections = {};
for (const p of payload.providers) {
  const mod = await import(pathToFileURL(join(here, p.file)).href);
  if (typeof mod.default !== "function") throw new Error("provider " + p.name + " must export default a factory");
  connections[p.name] = await mod.default(p.cred ?? {}, guardedFetch(p.egressDomain));
}
const fnMod = await import(pathToFileURL(join(here, "fb_func.mjs")).href);
if (typeof fnMod.default !== "function") throw new Error("func must export default an async (ctx, input) function");
const ctx = { idempotencyKey: payload.idempotencyKey, connections };
const result = await fnMod.default(ctx, payload.input);
process.stdout.write("${MARKER}" + JSON.stringify(result ?? null));
`;

function exists(p: string): Promise<boolean> {
  return access(p).then(
    () => true,
    () => false,
  );
}

function depsKey(deps: string[]): string {
  if (deps.length === 0) return "none";
  return createHash("sha256")
    .update([...deps].sort().join("\n"))
    .digest("hex")
    .slice(0, 16);
}

function toDependencyObject(deps: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of deps) {
    const d = raw.trim();
    if (!d) continue;
    const at = d.lastIndexOf("@");
    if (at > 0) out[d.slice(0, at)] = d.slice(at + 1);
    else out[d] = "latest";
  }
  return out;
}

interface DockerResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function docker(
  args: string[],
  opts: { timeoutMs?: number; containerName?: string; stdin?: string } = {},
): Promise<DockerResult> {
  return new Promise((resolve) => {
    const p = spawn("docker", args);
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer =
      opts.timeoutMs && opts.containerName
        ? setTimeout(() => {
            timedOut = true;
            spawn("docker", ["kill", opts.containerName!]);
          }, opts.timeoutMs)
        : undefined;
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => (stderr += d));
    p.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? 0, stdout, stderr, timedOut });
    });
    p.on("error", (e) => {
      if (timer) clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: String(e), timedOut });
    });
    if (opts.stdin !== undefined) {
      p.stdin.end(opts.stdin);
    }
  });
}

const installLocks = new Map<string, Promise<void>>();

async function ensureDeps(cacheDir: string, deps: string[]): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  if (deps.length === 0) return;
  if (await exists(join(cacheDir, "node_modules"))) return;
  let lock = installLocks.get(cacheDir);
  if (!lock) {
    lock = (async () => {
      await writeFile(
        join(cacheDir, "package.json"),
        JSON.stringify({
          name: "fb-docker",
          private: true,
          type: "module",
          dependencies: toDependencyObject(deps),
        }),
      );
      const r = await docker([
        "run",
        "--rm",
        "-v",
        mountFor(cacheDir),
        "-w",
        cacheDir,
        IMAGE,
        "npm",
        "install",
        "--no-audit",
        "--no-fund",
        "--loglevel=error",
      ]);
      if (r.code !== 0)
        throw new Error(`docker dependency install failed: ${r.stderr.slice(-400)}`);
    })();
    installLocks.set(cacheDir, lock);
  }
  try {
    await lock;
  } finally {
    installLocks.delete(cacheDir);
  }
}

export class DockerRuntime implements Runtime {
  async run(
    def: FuncDefinition,
    ctx: FuncContext,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    const providers: {
      name: string;
      clientSource: string;
      cred: Record<string, string>;
      egressDomain?: string;
    }[] = [];
    for (const [name, value] of Object.entries(ctx.connections ?? {})) {
      const c = value as Carrier;
      if (!c?.__remoteProvider || !c.clientSource) continue;
      providers.push({
        name,
        clientSource: c.clientSource,
        cred: c.cred ?? {},
        egressDomain: c.egressDomain,
      });
    }

    const deps = [
      ...(def.body.dependencies ?? []),
      ...providers.flatMap(
        (p) => (ctx.connections[p.name] as Carrier)?.dependencies ?? [],
      ),
    ].filter((v, i, a) => a.indexOf(v) === i);

    const cacheDir = join(WORK_DIR, depsKey(deps));
    await ensureDeps(cacheDir, deps);

    const runId = randomUUID();
    const runDir = join(cacheDir, "runs", runId);
    await mkdir(join(runDir, "providers"), { recursive: true });

    try {
      const provConf: {
        name: string;
        file: string;
        cred: Record<string, string>;
        egressDomain?: string;
      }[] = [];
      for (let i = 0; i < providers.length; i++) {
        const p = providers[i];
        const file = `providers/p${i}.mjs`;
        await writeFile(join(runDir, file), p.clientSource);
        provConf.push({
          name: p.name,
          file,
          cred: p.cred,
          egressDomain: p.egressDomain,
        });
      }
      await writeFile(join(runDir, "fb_func.mjs"), def.body.source);
      await writeFile(join(runDir, "entry.mjs"), ENTRY);

      const payload = JSON.stringify({
        input,
        idempotencyKey: ctx.idempotencyKey,
        providers: provConf,
      });

      const containerName = `fb-${runId}`;
      const r = await docker(
        [
          "run",
          "--rm",
          "-i",
          "--name",
          containerName,
          "--memory",
          "512m",
          "--cpus",
          "1",
          "--pids-limit",
          "256",
          "--cap-drop",
          "ALL",
          "--security-opt",
          "no-new-privileges",
          "-v",
          mountFor(cacheDir),
          IMAGE,
          "node",
          `${runDir}/entry.mjs`,
        ],
        { timeoutMs: TIMEOUT_SEC * 1000, containerName, stdin: payload },
      );

      if (r.timedOut)
        throw new Error(`code execution timed out after ${TIMEOUT_SEC}s`);
      if (r.code !== 0)
        throw new Error(
          `docker run failed: ${(r.stderr || r.stdout).slice(-600)}`,
        );

      const idx = r.stdout.lastIndexOf(MARKER);
      if (idx === -1)
        throw new Error(`no result from container: ${r.stdout.slice(-400)}`);
      return JSON.parse(r.stdout.slice(idx + MARKER.length));
    } finally {
      await rm(runDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

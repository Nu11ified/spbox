import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, writeFileSync } from "node:fs";

const containerName = process.env.SDB_DEMO_CONTAINER ?? "spbox-spacetime-demo";
const serverName = process.env.SDB_DEMO_SERVER_NAME ?? "spbox-demo";
const databaseName = process.env.SDB_SPACETIME_DATABASE ?? "spbox-demo";
const hostPort = process.env.SDB_DEMO_PORT ?? "3005";
const spacetimeUrl = process.env.SDB_SPACETIME_URI ?? `http://127.0.0.1:${hostPort}`;
const adminPort = process.env.SDB_ADMIN_PORT ?? "8787";
const adminHost = process.env.SDB_ADMIN_HOST ?? "127.0.0.1";
const adminLog = process.env.SDB_ADMIN_LOG ?? "/tmp/spbox-admin-demo.log";
const adminPid = process.env.SDB_ADMIN_PID ?? "/tmp/spbox-admin-demo.pid";

if (existsSync(adminPid)) {
  const existingPid = Number(readFileSync(adminPid, "utf8").trim());
  if (Number.isFinite(existingPid)) {
    try {
      process.kill(existingPid, "SIGTERM");
    } catch {
      // The previous demo admin process is already gone.
    }
  }
}

run("docker", ["rm", "-f", containerName], { allowFailure: true });
run("docker", [
  "run",
  "-d",
  "--name",
  containerName,
  "-p",
  `127.0.0.1:${hostPort}:3000`,
  "clockworklabs/spacetime",
  "start",
  "--listen-addr",
  "0.0.0.0:3000",
  "--in-memory",
  "--non-interactive"
]);

run("spacetime", ["server", "add", serverName, "--url", spacetimeUrl], { allowFailure: true });
run("spacetime", ["server", "ping", serverName]);
run("spacetime", [
  "publish",
  databaseName,
  "--server",
  serverName,
  "--module-path",
  "spacetimedb",
  "--delete-data=always",
  "--yes=all"
]);
run("npm", ["run", "build"]);

const logFd = openSync(adminLog, "w");
const child = spawn("node", ["dist/src/admin/main.js"], {
  detached: true,
  stdio: ["ignore", logFd, logFd],
  env: {
    ...process.env,
    SDB_ADMIN_HOST: adminHost,
    SDB_ADMIN_PORT: adminPort,
    SDB_SERVER_ID: databaseName,
    SDB_SERVER_NAME: "SPBox Demo",
    SDB_ENVIRONMENT: "demo",
    SDB_SERVER_PUBLIC_KEY: "demo-public-key",
    SDB_SPACETIME_URI: spacetimeUrl,
    SDB_SPACETIME_DATABASE: databaseName,
    SDB_SPACETIME_BINDINGS_MODULE: `file://${process.cwd()}/dist/src/spacetime/module_bindings/index.js`
  }
});
child.unref();
closeSync(logFd);
writeFileSync(adminPid, `${child.pid}\n`);

console.log(`SpacetimeDB demo: ${spacetimeUrl}`);
console.log(`Admin connector: http://${adminHost}:${adminPort}/admin/`);
console.log(`Admin log: ${adminLog}`);
console.log(`Admin PID: ${adminPid}`);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env
  });

  if (result.status !== 0 && !options.allowFailure) {
    process.exit(result.status ?? 1);
  }
}

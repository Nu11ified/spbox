import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { buildLegacySqlImportManifest } from "../dist/src/core/sql-compat.js";

const root = process.cwd();
const demoRoot = process.env.SDB_QBCORE_DEMO_ROOT ?? join(root, "cache", "qbcore-demo");
const resourcesRoot = join(demoRoot, "resources");

const upstream = [
  ["standalone", "PolyZone", "https://github.com/mkafrin/PolyZone.git", "0f9003080706d61ff29b9b3db5332d407632d4df"],
  ["qb", "qb-interior", "https://github.com/qbcore-framework/qb-interior.git", "f1227e533666c0ce55ce9dfab905512da6da9ea3"],
  ["qb", "qb-menu", "https://github.com/qbcore-framework/qb-menu.git", "fe2774f1b8213df314a93d500e2f89456d420db7"],
  ["qb", "qb-input", "https://github.com/qbcore-framework/qb-input.git", "6daa6a2925b446847555fa28df4512015121d90b"],
  ["qb", "qb-weathersync", "https://github.com/qbcore-framework/qb-weathersync.git", "1bcace3b795dc679b315b3c49a03f568a644de25"],
  ["qb", "qb-spawn", "https://github.com/qbcore-framework/qb-spawn.git", "8c39fb621812309ca3f8ea2a427455c63e4dfeeb"],
  ["qb", "qb-apartments", "https://github.com/qbcore-framework/qb-apartments.git", "51d3cfc58566e3705df8aae0b40d89ce04df4dcf"],
  ["qb", "qb-clothing", "https://github.com/qbcore-framework/qb-clothing.git", "3be67991fe8d0abf47d57624630781dd153e51bd"],
  ["qb", "qb-multicharacter", "https://github.com/qbcore-framework/qb-multicharacter.git", "772d5eb13cfceb2bec887539845d42a6c7501a04"],
  ["qb", "qb-adminmenu", "https://github.com/qbcore-framework/qb-adminmenu.git", "c8e314211e23a01f0e0e5a763a8df1fe46ff9b94"],
  ["qb", "qb-banking", "https://github.com/qbcore-framework/qb-banking.git", "2181635bfb4449e21c755ec42360ff410d97b5f9"],
  ["qb", "qb-hud", "https://github.com/qbcore-framework/qb-hud.git", "2bc4ec3c9579fa3bad5591cfd0be8faa5bece355"],
  ["qb", "qb-vehicleshop", "https://github.com/qbcore-framework/qb-vehicleshop.git", "e6e7a3bee0b037870f61b4981f0d9685722588c4"],
  ["qb", "qb-garages", "https://github.com/qbcore-framework/qb-garages.git", "a7c974b45b90b3c799bec250f6852d90332501bc"],
  ["qb", "qb-vehiclekeys", "https://github.com/qbcore-framework/qb-vehiclekeys.git", "8493d25c37e1301c7978d1f9ab6f875e32d90984"]
];

rmSync(demoRoot, { recursive: true, force: true });
mkdirSync(join(resourcesRoot, "[spbox]"), { recursive: true });
mkdirSync(join(resourcesRoot, "[compat]"), { recursive: true });
mkdirSync(join(resourcesRoot, "[standalone]"), { recursive: true });
mkdirSync(join(resourcesRoot, "[qb]"), { recursive: true });

copyResource("resources/[runtime]/sdb_runtime", join(resourcesRoot, "[spbox]", "sdb_runtime"));
for (const name of ["qb-core", "oxmysql", "qb-inventory", "menuv"]) {
  copyResource(`resources/[compat]/${name}`, join(resourcesRoot, "[compat]", name));
}

const installedResources = [];
for (const [group, name, url, sha] of upstream) {
  const destination = join(resourcesRoot, group === "standalone" ? "[standalone]" : "[qb]", name);
  run("git", ["clone", "--no-tags", "--depth", "1", url, destination]);
  run("git", ["fetch", "--depth", "1", "origin", sha], { cwd: destination });
  run("git", ["checkout", "--detach", sha], { cwd: destination });
  rmSync(join(destination, ".git"), { recursive: true, force: true });
  installedResources.push({ group, name, url, sha, destination });
}

const sqlImports = installedResources
  .map((resource) => {
    const sqlFiles = findSqlFiles(resource.destination)
      .map((path) => ({
        path: path.slice(resource.destination.length + 1),
        sql: readFileSync(path, "utf8")
      }));
    if (sqlFiles.length === 0) {
      return undefined;
    }

    return buildLegacySqlImportManifest({
      pluginId: resource.name,
      resourceName: resource.name,
      sqlFiles
    });
  })
  .filter(Boolean);

writeFileSync(join(demoRoot, "server.cfg"), serverConfig());
writeFileSync(join(demoRoot, "resources.lock.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  resources: upstream.map(([group, name, url, sha]) => ({ group, name, url, sha })),
  sqlImports: sqlImports.map((entry) => ({
    pluginId: entry.pluginId,
    resourceName: entry.resourceName,
    sqlFiles: entry.sqlFiles,
    tables: entry.tables.map((table) => table.name),
    unsupportedStatements: entry.unsupportedStatements.length
  }))
}, null, 2));
writeFileSync(join(demoRoot, "spbox-sql-manifest.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  imports: sqlImports
}, null, 2));

console.log(`Installed QBCore demo resources in ${demoRoot}`);
console.log(`Use ${join(demoRoot, "server.cfg")} as the FXServer config template.`);

function copyResource(source, destination) {
  cpSync(join(root, source), destination, {
    recursive: true,
    force: true
  });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function findSqlFiles(directory) {
  const found = [];
  for (const entry of readdirSync(directory)) {
    if (entry === ".git" || entry === "node_modules") {
      continue;
    }
    const fullPath = join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      found.push(...findSqlFiles(fullPath));
    } else if (entry.toLowerCase().endsWith(".sql")) {
      found.push(fullPath);
    }
  }
  return found;
}

function serverConfig() {
  return `sv_hostname "SPBox QBCore Hybrid Demo"
endpoint_add_tcp "0.0.0.0:30120"
endpoint_add_udp "0.0.0.0:30120"
sv_maxclients 8
set onesync on
set sdb_server_id "spbox-demo"
set sdb_admin_endpoint "http://127.0.0.1:8787"
set sdb_poc_admin_endpoint "http://127.0.0.1:8787"

ensure sdb_runtime
ensure oxmysql
ensure qb-core
ensure qb-inventory

ensure PolyZone
ensure menuv
ensure qb-interior
ensure qb-menu
ensure qb-input
ensure qb-weathersync
ensure qb-spawn
ensure qb-apartments
ensure qb-clothing
ensure qb-multicharacter
ensure qb-adminmenu
ensure qb-banking
ensure qb-hud
ensure qb-vehicleshop
ensure qb-garages
ensure qb-vehiclekeys
`;
}

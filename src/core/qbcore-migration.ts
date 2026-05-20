import { type AdminService } from "../admin/service.js";
import {
  validateEconomyAccountCreation,
  type AccountOwnerType
} from "./economy.js";

type QbCoreRecord<T> = Record<string, T>;

export interface QbCoreImportItem {
  label?: string;
  name?: string;
  unique?: boolean;
  maxStack?: number;
  maxstack?: number;
  max?: number;
  [key: string]: unknown;
}

export interface QbCoreImportGrade {
  name?: string;
  label?: string;
  level?: number;
  [key: string]: unknown;
}

export interface QbCoreImportJob {
  label?: string;
  name?: string;
  grades?: QbCoreRecord<QbCoreImportGrade>;
  [key: string]: unknown;
}

export interface QbCoreImportGang {
  label?: string;
  name?: string;
  grades?: QbCoreRecord<QbCoreImportGrade>;
  [key: string]: unknown;
}

export interface QbCoreImportVehicle {
  label?: string;
  name?: string;
  brand?: string;
  category?: string;
  [key: string]: unknown;
}

export interface QbCoreImportPlayer {
  source?: string | number;
  principalId?: string;
  citizenid?: string;
  citizenId?: string;
  characterId?: string;
  cid?: number;
  slot?: number;
  license?: string;
  name?: string;
  charinfo?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  position?: Record<string, unknown>;
  money?: Record<string, number>;
  job?: {
    name?: string;
    label?: string;
    onduty?: boolean;
    onDuty?: boolean;
    grade?: QbCoreImportGrade;
  };
  gang?: Record<string, unknown>;
}

export interface QbCoreMigrationInput {
  pluginId: string;
  items?: QbCoreRecord<QbCoreImportItem>;
  jobs?: QbCoreRecord<QbCoreImportJob>;
  gangs?: QbCoreRecord<QbCoreImportGang>;
  vehicles?: QbCoreRecord<QbCoreImportVehicle>;
  players?: QbCoreImportPlayer[];
}

export interface QbCoreMigrationPlan {
  pluginId: string;
  items: Array<{
    key: string;
    pluginId: string;
    label: string;
    stackable: boolean;
    maxStack: number;
  }>;
  jobs: Array<{
    key: string;
    pluginId: string;
    label: string;
    grades: string[];
  }>;
  vehicles: Array<{
    model: string;
    pluginId: string;
    label: string;
    category: string;
  }>;
  pluginSchemas: Array<{
    pluginId: string;
    schemaVersion: number;
    entityType: string;
    schemaJson: string;
    migrationPlanJson: string;
    status: "active";
  }>;
  pluginEntities: Array<{
    id: string;
    pluginId: string;
    entityType: string;
    ownerType: "plugin";
    ownerId: string;
    dataJson: string;
  }>;
  characters: Array<{
    id: string;
    playerPrincipalId: string;
    citizenId: string;
    cid: number;
    slot: number;
    license: string;
    name: string;
    charinfoJson: string;
    metadataJson: string;
    gangJson: string;
    positionJson: string;
    phoneNumber: string;
    accountNumber: string;
    selected: boolean;
  }>;
  accounts: Array<{
    id: string;
    ownerType: AccountOwnerType;
    ownerId: string;
    currency: string;
    balance: number;
  }>;
  jobAssignments: Array<{
    characterId: string;
    jobKey: string;
    grade: string;
    onDuty: boolean;
  }>;
}

const defaultGangSchema = {
  type: "object",
  required: ["key", "label", "grades"],
  properties: {
    key: { type: "string" },
    label: { type: "string" },
    grades: { type: "array", items: { type: "string" } }
  }
};

export function planQbCoreMigration(input: QbCoreMigrationInput): QbCoreMigrationPlan {
  const pluginId = requireNonEmpty(input.pluginId, "QBCore import pluginId");
  const items = Object.entries(input.items ?? {}).map(([key, item]) => planItem(pluginId, key, item));
  const jobs = Object.entries(input.jobs ?? {}).map(([key, job]) => planJob(pluginId, key, job));
  const vehicles = Object.entries(input.vehicles ?? {}).map(([model, vehicle]) => planVehicle(pluginId, model, vehicle));
  const gangs = Object.entries(input.gangs ?? {});
  const characters: QbCoreMigrationPlan["characters"] = [];
  const accounts: QbCoreMigrationPlan["accounts"] = [];
  const jobAssignments: QbCoreMigrationPlan["jobAssignments"] = [];

  for (const player of input.players ?? []) {
    const planned = planPlayer(player);
    characters.push(planned.character);
    accounts.push(...planned.accounts);
    if (planned.jobAssignment) {
      jobAssignments.push(planned.jobAssignment);
    }
  }

  return {
    pluginId,
    items,
    jobs,
    vehicles,
    pluginSchemas: gangs.length > 0
      ? [
          {
            pluginId,
            schemaVersion: 1,
            entityType: "qbcore_gang",
            schemaJson: JSON.stringify(defaultGangSchema),
            migrationPlanJson: "[]",
            status: "active"
          }
        ]
      : [],
    pluginEntities: gangs.map(([key, gang]) => planGang(pluginId, key, gang)),
    characters,
    accounts,
    jobAssignments
  };
}

export async function applyQbCoreMigrationPlan(admin: AdminService, plan: QbCoreMigrationPlan): Promise<void> {
  validatePlanBeforeWrites(plan);

  for (const item of plan.items) {
    await admin.registerGameplayItem(item);
  }
  for (const job of plan.jobs) {
    await admin.registerGameplayJob(job);
  }
  for (const vehicle of plan.vehicles) {
    await admin.registerGameplayVehicle(vehicle);
  }
  for (const schema of plan.pluginSchemas) {
    await admin.registerPluginSchema(schema);
  }
  for (const entity of plan.pluginEntities) {
    await admin.upsertPluginEntity(entity);
  }
  for (const character of plan.characters) {
    await admin.upsertGameplayCharacter(character);
  }
  for (const account of plan.accounts) {
    await admin.createEconomyAccount(account);
  }
  for (const assignment of plan.jobAssignments) {
    await admin.assignGameplayJob(assignment);
  }
}

function planItem(pluginId: string, rawKey: string, item: QbCoreImportItem): QbCoreMigrationPlan["items"][number] {
  const key = requireNonEmpty(rawKey, "QBCore import item key");
  const unique = item.unique === true;
  const maxStack = normalizePositiveInteger(item.maxStack ?? item.maxstack ?? item.max, unique ? 1 : 100);
  return {
    key,
    pluginId,
    label: normalizeLabel(item.label ?? item.name, key),
    stackable: !unique,
    maxStack
  };
}

function planJob(pluginId: string, rawKey: string, job: QbCoreImportJob): QbCoreMigrationPlan["jobs"][number] {
  const key = requireNonEmpty(rawKey, "QBCore import job key");
  return {
    key,
    pluginId,
    label: normalizeLabel(job.label ?? job.name, key),
    grades: normalizeGrades(job.grades)
  };
}

function planGang(
  pluginId: string,
  rawKey: string,
  gang: QbCoreImportGang
): QbCoreMigrationPlan["pluginEntities"][number] {
  const key = requireNonEmpty(rawKey, "QBCore import gang key");
  return {
    id: `${pluginId}:gang:${key}`,
    pluginId,
    entityType: "qbcore_gang",
    ownerType: "plugin",
    ownerId: pluginId,
    dataJson: JSON.stringify({
      key,
      label: normalizeLabel(gang.label ?? gang.name, key),
      grades: normalizeGrades(gang.grades)
    })
  };
}

function planVehicle(
  pluginId: string,
  rawModel: string,
  vehicle: QbCoreImportVehicle
): QbCoreMigrationPlan["vehicles"][number] {
  const model = requireNonEmpty(rawModel, "QBCore import vehicle model");
  const name = normalizeLabel(vehicle.label ?? vehicle.name, model);
  const brand = typeof vehicle.brand === "string" && vehicle.brand.trim() ? vehicle.brand.trim() : undefined;
  return {
    model,
    pluginId,
    label: brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${name}` : name,
    category: normalizeLabel(vehicle.category, "uncategorized")
  };
}

function planPlayer(player: QbCoreImportPlayer): {
  character: QbCoreMigrationPlan["characters"][number];
  accounts: QbCoreMigrationPlan["accounts"];
  jobAssignment?: QbCoreMigrationPlan["jobAssignments"][number];
} {
  const citizenId = requireNonEmpty(player.citizenid ?? player.citizenId, "QBCore import player citizenid");
  const characterId = requireNonEmpty(player.characterId ?? `char:${citizenId}`, "QBCore import player characterId");
  const cid = normalizePositiveInteger(player.cid, 1);
  const charinfo = player.charinfo ?? {};
  const metadata = player.metadata ?? {};
  const position = player.position ?? {};
  const gang = player.gang ?? {};
  const phoneNumber = stringField(charinfo.phone);
  const accountNumber = stringField(charinfo.account);
  const source = player.source === undefined ? citizenId : String(player.source);
  const name = normalizePlayerName(player.name, charinfo, citizenId);
  const accounts = Object.entries(player.money ?? {}).map(([currency, balance]) => ({
    id: `acct:${characterId}:${requireNonEmpty(currency, "QBCore import money type")}`,
    ownerType: "character" as const,
    ownerId: characterId,
    currency,
    balance: normalizeNonNegativeInteger(balance, `QBCore import ${characterId}:${currency} balance`)
  }));
  const jobName = player.job?.name;
  const jobAssignment = jobName && jobName !== "unemployed"
    ? {
        characterId,
        jobKey: jobName,
        grade: normalizeGrade(player.job?.grade, "0"),
        onDuty: player.job?.onduty === true || player.job?.onDuty === true
      }
    : undefined;

  return {
    character: {
      id: characterId,
      playerPrincipalId: player.principalId ?? `player:${source}`,
      citizenId,
      cid,
      slot: normalizePositiveInteger(player.slot, cid),
      license: stringField(player.license, String(source)),
      name,
      charinfoJson: JSON.stringify(charinfo),
      metadataJson: JSON.stringify(metadata),
      gangJson: JSON.stringify(gang),
      positionJson: JSON.stringify(position),
      phoneNumber,
      accountNumber,
      selected: true
    },
    accounts,
    jobAssignment
  };
}

function validatePlanBeforeWrites(plan: QbCoreMigrationPlan): void {
  requireNonEmpty(plan.pluginId, "QBCore import pluginId");
  for (const account of plan.accounts) {
    validateEconomyAccountCreation(account);
  }
}

function normalizeGrades(grades: QbCoreRecord<QbCoreImportGrade> | undefined): string[] {
  const entries = Object.entries(grades ?? {});
  if (entries.length === 0) {
    return ["0"];
  }

  return entries
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([, grade], index) => normalizeGrade(grade, String(index)));
}

function normalizeGrade(grade: QbCoreImportGrade | undefined, fallback: string): string {
  if (grade?.name !== undefined && String(grade.name).trim() !== "") {
    return String(grade.name).trim();
  }
  if (grade?.label !== undefined && String(grade.label).trim() !== "") {
    return String(grade.label).trim();
  }
  if (grade?.level !== undefined && Number.isFinite(grade.level)) {
    return String(grade.level);
  }
  return fallback;
}

function normalizePlayerName(name: unknown, charinfo: Record<string, unknown>, fallback: string): string {
  const direct = stringField(name);
  if (direct) {
    return direct;
  }

  const first = stringField(charinfo.firstname);
  const last = stringField(charinfo.lastname);
  const full = `${first} ${last}`.trim();
  return full || fallback;
}

function normalizeLabel(value: unknown, fallback: string): string {
  const label = stringField(value);
  return label || fallback;
}

function requireNonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }

  return value.trim();
}

function stringField(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  if (value === undefined || value === null) {
    return fallback;
  }
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    return fallback;
  }
  return numeric;
}

function normalizeNonNegativeInteger(value: unknown, label: string): number {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return numeric;
}

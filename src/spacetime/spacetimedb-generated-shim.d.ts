declare module "spacetimedb" {
  export type AlgebraicTypeType = unknown;
  export type DbConnectionConfig<T = unknown> = unknown;
  export type ErrorContextInterface<T = unknown> = unknown;
  export type Event<T = unknown> = unknown;
  export type EventContextInterface<T = unknown> = unknown;
  export type Infer<T> = T extends TypeBuilder<infer Type, unknown> ? Type : unknown;
  export type QueryBuilder<T = unknown> = Record<string, unknown>;
  export type ReducerEventContextInterface<T = unknown> = unknown;
  export type RemoteModule<
    SchemaDef = unknown,
    ReducersDef = unknown,
    ProceduresDef = unknown,
    CliVersion extends string = string
  > = SchemaDef & ReducersDef & ProceduresDef & { versionInfo: { cliVersion: CliVersion } };
  export type SubscriptionEventContextInterface<T = unknown> = unknown;
  export type SubscriptionHandleImpl<T = unknown> = unknown;

  export class TypeBuilder<Type = unknown, SpacetimeType = unknown> {
    public constructor(...args: unknown[]);
    public primaryKey(): this;
    public name(name: string): this;
    public optional(): this;
  }

  export class Uuid {}

  export class SubscriptionBuilderImpl<T = unknown> {
    public constructor(...args: unknown[]);
  }

  export class DbConnectionBuilder<Connection = unknown> {
    public constructor(...args: unknown[]);
    public withUri(uri: string): this;
    public withDatabaseName(databaseName: string): this;
    public withToken(token?: string): this;
    public withConfirmedReads(confirmedReads: boolean): this;
    public onConnect(callback: (connection: Connection, identity: unknown, token: string) => void): this;
    public onConnectError(callback: (ctx: unknown, error: Error) => void): this;
    public build(): Connection;
  }

  export class DbConnectionImpl<T = unknown> {
    public constructor(...args: unknown[]);
    public subscriptionBuilder(): SubscriptionBuilderImpl<T>;
  }

  export const t: {
    bool(): TypeBuilder<boolean>;
    string(): TypeBuilder<string>;
    number(): TypeBuilder<number>;
    i8(): TypeBuilder<number>;
    u8(): TypeBuilder<number>;
    i16(): TypeBuilder<number>;
    u16(): TypeBuilder<number>;
    i32(): TypeBuilder<number>;
    u32(): TypeBuilder<number>;
    i64(): TypeBuilder<bigint>;
    u64(): TypeBuilder<bigint>;
    i128(): TypeBuilder<bigint>;
    u128(): TypeBuilder<bigint>;
    f32(): TypeBuilder<number>;
    f64(): TypeBuilder<number>;
    timestamp(): TypeBuilder<unknown>;
    uuid(): TypeBuilder<Uuid>;
    row<T extends Record<string, TypeBuilder>>(fields: T): TypeBuilder<{ [K in keyof T]: Infer<T[K]> }>;
    object<T extends Record<string, TypeBuilder>>(
      name: string,
      fields: T
    ): TypeBuilder<{ [K in keyof T]: Infer<T[K]> }>;
    array<T extends TypeBuilder>(item: T): TypeBuilder<Array<Infer<T>>>;
    option<T extends TypeBuilder>(item: T): TypeBuilder<Infer<T> | null>;
  };

  export function convertToAccessorMap<T>(value: T): Record<string, unknown>;
  export function makeQueryBuilder<T>(value: T): QueryBuilder<T>;
  export function procedureSchema(...args: unknown[]): unknown;
  export function procedures<T extends readonly unknown[]>(...procedures: T): { procedures: T };
  export function reducerSchema(...args: unknown[]): unknown;
  export function reducers<T extends readonly unknown[]>(...reducers: T): { reducersType: { reducers: T } };
  export function schema<T>(tables: T): { schemaType: { tables: T } };
  export function table(...args: unknown[]): unknown;
}

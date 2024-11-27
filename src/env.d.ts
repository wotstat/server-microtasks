declare module "bun" {
  interface Env {
    readonly CLICKHOUSE_HOST: string;
    readonly CLICKHOUSE_USER: string;
    readonly CLICKHOUSE_PASSWORD: string;
  }
}

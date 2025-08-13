declare module "bun" {
  interface Env {
    readonly CLICKHOUSE_HOST: string;
    readonly CLICKHOUSE_USER: string;
    readonly CLICKHOUSE_PASSWORD: string;
    readonly AWS_REGION: string;
    readonly AWS_SECRET_ACCESS_KEY: string;
    readonly AWS_ACCESS_KEY_ID: string;
    readonly AWS_ENDPOINT_URL: string;
    readonly AWS_BUCKET: string;
  }
}

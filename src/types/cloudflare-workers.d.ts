declare module "cloudflare:workers" {
  export const env: {
    HYPERDRIVE?: {
      connectionString: string;
    };
    [key: string]: unknown;
  };
}

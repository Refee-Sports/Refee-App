export type AppEnv = "development" | "staging" | "production";

const raw = process.env.NEXT_PUBLIC_APP_ENV;

export const appEnv: AppEnv =
  raw === "staging" || raw === "production" ? raw : "development";

export const isDevelopment = appEnv === "development";
export const isStaging = appEnv === "staging";
export const isProduction = appEnv === "production";

import { optionalEnv, requireEnv } from "./env";

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export const testConfig = {
  get baseURL(): string {
    return trimSlash(requireEnv("LANGLER_E2E_BASE_URL"));
  },
  get email(): string {
    return requireEnv("LANGLER_E2E_EMAIL");
  },
  get password(): string {
    return requireEnv("LANGLER_E2E_PASSWORD");
  },
  get apiUrl(): string {
    return trimSlash(requireEnv("LANGLER_E2E_API_URL"));
  },
  get machineApiUrl(): string {
    return trimSlash(requireEnv("LANGLER_E2E_MACHINE_API_URL"));
  },
  get cognitoClientId(): string {
    return requireEnv("LANGLER_E2E_COGNITO_CLIENT_ID");
  },
  get awsRegion(): string {
    return optionalEnv("LANGLER_E2E_AWS_REGION", "eu-central-1");
  },
};

import fs from "node:fs";
import path from "node:path";

export interface RegressionEnv {
  proofEmail: string;
  proofPassword: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  storageKey: string;
}

function parseEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return {};

  const values: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function resolveProjectRef(supabaseUrl: string) {
  const match = supabaseUrl.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co$/i);
  if (!match) {
    throw new Error(
      `Unsupported Supabase URL "${supabaseUrl}". Expected https://<project-ref>.supabase.co`,
    );
  }
  return match[1];
}

let cachedEnv: RegressionEnv | null = null;

export function getRegressionEnv(): RegressionEnv {
  if (cachedEnv) return cachedEnv;

  const root = process.cwd();
  const merged = {
    ...parseEnvFile(path.join(root, ".env")),
    ...parseEnvFile(path.join(root, ".env.local")),
    ...parseEnvFile(path.join(root, ".env.regression.local")),
    ...Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => !!entry[1]),
    ),
  };

  const proofEmail = merged.PLAYWRIGHT_PROOF_EMAIL;
  const proofPassword = merged.PLAYWRIGHT_PROOF_PASSWORD;
  const supabaseUrl = merged.VITE_SUPABASE_URL ?? merged.SUPABASE_URL;
  const supabasePublishableKey =
    merged.VITE_SUPABASE_PUBLISHABLE_KEY ?? merged.SUPABASE_PUBLISHABLE_KEY;

  if (!proofEmail || !proofPassword) {
    throw new Error(
      "Missing PLAYWRIGHT_PROOF_EMAIL or PLAYWRIGHT_PROOF_PASSWORD. Add them to .env.regression.local before running npm run test:proof.",
    );
  }

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing Supabase runtime variables. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are available in .env.",
    );
  }

  const projectRef = resolveProjectRef(supabaseUrl);
  cachedEnv = {
    proofEmail,
    proofPassword,
    supabaseUrl,
    supabasePublishableKey,
    storageKey: `sb-${projectRef}-auth-token`,
  };
  return cachedEnv;
}

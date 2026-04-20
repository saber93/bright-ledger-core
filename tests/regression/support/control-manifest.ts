import fs from "node:fs";
import path from "node:path";

export interface ControlFixtureReference {
  id: string;
  number: string;
}

export interface ControlPaymentReference {
  id: string;
  reference: string;
}

export interface ControlProofManifest {
  generatedAt: string;
  companyId: string;
  periodStart: string;
  periodLabel: string;
  invoiceBlocked: ControlFixtureReference;
  invoicePaymentReverse: ControlFixtureReference & { payment: ControlPaymentReference };
  billVoid: ControlFixtureReference;
  billPaymentReverse: ControlFixtureReference & { payment: ControlPaymentReference };
  creditNoteVoid: ControlFixtureReference;
}

export function controlManifestPath(root = process.cwd()) {
  return path.join(root, "test-results", "control-proof-manifest.json");
}

export function writeControlManifest(
  manifest: ControlProofManifest,
  filePath = controlManifestPath(),
) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export function readControlManifest(
  filePath = controlManifestPath(),
): ControlProofManifest {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing control proof manifest at ${filePath}. Run npm run prepare:proof:controls before Playwright starts.`,
    );
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as ControlProofManifest;
}

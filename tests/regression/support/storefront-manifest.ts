import fs from "node:fs";
import path from "node:path";

export interface StorefrontProofManifest {
  generatedAt: string;
  companyId: string;
  storeSlug: string;
  categoryKey: string;
  productKey: string;
  productName: string;
  publishedHero: string;
  draftHero: string;
}

export function storefrontManifestPath(root = process.cwd()) {
  return path.join(root, "test-results", "storefront-proof-manifest.json");
}

export function writeStorefrontManifest(
  manifest: StorefrontProofManifest,
  filePath = storefrontManifestPath(),
) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export function readStorefrontManifest(
  filePath = storefrontManifestPath(),
): StorefrontProofManifest {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing storefront proof manifest at ${filePath}. Run npm run prepare:proof:storefront before Playwright starts.`,
    );
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as StorefrontProofManifest;
}

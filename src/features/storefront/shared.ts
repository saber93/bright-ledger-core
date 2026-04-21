export const STOREFRONT_PORTAL_COOKIE = "atlas_storefront_portal";
export const STOREFRONT_PREVIEW_COOKIE = "atlas_storefront_preview";

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function buildEntityKey(label: string, id: string) {
  const slug = slugify(label);
  return slug ? `${slug}--${id}` : id;
}

export function parseEntityKey(key: string) {
  const parts = key.split("--");
  return parts[parts.length - 1] || key;
}

export function formatStoreUrlPath(storeSlug: string) {
  return `/shop/${storeSlug}`;
}

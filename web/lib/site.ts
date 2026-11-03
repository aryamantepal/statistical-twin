/** Public base path for sub-path deploys, e.g. "/statistical-twin". Empty for a standalone deploy. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Absolute origin used for canonical and og:image URLs. Override with NEXT_PUBLIC_SITE_URL. On Vercel,
 * previews use their own URL so share-card validators see the preview, and production uses the
 * production domain.
 */
export function siteOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://statistical-twin.vercel.app";
}

/** metadataBase: Next resolves relative metadata URLs against this. It must include the base path. */
export const metadataBase = new URL(`${siteOrigin()}${BASE_PATH}/`);

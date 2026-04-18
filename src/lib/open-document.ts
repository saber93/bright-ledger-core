import { supabase } from "@/integrations/supabase/client";

/**
 * Opens a server-rendered document route (`/api/documents/...`) in a new tab,
 * attaching the current Supabase access token as a `?token=` query parameter
 * so the route's `requireDocumentAccess` guard can authenticate the request.
 *
 * Document routes run server-side and don't share localStorage with the
 * browser, so we have to ferry the token across explicitly. The token is
 * never logged or persisted — it lives only in the new tab's URL bar.
 */
export async function openDocument(path: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const url = token
    ? `${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`
    : path;

  window.open(url, "_blank", "noopener,noreferrer");
}

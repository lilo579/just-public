export const PUBLIC_SITE_PAYLOAD_URL =
  import.meta.env.PUBLIC_SITE_PAYLOAD_URL ||
  "https://ehondnpqztvybvgsjnxe.supabase.co/functions/v1/public-site-payload";

export const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  throw new Error("Missing SUPABASE_ANON_KEY");
}

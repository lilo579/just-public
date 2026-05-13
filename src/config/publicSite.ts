export const PUBLIC_SITE_PAYLOAD_URL =
  import.meta.env.PUBLIC_SITE_PAYLOAD_URL ||
  "https://ehondnpqztvybvgsjnxe.supabase.co/functions/v1/public-site-payload";

export const PUBLIC_LEADS_INTAKE_URL =
  import.meta.env.PUBLIC_LEADS_INTAKE_URL ||
  "https://ehondnpqztvybvgsjnxe.supabase.co/functions/v1/leads";

export const SUPABASE_ANON_KEY =
  typeof import.meta.env.SUPABASE_ANON_KEY === "string"
    ? import.meta.env.SUPABASE_ANON_KEY.trim()
    : "";

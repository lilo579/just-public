/**
 * F3 shop header nav — Golden Master parity with product-palette-kit useNavLines.
 * Lines flagged show_in_nav, collection-aware hrefs, then trailing "Catálogo".
 *
 * @param {Array<{
 *   kind?: string
 *   id?: string
 *   name?: string
 *   slug?: string | null
 *   show_in_nav?: boolean
 *   sort_order?: number | null
 * }>} taxonomy
 * @returns {Array<{ label: string, href: string, separatorBefore?: boolean }>}
 */
export function resolveShopNavItems(taxonomy) {
  const rows = Array.isArray(taxonomy) ? taxonomy : [];
  const collectionSlugs = new Set(
    rows
      .filter((row) => row.kind === "collection" && typeof row.slug === "string")
      .map((row) => String(row.slug).trim())
      .filter(Boolean),
  );

  const navLines = rows
    .filter((row) => row.kind === "line" && row.show_in_nav === true)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  if (navLines.length === 0) {
    return [{ label: "Catálogo", href: "/catalogo" }];
  }

  return [
    ...navLines.map((line) => {
      const slug = typeof line.slug === "string" ? line.slug.trim() : "";
      const href =
        slug && collectionSlugs.has(slug)
          ? `/catalogo?colecao=${encodeURIComponent(slug)}`
          : `/catalogo?line=${encodeURIComponent(String(line.id))}`;
      return { label: String(line.name || "Linha"), href };
    }),
    { label: "Catálogo", href: "/catalogo", separatorBefore: true },
  ];
}

/**
 * Prefer brand crest for solid (non-over-hero) shop headers — matches GM Header.tsx.
 * @param {{ logoUrl?: string | null, logoHorizontalUrl?: string | null } | null | undefined} branding
 * @param {string} [fallback]
 */
export function resolveShopSolidLogoUrl(branding, fallback = "") {
  const brand =
    typeof branding?.logoUrl === "string" ? branding.logoUrl.trim() : "";
  if (brand) return brand;
  const horizontal =
    typeof branding?.logoHorizontalUrl === "string"
      ? branding.logoHorizontalUrl.trim()
      : "";
  return horizontal || fallback || "";
}

/**
 * Shared chrome loader for F3 multi-route pages (catalog / about / contact).
 * Uses the same public payload path as the homepage — no tenant forks.
 */
import {
  fetchPublicSitePayload,
  chooseHomepageRenderer,
} from "./publicHomepage";
import { resolvePublicPresentationBinding } from "./publicPresentationBinding.js";
import {
  resolveSitePayloadUrl,
  resolveSupabaseAnonKey,
  isPocFixtureMode,
  isLeadIntakeSafeMode,
  resolveDeployEnv,
} from "./runtimeEnv.js";
import {
  isPublicationIndexingEnforced,
  publicationFromPayload,
  shouldNoindexFromPublication,
} from "./publicationContract.js";
import { resolvePocFixturePayload } from "../poc/publicSiteFixtures.js";
import { themeTokensFromBranding } from "./themeFromBranding";
import {
  resolveHeaderLogoUrl,
  resolveHeaderOverHeroLogoUrl,
  resolveFooterLogoUrl,
} from "@just/site-engine-authority";
import {
  resolveBrandFaviconUrl,
  resolvePackagedTenantFaviconPath,
} from "./publicPageSeo.js";
import { toAbsoluteCanonicalUrl } from "./canonicalAuthority.js";
import { createPublicSupabaseClient } from "./publicSupabase.js";
import {
  resolveShopNavItems,
  resolveShopSolidLogoUrl,
} from "./resolveShopNavItems.js";
import { resolvePublicSiteMode } from "./resolvePublicSiteMode.js";

/**
 * @param {string} host
 * @param {{ runtime?: { env?: Record<string, unknown> } } | undefined} locals
 */
export async function loadCatalogPublicChrome(host, locals) {
  /** @type {any} */
  let homepage = null;

  if (
    locals?.publicSitePayloadHost === host &&
    locals?.publicSitePayload &&
    typeof locals.publicSitePayload === "object"
  ) {
    homepage = locals.publicSitePayload;
  } else if (isPocFixtureMode(locals)) {
    homepage = resolvePocFixturePayload(host);
    if (homepage) {
      locals.publicSitePayload = homepage;
      locals.publicSitePayloadHost = host;
    }
  } else {
    const payloadUrl = resolveSitePayloadUrl(locals);
    const anonKey = resolveSupabaseAnonKey(locals) ?? "";
    if (!payloadUrl) {
      return { ok: false, status: 503, reason: "PUBLIC_SITE_PAYLOAD_URL missing" };
    }
    const fetched = await fetchPublicSitePayload({ kind: "host", host }, "public", {
      payloadUrl,
      anonKey,
    });
    if (!fetched.ok) {
      return {
        ok: false,
        status: fetched.status === 404 ? 404 : fetched.status >= 500 ? 503 : 502,
        reason: "payload_unavailable",
      };
    }
    homepage = fetched.homepage;
    if (locals && typeof locals === "object") {
      locals.publicSitePayload = homepage;
      locals.publicSitePayloadHost = host;
    }
  }

  if (!homepage) {
    return { ok: false, status: 404, reason: "site_unavailable" };
  }

  const choice = chooseHomepageRenderer(homepage);
  const presentationBinding = resolvePublicPresentationBinding(homepage, choice);
  const isF3 = presentationBinding.family === "f3";
  const chrome = presentationBinding.chrome || {};
  const branding = homepage?.source?.meta?.branding ?? null;
  const contact = homepage?.source?.contact ?? null;
  const companyName =
    contact?.companyName || homepage?.footer?.companyName || "Site";

  /** @type {Array<{ label: string, href: string, separatorBefore?: boolean }>} */
  let navItems =
    isF3 && Array.isArray(chrome.navItems)
      ? chrome.navItems
      : [
          { label: "Catálogo", href: "/catalogo" },
          { label: "Sobre", href: "/sobre" },
          { label: "Contato", href: "/contato" },
        ];

  if (isF3) {
    const supabase = createPublicSupabaseClient(locals);
    if (supabase) {
      const { data: taxonomyRows } = await supabase.rpc(
        "public_get_catalog_taxonomy_by_host",
        { p_host: host },
      );
      const shopNav = resolveShopNavItems(
        Array.isArray(taxonomyRows) ? taxonomyRows : [],
      );
      if (shopNav.length > 0) navItems = shopNav;
    }
  }

  const whatsappDigits = String(contact?.whatsappNumber || "").replace(/\D/g, "");
  const whatsappHref = whatsappDigits ? `https://wa.me/${whatsappDigits}` : "";
  const logoUrl = isF3
    ? resolveShopSolidLogoUrl(branding, resolveHeaderLogoUrl(branding, /** @type {any} */ (chrome)))
    : resolveHeaderLogoUrl(branding, /** @type {any} */ (chrome));
  const logoOverHeroUrl = resolveHeaderOverHeroLogoUrl(
    branding,
    /** @type {any} */ (chrome),
  );
  const footerLogoUrl = resolveFooterLogoUrl(branding, /** @type {any} */ (chrome));
  const tokens = themeTokensFromBranding(branding);
  const socialLinks = (
    homepage?.source?.meta?.footer?.socialLinks ||
    homepage?.footer?.socialLinks ||
    []
  ).filter((link) => typeof link?.url === "string" && link.url.trim());

  const siteModeResolved = resolvePublicSiteMode(homepage);
  const deployEnv = resolveDeployEnv(locals);
  const noindex =
    isLeadIntakeSafeMode(deployEnv) ||
    siteModeResolved.mode === "MAINTENANCE" ||
    shouldNoindexFromPublication({
      enforce: isPublicationIndexingEnforced(locals),
      publication: publicationFromPayload(homepage),
      siteMode: siteModeResolved.mode,
    });
  /** ADR-SEO-001 — prefer middleware locals (same request), else payload contract. */
  const canonical =
    (locals?.publicCanonical && typeof locals.publicCanonical === "object"
      ? locals.publicCanonical
      : null) ||
    (homepage?.canonical && typeof homepage.canonical === "object"
      ? homepage.canonical
      : null);

  const seoMeta =
    homepage?.source?.meta?.seo && typeof homepage.source.meta.seo === "object"
      ? homepage.source.meta.seo
      : null;
  const packagedFavicon = resolvePackagedTenantFaviconPath(host);
  const packagedSlug = packagedFavicon
    ? packagedFavicon.split("/")[2] || ""
    : "";
  // Only 3D Jewish ships a dedicated OG pack today; other packs use Hub logos.
  const packagedOgImage =
    packagedSlug === "3d-jewish" ? `/branding/${packagedSlug}/og-image.jpg` : "";
  const logoHorizontalUrl =
    typeof branding?.logoHorizontalUrl === "string"
      ? branding.logoHorizontalUrl.trim()
      : "";
  const brandingLogoUrl =
    typeof branding?.logoUrl === "string" ? branding.logoUrl.trim() : "";
  const ogImageRelative =
    (typeof seoMeta?.ogImage === "string" && seoMeta.ogImage.trim()) ||
    packagedOgImage ||
    logoHorizontalUrl ||
    brandingLogoUrl ||
    "";
  const ogImage = canonical
    ? toAbsoluteCanonicalUrl(
        typeof canonical.origin === "string" ? canonical.origin : "",
        ogImageRelative,
      ) || ogImageRelative
    : ogImageRelative;
  const faviconUrl = resolveBrandFaviconUrl({
    host,
    favicon:
      (typeof seoMeta?.favicon === "string" && seoMeta.favicon.trim()) ||
      packagedFavicon ||
      "",
    ogImage: ogImageRelative,
    logoHorizontalUrl,
    logoUrl: brandingLogoUrl,
  });

  const catalogHero =
    homepage?.source?.catalog?.hero &&
    typeof homepage.source.catalog.hero === "object"
      ? homepage.source.catalog.hero
      : null;

  return {
    ok: true,
    homepage,
    isF3,
    presentationProfile: presentationBinding.profile,
    companyName,
    navItems,
    whatsappHref,
    logoUrl,
    logoOverHeroUrl,
    footerLogoUrl,
    tokens,
    socialLinks,
    noindex,
    deployEnv,
    canonical,
    faviconUrl,
    ogImage,
    catalogHeroTitle:
      typeof catalogHero?.title === "string" ? catalogHero.title.trim() : "",
    catalogHeroSubtitle:
      typeof catalogHero?.subtitle === "string"
        ? catalogHero.subtitle.trim()
        : "",
    headerCtaLabel:
      typeof chrome.headerCtaLabel === "string" && chrome.headerCtaLabel.trim()
        ? chrome.headerCtaLabel
        : "WhatsApp",
    justSignatureBand: chrome.justSignatureBand !== false,
    footerSurface: chrome.footerSurface || "light",
    contact,
    siteMode: siteModeResolved.mode,
    siteModeConfig: siteModeResolved.config,
    interstitial: siteModeResolved.interstitial,
  };
}

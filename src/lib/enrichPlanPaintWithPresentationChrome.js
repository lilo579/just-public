/**
 * Apply cinematic_v1 editorial chrome onto painted nodes when Edge paint
 * predates enrichment (no Edge redeploy required).
 *
 * @param {import("@just/site-engine-authority").SerializableHomepageRenderPlan} plan
 * @param {import("@just/site-engine-authority").F1PresentationChrome | import("@just/site-engine-authority").F3PresentationChrome} chrome
 */
export function enrichPlanPaintWithPresentationChrome(plan, chrome) {
  if (!plan?.nodes || !chrome || chrome.profile !== "f1.presentation.cinematic_v1") {
    return plan;
  }
  const editorial = chrome.cinematicEditorial;
  if (!editorial) return plan;

  const nodes = plan.nodes.map((node) => {
    const paint = node.paint;
    if (!paint?.block?.content) return node;
    const content = { ...paint.block.content };
    const layout = { ...(paint.layout ?? {}) };

    switch (paint.component) {
      case "hero":
        content.imageUrl = content.imageUrl || editorial.heroImageUrl;
        layout.heroLayout = "cinematic";
        break;
      case "problem":
      case "rich_text":
        content.kicker = content.kicker || editorial.problemKicker;
        content.pullQuote = content.pullQuote || editorial.problemPullQuote;
        layout.problemLayout = "cinematic-editorial";
        break;
      case "about":
        content.stats = content.stats || editorial.aboutStats;
        layout.aboutLayout = "cinematic-authority";
        layout.sectionId = layout.sectionId || "sobre";
        break;
      case "services": {
        content.kicker = content.kicker || editorial.situationsKicker;
        content.body = content.body || editorial.situationsSupport;
        layout.servicesLayout = "cinematic-signs";
        layout.sectionId = layout.sectionId || "para-quem";
        break;
      }
      case "features":
        content.kicker = content.kicker || editorial.principlesKicker;
        content.imageUrl = content.imageUrl || editorial.principlesImageUrl;
        layout.benefitsLayout = "cinematic-principles";
        break;
      case "process": {
        const existing = Array.isArray(content.steps) ? content.steps : [];
        const hasSupplemental = existing.length >= 5;
        if (!hasSupplemental) {
          const start = existing.length;
          const supplemental = editorial.processSupplementalSteps.map((step, i) => ({
            number: start + i + 1,
            title: step.title,
            description: step.description,
          }));
          content.steps = [...existing, ...supplemental];
        }
        content.kicker = content.kicker || editorial.processKicker;
        content.body = content.body || editorial.processSupport;
        content.imageUrl = content.imageUrl || editorial.processImageUrl;
        // Closing quote renders after CTA band (SPA order) — strip if present on process.
        delete content.closingPullQuote;
        layout.processLayout = "cinematic-journey";
        layout.sectionId = layout.sectionId || "como-funciona";
        break;
      }
      case "cta_final":
        content.microcopy = content.microcopy || editorial.ctaMicrocopy;
        content.closingPullQuote =
          content.closingPullQuote || editorial.closingPullQuote;
        layout.ctaLayout = "cinematic-band";
        layout.sectionId = layout.sectionId || "contato";
        break;
      default:
        break;
    }

    return {
      ...node,
      paint: {
        ...paint,
        block: { ...paint.block, content },
        layout,
      },
    };
  });

  return { ...plan, nodes };
}

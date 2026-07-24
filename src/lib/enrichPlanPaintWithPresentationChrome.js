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

  const problemNode = plan.nodes.find(
    (node) => node.paint?.component === "problem" || node.paint?.component === "rich_text",
  );
  const problemParagraphs = Array.isArray(problemNode?.paint?.block?.content?.paragraphs)
    ? problemNode.paint.block.content.paragraphs.filter((p) => typeof p === "string" && p.trim())
    : [];

  const nodes = plan.nodes.map((node) => {
    const paint = node.paint;
    if (!paint?.block?.content) return node;
    const content = { ...paint.block.content };
    const layout = { ...(paint.layout ?? {}) };

    switch (paint.component) {
      case "hero":
        content.imageUrl = content.imageUrl || editorial.heroImageUrl;
        if (editorial.heroVideoUrl) content.videoUrl = editorial.heroVideoUrl;
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
        layout.sectionId =
          layout.sectionId ||
          (editorial.composition === "pt_trainer"
            ? editorial.sectionIds?.method || "metodo"
            : "para-quem");
        break;
      }
      case "features": {
        content.kicker = content.kicker || editorial.principlesKicker;
        if (editorial.composition !== "pt_trainer") {
          content.imageUrl = content.imageUrl || editorial.principlesImageUrl;
          layout.benefitsLayout = "cinematic-principles";
        } else {
          content.imageUrl = null;
          layout.benefitsLayout = "cinematic-outcomes";
          const items = Array.isArray(content.items) ? content.items : [];
          content.outcomeImageUrls = items.map((_, index) => {
            const n = String(index + 1).padStart(2, "0");
            return `/presentation/cinematic_v1/pt/benefits-${n}.jpeg`;
          });
        }
        if (
          editorial.composition === "pt_trainer" &&
          problemParagraphs.length > 0 &&
          Array.isArray(content.items)
        ) {
          content.items = content.items.map((item, index) => ({
            ...item,
            description: item.description || problemParagraphs[index] || null,
          }));
        }
        layout.sectionId =
          layout.sectionId ||
          (editorial.composition === "pt_trainer"
            ? editorial.sectionIds?.benefits || "beneficios"
            : undefined);
        break;
      }
      case "process": {
        const existing = Array.isArray(content.steps) ? content.steps : [];
        const supplemental = Array.isArray(editorial.processSupplementalSteps)
          ? editorial.processSupplementalSteps
          : [];
        const hasSupplemental = existing.length >= 3 + supplemental.length;
        if (!hasSupplemental && supplemental.length > 0) {
          const start = existing.length;
          content.steps = [
            ...existing,
            ...supplemental.map((step, i) => ({
              number: start + i + 1,
              title: step.title,
              description: step.description,
            })),
          ];
        }
        content.kicker = content.kicker || editorial.processKicker;
        content.body = content.body || editorial.processSupport;
        content.imageUrl = content.imageUrl || editorial.processImageUrl;
        if (editorial.processVideoUrl) content.videoUrl = editorial.processVideoUrl;
        delete content.closingPullQuote;
        if (editorial.composition === "pt_trainer") {
          layout.processLayout = "cinematic-method";
          layout.sectionId = editorial.sectionIds?.method || "metodo";
        } else {
          layout.processLayout = "cinematic-journey";
          layout.sectionId = layout.sectionId || "como-funciona";
        }
        break;
      }
      case "cta_final":
        content.microcopy = content.microcopy || editorial.ctaMicrocopy;
        content.closingPullQuote =
          content.closingPullQuote || editorial.closingPullQuote;
        if (Array.isArray(editorial.manifestoGhost)) {
          content.manifestoGhost = editorial.manifestoGhost;
        }
        if (Array.isArray(editorial.manifestoStatement)) {
          content.manifestoStatement = editorial.manifestoStatement;
        }
        if (editorial.composition === "pt_trainer") {
          content.manifestoImageUrl =
            content.manifestoImageUrl ||
            "/presentation/cinematic_v1/pt/manifesto-portrait.png";
          layout.sectionId = editorial.sectionIds?.manifesto || "manifesto-final";
        } else {
          layout.sectionId = layout.sectionId || "contato";
        }
        layout.ctaLayout = "cinematic-band";
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

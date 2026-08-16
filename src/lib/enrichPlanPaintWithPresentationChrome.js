/**
 * Apply this tenant's cinematic editorial onto painted nodes.
 * Never invents another tenant's copy or composition asset paths.
 * Does not mutate the input plan.
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

  const isTrainer = editorial.composition === "pt_trainer";

  const nodes = plan.nodes.map((node) => {
    const paint = node.paint;
    if (!paint?.block?.content) return node;
    const content = { ...paint.block.content };
    const layout = { ...(paint.layout ?? {}) };
    let changed = false;

    const fill = (key, value) => {
      if (!value) return;
      if (content[key]) return;
      content[key] = value;
      changed = true;
    };

    switch (paint.component) {
      case "hero":
        fill("imageUrl", editorial.heroImageUrl);
        fill("videoUrl", editorial.heroVideoUrl);
        layout.heroLayout = "cinematic";
        changed = true;
        break;
      case "problem":
      case "rich_text":
        fill("kicker", editorial.problemKicker);
        fill("pullQuote", editorial.problemPullQuote);
        layout.problemLayout = "cinematic-editorial";
        changed = true;
        break;
      case "about":
        if (
          (!Array.isArray(content.stats) || content.stats.length === 0) &&
          Array.isArray(editorial.aboutStats) &&
          editorial.aboutStats.length > 0
        ) {
          content.stats = editorial.aboutStats;
          changed = true;
        }
        layout.aboutLayout = "cinematic-authority";
        layout.sectionId = layout.sectionId || "sobre";
        changed = true;
        break;
      case "services": {
        fill("kicker", editorial.situationsKicker);
        fill("body", editorial.situationsSupport);
        layout.servicesLayout = "cinematic-signs";
        layout.sectionId =
          layout.sectionId ||
          (isTrainer ? editorial.sectionIds?.method || "metodo" : "para-quem");
        changed = true;
        break;
      }
      case "features": {
        fill("kicker", editorial.principlesKicker);
        if (isTrainer) {
          content.imageUrl = content.imageUrl || null;
          layout.benefitsLayout = "cinematic-outcomes";
          if (
            Array.isArray(editorial.outcomeImageUrls) &&
            editorial.outcomeImageUrls.length > 0
          ) {
            content.outcomeImageUrls = editorial.outcomeImageUrls;
            changed = true;
          }
        } else {
          fill("imageUrl", editorial.principlesImageUrl);
          layout.benefitsLayout = "cinematic-principles";
        }
        layout.sectionId =
          layout.sectionId ||
          (isTrainer ? editorial.sectionIds?.benefits || "beneficios" : undefined);
        changed = true;
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
          changed = true;
        }
        fill("kicker", editorial.processKicker);
        fill("body", editorial.processSupport);
        fill("imageUrl", editorial.processImageUrl);
        fill("videoUrl", editorial.processVideoUrl);
        if (content.closingPullQuote) {
          delete content.closingPullQuote;
          changed = true;
        }
        if (isTrainer) {
          layout.processLayout = "cinematic-method";
          layout.sectionId = editorial.sectionIds?.method || "metodo";
        } else {
          layout.processLayout = "cinematic-journey";
          layout.sectionId = layout.sectionId || "como-funciona";
        }
        changed = true;
        break;
      }
      case "cta_final":
        fill("microcopy", editorial.ctaMicrocopy);
        fill("closingPullQuote", editorial.closingPullQuote);
        if (Array.isArray(editorial.manifestoGhost) && editorial.manifestoGhost.length > 0) {
          content.manifestoGhost = editorial.manifestoGhost;
          changed = true;
        }
        if (
          Array.isArray(editorial.manifestoStatement) &&
          editorial.manifestoStatement.length > 0
        ) {
          content.manifestoStatement = editorial.manifestoStatement;
          changed = true;
        }
        fill("manifestoImageUrl", editorial.manifestoImageUrl);
        if (isTrainer) {
          layout.sectionId = editorial.sectionIds?.manifesto || "manifesto-final";
        } else {
          layout.sectionId = layout.sectionId || "contato";
        }
        layout.ctaLayout = "cinematic-band";
        changed = true;
        break;
      default:
        break;
    }

    if (!changed) return node;
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

/**
 * Frozen JUST institutional content — M1 Content Freeze SHA 18dfcd6.
 * Do not edit copy without an approved freeze amendment.
 * Terms of Use v1.0: see justTermsOfUseV1.js (JUST hosts only via justLegalPages).
 * Privacy Policy v1.0: see justPrivacyPolicyV1.js (JUST hosts only via justLegalPages).
 *
 * Freeze amendment (Closed Beta Commercial Alignment v1):
 * - hero closed-beta status line
 * - commercial CTA → "Quero conhecer a JUST"
 * - pricing access microcopy
 * - final CTA headline alignment
 * - fictional trust names removed; editorial real beta client proof
 * - NORMAL homepage SEO/OG (no Coming Soon residual)
 */

import { justPrivacyPolicyV1 } from "./justPrivacyPolicyV1.js"
import { justTermsOfUseV1 } from "./justTermsOfUseV1.js"

export const JUST_BRAND_PACK_SLUG = "just"

export const JUST_HOSTS = Object.freeze([
  "www.justwebsites.com.br",
  "justwebsites.com.br",
])

export const JUST_SIGN_IN_URL = "https://hub.justwebsites.com.br/login/admin"
export const JUST_WHATSAPP_URL = "https://wa.me/5511956480018"
export const JUST_WHATSAPP_DIGITS = "5511956480018"

/** M1 Coming Soon SEO + document meta (COMING_SOON mode only) */
export const justComingSoonSeo = Object.freeze({
  title: "JUST",
  description:
    "Plataforma para pequenos negócios reunirem gestão, site, agenda, financeiro e marketing em um único lugar.",
  ogTitle: "JUST",
  ogDescription:
    "Estamos finalizando a primeira versão pública da JUST. Plataforma para pequenos negócios reunirem gestão, site, agenda, financeiro e marketing em um único lugar.",
  author: "JUST",
  robots: "index, follow",
  themeColor: "#121212",
})

/**
 * NORMAL institutional homepage SEO / OG / Twitter.
 * Must not reuse Coming Soon “finalizando a primeira versão pública” narrative.
 */
export const justInstitutionalSeo = Object.freeze({
  title: "JUST",
  description:
    "A JUST reúne gestão, site, agenda, financeiro e marketing para pequenos negócios operarem de forma mais organizada e integrada.",
  ogTitle: "JUST",
  ogDescription:
    "A JUST reúne gestão, site, agenda, financeiro e marketing para pequenos negócios operarem de forma mais organizada e integrada.",
  author: "JUST",
  robots: "index, follow",
  themeColor: "#121212",
})

/** Shared commercial CTA label (header / hero / pricing / final). */
export const JUST_COMMERCIAL_CTA_LABEL = "Quero conhecer a JUST"

/** Canonical site.mode.config fields (M1 §2.3) + form/legal for platform Coming Soon */
export const justComingSoonModeConfig = Object.freeze({
  headline:
    "Pequenos negócios não precisam de mais ferramentas.\nPrecisam de um sistema.",
  subtitle: "Estamos finalizando a primeira versão pública da JUST.",
  description:
    "Uma plataforma criada para reunir gestão, site, agenda, financeiro, marketing e muito mais em um único lugar.\n\nSe você quiser conhecer antes do lançamento oficial, deixe seus dados abaixo.",
  launchDate:
    "Os primeiros interessados terão acesso antecipado e condições especiais de lançamento.",
  leadCaptureEnabled: false,
  ctaLabel: null,
  ctaHref: null,
  whatsappNumber: null,
  email: null,
  socialLinks: null,
  backgroundImageUrl: null,
  heroImageUrl: null,
  showEyebrow: false,
  showJustSignature: false,
  paragraphs: [
    "Estamos finalizando a primeira versão pública da JUST.",
    "Uma plataforma criada para reunir gestão, site, agenda, financeiro, marketing e muito mais em um único lugar.",
    "Se você quiser conhecer antes do lançamento oficial, deixe seus dados abaixo.",
  ],
  legalLinks: [
    { href: "/privacidade", label: "Privacidade" },
    { href: "/termos", label: "Termos" },
  ],
  leadForm: {
    nameLabel: "Nome",
    whatsappLabel: "WhatsApp",
    submitLabel: "Quero saber primeiro",
    successTitle: "Obrigado!",
    successBody:
      "Entraremos em contato quando a JUST estiver pronta para receber novos clientes.",
  },
})

export const justInstitutionalNav = Object.freeze([
  { href: "/#estrutura-completa", label: "Recursos", hash: "estrutura-completa" },
  { href: "/#como-funciona-junto", label: "Como funciona", hash: "como-funciona-junto" },
  { href: "/#depoimentos", label: "Depoimentos", hash: "depoimentos" },
  { href: "/#precos", label: "Preços", hash: "precos" },
])

export const justHero = Object.freeze({
  headlineLines: [
    "Seu pequeno negócio funcionando",
    "como um negócio de verdade.",
  ],
  body: "A JUST organiza o seu negócio para que você possa dedicar menos tempo à operação e mais tempo ao crescimento.",
  stageLine:
    "A plataforma já está operacional com clientes selecionados. Estamos em beta fechado, preparando o lançamento comercial.",
  primaryCta: { label: JUST_COMMERCIAL_CTA_LABEL, targetId: "cta-final" },
  secondaryCta: { label: "Como funciona", targetId: "como-funciona-junto" },
  trustLabel: "Negócios que operam com a JUST",
  /**
   * Editorial closed-beta client proof (explicit allowlist — not DB-driven).
   * Classification: live JUST Public Layer tenants + Dorot Publications.
   * Excludes: just (platform), sandboxes, fixtures, demos, shop-template.
   * opticalScale: presentation-only size balance (does not alter source files).
   * surface: optional contrast plate — "transparent" (default) | "dark".
   * All entries require a real graphical logoSrc (no HTML wordmark fallback).
   */
  clientProof: [
    {
      id: "3d-jewish",
      name: "3D Jewish",
      logoSrc: "/branding/just/client-proof/3d-jewish.png",
      logoAlt: "3D Jewish",
      opticalScale: 1,
    },
    {
      id: "celina-pires",
      name: "Celina Pires",
      logoSrc: "/branding/just/client-proof/celina-pires.png",
      logoAlt: "Celina Pires",
      opticalScale: 1.18,
    },
    {
      id: "marcelo-borer",
      name: "Marcelo Borer",
      logoSrc: "/branding/just/client-proof/marcelo-borer.png",
      logoAlt: "Marcelo Borer",
      // Horizontal lockup (site/logo/logo.png) — taller optical scale vs square monogram.
      opticalScale: 1.32,
    },
    {
      id: "rossana-mendonca",
      name: "Rossana Mendonça",
      logoSrc: "/branding/just/client-proof/rossana-mendonca.png",
      logoAlt: "Rossana Mendonça",
      opticalScale: 1,
    },
    {
      id: "soraya-barbosa",
      name: "Soraya Barbosa",
      logoSrc: "/branding/just/client-proof/soraya-barbosa.png",
      logoAlt: "Soraya Barbosa",
      opticalScale: 0.88,
    },
    {
      id: "flavio-personal",
      name: "Flávio Henrique",
      logoSrc: "/branding/just/client-proof/flavio-personal.png",
      logoAlt: "Flávio Henrique",
      // Live crest has white detail on transparent plate — needs dark surface on cream band.
      opticalScale: 1.35,
      surface: "dark",
    },
    {
      id: "dorot-publications",
      name: "Dorot Publications",
      logoSrc: "/branding/just/client-proof/dorot-publications.png",
      logoAlt: "Dorot Publications",
      opticalScale: 1.08,
    },
  ],
})

export const justStructure = Object.freeze({
  id: "estrutura-completa",
  headline: "Uma estrutura completa para o seu negócio.",
  lead: "Presença digital, gestão e operação reunidas para que tudo funcione com mais clareza, menos complexidade e continuidade.",
  pillars: [
    {
      id: "presenca",
      title: "Presença digital",
      description:
        "Um site profissional que representa o seu negócio, transmite confiança e transforma interesse em contato.",
      visual: "presence",
      prominence: "primary",
    },
    {
      id: "clientes",
      title: "Clientes",
      description:
        "Informações, histórico e relacionamento reunidos para que nenhum cliente se perca pelo caminho.",
      visual: "clients",
      prominence: "primary",
    },
    {
      id: "agenda",
      title: "Agenda",
      description:
        "Serviços, horários e atendimentos organizados para reduzir desencontros, esquecimentos e retrabalho.",
      visual: "agenda",
      prominence: "primary",
    },
    {
      id: "financeiro",
      title: "Financeiro",
      description:
        "Cobranças, recebimentos e compromissos financeiros acompanhados com clareza no dia a dia.",
      visual: "finance",
      prominence: "secondary",
    },
    {
      id: "operacao",
      title: "Operação",
      description:
        "O dia a dia do negócio reunido para que tarefas, informações e decisões não dependam só da memória.",
      visual: "operation",
      prominence: "secondary",
    },
    {
      id: "evolucao",
      title: "Evolução contínua",
      description:
        "Uma estrutura preparada para incorporar novas necessidades conforme o negócio cresce.",
      visual: "evolution",
      prominence: "secondary",
    },
  ],
})

export const justHowTogether = Object.freeze({
  id: "como-funciona-junto",
  headline: "Quando tudo trabalha junto, seu negócio muda.",
  lead: "Cada etapa alimenta a próxima. Informações fluem, tarefas se conectam e decisões se tornam mais simples. Assim, sua operação ganha continuidade e você tem tempo para focar no crescimento.",
  tag: "Um ciclo contínuo de valor",
  coreLines: [
    "Tudo conectado.",
    "Tudo atualizado.",
    "Seu negócio sempre em frente.",
  ],
  steps: [
    {
      title: "Cliente encontra seu negócio",
      text: "Presença digital que atrai e transmite confiança.",
    },
    {
      title: "Agenda organizada",
      text: "Horários disponíveis, agendamentos e confirmações automáticas.",
    },
    {
      title: "Atendimento realizado",
      text: "Informações e histórico registrados em um só lugar.",
    },
    {
      title: "Recebimento concluído",
      text: "Cobranças, pagamentos e recebimentos acompanhados com clareza.",
    },
    {
      title: "Relacionamento fortalecido",
      text: "Comunicação, histórico e acompanhamento que geram fidelização.",
    },
    {
      title: "Novo atendimento e crescimento",
      text: "Dados e aprendizados alimentam o próximo ciclo de crescimento.",
    },
  ],
  outcomes: [
    {
      title: "Menos retrabalho",
      text: "Informações centralizadas e sempre atualizadas.",
    },
    {
      title: "Mais tempo",
      text: "Automação do que é repetitivo para você focar no importante.",
    },
    {
      title: "Melhores decisões",
      text: "Visão completa do negócio para decidir com clareza.",
    },
    {
      title: "Crescimento contínuo",
      text: "Uma estrutura que evolui junto com você.",
    },
  ],
})

export const justEvolution = Object.freeze({
  id: "evolucao-do-negocio",
  headline: "Uma estrutura que cresce junto com o seu negócio.",
  lead: "Não importa o segmento. Conforme o seu negócio cresce, a forma de trabalhar muda. A JUST evolui junto com você, organizando cada nova etapa da operação.",
  stages: [
    {
      id: "comecando",
      title: "Você está começando.",
      text: "Você precisa parecer profissional desde o primeiro cliente.",
    },
    {
      id: "movimento",
      title: "O movimento aumentou.",
      text: "Agenda, clientes e financeiro deixam de caber na memória.",
    },
    {
      id: "equipe",
      title: "A equipe cresceu.",
      text: "As informações precisam ser compartilhadas para que a operação continue funcionando.",
    },
    {
      id: "online",
      title: "Você começou a vender online.",
      text: "Catálogo, pedidos e atendimento passam a fazer parte da mesma operação.",
    },
    {
      id: "evoluindo",
      title: "O negócio continua evoluindo.",
      text: "A estrutura cresce junto com você, sem precisar trocar de sistema.",
    },
  ],
  outcomes: [
    {
      id: "recomeços",
      title: "Sem recomeços",
      text: "Você não precisa trocar de sistema a cada nova fase.",
    },
    {
      id: "clareza",
      title: "Mais clareza",
      text: "Cada etapa da operação fica organizada e conectada.",
    },
    {
      id: "retrabalho",
      title: "Menos retrabalho",
      text: "Informações centralizadas e sempre atualizadas.",
    },
    {
      id: "crescimento",
      title: "Crescimento sustentável",
      text: "Uma estrutura preparada para acompanhar a evolução.",
    },
  ],
})

/** Empty publish set — section must not render (M1). */
export const justTestimonials = Object.freeze({
  id: "depoimentos",
  title: "Quem usa a JUST sente a diferença.",
  lead: "Veja como pequenos negócios estão organizando melhor a operação e ganhando mais tempo para crescer.",
  items: /** @type {never[]} */ ([]),
})

export const justPricing = Object.freeze({
  id: "precos",
  headline: "Um único plano. Tudo incluído.",
  lead: "A plataforma completa para organizar, administrar e fazer seu negócio crescer.",
  support:
    "Uma assinatura mensal. Sem planos escondidos, sem módulos à parte e sem limites artificiais. A estrutura completa do negócio em um só lugar.",
  brand: "JUST",
  currency: "R$",
  amount: "67",
  period: "/ mês",
  featureGroups: [
    { title: "Operação", items: ["Financeiro", "Agenda", "CRM"] },
    { title: "Presença digital", items: ["Site profissional", "Catálogo"] },
    { title: "Crescimento", items: ["Marketing", "Área do cliente"] },
    { title: "Sempre incluso", items: ["Atualizações contínuas", "Suporte"] },
  ],
  ctaLabel: JUST_COMMERCIAL_CTA_LABEL,
  ctaHref: "/#cta-final",
  accessNote:
    "Acesso disponível para clientes selecionados durante o beta fechado.",
  micro: "Sem fidelidade.",
  microQuiet: "Sem taxas de implantação. Sem módulos extras.",
  trust: [
    { title: "Sem custos ocultos", detail: "Transparência total." },
    { title: "Seus dados protegidos", detail: "Segurança e privacidade." },
    { title: "Suporte humano", detail: "Atendimento de verdade." },
  ],
})

/** Closed-beta interest mini-form — replaces commercial WhatsApp exit on final CTA. */
export const justLeadMiniForm = Object.freeze({
  sourceType: "just_closed_beta_interest",
  ctaId: "just-final-lead-form",
  nameLabel: "Nome",
  companyLabel: "Empresa / negócio",
  websiteLabel: "Website",
  websitePlaceholder: "https://suaempresa.com.br",
  phoneLabel: "WhatsApp",
  emailLabel: "E-mail",
  messageLabel: "Conte brevemente sobre o seu negócio",
  submitLabel: "Enviar",
  successTitle: "Recebemos seu interesse.",
  successBody: "Em breve entraremos em contato pelo WhatsApp ou e-mail.",
  errors: Object.freeze({
    required: "Preencha os campos obrigatórios para continuar.",
    email: "Informe um e-mail válido.",
    website: "Informe um website válido (ex.: empresa.com.br).",
    unavailable: "Envio indisponível no momento.",
    failed: "Não foi possível enviar agora. Tente novamente.",
  }),
})

export const justFinalCta = Object.freeze({
  id: "cta-final",
  headline: "Conheça a JUST",
  lead: "A JUST está em beta fechado com clientes selecionados. Deixe seus dados e entraremos em contato.",
})

export const justFooter = Object.freeze({
  mark: "JUST",
  tagline: "O sistema operacional para pequenos negócios.",
  copyright: "© 2026 JUST. Todos os direitos reservados.",
  legalLinks: [
    { href: "/privacidade", label: "Privacidade" },
    { href: "/termos", label: "Termos" },
  ],
  supportLabel: "Suporte",
  supportHref: JUST_WHATSAPP_URL,
})

export const justLegalPages = Object.freeze({
  /** Public Privacy Policy v1.0 — structured document (JUST hosts only). */
  privacidade: justPrivacyPolicyV1,
  /** Public Terms of Use v1.0 — structured document (JUST hosts only). */
  termos: justTermsOfUseV1,
})

export const justNotFound = Object.freeze({
  eyebrow: "JUST",
  title: "Página não encontrada",
  body: "Esta página não existe ou pode ter sido movida.",
  ctaLabel: "Voltar para a página inicial",
  ctaHref: "/",
})

/** Theme tokens matching just-site-magic index.css :root (M1). */
export const justThemeBranding = Object.freeze({
  companyName: "JUST",
  logoHorizontalUrl: `/branding/${JUST_BRAND_PACK_SLUG}/logo-horizontal.png`,
  logoUrl: `/branding/${JUST_BRAND_PACK_SLUG}/logo-horizontal.png`,
  primaryColor: "#121212",
  /** Cream wash — promoted to --site-color-background by themeTokensFromBranding. */
  secondaryColor: "#f7f5f0",
  accentColor: "#3b5bdb",
  typography: "just_institutional",
})

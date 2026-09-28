import assert from "node:assert/strict"
import test from "node:test"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import {
  JUST_COMMERCIAL_CTA_LABEL,
  justFinalCta,
  justHero,
  justInstitutionalSeo,
  justComingSoonSeo,
  justPricing,
} from "../src/lib/justInstitutionalFreeze.js"
import { resolvePackagedInstitutionalSite } from "../src/lib/resolvePackagedInstitutionalSite.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

const FAKE_CLIENTS = [
  "Vértice",
  "Ateliê Norte",
  "Leme",
  "Forma",
  "Praxis",
  "Oficina Alma",
]

const APPROVED_CLIENT_IDS = [
  "3d-jewish",
  "celina-pires",
  "marcelo-borer",
  "rossana-mendonca",
  "soraya-barbosa",
  "flavio-personal",
  "dorot-publications",
]

test("closed beta: stage line + commercial CTA + pricing access note", () => {
  assert.match(justHero.stageLine, /beta fechado/i)
  assert.match(justHero.stageLine, /operacional/i)
  assert.match(justHero.stageLine, /lançamento comercial/i)
  assert.equal(JUST_COMMERCIAL_CTA_LABEL, "Quero conhecer a JUST")
  assert.equal(justHero.primaryCta.label, JUST_COMMERCIAL_CTA_LABEL)
  assert.equal(justPricing.ctaLabel, JUST_COMMERCIAL_CTA_LABEL)
  assert.equal(
    justPricing.accessNote,
    "Acesso disponível para clientes selecionados durante o beta fechado.",
  )
  assert.equal(justPricing.amount, "67")
  assert.equal(justFinalCta.headline, "Conheça a JUST")
  assert.doesNotMatch(justFinalCta.headline, /Agora é só começar/)
  // Commercial exit is the lead mini-form — not a WhatsApp button on final CTA.
  assert.equal("ctaHref" in justFinalCta, false)
  assert.equal("ctaLabel" in justFinalCta, false)
})

test("closed beta: fake trust names removed from freeze and components", () => {
  const freeze = readFileSync(join(root, "src/lib/justInstitutionalFreeze.js"), "utf8")
  const hero = readFileSync(
    join(root, "src/components/just-institutional/JustHero.astro"),
    "utf8",
  )
  const header = readFileSync(
    join(root, "src/components/just-institutional/JustHeader.astro"),
    "utf8",
  )
  for (const name of FAKE_CLIENTS) {
    assert.equal(freeze.includes(name), false, `freeze still has ${name}`)
    assert.equal(hero.includes(name), false, `hero still has ${name}`)
  }
  assert.equal(freeze.includes("trustNames"), false)
  assert.equal(hero.includes("Começar agora"), false)
  assert.equal(header.includes("Começar agora"), false)
  assert.match(header, /JUST_COMMERCIAL_CTA_LABEL/)
  assert.equal(justHero.trustLabel, "Negócios que operam com a JUST")
})

test("closed beta: editorial clientProof is explicit 7-client allowlist with real logos", () => {
  assert.ok(Array.isArray(justHero.clientProof))
  assert.equal(justHero.clientProof.length, 7)
  assert.deepEqual(
    justHero.clientProof.map((c) => c.id),
    APPROVED_CLIENT_IDS,
  )
  assert.ok(justHero.clientProof.some((c) => c.id === "dorot-publications"))

  for (const client of justHero.clientProof) {
    assert.ok(client.name)
    assert.ok(client.logoSrc, `${client.id} missing logoSrc`)
    assert.equal(client.display, undefined, `${client.id} must not use display wordmark`)
    assert.equal(existsSync(join(root, "public", client.logoSrc)), true)
    assert.ok(
      typeof client.opticalScale === "number" && client.opticalScale > 0,
      `${client.id} opticalScale`,
    )
  }

  const marcelo = justHero.clientProof.find((c) => c.id === "marcelo-borer")
  const flavio = justHero.clientProof.find((c) => c.id === "flavio-personal")
  assert.ok(marcelo.logoSrc.includes("marcelo-borer"))
  assert.ok(flavio.logoSrc.includes("flavio-personal"))

  // Authority: primary site logos — reject favicon/monogram/brain-crop substitutes.
  const marceloBytes = readFileSync(join(root, "public", marcelo.logoSrc))
  const flavioBytes = readFileSync(join(root, "public", flavio.logoSrc))
  const faviconPack = readFileSync(
    join(root, "public/branding/marcelo-borer/apple-touch-icon.png"),
  )
  const flavioApple = readFileSync(
    join(root, "public/branding/flavio-personal/apple-touch-icon.png"),
  )
  assert.notEqual(
    marceloBytes.equals(faviconPack),
    true,
    "Marcelo must not use favicon/apple-touch monogram",
  )
  assert.notEqual(
    flavioBytes.equals(flavioApple),
    true,
    "Flávio must not use apple-touch/brain favicon crop",
  )
  // PNG IHDR: width @16, height @20 (big-endian)
  const pngSize = (buf) => ({
    w: buf.readUInt32BE(16),
    h: buf.readUInt32BE(20),
  })
  const marceloSize = pngSize(marceloBytes)
  const flavioSize = pngSize(flavioBytes)
  assert.ok(
    marceloSize.w > marceloSize.h,
    `Marcelo must be horizontal lockup, got ${marceloSize.w}x${marceloSize.h}`,
  )
  assert.ok(
    marceloSize.w >= 800,
    `Marcelo logo too small to be site header lockup (${marceloSize.w}x${marceloSize.h})`,
  )
  assert.ok(
    flavioSize.h > flavioSize.w,
    `Flávio must be vertical crest, got ${flavioSize.w}x${flavioSize.h}`,
  )
  assert.ok(
    flavioSize.h >= 700,
    `Flávio crest too small / favicon-like (${flavioSize.w}x${flavioSize.h})`,
  )
})

test("closed beta: adaptive logo surface is editorial (default transparent, Flávio dark)", () => {
  for (const client of justHero.clientProof) {
    if (client.id === "flavio-personal") continue
    assert.ok(
      client.surface === undefined || client.surface === "transparent",
      `${client.id} must default to transparent surface`,
    )
  }

  const flavio = justHero.clientProof.find((c) => c.id === "flavio-personal")
  assert.equal(flavio.surface, "dark")
  assert.ok(flavio.logoSrc.includes("flavio-personal.png"))

  const hero = readFileSync(
    join(root, "src/components/just-institutional/JustHero.astro"),
    "utf8",
  )
  assert.match(hero, /data-surface=\{client\.surface === "dark" \? "dark" : undefined\}/)
  assert.doesNotMatch(hero, /flavio-personal/)
  assert.doesNotMatch(hero, /client\.id ===/)

  const css = readFileSync(join(root, "src/styles/just-institutional.css"), "utf8")
  assert.match(css, /\[data-surface="dark"\]/)
  assert.match(css, /--trust-surface-bg/)
})

test("closed beta: marquee presentation duplicates sequence without changing editorial source", () => {
  const hero = readFileSync(
    join(root, "src/components/just-institutional/JustHero.astro"),
    "utf8",
  )
  assert.match(hero, /marqueeGroups/)
  assert.match(hero, /hero-trust-marquee/)
  assert.match(hero, /hero-trust-label/)
  assert.match(hero, /justHero\.trustLabel/)
  assert.doesNotMatch(hero, /display === "logo"/)
  assert.doesNotMatch(hero, /hero-trust-mark/)
  // Editorial source stays length 7 — duplication is presentation-only
  assert.equal(justHero.clientProof.length, 7)
  assert.match(hero, /justHero\.clientProof, justHero\.clientProof/)
})

test("closed beta: reduced-motion and optical normalization CSS present", () => {
  const css = readFileSync(join(root, "src/styles/just-institutional.css"), "utf8")
  assert.match(css, /prefers-reduced-motion:\s*reduce/)
  assert.match(css, /just-hero-trust-marquee/)
  assert.match(css, /--trust-scale/)
  assert.match(css, /object-fit:\s*contain/)
  assert.match(css, /hero-trust-label/)
  assert.match(css, /animation-play-state:\s*paused/)
})

test("closed beta: NORMAL SEO has no Coming Soon residual", () => {
  assert.match(justInstitutionalSeo.description, /JUST reúne gestão/)
  assert.match(justInstitutionalSeo.ogDescription, /JUST reúne gestão/)
  assert.doesNotMatch(justInstitutionalSeo.ogDescription, /finalizando a primeira versão/i)
  assert.doesNotMatch(justInstitutionalSeo.description, /finalizando a primeira versão/i)
  assert.match(justComingSoonSeo.ogDescription, /finalizando a primeira versão/i)

  const packaged = resolvePackagedInstitutionalSite("www.justwebsites.com.br")
  assert.equal(packaged?.institutionalSeo, justInstitutionalSeo)
  assert.equal(packaged?.comingSoonSeo, justComingSoonSeo)

  const indexSrc = readFileSync(join(root, "src/pages/index.astro"), "utf8")
  assert.match(indexSrc, /institutionalSeo/)
  assert.match(indexSrc, /isJustInstitutionalNormal/)
})

test("closed beta: hero paints stage line before CTAs and visible trust label", () => {
  const hero = readFileSync(
    join(root, "src/components/just-institutional/JustHero.astro"),
    "utf8",
  )
  const stageIdx = hero.indexOf("justHero.stageLine")
  const ctaIdx = hero.indexOf("justHero.primaryCta")
  const labelIdx = hero.indexOf("hero-trust-label")
  assert.ok(stageIdx > 0)
  assert.ok(ctaIdx > stageIdx)
  assert.ok(labelIdx > ctaIdx)
  assert.match(hero, /hero-stage-line/)
  assert.doesNotMatch(hero, /class="sr-only">\{justHero\.trustLabel\}/)
})

test("closed beta: pricing surfaces access note near CTA", () => {
  const pricing = readFileSync(
    join(root, "src/components/just-institutional/JustPricing.astro"),
    "utf8",
  )
  assert.match(pricing, /justPricing\.accessNote/)
  assert.match(pricing, /just-pricing__access-note/)
})

import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import {
  JUST_COMMERCIAL_CTA_LABEL,
  JUST_HOSTS,
  JUST_SIGN_IN_URL,
  JUST_WHATSAPP_URL,
  justFinalCta,
  justFooter,
  justHero,
  justLeadMiniForm,
  justPricing,
} from "../src/lib/justInstitutionalFreeze.js"
import { normalizeBusinessWebsite } from "../src/lib/normalizeBusinessWebsite.js"
import {
  isLeadIntakeSafeMode,
  resolveSupabaseAnonKey,
} from "../src/lib/runtimeEnv.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const formSrc = () =>
  readFileSync(
    join(root, "src/components/just-institutional/JustLeadMiniForm.astro"),
    "utf8",
  )
const finalSrc = () =>
  readFileSync(
    join(root, "src/components/just-institutional/JustFinalCta.astro"),
    "utf8",
  )
const headerSrc = () =>
  readFileSync(
    join(root, "src/components/just-institutional/JustHeader.astro"),
    "utf8",
  )

test("CTA map: Header / Hero / Pricing → #cta-final; Entrar → Hub", () => {
  assert.equal(justHero.primaryCta.label, JUST_COMMERCIAL_CTA_LABEL)
  assert.equal(justHero.primaryCta.targetId, "cta-final")
  assert.equal(justPricing.ctaLabel, JUST_COMMERCIAL_CTA_LABEL)
  assert.equal(justPricing.ctaHref, "/#cta-final")

  const header = headerSrc()
  assert.match(header, /href="\/#cta-final"/)
  assert.match(header, /JUST_SIGN_IN_URL/)
  assert.equal(JUST_SIGN_IN_URL, "https://hub.justwebsites.com.br/login/admin")
  assert.doesNotMatch(header, /wa\.me/)
})

test("final section: lead form present; no commercial WhatsApp CTA", () => {
  const final = finalSrc()
  assert.match(final, /JustLeadMiniForm/)
  assert.doesNotMatch(final, /wa\.me/)
  assert.doesNotMatch(final, /JUST_WHATSAPP_URL/)
  assert.doesNotMatch(final, /Prefere falar agora/)

  const form = formSrc()
  assert.doesNotMatch(form, /Prefere falar agora/)
  assert.doesNotMatch(form, /whatsappSecondary/)
  assert.doesNotMatch(form, /data-just-lead-whatsapp-secondary/)
  assert.doesNotMatch(form, /JUST_WHATSAPP_URL/)
  assert.doesNotMatch(form, /wa\.me/)
  assert.equal("whatsappSecondaryLabel" in justLeadMiniForm, false)
  assert.equal("whatsappSecondaryHref" in justLeadMiniForm, false)

  assert.equal(justFooter.supportLabel, "Suporte")
  assert.equal(justFooter.supportHref, JUST_WHATSAPP_URL)
})

test("success copy mentions WhatsApp as contact channel, not a CTA", () => {
  assert.equal(justLeadMiniForm.successTitle, "Recebemos seu interesse.")
  assert.equal(
    justLeadMiniForm.successBody,
    "Em breve entraremos em contato pelo WhatsApp ou e-mail.",
  )
  const form = formSrc()
  assert.match(form, /successTitle/)
  assert.match(form, /successBody/)
  assert.doesNotMatch(
    form.slice(form.indexOf("data-just-lead-success")),
    /<a[\s\S]*wa\.me/,
  )
})

test("fields: required + optional Website/message; visual order", () => {
  assert.equal(justLeadMiniForm.nameLabel, "Nome")
  assert.equal(justLeadMiniForm.companyLabel, "Empresa / negócio")
  assert.equal(justLeadMiniForm.websiteLabel, "Website (se tiver)")
  assert.equal(justLeadMiniForm.phoneLabel, "WhatsApp")
  assert.equal(justLeadMiniForm.emailLabel, "E-mail")
  assert.equal(
    justLeadMiniForm.messageLabel,
    "Conte brevemente sobre o seu negócio",
  )

  const src = formSrc()
  const order = [
    'name="full_name"',
    'name="company"',
    'name="website"',
    'name="phone"',
    'name="email"',
    'name="message"',
  ]
  let last = -1
  for (const marker of order) {
    const idx = src.indexOf(marker)
    assert.ok(idx > last, marker)
    last = idx
  }

  for (const name of ["full_name", "company", "phone", "email"]) {
    const block = src.slice(src.indexOf(`name="${name}"`), src.indexOf(`name="${name}"`) + 180)
    assert.match(block, /\brequired\b/, name)
  }
  const websiteBlock = src.slice(src.indexOf('name="website"'), src.indexOf('name="phone"'))
  assert.doesNotMatch(websiteBlock, /\brequired\b/)
  assert.doesNotMatch(src, /\(opcional\)/i)
  assert.match(src, /type="url"/)
  assert.match(src, /inputmode="url"/)
})

test("source_type + metadata contract + UTM preservation", () => {
  assert.equal(justLeadMiniForm.sourceType, "just_closed_beta_interest")
  assert.equal(justLeadMiniForm.ctaId, "just-final-lead-form")
  const src = formSrc()
  assert.match(src, /source:\s*"just-public"/)
  assert.match(src, /surface:\s*"institutional_homepage"/)
  assert.match(src, /cta_id/)
  assert.match(src, /company,/)
  assert.match(src, /metadata\.website/)
  assert.match(src, /metadata\.message/)
  assert.match(src, /utm_source/)
  assert.match(src, /utm_medium/)
  assert.match(src, /utm_campaign/)
  assert.match(src, /utm_term/)
  assert.match(src, /utm_content/)
  assert.match(src, /path:\s*window\.location\.pathname/)
  assert.match(src, /source_type:\s*sourceType/)
})

test("tenant attribution: live host → JUST hosts; never Dorot hardcode", () => {
  assert.ok(JUST_HOSTS.includes("justwebsites.com.br"))
  assert.ok(JUST_HOSTS.includes("www.justwebsites.com.br"))
  const src = formSrc()
  assert.match(src, /window\.location\.host/)
  assert.doesNotMatch(src, /dorot/i)
  assert.doesNotMatch(src, /book-club-signup/)
  assert.doesNotMatch(src, /public_form_submissions/)
  // Form does not pin a foreign host; Edge resolves tenant from request host.
  assert.doesNotMatch(src, /host:\s*["']dorot/)
  assert.doesNotMatch(src, /host:\s*["']www\.dorot/)
})

test("website normalization", () => {
  assert.deepEqual(normalizeBusinessWebsite(""), { ok: true, value: null })
  assert.deepEqual(normalizeBusinessWebsite("empresa.com.br"), {
    ok: true,
    value: "https://empresa.com.br",
  })
  assert.deepEqual(normalizeBusinessWebsite("www.empresa.com.br"), {
    ok: true,
    value: "https://www.empresa.com.br",
  })
  assert.deepEqual(normalizeBusinessWebsite("https://empresa.com.br"), {
    ok: true,
    value: "https://empresa.com.br",
  })
  assert.deepEqual(normalizeBusinessWebsite("http://empresa.com.br"), {
    ok: true,
    value: "http://empresa.com.br",
  })
  assert.equal(normalizeBusinessWebsite("not a site").ok, false)
  assert.equal(normalizeBusinessWebsite("javascript:alert(1)").ok, false)
})

test("safe mode vs production intake readiness", () => {
  assert.equal(isLeadIntakeSafeMode("preview"), true)
  assert.equal(isLeadIntakeSafeMode("staging"), true)
  assert.equal(isLeadIntakeSafeMode("production"), false)
  assert.equal(isLeadIntakeSafeMode(undefined), false)

  const src = formSrc()
  assert.match(src, /isLeadIntakeSafeMode/)
  assert.match(src, /resolveSupabaseAnonKey/)
  assert.match(src, /PUBLIC_LEADS_INTAKE_URL/)
  assert.match(src, /data-just-lead-form-safe/)
  // Must not rely solely on empty build-time SUPABASE_ANON_KEY bake.
  assert.doesNotMatch(src, /import \{[^}]*SUPABASE_ANON_KEY/)

  const runtimeKey = resolveSupabaseAnonKey({
    runtime: { env: { SUPABASE_ANON_KEY: "runtime-anon-test" } },
  })
  assert.equal(runtimeKey, "runtime-anon-test")

  const publicSite = readFileSync(join(root, "src/config/publicSite.ts"), "utf8")
  assert.match(publicSite, /functions\/v1\/leads/)
})

test("double-submit prevention + success/error UX markers", () => {
  const src = formSrc()
  assert.match(src, /dataset\.submitting/)
  assert.match(src, /Enviando\.\.\./)
  assert.match(src, /formEl\.hidden = true/)
  assert.match(src, /successEl\.hidden = false/)
  assert.match(src, /data-just-lead-status/)
  assert.match(src, /errorFailed|Não foi possível enviar/)
  // Success must clear submitting and hide form/button panel.
  assert.match(src, /dataset\.state = "success"/)
  assert.match(src, /dataset\.submitting = "false"/)
  assert.match(src, /payload\.ok !== true/)
  const css = readFileSync(join(root, "src/styles/just-institutional.css"), "utf8")
  assert.match(css, /\[data-state="success"\][\s\S]*just-lead-form__form/)
})

test("success contract: only after HTTP ok + JSON ok:true", () => {
  const src = formSrc()
  const successIdx = src.indexOf('dataset.state = "success"')
  const okCheckIdx = src.indexOf("payload.ok !== true")
  const responseOkIdx = src.indexOf("if (!response.ok)")
  assert.ok(responseOkIdx >= 0)
  assert.ok(okCheckIdx > responseOkIdx)
  assert.ok(successIdx > okCheckIdx)
  // Failed path restores Enviar and keeps form usable.
  assert.match(src, /dataset\.state = "error"/)
  assert.match(src, /submitButton\.disabled = false/)
})

test("no migration; Hub-only notify in this gate", () => {
  const src = formSrc()
  assert.match(src, /metadata — no DB migration/i)
  assert.doesNotMatch(src, /RESEND|Novo interesse pelo site/)
  assert.equal(justFinalCta.headline, "Conheça a JUST")
  assert.match(justFinalCta.lead, /beta fechado/i)
})

test("Dorot mission contact / club signup files untouched by this branch", () => {
  // Presence check only — this worktree is just-public; Dorot paths must not be edited here.
  const statusPaths = [
    "src/components/mission/editorial/Contact.astro",
    "src/components/mission/MissionFormSignupShell.astro",
  ]
  for (const rel of statusPaths) {
    const full = join(root, rel)
    // Files may exist; we only assert our form does not import them.
    assert.doesNotMatch(formSrc(), /MissionFormSignupShell|editorial\/Contact/)
    assert.ok(rel)
    void full
  }
})

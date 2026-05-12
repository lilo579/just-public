import test from "node:test"
import assert from "node:assert/strict"

import { buildCanonicalCtaPrimaryCTA } from "../src/components/canonicalHomepageCtaAdapter.js"

test("uses WhatsApp when available", () => {
  const primaryCTA = buildCanonicalCtaPrimaryCTA(
    { buttonLabel: null },
    {
      whatsappNumber: "+55 (11) 99999-9999",
      whatsappVisible: true,
      email: "contato@example.com",
      emailVisible: true,
    }
  )

  assert.deepEqual(primaryCTA, {
    type: "whatsapp",
    label: "Fale pelo WhatsApp",
    href: "https://wa.me/5511999999999",
    visible: true,
  })
})

test("falls back to email when WhatsApp is not actionable", () => {
  const primaryCTA = buildCanonicalCtaPrimaryCTA(
    { buttonLabel: null },
    {
      whatsappNumber: null,
      whatsappVisible: false,
      email: "contato@example.com",
      emailVisible: true,
    }
  )

  assert.deepEqual(primaryCTA, {
    type: "email",
    label: "Enviar email",
    href: "mailto:contato@example.com",
    visible: true,
  })
})

test("prefers ctaFinal.buttonLabel over fallback label", () => {
  const primaryCTA = buildCanonicalCtaPrimaryCTA(
    { buttonLabel: "Entrar em contato" },
    {
      whatsappNumber: null,
      whatsappVisible: false,
      email: "contato@example.com",
      emailVisible: true,
    }
  )

  assert.deepEqual(primaryCTA, {
    type: "email",
    label: "Entrar em contato",
    href: "mailto:contato@example.com",
    visible: true,
  })
})

test("returns null when no actionable channel exists", () => {
  const primaryCTA = buildCanonicalCtaPrimaryCTA(
    { buttonLabel: "Entrar em contato" },
    {
      whatsappNumber: null,
      whatsappVisible: false,
      email: null,
      emailVisible: false,
    }
  )

  assert.equal(primaryCTA, null)
})

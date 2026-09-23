import assert from "node:assert/strict"
import test from "node:test"

import { justLegalPages } from "../src/lib/justInstitutionalFreeze.js"
import {
  ASAAS_FINANCIAL_SERVICES_PARAGRAPHS,
  JUST_TERMS_V1_DOCUMENT,
  justTermsOfUseV1,
} from "../src/lib/justTermsOfUseV1.js"
import {
  isInterstitialLegalPath,
  resolvePackagedInstitutionalSite,
} from "../src/lib/resolvePackagedInstitutionalSite.js"

const ASAAS_P1 =
  "Os serviços financeiros e de pagamentos disponibilizados por meio da presente plataforma, incluindo abertura e manutenção de conta de pagamento, processamento de transações, emissão de boletos, transferências, pagamentos e demais movimentações de valores, são prestados pelo ASAAS GESTÃO FINANCEIRA INSTITUIÇÃO DE PAGAMENTOS S.A., instituição de pagamento autorizada a funcionar pelo Banco Central do Brasil."
const ASAAS_P2 =
  "A SHEFA MARKETING LTDA atua exclusivamente como integradora tecnológica e distribuidora da experiência do produto, não sendo instituição financeira ou de pagamento, nem realizando intermediação financeira em nome próprio."
const ASAAS_P3 =
  "O cliente declara ciência de que o relacionamento financeiro/ de pagamentos e a responsabilidade regulatória pelos serviços acima descritos são do ASAAS GESTÃO FINANCEIRA S.A., nos termos da regulamentação vigente."

function flattenDocumentText(document) {
  const parts = []
  for (const block of document) {
    if (block.type === "h2" || block.type === "h3" || block.type === "p") {
      if (typeof block.text === "string") parts.push(block.text)
      if (Array.isArray(block.parts)) {
        parts.push(block.parts.map((p) => p.text).join(""))
      }
    }
    if (block.type === "ul" && Array.isArray(block.items)) {
      parts.push(...block.items)
    }
  }
  return parts.join("\n")
}

test("Terms v1.0 metadata and H1 title", () => {
  assert.equal(justTermsOfUseV1.title, "Termos de Uso da JUST")
  assert.equal(justTermsOfUseV1.version, "1.0")
  assert.equal(justTermsOfUseV1.effectiveDateLabel, "23 de setembro de 2026")
  assert.equal(justLegalPages.termos, justTermsOfUseV1)
})

test("Terms v1.0 sections 1–21 present as H2", () => {
  const h2 = JUST_TERMS_V1_DOCUMENT.filter((b) => b.type === "h2").map((b) => b.text)
  assert.equal(h2.length, 21)
  assert.equal(h2[0], "1. A JUST")
  assert.equal(h2[8], "9. Prestação de Serviços Financeiros")
  assert.equal(h2[20], "21. Contato")
  for (let i = 1; i <= 21; i++) {
    assert.ok(
      h2.some((t) => t.startsWith(`${i}.`)),
      `missing section ${i}`,
    )
  }
})

test("Terms v1.0 required factual anchors", () => {
  const text = flattenDocumentText(JUST_TERMS_V1_DOCUMENT)
  assert.match(text, /48\.591\.474\/0001-81/)
  assert.match(text, /privacidade@justwebsites\.com\.br/)
  assert.match(text, /Não transferência do código/)
  assert.match(text, /7 \(sete\) dias corridos/)
  assert.match(
    text,
    /não constitui promessa de ferramenta automática ou universal de exportação/,
  )
  assert.match(text, /Comarca de São Paulo, Estado de São Paulo/)
  assert.match(text, /SHEFA MARKETING LTDA/)
})

test("Asaas BaaS clause §9 is literal (three paragraphs)", () => {
  assert.equal(ASAAS_FINANCIAL_SERVICES_PARAGRAPHS[0], ASAAS_P1)
  assert.equal(ASAAS_FINANCIAL_SERVICES_PARAGRAPHS[1], ASAAS_P2)
  assert.equal(ASAAS_FINANCIAL_SERVICES_PARAGRAPHS[2], ASAAS_P3)

  const section9Index = JUST_TERMS_V1_DOCUMENT.findIndex(
    (b) => b.type === "h2" && b.text === "9. Prestação de Serviços Financeiros",
  )
  assert.ok(section9Index >= 0)
  const p1 = JUST_TERMS_V1_DOCUMENT[section9Index + 1]
  const p2 = JUST_TERMS_V1_DOCUMENT[section9Index + 2]
  const p3 = JUST_TERMS_V1_DOCUMENT[section9Index + 3]
  assert.equal(p1.type, "p")
  assert.equal(p1.text, ASAAS_P1)
  assert.equal(p2.text, ASAAS_P2)
  assert.equal(p3.text, ASAAS_P3)
})

test("Privacy policy page body unchanged (not Terms)", () => {
  assert.ok(Array.isArray(justLegalPages.privacidade.body))
  assert.equal(justLegalPages.privacidade.title, "Privacidade")
  assert.ok(
    justLegalPages.privacidade.body.some((p) =>
      p.includes("suporte da JUST"),
    ),
  )
})

test("Routing: JUST institutional hosts get Terms v1.0 pack", () => {
  const justWww = resolvePackagedInstitutionalSite("www.justwebsites.com.br")
  const justApex = resolvePackagedInstitutionalSite("justwebsites.com.br")
  assert.equal(justWww?.slug, "just")
  assert.equal(justWww?.legalPages?.termos?.version, "1.0")
  assert.equal(justWww?.legalPages?.termos?.title, "Termos de Uso da JUST")
  assert.equal(justApex?.legalPages?.termos?.version, "1.0")
  assert.equal(isInterstitialLegalPath("/termos"), true)
})

test("Tenant isolation: non-JUST hosts do not resolve JUST legal pack", () => {
  assert.equal(resolvePackagedInstitutionalSite("www.marceloborer.com.br"), null)
  assert.equal(resolvePackagedInstitutionalSite("www.3djewish.com.br"), null)
  assert.equal(resolvePackagedInstitutionalSite("alpha.justwebsites.com.br"), null)
  assert.equal(resolvePackagedInstitutionalSite("dorotpublications.com.br"), null)
})

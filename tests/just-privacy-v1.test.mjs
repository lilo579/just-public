import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

import { justLegalPages } from "../src/lib/justInstitutionalFreeze.js"
import {
  JUST_PRIVACY_V1_DOCUMENT,
  justPrivacyPolicyV1,
} from "../src/lib/justPrivacyPolicyV1.js"
import {
  ASAAS_FINANCIAL_SERVICES_PARAGRAPHS,
  JUST_TERMS_V1_DOCUMENT,
  justTermsOfUseV1,
} from "../src/lib/justTermsOfUseV1.js"
import {
  isInterstitialLegalPath,
  resolvePackagedInstitutionalSite,
} from "../src/lib/resolvePackagedInstitutionalSite.js"

const PAN_CVV =
  "A JUST não possui campos próprios destinados ao armazenamento de números completos de cartão (PAN) ou códigos de segurança (CVV)."
const NO_DATA_SALE =
  "A JUST não comercializa dados pessoais como atividade de venda de bases de dados."

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

test("Privacy v1.0 metadata and H1 title", () => {
  assert.equal(justPrivacyPolicyV1.title, "Política de Privacidade da JUST")
  assert.equal(justPrivacyPolicyV1.version, "1.0")
  assert.equal(justPrivacyPolicyV1.effectiveDateLabel, "23 de setembro de 2026")
  assert.equal(justLegalPages.privacidade, justPrivacyPolicyV1)
})

test("Privacy page uses shared Atualizado em metadata label", () => {
  const layout = readFileSync(
    new URL("../src/components/just-institutional/JustLegalLayout.astro", import.meta.url),
    "utf8",
  )
  assert.match(layout, /Atualizado em: \{effectiveDateLabel\}/)
  assert.equal(layout.includes("Vigência:"), false)
})

test("Privacy v1.0 has exactly 18 main H2 sections", () => {
  const h2 = JUST_PRIVACY_V1_DOCUMENT.filter((b) => b.type === "h2").map(
    (b) => b.text,
  )
  assert.equal(h2.length, 18)
  assert.equal(h2[0], "1. A quem esta Política se aplica")
  assert.equal(h2[17], "18. Contato")
  for (let i = 1; i <= 18; i++) {
    assert.ok(
      h2.some((t) => t.startsWith(`${i}.`)),
      `missing section ${i}`,
    )
  }
})

test("Privacy v1.0 required section headings", () => {
  const h2 = new Set(
    JUST_PRIVACY_V1_DOCUMENT.filter((b) => b.type === "h2").map((b) => b.text),
  )
  const h3 = new Set(
    JUST_PRIVACY_V1_DOCUMENT.filter((b) => b.type === "h3").map((b) => b.text),
  )
  assert.ok(h3.has("2.6. Dados financeiros e transacionais"))
  assert.ok(h2.has("3. Dados relacionados à integração com o Asaas"))
  assert.ok(h2.has("6. Dados tratados em nome dos Clientes"))
  assert.ok(
    h2.has("8. Cookies, armazenamento local e tecnologias semelhantes"),
  )
  assert.ok(h2.has("9. Transferências e processamento internacional"))
  assert.ok(h2.has("11. Retenção dos dados"))
  assert.ok(h2.has("12. Direitos dos titulares"))
  assert.ok(h2.has("14. Crianças e adolescentes"))
  assert.ok(h2.has("18. Contato"))
})

test("Privacy v1.0 required factual anchors", () => {
  const text = flattenDocumentText(JUST_PRIVACY_V1_DOCUMENT)
  assert.match(text, /SHEFA MARKETING LTDA/)
  assert.match(text, /48\.591\.474\/0001-81/)
  assert.match(text, /privacidade@justwebsites\.com\.br/)
  assert.ok(text.includes(PAN_CVV))
  assert.ok(text.includes(NO_DATA_SALE))
  assert.match(text, /Supabase/)
  assert.match(text, /Cloudflare/)
  assert.match(text, /Asaas/)
  assert.match(text, /como Google/)
})

test("Privacy v1.0 rejects unapproved absolute claims", () => {
  const text = flattenDocumentText(JUST_PRIVACY_V1_DOCUMENT)
  assert.equal(text.includes("backups diários"), false)
  assert.equal(text.includes("PITR"), false)
  assert.equal(text.includes("wipe automático"), false)
  assert.equal(text.includes("exportação universal"), false)
  assert.equal(text.includes("LGPD certified"), false)
  assert.equal(text.includes("100% seguro"), false)
  assert.ok(
    text.includes(
      "Nenhum sistema conectado à internet pode garantir segurança absoluta",
    ),
  )
})

test("Tenant isolation: Privacy pack only on JUST hosts", () => {
  const justWww = resolvePackagedInstitutionalSite("www.justwebsites.com.br")
  assert.equal(justWww?.legalPages?.privacidade?.version, "1.0")
  assert.equal(
    justWww?.legalPages?.privacidade?.title,
    "Política de Privacidade da JUST",
  )
  assert.equal(isInterstitialLegalPath("/privacidade"), true)
  assert.equal(resolvePackagedInstitutionalSite("www.marceloborer.com.br"), null)
  assert.equal(resolvePackagedInstitutionalSite("www.3djewish.com.br"), null)
  assert.equal(resolvePackagedInstitutionalSite("alpha.justwebsites.com.br"), null)
  assert.equal(resolvePackagedInstitutionalSite("dorotpublications.com.br"), null)
})

test("Terms v1.0 regression: metadata and Asaas BaaS clause untouched", () => {
  assert.equal(justTermsOfUseV1.title, "Termos de Uso da JUST")
  assert.equal(justTermsOfUseV1.version, "1.0")
  assert.equal(justLegalPages.termos, justTermsOfUseV1)

  assert.equal(ASAAS_FINANCIAL_SERVICES_PARAGRAPHS[0], ASAAS_P1)
  assert.equal(ASAAS_FINANCIAL_SERVICES_PARAGRAPHS[1], ASAAS_P2)
  assert.equal(ASAAS_FINANCIAL_SERVICES_PARAGRAPHS[2], ASAAS_P3)

  const section9Index = JUST_TERMS_V1_DOCUMENT.findIndex(
    (b) => b.type === "h2" && b.text === "9. Prestação de Serviços Financeiros",
  )
  assert.ok(section9Index >= 0)
  assert.equal(JUST_TERMS_V1_DOCUMENT[section9Index + 1].text, ASAAS_P1)
  assert.equal(JUST_TERMS_V1_DOCUMENT[section9Index + 2].text, ASAAS_P2)
  assert.equal(JUST_TERMS_V1_DOCUMENT[section9Index + 3].text, ASAAS_P3)
})

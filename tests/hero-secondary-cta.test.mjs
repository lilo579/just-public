import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

test("HeroBlock renders secondary CTA class and supports Conhecer o Clube label path", () => {
  const src = readFileSync(
    join(ROOT, "src/components/blocks/HeroBlock.astro"),
    "utf8",
  )
  assert.match(src, /secondaryCTA/)
  assert.match(src, /hero__cta--secondary/)
  assert.match(src, /hero__cta-row/)
  assert.match(src, /f1-cta--outline-on-dark/)
  assert.match(src, /hero-secondary-cta/)
})

test("homepage contract includes optional secondaryCTA on HeroBlock", () => {
  const src = readFileSync(join(ROOT, "src/contracts/homepage.ts"), "utf8")
  assert.match(src, /secondaryCTA\?:/)
})

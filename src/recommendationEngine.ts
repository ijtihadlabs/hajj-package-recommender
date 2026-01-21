import { MINA_CAPACITY } from './models'
import type {
  HajjPackage,
  Preferences,
  Recommendation,
  MakkahZone,
  MinaCamp,
  OccupancyType
} from './models'

/** Majr AlKabsh camp upgrade fee (per person) */
const MAJR_UPGRADE_FEE_SAR = 4673.42

/* =========================
   Helpers
   ========================= */

function zoneScore(preferred: MakkahZone, actual: MakkahZone): number {
  if (preferred === actual) return 1

  const order: MakkahZone[] = ['A', 'B', 'C', 'M']
  const p = order.indexOf(preferred)
  const a = order.indexOf(actual)

  if (p === -1 || a === -1) return 0
  return Math.max(0, 1 - Math.abs(p - a) * 0.25)
}

function campScore(preferred: MinaCamp, actual: MinaCamp): number {
  return preferred === actual ? 1 : 0
}

function parseISO(d: string | undefined): number | undefined {
  if (!d) return undefined
  const t = Date.parse(d)
  return Number.isFinite(t) ? t : undefined
}

function majrFee(pkg: HajjPackage): number {
  return pkg.minaCamp === 'majr' ? MAJR_UPGRADE_FEE_SAR : 0
}

function occupancyAvailable(pkg: HajjPackage, occ: OccupancyType): boolean {
  if (occ === 'quad') return true // base price baseline always exists

  const fee =
    occ === 'double'
      ? pkg.upgradeFees?.makkah?.double ??
        pkg.upgradeFees?.madinah?.double ??
        pkg.upgradeFees?.aziziya?.double
      : pkg.upgradeFees?.makkah?.triple ??
        pkg.upgradeFees?.madinah?.triple ??
        pkg.upgradeFees?.aziziya?.triple

  return typeof fee === 'number' && fee > 0
}

/**
 * Option A pricing:
 * - Keep basePriceSAR as listed price
 * - Add Majr upgrade fee ONLY if package is Majr
 * - Add occupancy upgrade fees (sum by city when provided)
 */
function priceForOccupancy(pkg: HajjPackage, occ: OccupancyType): number | undefined {
  const base = pkg.basePriceSAR
  if (!base || base <= 0) return undefined

  const campUpgrade = majrFee(pkg)

  if (occ === 'quad') return base + campUpgrade

  const fees = pkg.upgradeFees
  if (!fees) return undefined

  const get = (n?: number) => (typeof n === 'number' && n > 0 ? n : 0)

  if (occ === 'double') {
    const total =
      get(fees.makkah?.double) + get(fees.madinah?.double) + get(fees.aziziya?.double)
    return total > 0 ? base + campUpgrade + total : undefined
  }

  const total =
    get(fees.makkah?.triple) + get(fees.madinah?.triple) + get(fees.aziziya?.triple)
  return total > 0 ? base + campUpgrade + total : undefined
}

/* =========================
   Scoring (value-first)
   ========================= */

function scorePreferences(pkg: HajjPackage, prefs: Preferences): { score: number; max: number } {
  let score = 0
  let max = 0

  if (prefs.provider && prefs.provider !== 'any') {
    max += 1
    if (pkg.provider === prefs.provider) score += 1
  }

  const firstStay = pkg.hotels[0]?.city
  const lastStay = pkg.hotels[pkg.hotels.length - 1]?.city

  if (prefs.firstStay && prefs.firstStay !== 'any') {
    max += 1
    if (firstStay === prefs.firstStay) score += 1
  }

  if (prefs.lastStay && prefs.lastStay !== 'any') {
    max += 1
    if (lastStay === prefs.lastStay) score += 1
  }

  if (prefs.makkahZone && prefs.makkahZone !== 'any') {
    max += 1
    score += zoneScore(prefs.makkahZone as MakkahZone, pkg.makkahZone)
  }

  if (prefs.minaCamp && prefs.minaCamp !== 'any') {
    max += 1
    score += campScore(prefs.minaCamp as MinaCamp, pkg.minaCamp)
  }

  if (prefs.shifting && prefs.shifting !== 'any') {
    max += 1
    const matches =
      (prefs.shifting === 'shifting' && pkg.isShifting) ||
      (prefs.shifting === 'non-shifting' && !pkg.isShifting)
    if (matches) score += 1
  }

  if (prefs.startDate && prefs.endDate) {
    max += 1
    const uStart = parseISO(prefs.startDate)
    const uEnd = parseISO(prefs.endDate)
    const pStart = parseISO(pkg.startDate)
    const pEnd = parseISO(pkg.endDate)

    if (uStart && uEnd && pStart && pEnd) {
      const within = pStart >= uStart && pEnd <= uEnd
      if (within) score += 1
      else {
        const dist = Math.min(Math.abs(pStart - uStart), Math.abs(pEnd - uEnd))
        const days = dist / (1000 * 60 * 60 * 24)
        score += Math.max(0, 1 - days / 14)
      }
    }
  }

  if (prefs.durationDays && prefs.durationDays > 0) {
    max += 1
    const diff = Math.abs(pkg.durationDays - prefs.durationDays)
    score += Math.max(0, 1 - diff / 3)
  }

  return { score, max }
}

function scoreValueQuality(pkg: HajjPackage): number {
  let score = 0

  if (pkg.minaCamp === 'majr') score += 1
  else if (pkg.minaCamp === 'muaisim') score += 0.6

  if (pkg.makkahZone === 'A') score += 1
  else if (pkg.makkahZone === 'B') score += 0.7
  else if (pkg.makkahZone === 'C') score += 0.4
  else if (pkg.makkahZone === 'M') score += 0.2

  if (pkg.isShifting) score += 0.5

  if (pkg.hotels.length >= 2) score += 0.2

  if (pkg.flight?.priceSAR && pkg.flight.priceSAR > 0) score += 0.15

  return Math.min(score / 3, 1)
}

/**
 * Budget fit is NOT "cheapest wins".
 * Best score is near target, mild penalty if far under,
 * and increasing penalty when over.
 */
function scoreBudgetFit(pricePerPersonSAR: number, prefs: Preferences): number {
  const target = prefs.budgetAmount / Math.max(1, prefs.hujjajCount)
  if (target <= 0) return 0

  const ratio = pricePerPersonSAR / target

  if (ratio <= 1) return Math.max(0.6, ratio)

  return Math.max(0, 1 - (ratio - 1))
}

function scarcityPenalty(pkg: HajjPackage): number {
  const cap = MINA_CAPACITY[pkg.minaCamp]
  if (!cap) return 0
  return pkg.minaCamp === 'majr' ? 0.15 : 0
}

/* =========================
   Public API
   ========================= */

export function recommendPackages(packages: HajjPackage[], prefs: Preferences): Recommendation[] {
  const results: Recommendation[] = []

  for (const pkg of packages) {
    let occ: OccupancyType = 'quad'

    if (prefs.occupancy && prefs.occupancy !== 'any') {
      occ = prefs.occupancy
      if (!occupancyAvailable(pkg, occ)) continue
    }

    const price = priceForOccupancy(pkg, occ)
    if (!price || price <= 0) continue

    const pref = scorePreferences(pkg, prefs)
    const prefScore = pref.max === 0 ? 0 : pref.score / pref.max
    const valueScore = scoreValueQuality(pkg)
    const budgetScore = scoreBudgetFit(price, prefs)
    const scarcity = scarcityPenalty(pkg)

    const total = prefScore * 0.6 + valueScore * 0.25 + budgetScore * 0.15 - scarcity

    const reasons: string[] = []
    if (prefScore > 0.75) reasons.push('Strong match to your preferences')
    if (pkg.minaCamp === 'majr') {
      reasons.push(`Majr AlKabsh (includes +${MAJR_UPGRADE_FEE_SAR.toFixed(2)} SAR pp camp upgrade)`)
      reasons.push('Majr AlKabsh (high quality, very limited capacity)')
    }
    if (pkg.minaCamp === 'muaisim') reasons.push('Al Muaisim (high capacity)')
    if (pkg.isShifting) reasons.push('Shifting structure (often better value)')
    if (budgetScore > 0.85) reasons.push('Close to your target budget')

    results.push({
      pkg,
      totalScore: Number(total.toFixed(3)),
      breakdown: {
        preferenceMatch: prefScore,
        valueQuality: valueScore,
        budgetFit: budgetScore,
        scarcityPenalty: scarcity
      },
      reasons
    })
  }

  return results.sort((a, b) => b.totalScore - a.totalScore).slice(0, 5)
}

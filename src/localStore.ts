import type { HajjPackage } from './models'

/**
 * Local-only storage contract
 *
 * - Preloaded packages are NEVER modified
 * - User edits are stored as overrides keyed by package id
 * - User-added packages are stored separately
 * - Saved/Favourites are stored as a list of package ids (max 5)
 * - Nothing is uploaded or shared
 */

const OVERRIDES_KEY = 'hajj_pkg_overrides_v1'
const USER_PACKAGES_KEY = 'hajj_user_packages_v1'
const FAVOURITES_KEY = 'hajj_pkg_favourites_v1'
const MAX_FAVOURITES = 5

type PackageOverride = Partial<HajjPackage>

/* ---------- Stable key for dedupe ---------- */

export function packageDedupeKey(
  p: Pick<HajjPackage, 'provider' | 'packageName' | 'startDate' | 'endDate'>
): string {
  const norm = (s: string) => (s ?? '').trim().toLowerCase()
  return `${norm(p.provider)}|${norm(p.packageName)}|${norm(p.startDate)}|${norm(p.endDate)}`
}

export function getUserPackageKeySet(): Set<string> {
  const pkgs = getUserPackages()
  const set = new Set<string>()
  for (const p of pkgs) set.add(packageDedupeKey(p))
  return set
}

/* ---------- Favourites (Saved) ---------- */

export function getFavouriteIds(): string[] {
  try {
    const raw = localStorage.getItem(FAVOURITES_KEY)
    if (!raw) return []
    const ids = JSON.parse(raw)
    return Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function isFavourite(id: string): boolean {
  return getFavouriteIds().includes(id)
}

/**
 * Toggle favourite with a hard limit.
 * Returns {ok:false, message} if the limit would be exceeded.
 */
export function toggleFavourite(id: string): { ok: boolean; message?: string } {
  const ids = getFavouriteIds()

  if (ids.includes(id)) {
    const next = ids.filter((x) => x !== id)
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next))
    return { ok: true }
  }

  if (ids.length >= MAX_FAVOURITES) {
    return { ok: false, message: `You can save up to ${MAX_FAVOURITES} packages.` }
  }

  const next = [...ids, id]
  localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next))
  return { ok: true }
}

export function clearFavourites(): void {
  localStorage.setItem(FAVOURITES_KEY, JSON.stringify([]))
}

/* ---------- Overrides (edits to preloaded packages) ---------- */

export function getPackageOverrides(): Record<string, PackageOverride> {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function savePackageOverride(packageId: string, override: PackageOverride) {
  const all = getPackageOverrides()
  all[packageId] = {
    ...all[packageId],
    ...override
  }
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(all))
}

export function clearPackageOverride(packageId: string) {
  const all = getPackageOverrides()
  delete all[packageId]
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(all))
}

/* ---------- User-added packages ---------- */

export function getUserPackages(): HajjPackage[] {
  try {
    const raw = localStorage.getItem(USER_PACKAGES_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function saveUserPackage(pkg: HajjPackage) {
  const pkgs = getUserPackages()
  pkgs.push(pkg)
  localStorage.setItem(USER_PACKAGES_KEY, JSON.stringify(pkgs))
}

export function updateUserPackage(pkg: HajjPackage) {
  const pkgs = getUserPackages()
  const idx = pkgs.findIndex((p) => p.id === pkg.id)
  if (idx >= 0) {
    pkgs[idx] = pkg
    localStorage.setItem(USER_PACKAGES_KEY, JSON.stringify(pkgs))
  }
}

export function deleteUserPackage(packageId: string) {
  const pkgs = getUserPackages().filter((p) => p.id !== packageId)
  localStorage.setItem(USER_PACKAGES_KEY, JSON.stringify(pkgs))
}

/* ---------- Merge helper ---------- */

export function mergePackages(preloaded: HajjPackage[]): {
  packages: HajjPackage[]
  editedIds: Set<string>
} {
  const overrides = getPackageOverrides()
  const editedIds = new Set(Object.keys(overrides))
  const userPkgs = getUserPackages()

  const mergedPreloaded = preloaded.map((pkg) => {
    const override = overrides[pkg.id]
    if (!override) return pkg
    return { ...pkg, ...override }
  })

  return { packages: [...mergedPreloaded, ...userPkgs], editedIds }
}

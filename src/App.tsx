import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

import PreferencesView from './PreferencesView'
import EditPackageModal from './EditPackageModal'
import AddPackageModal from './AddPackageModal'
import { recommendPackages } from './recommendationEngine'
import { loadPreloadedPackages } from './preloadedLoader'
import { loadAlternativePackages } from './preloadedLoaderAlternative'
import {
  mergePackages,
  packageDedupeKey,
  getUserPackageKeySet,
  saveUserPackage,
  getFavouriteIds,
  toggleFavourite
} from './localStore'
import { downloadTemplateCsv } from './template'
import { importTemplateCsv } from './importCsv'

import type { Preferences, HajjPackage } from './models'
import type { LoaderResult } from './preloadedLoader'

type Tab = 'home' | 'saved' | 'recommend' | 'packages' | 'packagePlus' | 'preferences'

type PackageFilters = {
  provider: string
  shifting: 'any' | 'shifting' | 'non-shifting'
  makkahZone: string
  durationDays: string
  startDate: string
  endDate: string
  makkahHotel: string
  madinahHotel: string
  minaCamp: 'any' | 'majr' | 'muaisim'
  minPrice: string
  maxPrice: string
  sort: 'none' | 'price-asc' | 'price-desc'
}

type RoomOccupancy = 'quad' | 'triple' | 'double'

type PackagePlusSelection = {
  hujjajCount: number
  minaCamp: 'muaisim' | 'majr'
  makkahOcc: RoomOccupancy
  madinahOcc: RoomOccupancy
  aziziyaOcc: RoomOccupancy
}

const MAJR_UPGRADE_FEE_SAR = 4673.42
const PREFS_KEY = 'hajj_prefs_v1'
const PACKAGE_PLUS_SELECTIONS_KEY = 'hajj_pkg_plus_selections_v1'

function formatSAR(n: number) {
  return `${Math.round(n).toLocaleString()} SAR`
}

function formatSAR2(n: number) {
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`
}

function campLabel(camp: HajjPackage['minaCamp']) {
  return camp === 'majr' ? 'Majr AlKabsh' : 'Al Muaisim'
}

/* ---------------- Totals helpers (read-only) ---------------- */

function majrFee(pkg: HajjPackage): number {
  return pkg.minaCamp === 'majr' ? MAJR_UPGRADE_FEE_SAR : 0
}

function sumUpgradeFees(pkg: HajjPackage, occ: 'double' | 'triple'): number {
  const fees = pkg.upgradeFees
  if (!fees) return 0
  const get = (n?: number) => (typeof n === 'number' && n > 0 ? n : 0)

  if (occ === 'double') {
    return get(fees.makkah?.double) + get(fees.madinah?.double) + get(fees.aziziya?.double)
  }
  return get(fees.makkah?.triple) + get(fees.madinah?.triple) + get(fees.aziziya?.triple)
}

function estimateFlightPerPersonSAR(pkg: HajjPackage): number | null {
  const fp = pkg.flight?.priceSAR
  if (typeof fp === 'number' && fp > 0) return fp
  return null
}

function occupancyLabel(prefs: Preferences): 'quad' | 'double' | 'triple' {
  if (prefs.occupancy === 'double') return 'double'
  if (prefs.occupancy === 'triple') return 'triple'
  return 'quad'
}

function occupancyUpgradeForSelection(pkg: HajjPackage, prefs: Preferences): number {
  const occ = occupancyLabel(prefs)
  if (occ === 'double') return sumUpgradeFees(pkg, 'double')
  if (occ === 'triple') return sumUpgradeFees(pkg, 'triple')
  return 0
}

function getOccupancyOptions(fees?: { double?: number; triple?: number }): RoomOccupancy[] {
  const options: RoomOccupancy[] = ['quad']
  if (typeof fees?.triple === 'number' && fees.triple > 0) options.push('triple')
  if (typeof fees?.double === 'number' && fees.double > 0) options.push('double')
  return options
}

function getOccupancyFee(fees: { double?: number; triple?: number } | undefined, occ: RoomOccupancy): number {
  if (!fees) return 0
  if (occ === 'double') return fees.double ?? 0
  if (occ === 'triple') return fees.triple ?? 0
  return 0
}

function defaultPackagePlusSelection(): PackagePlusSelection {
  return {
    hujjajCount: 1,
    minaCamp: 'muaisim',
    makkahOcc: 'quad',
    madinahOcc: 'quad',
    aziziyaOcc: 'quad'
  }
}

function normalizePackagePlusSelection(pkg: HajjPackage, selection?: Partial<PackagePlusSelection>): PackagePlusSelection {
  const base = defaultPackagePlusSelection()
  const next: PackagePlusSelection = {
    ...base,
    ...selection
  }

  next.hujjajCount = Math.max(1, Number(next.hujjajCount) || 1)

  if (!pkg.minaCampUpgradeAvailable) {
    next.minaCamp = 'muaisim'
  }

  const safeOcc = (occ: RoomOccupancy, fees?: { double?: number; triple?: number }): RoomOccupancy => {
    const allowed = getOccupancyOptions(fees)
    return allowed.includes(occ) ? occ : 'quad'
  }

  next.makkahOcc = safeOcc(next.makkahOcc, pkg.upgradeFees?.makkah)
  next.madinahOcc = safeOcc(next.madinahOcc, pkg.upgradeFees?.madinah)
  next.aziziyaOcc = pkg.isShifting ? safeOcc(next.aziziyaOcc, pkg.upgradeFees?.aziziya) : 'quad'

  return next
}

function loadPackagePlusSelections(): Record<string, PackagePlusSelection> {
  try {
    const raw = localStorage.getItem(PACKAGE_PLUS_SELECTIONS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

/* ---------------- UI blocks ---------------- */

function InstallTip() {
  return (
    <details className="card muted" style={{ marginTop: '0.75rem' }}>
      <summary style={{ fontWeight: 900, cursor: 'pointer' }}>Install this app</summary>
      <div style={{ marginTop: '0.6rem' }}>
        <div style={{ fontWeight: 800 }}>iPhone / iPad (Safari)</div>
        <div className="muted" style={{ marginTop: '0.25rem' }}>
          Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>.
        </div>

        <div style={{ fontWeight: 800, marginTop: '0.75rem' }}>Android (Chrome)</div>
        <div className="muted" style={{ marginTop: '0.25rem' }}>
          Tap <strong>⋮ Menu</strong> → <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
        </div>

        <div className="muted" style={{ marginTop: '0.75rem' }}>
          Once installed, it opens like a normal app and keeps your data on your device.
        </div>
      </div>
    </details>
  )
}

function NusukDisclaimer() {
  return (
    <div className="card muted">
      <strong>Important notice:</strong> Package details can change. Please verify everything with
      Nusuk and your provider. For the latest and most accurate information, refer to{' '}
      <a href="https://hajj.nusuk.sa/" target="_blank" rel="noreferrer">
        https://hajj.nusuk.sa/
      </a>
      .
      <br />
      <br />
      <strong>Safety:</strong> Do not share personal information and do not make any payment anywhere
      except through{' '}
      <a href="https://hajj.nusuk.sa/" target="_blank" rel="noreferrer">
        https://hajj.nusuk.sa/
      </a>
      .
      <br />
      <br />
      This app is a local-only tool (data stays on your device) and does not guarantee availability
      or correctness.
    </div>
  )
}

function HomeFooter() {
  return (
    <div className="app-footer">
      Built with love by{' '}
      <a href="https://ijtihadlabs.org" target="_blank" rel="noreferrer">
        Ijtihad Labs
      </a>
    </div>
  )
}

function TopNav({ tab, onGoHome }: { tab: Tab; onGoHome: () => void }) {
  if (tab === 'home') return null
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <button type="button" className="outline-btn" onClick={onGoHome}>
        ← Home
      </button>
    </div>
  )
}

function PackageCard({
  pkg,
  editedLocally,
  isSaved,
  onToggleSaved,
  onEdit,
  showCompareToggle = false,
  isCompared = false,
  onToggleCompare
}: {
  pkg: HajjPackage
  editedLocally: boolean
  isSaved: boolean
  onToggleSaved: (id: string) => void
  onEdit: (pkg: HajjPackage) => void
  showCompareToggle?: boolean
  isCompared?: boolean
  onToggleCompare?: (id: string) => void
}) {
  const dateLine = `${pkg.startDate} → ${pkg.endDate} (${pkg.durationDays} days)`
  const hotelsLine = pkg.hotels
    .map((h) => `${h.city.toUpperCase()}: ${h.hotelName} (${h.checkInDate})`)
    .join(' • ')

  return (
    <div className="card package-card">
      <div className="card-header">
        <div className="card-title">
          <strong>
            {pkg.provider} — {pkg.packageName}
          </strong>
        </div>

        <div className="card-actions">
          {editedLocally && <span className="pill">Edited locally</span>}

          <button
            type="button"
            className="outline-btn small"
            onClick={() => onToggleSaved(pkg.id)}
            aria-label={isSaved ? 'Remove from saved' : 'Save package'}
            title={isSaved ? 'Saved (tap to remove)' : 'Save (tap to add)'}
          >
            {isSaved ? '❤️' : '🤍'}
          </button>

          <button type="button" className="outline-btn small" onClick={() => onEdit(pkg)}>
            Edit
          </button>

          {showCompareToggle && onToggleCompare && (
            <button
              type="button"
              className={isCompared ? 'outline-btn small compare-btn active' : 'outline-btn small compare-btn'}
              onClick={() => onToggleCompare(pkg.id)}
            >
              {isCompared ? 'Comparing' : 'Compare'}
            </button>
          )}
        </div>
      </div>

      <div className="muted">{dateLine}</div>

      <div style={{ marginTop: '0.6rem' }}>
        <div className="muted" style={{ marginBottom: '0.15rem' }}>
          Listed price (quad baseline)
        </div>
        <div style={{ fontSize: '1.25rem', fontWeight: 900, lineHeight: 1.1 }}>
          {formatSAR(pkg.basePriceSAR)}
        </div>

        {pkg.minaCamp === 'majr' && (
          <div className="muted" style={{ marginTop: '0.25rem' }}>
            Majr camp upgrade: +{formatSAR2(MAJR_UPGRADE_FEE_SAR)} pp
          </div>
        )}
      </div>

      <div className="muted" style={{ marginTop: '0.6rem' }}>
        Mina: {campLabel(pkg.minaCamp)} • Zone: {pkg.makkahZone} •{' '}
        {pkg.isShifting ? 'Shifting' : 'Non-shifting'}
      </div>

      {pkg.flight?.gateway && (
        <div className="muted" style={{ marginTop: '0.35rem' }}>
          Flight baseline: {pkg.flight.gateway}
          {pkg.flight.priceSAR && pkg.flight.priceSAR > 0 ? ` • ${formatSAR(pkg.flight.priceSAR)}` : ''}
        </div>
      )}

      <div className="muted" style={{ marginTop: '0.35rem' }}>
        {hotelsLine}
      </div>

      {pkg.packageLink && (
        <div style={{ marginTop: '0.5rem' }}>
          <a href={pkg.packageLink} target="_blank" rel="noreferrer">
            Package link
          </a>
        </div>
      )}
    </div>
  )
}

function PackagePlusCard({
  pkg,
  selection,
  onSelectionChange,
  isSaved,
  onToggleSaved,
  showCompareToggle = false,
  isCompared = false,
  onToggleCompare
}: {
  pkg: HajjPackage
  selection: PackagePlusSelection
  onSelectionChange: (updates: Partial<PackagePlusSelection>) => void
  isSaved: boolean
  onToggleSaved: (id: string) => void
  showCompareToggle?: boolean
  isCompared?: boolean
  onToggleCompare?: (id: string) => void
}) {
  const dateLine = `${pkg.startDate} → ${pkg.endDate} (${pkg.durationDays} days)`
  const hotelsLine = pkg.hotels
    .map((h) => `${h.city.toUpperCase()}: ${h.hotelName} (${h.checkInDate})`)
    .join(' • ')

  const makkahOptions = getOccupancyOptions(pkg.upgradeFees?.makkah)
  const madinahOptions = getOccupancyOptions(pkg.upgradeFees?.madinah)
  const aziziyaOptions = getOccupancyOptions(pkg.upgradeFees?.aziziya)
  const campOptions = pkg.minaCampUpgradeAvailable ? ['muaisim', 'majr'] : ['muaisim']

  const selectedUpgrades: string[] = []
  if (selection.minaCamp === 'majr') {
    selectedUpgrades.push(`Majr camp +${formatSAR2(MAJR_UPGRADE_FEE_SAR)} pp`)
  }

  const addUpgrade = (label: string, fees: { double?: number; triple?: number } | undefined, occ: RoomOccupancy) => {
    if (occ === 'quad') return 0
    const fee = getOccupancyFee(fees, occ)
    if (fee > 0) {
      selectedUpgrades.push(`${label} ${occ} +${formatSAR2(fee)} pp`)
    }
    return fee
  }

  const perPerson =
    pkg.basePriceSAR +
    (selection.minaCamp === 'majr' ? MAJR_UPGRADE_FEE_SAR : 0) +
    addUpgrade('Makkah', pkg.upgradeFees?.makkah, selection.makkahOcc) +
    addUpgrade('Madinah', pkg.upgradeFees?.madinah, selection.madinahOcc) +
    (pkg.isShifting
      ? addUpgrade('Aziziya', pkg.upgradeFees?.aziziya, selection.aziziyaOcc)
      : 0)

  const total = perPerson * selection.hujjajCount

  const possibleUpgrades: string[] = []
  if (pkg.minaCampUpgradeAvailable) {
    possibleUpgrades.push(`Majr camp +${formatSAR2(MAJR_UPGRADE_FEE_SAR)} pp`)
  }
  const pushPossible = (label: string, fees: { double?: number; triple?: number } | undefined) => {
    if (fees?.triple) possibleUpgrades.push(`${label} triple +${formatSAR2(fees.triple)} pp`)
    if (fees?.double) possibleUpgrades.push(`${label} double +${formatSAR2(fees.double)} pp`)
  }
  pushPossible('Makkah', pkg.upgradeFees?.makkah)
  pushPossible('Madinah', pkg.upgradeFees?.madinah)
  if (pkg.isShifting) pushPossible('Aziziya', pkg.upgradeFees?.aziziya)

  const showPossible = selectedUpgrades.length === 0 && possibleUpgrades.length > 0

  return (
    <div className="card package-card">
      <div className="card-header">
        <div className="card-title">
          <strong>
            {pkg.provider} — {pkg.packageName}
          </strong>
        </div>

        <div className="card-actions">
          <button
            type="button"
            className="outline-btn small"
            onClick={() => onToggleSaved(pkg.id)}
            aria-label={isSaved ? 'Remove from saved' : 'Save package'}
            title={isSaved ? 'Saved (tap to remove)' : 'Save (tap to add)'}
          >
            {isSaved ? '❤️' : '🤍'}
          </button>

          {showCompareToggle && onToggleCompare && (
            <button
              type="button"
              className={isCompared ? 'outline-btn small compare-btn active' : 'outline-btn small compare-btn'}
              onClick={() => onToggleCompare(pkg.id)}
            >
              {isCompared ? 'Comparing' : 'Compare'}
            </button>
          )}
        </div>
      </div>

      <div className="muted">{dateLine}</div>

      <div style={{ marginTop: '0.6rem' }}>
        <div className="muted" style={{ marginBottom: '0.15rem' }}>
          Listed price (Al Muaisim • quad baseline)
        </div>
        <div style={{ fontSize: '1.25rem', fontWeight: 900, lineHeight: 1.1 }}>
          {formatSAR(pkg.basePriceSAR)}
        </div>
      </div>

      <div className="package-plus-grid">
        <label className="package-plus-field">
          <div className="muted">Hujjaj count</div>
          <input
            className="input"
            type="number"
            min={1}
            inputMode="numeric"
            value={selection.hujjajCount}
            onChange={(e) =>
              onSelectionChange({ hujjajCount: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        </label>

        <label className="package-plus-field">
          <div className="muted">Mina camp</div>
          <select
            className="select"
            value={selection.minaCamp}
            onChange={(e) => onSelectionChange({ minaCamp: e.target.value as PackagePlusSelection['minaCamp'] })}
          >
            {campOptions.map((camp) => (
              <option key={camp} value={camp}>
                {camp === 'muaisim'
                  ? 'Al Muaisim (included)'
                  : `Majr AlKabsh (+${formatSAR2(MAJR_UPGRADE_FEE_SAR)} pp)`}
              </option>
            ))}
          </select>
        </label>

        <label className="package-plus-field">
          <div className="muted">Makkah room</div>
          <select
            className="select"
            value={selection.makkahOcc}
            onChange={(e) => onSelectionChange({ makkahOcc: e.target.value as RoomOccupancy })}
          >
            {makkahOptions.map((occ) => (
              <option key={occ} value={occ}>
                {occ === 'quad'
                  ? 'Quad (included)'
                  : `${occ[0].toUpperCase() + occ.slice(1)} (+${formatSAR2(
                      getOccupancyFee(pkg.upgradeFees?.makkah, occ)
                    )} pp)`}
              </option>
            ))}
          </select>
        </label>

        <label className="package-plus-field">
          <div className="muted">Madinah room</div>
          <select
            className="select"
            value={selection.madinahOcc}
            onChange={(e) => onSelectionChange({ madinahOcc: e.target.value as RoomOccupancy })}
          >
            {madinahOptions.map((occ) => (
              <option key={occ} value={occ}>
                {occ === 'quad'
                  ? 'Quad (included)'
                  : `${occ[0].toUpperCase() + occ.slice(1)} (+${formatSAR2(
                      getOccupancyFee(pkg.upgradeFees?.madinah, occ)
                    )} pp)`}
              </option>
            ))}
          </select>
        </label>

        {pkg.isShifting && (
          <label className="package-plus-field">
            <div className="muted">Aziziya room</div>
            <select
              className="select"
              value={selection.aziziyaOcc}
              onChange={(e) => onSelectionChange({ aziziyaOcc: e.target.value as RoomOccupancy })}
            >
              {aziziyaOptions.map((occ) => (
                <option key={occ} value={occ}>
                  {occ === 'quad'
                    ? 'Quad (included)'
                    : `${occ[0].toUpperCase() + occ.slice(1)} (+${formatSAR2(
                        getOccupancyFee(pkg.upgradeFees?.aziziya, occ)
                      )} pp)`}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="package-plus-total">
        <div className="muted">Estimated total (excl. flight)</div>
        <div className="package-plus-total-value">{formatSAR(total)}</div>
        <div className="muted">{selection.hujjajCount} hujjaj • {formatSAR(perPerson)} per person</div>
        {selectedUpgrades.length > 0 && (
          <div className="package-plus-summary">{selectedUpgrades.join(' • ')}</div>
        )}
        {showPossible && (
          <div className="package-plus-summary muted">Possible upgrades: {possibleUpgrades.join(' • ')}</div>
        )}
      </div>

      <div className="muted" style={{ marginTop: '0.6rem' }}>
        Mina: {campLabel(selection.minaCamp)} • Zone: {pkg.makkahZone} •{' '}
        {pkg.isShifting ? 'Shifting' : 'Non-shifting'}
      </div>

      <div className="muted" style={{ marginTop: '0.35rem' }}>
        {hotelsLine}
      </div>

      {pkg.packageLink && (
        <div style={{ marginTop: '0.5rem' }}>
          <a href={pkg.packageLink} target="_blank" rel="noreferrer">
            Package link
          </a>
        </div>
      )}
    </div>
  )
}

function RejectedReport({ rejected }: { rejected: LoaderResult['rejected'] }) {
  if (rejected.length === 0) return null
  return (
    <details style={{ marginTop: '0.75rem' }}>
      <summary style={{ fontWeight: 900, cursor: 'pointer' }}>
        View rejected rows (excluded for accuracy)
      </summary>
      <div style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
        {rejected.slice(0, 100).map((r, idx) => (
          <div key={`${r.rowIndex}-${idx}`} className="card">
            <div>
              <strong>Row {r.rowIndex}</strong>
              {r.packageName ? ` • ${r.packageName}` : ''}
            </div>
            <div className="muted">{r.reason}</div>
          </div>
        ))}
      </div>
    </details>
  )
}

function ProviderFilter({
  providers,
  selected,
  onToggle,
  onSelectAll,
  onClear
}: {
  providers: string[]
  selected: string[]
  onToggle: (p: string) => void
  onSelectAll: () => void
  onClear: () => void
}) {
  const showingText = selected.length === 0 ? 'All providers' : `${selected.length} selected`

  return (
    <details style={{ margin: '1rem 0' }}>
      <summary style={{ fontWeight: 900, cursor: 'pointer' }}>
        Provider filter (recommendations)
      </summary>

      <div className="muted" style={{ marginTop: '0.5rem' }}>
        Showing: <strong>{showingText}</strong>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <button type="button" className="outline-btn" style={{ flex: 1 }} onClick={onSelectAll}>
          Select all
        </button>
        <button type="button" className="outline-btn" style={{ flex: 1 }} onClick={onClear}>
          Clear
        </button>
      </div>

      <div style={{ marginTop: '0.75rem' }}>
        {providers.map((p) => (
          <label key={p} style={{ display: 'block', marginBottom: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={selected.includes(p)}
              onChange={() => onToggle(p)}
              style={{ marginRight: '0.5rem' }}
            />
            {p}
          </label>
        ))}
      </div>
    </details>
  )
}

function getHotelName(pkg: HajjPackage, city: 'makkah' | 'madinah') {
  return pkg.hotels.find((h) => h.city === city)?.hotelName ?? ''
}

function uniqueSorted(items: string[]) {
  return Array.from(new Set(items.filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

function HomeTile({
  icon,
  title,
  description,
  onClick
}: {
  icon: string
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button type="button" className="tile" onClick={onClick}>
      <div className="tile-icon">{icon}</div>
      <div className="tile-title">{title}</div>
      <div className="tile-desc">{description}</div>
    </button>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')

  const [preloaded, setPreloaded] = useState<HajjPackage[]>([])
  const [loadingPackages, setLoadingPackages] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rejected, setRejected] = useState<LoaderResult['rejected']>([])

  const [plusPreloaded, setPlusPreloaded] = useState<HajjPackage[]>([])
  const [plusLoadingPackages, setPlusLoadingPackages] = useState(true)
  const [plusLoadError, setPlusLoadError] = useState<string | null>(null)
  const [plusRejected, setPlusRejected] = useState<LoaderResult['rejected']>([])

  const [mergedPackages, setMergedPackages] = useState<HajjPackage[]>([])
  const [editedIds, setEditedIds] = useState<Set<string>>(new Set())

  const [results, setResults] = useState<any[]>([])

  const [prefs, setPrefs] = useState<Preferences>(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY)
      if (!raw) throw new Error('no prefs')
      const parsed = JSON.parse(raw)
      return {
        provider: parsed.provider ?? 'any',
        firstStay: parsed.firstStay ?? 'any',
        lastStay: parsed.lastStay ?? 'any',
        startDate: parsed.startDate ?? undefined,
        endDate: parsed.endDate ?? undefined,
        durationDays: parsed.durationDays ?? undefined,
        makkahZone: parsed.makkahZone ?? 'any',
        minaCamp: parsed.minaCamp ?? 'any',
        occupancy: parsed.occupancy ?? 'any',
        shifting: parsed.shifting ?? 'any',
        budgetAmount: Number(parsed.budgetAmount) || 0,
        budgetCurrency: (parsed.budgetCurrency ?? 'GBP').toString(),
        hujjajCount: Math.max(1, Number(parsed.hujjajCount) || 1)
      } as Preferences
    } catch {
      return {
        provider: 'any',
        firstStay: 'any',
        lastStay: 'any',
        makkahZone: 'any',
        minaCamp: 'any',
        occupancy: 'any',
        shifting: 'any',
        budgetAmount: 0,
        budgetCurrency: 'GBP',
        hujjajCount: 1
      }
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
      // ignore
    }
  }, [prefs])

  const [editingPkg, setEditingPkg] = useState<HajjPackage | null>(null)
  const [addingPkg, setAddingPkg] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [importStatus, setImportStatus] = useState<string>('')

  const [favouriteIds, setFavouriteIds] = useState<string[]>(getFavouriteIds())

  const [packagePlusSelections, setPackagePlusSelections] = useState<Record<string, PackagePlusSelection>>(
    () => loadPackagePlusSelections()
  )

  useEffect(() => {
    try {
      localStorage.setItem(PACKAGE_PLUS_SELECTIONS_KEY, JSON.stringify(packagePlusSelections))
    } catch {
      // ignore
    }
  }, [packagePlusSelections])

  function refreshMerged(currentPreloaded: HajjPackage[]) {
    const merged = mergePackages(currentPreloaded)
    setMergedPackages(merged.packages)
    setEditedIds(merged.editedIds)
  }

  function refreshFavourites() {
    setFavouriteIds(getFavouriteIds())
  }

  function onToggleSaved(id: string) {
    const res = toggleFavourite(id)
    if (!res.ok && res.message) alert(res.message)
    refreshFavourites()
  }

  function getPackagePlusSelection(pkg: HajjPackage): PackagePlusSelection {
    return normalizePackagePlusSelection(pkg, packagePlusSelections[pkg.id])
  }

  function updatePackagePlusSelection(pkg: HajjPackage, updates: Partial<PackagePlusSelection>) {
    setPackagePlusSelections((prev) => {
      const current = normalizePackagePlusSelection(pkg, prev[pkg.id])
      const next = normalizePackagePlusSelection(pkg, { ...current, ...updates })
      return { ...prev, [pkg.id]: next }
    })
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoadingPackages(true)
      setLoadError(null)

      try {
        const res = await loadPreloadedPackages()
        if (cancelled) return
        setPreloaded(res.packages)
        setRejected(res.rejected)
        refreshMerged(res.packages)
        setLoadingPackages(false)
      } catch (e) {
        if (cancelled) return
        setLoadError(e instanceof Error ? e.message : 'Failed to load XLSX')
        setLoadingPackages(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setPlusLoadingPackages(true)
      setPlusLoadError(null)

      try {
        const res = await loadAlternativePackages()
        if (cancelled) return
        setPlusPreloaded(res.packages)
        setPlusRejected(res.rejected)
        setPlusLoadingPackages(false)
      } catch (e) {
        if (cancelled) return
        setPlusLoadError(e instanceof Error ? e.message : 'Failed to load XLSX')
        setPlusLoadingPackages(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  const allProviders = useMemo(
    () => Array.from(new Set(mergedPackages.map((p) => p.provider))).sort(),
    [mergedPackages]
  )

  const [selectedProviders, setSelectedProviders] = useState<string[]>([])
  function toggleProvider(p: string) {
    setSelectedProviders((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }
  function selectAllProviders() {
    setSelectedProviders(allProviders)
  }
  function clearProviders() {
    setSelectedProviders([])
  }

  function runRecommendation() {
    if (!prefs.budgetAmount || !prefs.hujjajCount) {
      alert('Please set your budget and number of hujjaj first (Preferences).')
      return
    }
    if (mergedPackages.length === 0) {
      alert('No packages available yet.')
      return
    }

    const effectivePrefs: Preferences =
      selectedProviders.length === 0 ? prefs : { ...prefs, provider: 'any' }

    const filtered =
      selectedProviders.length === 0
        ? mergedPackages
        : mergedPackages.filter((p) => selectedProviders.includes(p.provider))

    setResults(recommendPackages(filtered, effectivePrefs))
  }

  const [showPackageFilters, setShowPackageFilters] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [showCompareView, setShowCompareView] = useState(false)
  const emptyPackageFilters: PackageFilters = {
    provider: 'any',
    shifting: 'any',
    makkahZone: 'any',
    durationDays: 'any',
    startDate: 'any',
    endDate: 'any',
    makkahHotel: 'any',
    madinahHotel: 'any',
    minaCamp: 'any',
    minPrice: '',
    maxPrice: '',
    sort: 'none'
  }
  const [packageFilters, setPackageFilters] = useState<PackageFilters>(emptyPackageFilters)
  const [draftPackageFilters, setDraftPackageFilters] = useState<PackageFilters>(emptyPackageFilters)

  function openPackageFilters() {
    setDraftPackageFilters(packageFilters)
    setShowPackageFilters(true)
  }

  function applyPackageFilters() {
    setPackageFilters(draftPackageFilters)
    setShowPackageFilters(false)
  }

  function resetPackageFilters() {
    setPackageFilters(emptyPackageFilters)
    setDraftPackageFilters(emptyPackageFilters)
    setShowPackageFilters(false)
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 3) {
        alert('You can compare up to 3 packages at a time.')
        return prev
      }
      return [...prev, id]
    })
  }

  function clearCompare() {
    setCompareIds([])
    setShowCompareView(false)
  }

  function openCompare() {
    if (compareIds.length < 2) {
      alert('Select at least 2 packages to compare.')
      return
    }
    setShowCompareView(true)
  }

  const [showPackagePlusFilters, setShowPackagePlusFilters] = useState(false)
  const [comparePlusIds, setComparePlusIds] = useState<string[]>([])
  const [showComparePlusView, setShowComparePlusView] = useState(false)
  const emptyPackagePlusFilters: PackageFilters = emptyPackageFilters
  const [packagePlusFilters, setPackagePlusFilters] = useState<PackageFilters>(emptyPackagePlusFilters)
  const [draftPackagePlusFilters, setDraftPackagePlusFilters] = useState<PackageFilters>(emptyPackagePlusFilters)

  function openPackagePlusFilters() {
    setDraftPackagePlusFilters(packagePlusFilters)
    setShowPackagePlusFilters(true)
  }

  function applyPackagePlusFilters() {
    setPackagePlusFilters(draftPackagePlusFilters)
    setShowPackagePlusFilters(false)
  }

  function resetPackagePlusFilters() {
    setPackagePlusFilters(emptyPackagePlusFilters)
    setDraftPackagePlusFilters(emptyPackagePlusFilters)
    setShowPackagePlusFilters(false)
  }

  function toggleComparePlus(id: string) {
    setComparePlusIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 3) {
        alert('You can compare up to 3 packages at a time.')
        return prev
      }
      return [...prev, id]
    })
  }

  function clearComparePlus() {
    setComparePlusIds([])
    setShowComparePlusView(false)
  }

  function openComparePlus() {
    if (comparePlusIds.length < 2) {
      alert('Select at least 2 packages to compare.')
      return
    }
    setShowComparePlusView(true)
  }

  const filteredPackages = mergedPackages.filter((p) => {
    if (packageFilters.provider !== 'any' && p.provider !== packageFilters.provider) return false

    if (packageFilters.shifting !== 'any') {
      const shiftingMatch = packageFilters.shifting === 'shifting' ? p.isShifting : !p.isShifting
      if (!shiftingMatch) return false
    }

    if (packageFilters.makkahZone !== 'any' && p.makkahZone !== packageFilters.makkahZone) return false
    if (packageFilters.minaCamp !== 'any' && p.minaCamp !== packageFilters.minaCamp) return false

    if (packageFilters.durationDays !== 'any') {
      if (String(p.durationDays) !== packageFilters.durationDays) return false
    }

    if (packageFilters.startDate !== 'any' && p.startDate < packageFilters.startDate) return false
    if (packageFilters.endDate !== 'any' && p.endDate > packageFilters.endDate) return false

    if (packageFilters.makkahHotel !== 'any') {
      if (getHotelName(p, 'makkah') !== packageFilters.makkahHotel) return false
    }

    if (packageFilters.madinahHotel !== 'any') {
      if (getHotelName(p, 'madinah') !== packageFilters.madinahHotel) return false
    }

    const minPrice = Number(packageFilters.minPrice)
    if (packageFilters.minPrice && !Number.isNaN(minPrice) && p.basePriceSAR < minPrice) return false

    const maxPrice = Number(packageFilters.maxPrice)
    if (packageFilters.maxPrice && !Number.isNaN(maxPrice) && p.basePriceSAR > maxPrice) return false

    return true
  })

  const visiblePackages = [...filteredPackages].sort((a, b) => {
    if (packageFilters.sort === 'price-asc') return a.basePriceSAR - b.basePriceSAR
    if (packageFilters.sort === 'price-desc') return b.basePriceSAR - a.basePriceSAR
    const providerCompare = a.provider.localeCompare(b.provider)
    if (providerCompare !== 0) return providerCompare
    return a.basePriceSAR - b.basePriceSAR
  })

  const filteredPackagePlus = plusPreloaded.filter((p) => {
    if (packagePlusFilters.provider !== 'any' && p.provider !== packagePlusFilters.provider) return false

    if (packagePlusFilters.shifting !== 'any') {
      const shiftingMatch = packagePlusFilters.shifting === 'shifting' ? p.isShifting : !p.isShifting
      if (!shiftingMatch) return false
    }

    if (packagePlusFilters.makkahZone !== 'any' && p.makkahZone !== packagePlusFilters.makkahZone) return false
    if (packagePlusFilters.minaCamp !== 'any' && p.minaCamp !== packagePlusFilters.minaCamp) return false

    if (packagePlusFilters.durationDays !== 'any') {
      if (String(p.durationDays) !== packagePlusFilters.durationDays) return false
    }

    if (packagePlusFilters.startDate !== 'any' && p.startDate < packagePlusFilters.startDate) return false
    if (packagePlusFilters.endDate !== 'any' && p.endDate > packagePlusFilters.endDate) return false

    if (packagePlusFilters.makkahHotel !== 'any') {
      if (getHotelName(p, 'makkah') !== packagePlusFilters.makkahHotel) return false
    }

    if (packagePlusFilters.madinahHotel !== 'any') {
      if (getHotelName(p, 'madinah') !== packagePlusFilters.madinahHotel) return false
    }

    const minPrice = Number(packagePlusFilters.minPrice)
    if (packagePlusFilters.minPrice && !Number.isNaN(minPrice) && p.basePriceSAR < minPrice) return false

    const maxPrice = Number(packagePlusFilters.maxPrice)
    if (packagePlusFilters.maxPrice && !Number.isNaN(maxPrice) && p.basePriceSAR > maxPrice) return false

    return true
  })

  const visiblePackagePlus = [...filteredPackagePlus].sort((a, b) => {
    if (packagePlusFilters.sort === 'price-asc') return a.basePriceSAR - b.basePriceSAR
    if (packagePlusFilters.sort === 'price-desc') return b.basePriceSAR - a.basePriceSAR
    const providerCompare = a.provider.localeCompare(b.provider)
    if (providerCompare !== 0) return providerCompare
    return a.basePriceSAR - b.basePriceSAR
  })

  const savedPackages = useMemo(() => {
    const byId = new Map([...mergedPackages, ...plusPreloaded].map((p) => [p.id, p]))
    return favouriteIds.map((id) => byId.get(id)).filter(Boolean) as HajjPackage[]
  }, [favouriteIds, mergedPackages, plusPreloaded])

  const comparePackages = useMemo(() => {
    const byId = new Map(mergedPackages.map((p) => [p.id, p]))
    return compareIds.map((id) => byId.get(id)).filter(Boolean) as HajjPackage[]
  }, [compareIds, mergedPackages])

  const comparePlusPackages = useMemo(() => {
    const byId = new Map(plusPreloaded.map((p) => [p.id, p]))
    return comparePlusIds.map((id) => byId.get(id)).filter(Boolean) as HajjPackage[]
  }, [comparePlusIds, plusPreloaded])

  const packageProviders = useMemo(
    () => uniqueSorted(mergedPackages.map((p) => p.provider)),
    [mergedPackages]
  )

  const packagePlusProviders = useMemo(
    () => uniqueSorted(plusPreloaded.map((p) => p.provider)),
    [plusPreloaded]
  )

  const packageZones = useMemo(
    () => uniqueSorted(mergedPackages.map((p) => p.makkahZone)),
    [mergedPackages]
  )

  const packagePlusZones = useMemo(
    () => uniqueSorted(plusPreloaded.map((p) => p.makkahZone)),
    [plusPreloaded]
  )

  const packageDurations = useMemo(
    () => uniqueSorted(mergedPackages.map((p) => String(p.durationDays))),
    [mergedPackages]
  )

  const packagePlusDurations = useMemo(
    () => uniqueSorted(plusPreloaded.map((p) => String(p.durationDays))),
    [plusPreloaded]
  )

  const packageStartDates = useMemo(
    () => uniqueSorted(mergedPackages.map((p) => p.startDate)),
    [mergedPackages]
  )

  const packagePlusStartDates = useMemo(
    () => uniqueSorted(plusPreloaded.map((p) => p.startDate)),
    [plusPreloaded]
  )

  const packageEndDates = useMemo(
    () => uniqueSorted(mergedPackages.map((p) => p.endDate)),
    [mergedPackages]
  )

  const packagePlusEndDates = useMemo(
    () => uniqueSorted(plusPreloaded.map((p) => p.endDate)),
    [plusPreloaded]
  )

  const packageMakkahHotels = useMemo(
    () => uniqueSorted(mergedPackages.map((p) => getHotelName(p, 'makkah'))),
    [mergedPackages]
  )

  const packagePlusMakkahHotels = useMemo(
    () => uniqueSorted(plusPreloaded.map((p) => getHotelName(p, 'makkah'))),
    [plusPreloaded]
  )

  const packageMadinahHotels = useMemo(
    () => uniqueSorted(mergedPackages.map((p) => getHotelName(p, 'madinah'))),
    [mergedPackages]
  )

  const packagePlusMadinahHotels = useMemo(
    () => uniqueSorted(plusPreloaded.map((p) => getHotelName(p, 'madinah'))),
    [plusPreloaded]
  )


  async function handleCsvFile(file: File) {
    setImportStatus('')

    const text = await file.text()
    const parsed = importTemplateCsv(text)

    if (parsed.errors.length > 0) {
      const preview = parsed.errors
        .slice(0, 5)
        .map((e) => `Row ${e.row}: ${e.message}`)
        .join('\n')
      alert(
        `CSV import blocked (fix errors first):\n\n${preview}\n\nTotal errors: ${parsed.errors.length}`
      )
      return
    }

    const existing = getUserPackageKeySet()
    let imported = 0
    let skipped = 0

    for (const p of parsed.packages) {
      const k = packageDedupeKey(p)
      if (existing.has(k)) {
        skipped++
        continue
      }
      saveUserPackage(p)
      existing.add(k)
      imported++
    }

    refreshMerged(preloaded)
    setImportStatus(
      `Imported ${imported} package(s), skipped ${skipped} duplicate(s). (Saved locally)`
    )
  }

  const statusLine = (
    <div className="muted" style={{ margin: '0.75rem 0' }}>
      {loadingPackages && 'Loading packages…'}
      {!loadingPackages && loadError && `Could not load XLSX: ${loadError}`}
      {!loadingPackages && !loadError && (
        <>
          Loaded: <strong>{preloaded.length}</strong> preloaded
          {editedIds.size > 0 ? ` • Edited locally: ${editedIds.size}` : ''}
          {rejected.length > 0 ? ` • Rejected: ${rejected.length}` : ''}
          {favouriteIds.length > 0 ? ` • Saved: ${favouriteIds.length}/5` : ''}
        </>
      )}
    </div>
  )

  const plusStatusLine = (
    <div className="muted" style={{ margin: '0.75rem 0' }}>
      {plusLoadingPackages && 'Loading packages…'}
      {!plusLoadingPackages && plusLoadError && `Could not load XLSX: ${plusLoadError}`}
      {!plusLoadingPackages && !plusLoadError && (
        <>
          Loaded: <strong>{plusPreloaded.length}</strong> preloaded
          {plusRejected.length > 0 ? ` • Rejected: ${plusRejected.length}` : ''}
          {favouriteIds.length > 0 ? ` • Saved: ${favouriteIds.length}/5` : ''}
        </>
      )}
    </div>
  )

  return (
    <div className="app-root">
      <main className="app-content">
        <TopNav tab={tab} onGoHome={() => setTab('home')} />

        {/* HOME */}
        {tab === 'home' && (
          <section className="home-section">
            <h1>Hajj Package Helper</h1>
            <p className="muted" style={{ marginTop: '-0.25rem' }}>
              A small effort to make things easier for potential hujjaj — seeking nothing but your
              du‘ā’ and reward from Allah. May Allah accept from all of us and invite us to perform
              Hajj. Āmīn.
            </p>

            {statusLine}

            <HomeTile icon="⚙️" title="Set preferences" description="Budget, dates, zone, camp, shifting, occupancy." onClick={() => setTab('preferences')} />
            <HomeTile icon="📦" title="View packages" description="Browse packages and filter by provider." onClick={() => setTab('packages')} />
            <HomeTile icon="➕" title="Package+ view" description="Adjust rooms, camp upgrades, and hujjaj count." onClick={() => setTab('packagePlus')} />
            <HomeTile icon="❤️" title="Saved packages" description="Quick access to up to 5 saved packages." onClick={() => setTab('saved')} />
            <HomeTile icon="⭐" title="Get recommendations" description="Top matches that aim to maximise value for your budget." onClick={() => setTab('recommend')} />

            <InstallTip />
            <NusukDisclaimer />
            <RejectedReport rejected={rejected} />
            <HomeFooter />
          </section>
        )}

        {/* SAVED */}
        {tab === 'saved' && (
          <section>
            <h1>Saved packages</h1>
            <p className="muted" style={{ marginTop: '-0.25rem' }}>
              Up to 5 packages. Saved only on your device.
            </p>

            {statusLine}

            {savedPackages.length === 0 ? (
              <div className="card muted">No saved packages yet. Tap 🤍 on a package card to save it.</div>
            ) : (
              savedPackages.map((p) => (
                <PackageCard
                  key={p.id}
                  pkg={p}
                  editedLocally={editedIds.has(p.id)}
                  isSaved={favouriteIds.includes(p.id)}
                  onToggleSaved={onToggleSaved}
                  onEdit={setEditingPkg}
                />
              ))
            )}

            <NusukDisclaimer />
          </section>
        )}

        {/* RECOMMEND */}
        {tab === 'recommend' && (
          <section>
            <h1>Recommendations</h1>
            <p className="muted" style={{ marginTop: '-0.25rem' }}>
              Estimated totals use your saved preferences (occupancy + group size), Majr fee, and baseline flight if present.
            </p>

            {statusLine}

            <ProviderFilter
              providers={allProviders}
              selected={selectedProviders}
              onToggle={toggleProvider}
              onSelectAll={selectAllProviders}
              onClear={clearProviders}
            />

            <button className="primary-button" onClick={runRecommendation}>
              Get recommendations
            </button>

            <NusukDisclaimer />

            {results.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                {results.map((r, i) => {
                  const group = Math.max(1, prefs.hujjajCount)
                  const occ = occupancyLabel(prefs)
                  const base = r.pkg.basePriceSAR
                  const camp = majrFee(r.pkg)
                  const occUp = occupancyUpgradeForSelection(r.pkg, prefs)
                  const perPerson = base + camp + occUp

                  const flightPP = estimateFlightPerPersonSAR(r.pkg)
                  const totalNoFlight = perPerson * group
                  const totalWithFlight = flightPP !== null ? (perPerson + flightPP) * group : null

                  const parts: string[] = []
                  parts.push(`Base ${formatSAR(base)}`)
                  if (camp > 0) parts.push(`Majr +${formatSAR2(camp)}`)
                  if (occUp > 0) parts.push(`${occ} upgrade +${formatSAR(occUp)}`)
                  if (flightPP !== null) parts.push(`Flight +${formatSAR(flightPP)}`)

                  return (
                    <div key={r.pkg.id} style={{ marginBottom: '0.9rem' }}>
                      <div style={{ marginBottom: '0.35rem' }}>
                        <strong>#{i + 1} — Score: {r.totalScore}</strong>
                      </div>

                      <PackageCard
                        pkg={r.pkg}
                        editedLocally={editedIds.has(r.pkg.id)}
                        isSaved={favouriteIds.includes(r.pkg.id)}
                        onToggleSaved={onToggleSaved}
                        onEdit={setEditingPkg}
                      />

                      <div className="card" style={{ borderWidth: 2, marginTop: '-0.25rem' }}>
                        <div className="muted" style={{ marginBottom: '0.25rem' }}>
                          Estimated total (based on your preferences)
                        </div>

                        <div style={{ fontSize: '1.35rem', fontWeight: 900, lineHeight: 1.1 }}>
                          {totalWithFlight !== null ? formatSAR(totalWithFlight) : formatSAR(totalNoFlight)}
                        </div>

                        <div className="muted" style={{ marginTop: '0.25rem' }}>
                          Group ({group} hujjaj) {totalWithFlight !== null ? 'incl. flight' : 'excl. flight'}
                          {flightPP === null ? ' • flight not included' : ''}
                        </div>

                        <div style={{ marginTop: '0.6rem' }}>
                          <div className="muted">Per person</div>
                          <div style={{ fontWeight: 900, marginTop: '0.15rem' }}>{formatSAR(perPerson)}</div>
                          <div className="muted" style={{ marginTop: '0.2rem' }}>
                            {parts.join('  •  ')}
                          </div>
                        </div>
                      </div>

                      <ul style={{ marginTop: '0.25rem' }}>
                        {r.reasons.map((reason: string, idx: number) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )}

            <RejectedReport rejected={rejected} />
          </section>
        )}

        {/* PACKAGES */}
        {tab === 'packages' && (
          <section>
            <h1>Packages</h1>
            <p className="muted" style={{ marginTop: '-0.25rem' }}>
              Preloaded packages are shown as cards. Any edits you make stay only on your device.
            </p>

            {statusLine}

            <div style={{ display: 'flex', gap: '0.5rem', margin: '0.75rem 0' }}>
              <button type="button" className="outline-btn" style={{ flex: 1 }} onClick={() => setAddingPkg(true)}>
                + Add package
              </button>
              <button type="button" className="outline-btn" style={{ flex: 1 }} onClick={downloadTemplateCsv}>
                ⬇ Download template
              </button>
              <button type="button" className="outline-btn" style={{ flex: 1 }} onClick={() => fileInputRef.current?.click()}>
                ⬆ Upload CSV
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', margin: '0 0 0.75rem' }}>
              <button type="button" className="outline-btn" style={{ flex: 1 }} onClick={openPackageFilters}>
                Filters & sort
              </button>
              <button type="button" className="outline-btn" style={{ flex: 1 }} onClick={resetPackageFilters}>
                Show all packages
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                void handleCsvFile(f)
                e.currentTarget.value = ''
              }}
            />

            {importStatus && <div className="card muted">{importStatus}</div>}

            {compareIds.length > 0 && (
              <div className="card compare-summary">
                <div className="compare-summary-header">
                  <div>
                    <strong>Compare packages</strong>
                    <div className="muted">Select up to 3 packages to view side by side.</div>
                  </div>
                  <button type="button" className="outline-btn small" onClick={clearCompare}>
                    Clear
                  </button>
                </div>

                <div className="compare-tags">
                  {comparePackages.map((p) => (
                    <span key={p.id} className="pill">
                      {p.provider} — {p.packageName}
                    </span>
                  ))}
                </div>

                <div className="compare-actions">
                  <button type="button" className="primary-button" onClick={openCompare}>
                    Compare
                  </button>
                </div>
              </div>
            )}

            {showPackageFilters && (
              <div className="card filter-panel">
                <div className="filter-grid">
                  <label className="filter-field">
                    <div className="muted">Provider</div>
                    <select
                      className="select"
                      value={draftPackageFilters.provider}
                      onChange={(e) =>
                        setDraftPackageFilters((prev) => ({ ...prev, provider: e.target.value }))
                      }
                    >
                      <option value="any">Any</option>
                      {packageProviders.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="filter-field">
                    <div className="muted">Shifting</div>
                    <select
                      className="select"
                      value={draftPackageFilters.shifting}
                      onChange={(e) =>
                        setDraftPackageFilters((prev) => ({
                          ...prev,
                          shifting: e.target.value as PackageFilters['shifting']
                        }))
                      }
                    >
                      <option value="any">Any</option>
                      <option value="non-shifting">Non-shifting</option>
                      <option value="shifting">Shifting</option>
                    </select>
                  </label>

                  <label className="filter-field">
                    <div className="muted">Makkah zone</div>
                    <select
                      className="select"
                      value={draftPackageFilters.makkahZone}
                      onChange={(e) =>
                        setDraftPackageFilters((prev) => ({ ...prev, makkahZone: e.target.value }))
                      }
                    >
                      <option value="any">Any</option>
                      {packageZones.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="filter-field">
                    <div className="muted">Duration (days)</div>
                    <select
                      className="select"
                      value={draftPackageFilters.durationDays}
                      onChange={(e) =>
                        setDraftPackageFilters((prev) => ({ ...prev, durationDays: e.target.value }))
                      }
                    >
                      <option value="any">Any</option>
                      {packageDurations.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="filter-field">
                    <div className="muted">Start date</div>
                    <select
                      className="select"
                      value={draftPackageFilters.startDate}
                      onChange={(e) =>
                        setDraftPackageFilters((prev) => ({ ...prev, startDate: e.target.value }))
                      }
                    >
                      <option value="any">Any</option>
                      {packageStartDates.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="filter-field">
                    <div className="muted">End date</div>
                    <select
                      className="select"
                      value={draftPackageFilters.endDate}
                      onChange={(e) =>
                        setDraftPackageFilters((prev) => ({ ...prev, endDate: e.target.value }))
                      }
                    >
                      <option value="any">Any</option>
                      {packageEndDates.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="filter-field">
                    <div className="muted">Makkah hotel</div>
                    <select
                      className="select"
                      value={draftPackageFilters.makkahHotel}
                      onChange={(e) =>
                        setDraftPackageFilters((prev) => ({ ...prev, makkahHotel: e.target.value }))
                      }
                    >
                      <option value="any">Any</option>
                      {packageMakkahHotels.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="filter-field">
                    <div className="muted">Madinah hotel</div>
                    <select
                      className="select"
                      value={draftPackageFilters.madinahHotel}
                      onChange={(e) =>
                        setDraftPackageFilters((prev) => ({ ...prev, madinahHotel: e.target.value }))
                      }
                    >
                      <option value="any">Any</option>
                      {packageMadinahHotels.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="filter-field">
                    <div className="muted">Mina camp</div>
                    <select
                      className="select"
                      value={draftPackageFilters.minaCamp}
                      onChange={(e) =>
                        setDraftPackageFilters((prev) => ({
                          ...prev,
                          minaCamp: e.target.value as PackageFilters['minaCamp']
                        }))
                      }
                    >
                      <option value="any">Any</option>
                      <option value="majr">Majr AlKabsh</option>
                      <option value="muaisim">Al Muaisim</option>
                    </select>
                  </label>

                  <label className="filter-field">
                    <div className="muted">Price range (SAR)</div>
                    <div className="filter-inline">
                      <input
                        className="input"
                        type="number"
                        inputMode="decimal"
                        placeholder="Min"
                        value={draftPackageFilters.minPrice}
                        onChange={(e) =>
                          setDraftPackageFilters((prev) => ({ ...prev, minPrice: e.target.value }))
                        }
                      />
                      <input
                        className="input"
                        type="number"
                        inputMode="decimal"
                        placeholder="Max"
                        value={draftPackageFilters.maxPrice}
                        onChange={(e) =>
                          setDraftPackageFilters((prev) => ({ ...prev, maxPrice: e.target.value }))
                        }
                      />
                    </div>
                  </label>

                  <label className="filter-field">
                    <div className="muted">Sort by price</div>
                    <select
                      className="select"
                      value={draftPackageFilters.sort}
                      onChange={(e) =>
                        setDraftPackageFilters((prev) => ({
                          ...prev,
                          sort: e.target.value as PackageFilters['sort']
                        }))
                      }
                    >
                      <option value="none">Default order</option>
                      <option value="price-asc">Low to high</option>
                      <option value="price-desc">High to low</option>
                    </select>
                  </label>
                </div>

                <div className="filter-actions">
                  <button type="button" className="outline-btn" onClick={resetPackageFilters}>
                    Reset
                  </button>
                  <button type="button" className="primary-button" onClick={applyPackageFilters}>
                    Show packages
                  </button>
                </div>
              </div>
            )}

            {showCompareView && comparePackages.length > 0 && (
              <div className="card compare-table">
                <div className="compare-header">
                  <strong>Package comparison</strong>
                  <button type="button" className="outline-btn small" onClick={() => setShowCompareView(false)}>
                    Back to packages
                  </button>
                </div>

                <div className="compare-scroll">
                  <div
                    className="compare-grid"
                    style={{ gridTemplateColumns: `170px repeat(${comparePackages.length}, minmax(200px, 1fr))` }}
                  >
                    <div className="compare-cell compare-label">Provider</div>
                    {comparePackages.map((p) => (
                      <div key={`${p.id}-provider`} className="compare-cell">
                        {p.provider}
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Package</div>
                    {comparePackages.map((p) => (
                      <div key={`${p.id}-name`} className="compare-cell">
                        {p.packageName}
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Base price</div>
                    {comparePackages.map((p) => (
                      <div key={`${p.id}-price`} className="compare-cell">
                        {formatSAR(p.basePriceSAR)}
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Dates</div>
                    {comparePackages.map((p) => (
                      <div key={`${p.id}-dates`} className="compare-cell">
                        {p.startDate} → {p.endDate}
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Duration</div>
                    {comparePackages.map((p) => (
                      <div key={`${p.id}-duration`} className="compare-cell">
                        {p.durationDays} days
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Makkah zone</div>
                    {comparePackages.map((p) => (
                      <div key={`${p.id}-zone`} className="compare-cell">
                        {p.makkahZone}
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Shifting</div>
                    {comparePackages.map((p) => (
                      <div key={`${p.id}-shift`} className="compare-cell">
                        {p.isShifting ? 'Shifting' : 'Non-shifting'}
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Mina camp</div>
                    {comparePackages.map((p) => (
                      <div key={`${p.id}-camp`} className="compare-cell">
                        {campLabel(p.minaCamp)}
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Makkah hotel</div>
                    {comparePackages.map((p) => (
                      <div key={`${p.id}-makkah`} className="compare-cell">
                        {getHotelName(p, 'makkah') || '—'}
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Madinah hotel</div>
                    {comparePackages.map((p) => (
                      <div key={`${p.id}-madinah`} className="compare-cell">
                        {getHotelName(p, 'madinah') || '—'}
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Flight gateway</div>
                    {comparePackages.map((p) => (
                      <div key={`${p.id}-flight`} className="compare-cell">
                        {p.flight?.gateway || '—'}
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Package link</div>
                    {comparePackages.map((p) => (
                      <div key={`${p.id}-link`} className="compare-cell">
                        {p.packageLink ? (
                          <a href={p.packageLink} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        ) : (
                          '—'
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <NusukDisclaimer />

            {!showCompareView &&
              visiblePackages.map((p) => (
                <PackageCard
                  key={p.id}
                  pkg={p}
                  editedLocally={editedIds.has(p.id)}
                  isSaved={favouriteIds.includes(p.id)}
                  onToggleSaved={onToggleSaved}
                  onEdit={setEditingPkg}
                  showCompareToggle
                  isCompared={compareIds.includes(p.id)}
                  onToggleCompare={toggleCompare}
                />
              ))}

            <RejectedReport rejected={rejected} />
          </section>
        )}

        {/* PACKAGE+ */}
        {tab === 'packagePlus' && (
          <section>
            <h1>Package+</h1>
            <p className="muted" style={{ marginTop: '-0.25rem' }}>
              Alternative view using Al Muaisim + quad as the listed price. Adjust camp, room types,
              and hujjaj count to see your total.
            </p>

            {plusStatusLine}

            <div style={{ display: 'flex', gap: '0.5rem', margin: '0 0 0.75rem' }}>
              <button type="button" className="outline-btn" style={{ flex: 1 }} onClick={openPackagePlusFilters}>
                Filters & sort
              </button>
              <button type="button" className="outline-btn" style={{ flex: 1 }} onClick={resetPackagePlusFilters}>
                Show all packages
              </button>
            </div>

            {comparePlusIds.length > 0 && (
              <div className="card compare-summary">
                <div className="compare-summary-header">
                  <div>
                    <strong>Compare packages</strong>
                    <div className="muted">Select up to 3 packages to view side by side.</div>
                  </div>
                  <button type="button" className="outline-btn small" onClick={clearComparePlus}>
                    Clear
                  </button>
                </div>

                <div className="compare-tags">
                  {comparePlusPackages.map((p) => (
                    <span key={p.id} className="pill">
                      {p.provider} — {p.packageName}
                    </span>
                  ))}
                </div>

                <div className="compare-actions">
                  <button type="button" className="primary-button" onClick={openComparePlus}>
                    Compare
                  </button>
                </div>
              </div>
            )}

            {showPackagePlusFilters && (
              <div className="card filter-panel">
                <div className="filter-grid">
                  <label className="filter-field">
                    <div className="muted">Provider</div>
                    <select
                      className="select"
                      value={draftPackagePlusFilters.provider}
                      onChange={(e) =>
                        setDraftPackagePlusFilters((prev) => ({ ...prev, provider: e.target.value }))
                      }
                    >
                      <option value="any">Any</option>
                      {packagePlusProviders.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="filter-field">
                    <div className="muted">Shifting</div>
                    <select
                      className="select"
                      value={draftPackagePlusFilters.shifting}
                      onChange={(e) =>
                        setDraftPackagePlusFilters((prev) => ({
                          ...prev,
                          shifting: e.target.value as PackageFilters['shifting']
                        }))
                      }
                    >
                      <option value="any">Any</option>
                      <option value="non-shifting">Non-shifting</option>
                      <option value="shifting">Shifting</option>
                    </select>
                  </label>

                  <label className="filter-field">
                    <div className="muted">Makkah zone</div>
                    <select
                      className="select"
                      value={draftPackagePlusFilters.makkahZone}
                      onChange={(e) =>
                        setDraftPackagePlusFilters((prev) => ({ ...prev, makkahZone: e.target.value }))
                      }
                    >
                      <option value="any">Any</option>
                      {packagePlusZones.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="filter-field">
                    <div className="muted">Duration (days)</div>
                    <select
                      className="select"
                      value={draftPackagePlusFilters.durationDays}
                      onChange={(e) =>
                        setDraftPackagePlusFilters((prev) => ({ ...prev, durationDays: e.target.value }))
                      }
                    >
                      <option value="any">Any</option>
                      {packagePlusDurations.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="filter-field">
                    <div className="muted">Start date</div>
                    <select
                      className="select"
                      value={draftPackagePlusFilters.startDate}
                      onChange={(e) =>
                        setDraftPackagePlusFilters((prev) => ({ ...prev, startDate: e.target.value }))
                      }
                    >
                      <option value="any">Any</option>
                      {packagePlusStartDates.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="filter-field">
                    <div className="muted">End date</div>
                    <select
                      className="select"
                      value={draftPackagePlusFilters.endDate}
                      onChange={(e) =>
                        setDraftPackagePlusFilters((prev) => ({ ...prev, endDate: e.target.value }))
                      }
                    >
                      <option value="any">Any</option>
                      {packagePlusEndDates.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="filter-field">
                    <div className="muted">Makkah hotel</div>
                    <select
                      className="select"
                      value={draftPackagePlusFilters.makkahHotel}
                      onChange={(e) =>
                        setDraftPackagePlusFilters((prev) => ({ ...prev, makkahHotel: e.target.value }))
                      }
                    >
                      <option value="any">Any</option>
                      {packagePlusMakkahHotels.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="filter-field">
                    <div className="muted">Madinah hotel</div>
                    <select
                      className="select"
                      value={draftPackagePlusFilters.madinahHotel}
                      onChange={(e) =>
                        setDraftPackagePlusFilters((prev) => ({ ...prev, madinahHotel: e.target.value }))
                      }
                    >
                      <option value="any">Any</option>
                      {packagePlusMadinahHotels.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="filter-field">
                    <div className="muted">Mina camp</div>
                    <select
                      className="select"
                      value={draftPackagePlusFilters.minaCamp}
                      onChange={(e) =>
                        setDraftPackagePlusFilters((prev) => ({
                          ...prev,
                          minaCamp: e.target.value as PackageFilters['minaCamp']
                        }))
                      }
                    >
                      <option value="any">Any</option>
                      <option value="majr">Majr AlKabsh</option>
                      <option value="muaisim">Al Muaisim</option>
                    </select>
                  </label>

                  <label className="filter-field">
                    <div className="muted">Price range (SAR)</div>
                    <div className="filter-inline">
                      <input
                        className="input"
                        type="number"
                        inputMode="decimal"
                        placeholder="Min"
                        value={draftPackagePlusFilters.minPrice}
                        onChange={(e) =>
                          setDraftPackagePlusFilters((prev) => ({ ...prev, minPrice: e.target.value }))
                        }
                      />
                      <input
                        className="input"
                        type="number"
                        inputMode="decimal"
                        placeholder="Max"
                        value={draftPackagePlusFilters.maxPrice}
                        onChange={(e) =>
                          setDraftPackagePlusFilters((prev) => ({ ...prev, maxPrice: e.target.value }))
                        }
                      />
                    </div>
                  </label>

                  <label className="filter-field">
                    <div className="muted">Sort by price</div>
                    <select
                      className="select"
                      value={draftPackagePlusFilters.sort}
                      onChange={(e) =>
                        setDraftPackagePlusFilters((prev) => ({
                          ...prev,
                          sort: e.target.value as PackageFilters['sort']
                        }))
                      }
                    >
                      <option value="none">Default order</option>
                      <option value="price-asc">Low to high</option>
                      <option value="price-desc">High to low</option>
                    </select>
                  </label>
                </div>

                <div className="filter-actions">
                  <button type="button" className="outline-btn" onClick={resetPackagePlusFilters}>
                    Reset
                  </button>
                  <button type="button" className="primary-button" onClick={applyPackagePlusFilters}>
                    Show packages
                  </button>
                </div>
              </div>
            )}

            {showComparePlusView && comparePlusPackages.length > 0 && (
              <div className="card compare-table">
                <div className="compare-header">
                  <strong>Package comparison</strong>
                  <button type="button" className="outline-btn small" onClick={() => setShowComparePlusView(false)}>
                    Back to packages
                  </button>
                </div>

                <div className="compare-scroll">
                  <div
                    className="compare-grid"
                    style={{ gridTemplateColumns: `170px repeat(${comparePlusPackages.length}, minmax(200px, 1fr))` }}
                  >
                    <div className="compare-cell compare-label">Provider</div>
                    {comparePlusPackages.map((p) => (
                      <div key={`${p.id}-provider`} className="compare-cell">
                        {p.provider}
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Package</div>
                    {comparePlusPackages.map((p) => (
                      <div key={`${p.id}-name`} className="compare-cell">
                        {p.packageName}
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Base price</div>
                    {comparePlusPackages.map((p) => (
                      <div key={`${p.id}-price`} className="compare-cell">
                        {formatSAR(p.basePriceSAR)}
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Dates</div>
                    {comparePlusPackages.map((p) => (
                      <div key={`${p.id}-dates`} className="compare-cell">
                        {p.startDate} → {p.endDate}
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Duration</div>
                    {comparePlusPackages.map((p) => (
                      <div key={`${p.id}-duration`} className="compare-cell">
                        {p.durationDays} days
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Makkah zone</div>
                    {comparePlusPackages.map((p) => (
                      <div key={`${p.id}-zone`} className="compare-cell">
                        {p.makkahZone}
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Shifting</div>
                    {comparePlusPackages.map((p) => (
                      <div key={`${p.id}-shift`} className="compare-cell">
                        {p.isShifting ? 'Shifting' : 'Non-shifting'}
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Mina camp</div>
                    {comparePlusPackages.map((p) => (
                      <div key={`${p.id}-camp`} className="compare-cell">
                        {campLabel(p.minaCamp)}
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Makkah hotel</div>
                    {comparePlusPackages.map((p) => (
                      <div key={`${p.id}-makkah`} className="compare-cell">
                        {getHotelName(p, 'makkah') || '—'}
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Madinah hotel</div>
                    {comparePlusPackages.map((p) => (
                      <div key={`${p.id}-madinah`} className="compare-cell">
                        {getHotelName(p, 'madinah') || '—'}
                      </div>
                    ))}

                    <div className="compare-cell compare-label">Package link</div>
                    {comparePlusPackages.map((p) => (
                      <div key={`${p.id}-link`} className="compare-cell">
                        {p.packageLink ? (
                          <a href={p.packageLink} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        ) : (
                          '—'
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <NusukDisclaimer />

            {!showComparePlusView &&
              visiblePackagePlus.map((p) => (
                <PackagePlusCard
                  key={p.id}
                  pkg={p}
                  selection={getPackagePlusSelection(p)}
                  onSelectionChange={(updates) => updatePackagePlusSelection(p, updates)}
                  isSaved={favouriteIds.includes(p.id)}
                  onToggleSaved={onToggleSaved}
                  showCompareToggle
                  isCompared={comparePlusIds.includes(p.id)}
                  onToggleCompare={toggleComparePlus}
                />
              ))}

            <RejectedReport rejected={plusRejected} />
          </section>
        )}

        {/* PREFS */}
        {tab === 'preferences' && (
          <section>
            <PreferencesView value={prefs} onChange={setPrefs} />
            <div className="card muted">
              <strong>Saved automatically:</strong> Your preferences are stored only on this device so you don’t need to re-enter them.
            </div>
            <NusukDisclaimer />
          </section>
        )}
      </main>

      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>
            <span className="nav-icon">🏠</span>
            <span className="nav-label">Home</span>
          </button>
          <button className={tab === 'preferences' ? 'active' : ''} onClick={() => setTab('preferences')}>
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">Prefs</span>
          </button>
          <button className={tab === 'saved' ? 'active' : ''} onClick={() => setTab('saved')}>
            <span className="nav-icon">❤️</span>
            <span className="nav-label">Saved</span>
          </button>
          <button className={tab === 'packages' ? 'active' : ''} onClick={() => setTab('packages')}>
            <span className="nav-icon">📦</span>
            <span className="nav-label">Packages</span>
          </button>
          <button className={tab === 'packagePlus' ? 'active' : ''} onClick={() => setTab('packagePlus')}>
            <span className="nav-icon">➕</span>
            <span className="nav-label">Package+</span>
          </button>
          <button className={tab === 'recommend' ? 'active' : ''} onClick={() => setTab('recommend')}>
            <span className="nav-icon">⭐</span>
            <span className="nav-label">Recommend</span>
          </button>
        </div>
      </nav>

      {editingPkg && (
        <EditPackageModal
          pkg={editingPkg}
          isPreloaded={editingPkg.source === 'preloaded'}
          onClose={() => setEditingPkg(null)}
          onSaved={() => {
            const merged = mergePackages(preloaded)
            setMergedPackages(merged.packages)
            setEditedIds(merged.editedIds)
            setFavouriteIds(getFavouriteIds())
          }}
        />
      )}

      {addingPkg && (
        <AddPackageModal
          onClose={() => setAddingPkg(false)}
          onSaved={() => {
            const merged = mergePackages(preloaded)
            setMergedPackages(merged.packages)
            setEditedIds(merged.editedIds)
            setFavouriteIds(getFavouriteIds())
          }}
        />
      )}
    </div>
  )
}

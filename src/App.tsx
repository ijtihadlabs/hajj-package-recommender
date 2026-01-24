import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

import PreferencesView from './PreferencesView'
import EditPackageModal from './EditPackageModal'
import AddPackageModal from './AddPackageModal'
import { recommendPackages } from './recommendationEngine'
import { loadPreloadedPackages } from './preloadedLoader'
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

type Tab = 'home' | 'saved' | 'recommend' | 'packages' | 'preferences'

const MAJR_UPGRADE_FEE_SAR = 4673.42
const PREFS_KEY = 'hajj_prefs_v1'

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
  onEdit
}: {
  pkg: HajjPackage
  editedLocally: boolean
  isSaved: boolean
  onToggleSaved: (id: string) => void
  onEdit: (pkg: HajjPackage) => void
}) {
  const dateLine = `${pkg.startDate} → ${pkg.endDate} (${pkg.durationDays} days)`
  const hotelsLine = pkg.hotels
    .map((h) => `${h.city.toUpperCase()}: ${h.hotelName} (${h.checkInDate})`)
    .join(' • ')

  return (
    <div className="card">
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

  const [packagesProviderFilter, setPackagesProviderFilter] = useState<string>('all')
  const visiblePackages =
    packagesProviderFilter === 'all'
      ? mergedPackages
      : mergedPackages.filter((p) => p.provider === packagesProviderFilter)

  const savedPackages = useMemo(() => {
    const byId = new Map(mergedPackages.map((p) => [p.id, p]))
    return favouriteIds.map((id) => byId.get(id)).filter(Boolean) as HajjPackage[]
  }, [favouriteIds, mergedPackages])

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

  return (
    <div className="app-root">
      <main className="app-content">
        <TopNav tab={tab} onGoHome={() => setTab('home')} />

        {/* HOME */}
        {tab === 'home' && (
          <section>
            <h1>Hajj Package Helper</h1>
            <p className="muted" style={{ marginTop: '-0.25rem' }}>
              A small effort to make things easier for potential hujjaj — seeking nothing but your
              du‘ā’ and reward from Allah. May Allah accept from all of us and invite us to perform
              Hajj. Āmīn.
            </p>

            {statusLine}

            <HomeTile icon="🧭" title="Set preferences" description="Budget, dates, zone, camp, shifting, occupancy." onClick={() => setTab('preferences')} />
            <HomeTile icon="📦" title="View packages" description="Browse packages and filter by provider." onClick={() => setTab('packages')} />
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

            <label style={{ display: 'block', margin: '0.75rem 0' }}>
              <div className="muted" style={{ marginBottom: '0.35rem' }}>
                Filter by provider
              </div>
              <select value={packagesProviderFilter} onChange={(e) => setPackagesProviderFilter(e.target.value)} className="select">
                <option value="all">All providers</option>
                {allProviders.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>

            <NusukDisclaimer />

            {visiblePackages.map((p) => (
              <PackageCard
                key={p.id}
                pkg={p}
                editedLocally={editedIds.has(p.id)}
                isSaved={favouriteIds.includes(p.id)}
                onToggleSaved={onToggleSaved}
                onEdit={setEditingPkg}
              />
            ))}

            <RejectedReport rejected={rejected} />
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
          <button className={tab === 'saved' ? 'active' : ''} onClick={() => setTab('saved')}>
            <span className="nav-icon">❤️</span>
            <span className="nav-label">Saved</span>
          </button>
          <button className={tab === 'packages' ? 'active' : ''} onClick={() => setTab('packages')}>
            <span className="nav-icon">📦</span>
            <span className="nav-label">Packages</span>
          </button>
          <button className={tab === 'preferences' ? 'active' : ''} onClick={() => setTab('preferences')}>
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">Prefs</span>
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

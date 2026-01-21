import * as XLSX from 'xlsx'
import type { HajjPackage, StayLocation, MinaCamp, MakkahZone, UpgradeFees } from './models'

export type LoaderResult = {
  packages: HajjPackage[]
  rejected: Array<{
    rowIndex: number
    packageName?: string
    reason: string
  }>
}

function toISODate(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (!d) return undefined
    const yyyy = d.y
    const mm = String(d.m).padStart(2, '0')
    const dd = String(d.d).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  if (typeof v === 'string' && v.trim()) {
    const t = Date.parse(v)
    if (Number.isFinite(t)) return new Date(t).toISOString().slice(0, 10)
  }
  return undefined
}

/** Your rule: 0 = not available; blank = not applicable */
function availableNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  if (!Number.isFinite(n) || n === 0) return undefined
  return n
}

function parseStay(v: unknown): StayLocation | undefined {
  if (!v) return undefined
  const s = String(v).toLowerCase().trim()
  if (s === 'madinah' || s === 'makkah' || s === 'aziziya') return s as StayLocation
  return undefined
}

function isShiftingValue(v: unknown): boolean | undefined {
  if (!v) return undefined
  const s = String(v).toLowerCase().trim()
  if (s.includes('non')) return false
  if (s.includes('shift')) return true
  return undefined
}

function isValidZone(z: string): z is MakkahZone {
  return z === 'A' || z === 'B' || z === 'C' || z === 'M'
}

function parseCamp(v: unknown): MinaCamp | undefined {
  if (!v) return undefined
  const s = String(v).toLowerCase().trim()
  if (s.includes('majr')) return 'majr'
  if (s.includes('muai')) return 'muaisim'
  return undefined
}

function newId(i: number): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `pkg_${i}_${Date.now()}`
}

export async function loadPreloadedPackages(): Promise<LoaderResult> {
  const res = await fetch('/data/preloaded-packages.xlsx')
  if (!res.ok) {
    return { packages: [], rejected: [{ rowIndex: -1, reason: `Failed to fetch XLSX (${res.status})` }] }
  }

  const buf = await res.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })

  const sheet = wb.Sheets['APP_IMPORT']
  if (!sheet) {
    return { packages: [], rejected: [{ rowIndex: -1, reason: 'APP_IMPORT sheet not found' }] }
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })

  const packages: HajjPackage[] = []
  const rejected: LoaderResult['rejected'] = []

  rows.forEach((r, i) => {
    const rowIndex = i + 2

    const provider = (r.Provider ?? '').toString().trim()
    const packageName = (r.PackageName ?? '').toString().trim()
    const packageLink = (r.PackageLink ?? '').toString().trim()

    const startDate = toISODate(r.StartDate)
    const endDate = toISODate(r.EndDate)
    const durationDays = Number(r.DurationDays)

    const firstCity = parseStay(r.FirstCity)
    const shiftingParsed = isShiftingValue(r.IsShifting)
    const isShifting = shiftingParsed ?? true

    const zoneRaw = (r.MakkahZone ?? '').toString().trim().toUpperCase()
    const minaCamp = parseCamp(r.MinaCamp)

    const basePriceSAR = Number(r.BasePriceSAR)

    const madinahHotel = (r.MadinahHotel ?? '').toString().trim()
    const madinahCheckIn = toISODate(r.MadinahCheckIn)

    const makkahHotel = (r.MakkahHotel ?? '').toString().trim()
    const makkahCheckIn = toISODate(r.MakkahCheckIn)

    const aziziyaHotel = (r.AziziyaHotel ?? '').toString().trim()
    const aziziyaCheckIn = toISODate(r.AziziyaCheckIn)

    const flightGateway = (r.FlightGateway ?? '').toString().trim()
    const flightPriceSAR = availableNum(r.FlightPriceSAR)

    const upgradeFees: UpgradeFees = {
      makkah: {
        double: availableNum(r.DoubleUpgradeMakkah),
        triple: availableNum(r.TripleUpgradeMakkah)
      },
      madinah: {
        double: availableNum(r.DoubleUpgradeMadinah),
        triple: availableNum(r.TripleUpgradeMadinah)
      },
      aziziya: {
        double: availableNum(r.DoubleUpgradeAziziya),
        triple: availableNum(r.TripleUpgradeAziziya)
      }
    }

    const missing: string[] = []
    if (!provider) missing.push('Provider')
    if (!packageName) missing.push('PackageName')
    if (!packageLink) missing.push('PackageLink')
    if (!startDate) missing.push('StartDate')
    if (!endDate) missing.push('EndDate')
    if (!Number.isFinite(durationDays) || durationDays <= 0) missing.push('DurationDays')
    if (!firstCity) missing.push('FirstCity')
    if (!isValidZone(zoneRaw)) missing.push('MakkahZone')
    if (!minaCamp) missing.push('MinaCamp')
    if (!Number.isFinite(basePriceSAR) || basePriceSAR <= 0) missing.push('BasePriceSAR')

    if (!madinahHotel) missing.push('MadinahHotel')
    if (!madinahCheckIn) missing.push('MadinahCheckIn')
    if (!makkahHotel) missing.push('MakkahHotel')
    if (!makkahCheckIn) missing.push('MakkahCheckIn')

    if (isShifting) {
      if (!aziziyaHotel) missing.push('AziziyaHotel (required for shifting)')
      if (!aziziyaCheckIn) missing.push('AziziyaCheckIn (required for shifting)')
    }

    if (missing.length > 0) {
      rejected.push({
        rowIndex,
        packageName: packageName || undefined,
        reason: `Missing/invalid: ${missing.join(', ')}`
      })
      return
    }

    // ✅ Typed hotels array fixes the TS error
    const hotels: HajjPackage['hotels'] = [
      { city: 'madinah', hotelName: madinahHotel, checkInDate: madinahCheckIn! },
      { city: 'makkah', hotelName: makkahHotel, checkInDate: makkahCheckIn! }
    ]
    if (isShifting) {
      hotels.push({ city: 'aziziya', hotelName: aziziyaHotel, checkInDate: aziziyaCheckIn! })
    }

    const pkg: HajjPackage = {
      id: newId(i),
      source: 'preloaded',
      provider,
      packageName,
      startDate: startDate!,
      endDate: endDate!,
      durationDays,
      firstCity: firstCity!,
      isShifting,
      makkahZone: zoneRaw as MakkahZone,
      minaCamp: minaCamp!,
      hotels,
      basePriceSAR,
      upgradeFees,
      flight: flightGateway ? { gateway: flightGateway, priceSAR: flightPriceSAR } : undefined,
      packageLink
    }

    packages.push(pkg)
  })

  return { packages, rejected }
}

import type { HajjPackage, MinaCamp, MakkahZone, StayLocation } from './models'

export type CsvImportResult = {
  packages: HajjPackage[]
  errors: Array<{ row: number; message: string }>
}

function newId(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `csv_${Math.random().toString(16).slice(2)}_${Date.now()}`
}

function clean(s: string | undefined): string {
  return (s ?? '').trim()
}

function toNum(s: string | undefined): number | undefined {
  const v = clean(s)
  if (!v) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

/** rule: blank or 0 => not available */
function toUpgrade(s: string | undefined): number | undefined {
  const n = toNum(s)
  if (!n || n === 0) return undefined
  return n
}

function parseStay(s: string): StayLocation | undefined {
  const v = clean(s).toLowerCase()
  if (v === 'madinah' || v === 'makkah' || v === 'aziziya') return v as StayLocation
  return undefined
}

function parseZone(s: string): MakkahZone | undefined {
  const v = clean(s).toUpperCase()
  if (v === 'A' || v === 'B' || v === 'C' || v === 'M') return v as MakkahZone
  return undefined
}

function parseCamp(s: string): MinaCamp | undefined {
  const v = clean(s).toLowerCase()
  if (v === 'majr') return 'majr'
  if (v === 'muaisim') return 'muaisim'
  return undefined
}

function parseShifting(s: string): boolean | undefined {
  const v = clean(s).toLowerCase()
  if (v === 'shifting') return true
  if (v === 'non-shifting' || v === 'nonshifting') return false
  return undefined
}

/**
 * Simple CSV parser for your template.
 * Assumes no commas inside fields.
 */
function parseCsv(text: string): string[][] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '')

  return lines.map((line) =>
    line.split(',').map((cell) => cell.replace(/^"(.*)"$/, '$1').trim())
  )
}

export function importTemplateCsv(text: string): CsvImportResult {
  const rows = parseCsv(text)
  if (rows.length < 2) {
    return { packages: [], errors: [{ row: 0, message: 'CSV has no data rows.' }] }
  }

  const header = rows[0]
  const idx = (name: string) => header.indexOf(name)

  const requiredHeaders = [
    'Provider',
    'PackageName',
    'StartDate',
    'EndDate',
    'DurationDays',
    'FirstCity',
    'Shifting',
    'MakkahZone',
    'MinaCamp',
    'BasePriceSAR',
    'MadinahHotel',
    'MadinahCheckIn',
    'MakkahHotel',
    'MakkahCheckIn'
  ]

  for (const h of requiredHeaders) {
    if (idx(h) === -1) {
      return { packages: [], errors: [{ row: 0, message: `Missing required header: ${h}` }] }
    }
  }

  const packages: HajjPackage[] = []
  const errors: CsvImportResult['errors'] = []

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const rowNum = r + 1

    const provider = clean(row[idx('Provider')])
    const packageName = clean(row[idx('PackageName')])

    const startDate = clean(row[idx('StartDate')])
    const endDate = clean(row[idx('EndDate')])
    const durationDays = toNum(row[idx('DurationDays')])

    const firstCity = parseStay(row[idx('FirstCity')])
    const isShifting = parseShifting(row[idx('Shifting')])

    const zone = parseZone(row[idx('MakkahZone')])
    const camp = parseCamp(row[idx('MinaCamp')])

    const base = toNum(row[idx('BasePriceSAR')])

    const madinahHotel = clean(row[idx('MadinahHotel')])
    const madinahCheckIn = clean(row[idx('MadinahCheckIn')])
    const makkahHotel = clean(row[idx('MakkahHotel')])
    const makkahCheckIn = clean(row[idx('MakkahCheckIn')])

    const azHotelIdx = idx('AziziyaHotel')
    const azInIdx = idx('AziziyaCheckIn')
    const azHotel = azHotelIdx >= 0 ? clean(row[azHotelIdx]) : ''
    const azIn = azInIdx >= 0 ? clean(row[azInIdx]) : ''

    const linkIdx = idx('PackageLink')
    const packageLink = linkIdx >= 0 ? clean(row[linkIdx]) : ''

    const flightGatewayIdx = idx('FlightGateway')
    const flightGateway = flightGatewayIdx >= 0 ? clean(row[flightGatewayIdx]) : ''
    const flightPriceIdx = idx('FlightPriceSAR')
    const flightPrice = flightPriceIdx >= 0 ? toNum(row[flightPriceIdx]) : undefined

    if (!provider || !packageName) {
      errors.push({ row: rowNum, message: 'Provider and PackageName are required.' })
      continue
    }
    if (!startDate || !endDate || !durationDays || durationDays <= 0) {
      errors.push({ row: rowNum, message: 'StartDate/EndDate/DurationDays are required and must be valid.' })
      continue
    }
    if (!firstCity || isShifting === undefined) {
      errors.push({
        row: rowNum,
        message: 'FirstCity must be madinah/makkah/aziziya and Shifting must be shifting/non-shifting.'
      })
      continue
    }
    if (!zone || !camp) {
      errors.push({ row: rowNum, message: 'MakkahZone must be A/B/C/M and MinaCamp must be majr/muaisim.' })
      continue
    }
    if (!base || base <= 0) {
      errors.push({ row: rowNum, message: 'BasePriceSAR must be a positive number.' })
      continue
    }
    if (!madinahHotel || !madinahCheckIn || !makkahHotel || !makkahCheckIn) {
      errors.push({ row: rowNum, message: 'Madinah/Makkah hotels and check-in dates are required.' })
      continue
    }
    if (isShifting && (!azHotel || !azIn)) {
      errors.push({ row: rowNum, message: 'Aziziya hotel and check-in date are required for shifting packages.' })
      continue
    }

    // upgrades (optional)
    const makD = idx('MakkahDoubleUpgrade') >= 0 ? toUpgrade(row[idx('MakkahDoubleUpgrade')]) : undefined
    const makT = idx('MakkahTripleUpgrade') >= 0 ? toUpgrade(row[idx('MakkahTripleUpgrade')]) : undefined
    const madD = idx('MadinahDoubleUpgrade') >= 0 ? toUpgrade(row[idx('MadinahDoubleUpgrade')]) : undefined
    const madT = idx('MadinahTripleUpgrade') >= 0 ? toUpgrade(row[idx('MadinahTripleUpgrade')]) : undefined
    const aziD = idx('AziziyaDoubleUpgrade') >= 0 ? toUpgrade(row[idx('AziziyaDoubleUpgrade')]) : undefined
    const aziT = idx('AziziyaTripleUpgrade') >= 0 ? toUpgrade(row[idx('AziziyaTripleUpgrade')]) : undefined

    const hasAnyUpgrade = !!(makD || makT || madD || madT || aziD || aziT)

    // ✅ IMPORTANT: typed hotels array so city stays a StayLocation (not generic string)
    const hotels: HajjPackage['hotels'] = [
      { city: 'madinah', hotelName: madinahHotel, checkInDate: madinahCheckIn },
      { city: 'makkah', hotelName: makkahHotel, checkInDate: makkahCheckIn }
    ]
    if (isShifting) {
      hotels.push({ city: 'aziziya', hotelName: azHotel, checkInDate: azIn })
    }

    const pkg: HajjPackage = {
      id: newId(),
      source: 'user',

      provider,
      packageName,

      startDate,
      endDate,
      durationDays,

      firstCity,
      isShifting,

      makkahZone: zone,
      minaCamp: camp,

      basePriceSAR: base,

      hotels,

      upgradeFees: hasAnyUpgrade
        ? {
            makkah: { double: makD, triple: makT },
            madinah: { double: madD, triple: madT },
            aziziya: { double: aziD, triple: aziT }
          }
        : undefined,

      flight: flightGateway ? { gateway: flightGateway, priceSAR: flightPrice } : undefined,
      packageLink: packageLink || undefined
    }

    packages.push(pkg)
  }

  return { packages, errors }
}

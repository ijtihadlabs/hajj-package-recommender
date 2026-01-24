/* =========================
   Core domain enums
   ========================= */

export type OccupancyType = 'double' | 'triple' | 'quad'

export type ShiftingType = 'shifting' | 'non-shifting'

export type StayLocation = 'madinah' | 'makkah' | 'aziziya'

/**
 * Makkah zones as used in your dataset
 * A = closest, M = farthest
 */
export type MakkahZone = 'A' | 'B' | 'C' | 'M'

/**
 * Mina camps (restricted)
 */
export type MinaCamp = 'majr' | 'muaisim'

/* =========================
   Hotel stay model
   ========================= */

export interface HotelStay {
  city: StayLocation
  hotelName: string
  checkInDate: string // ISO date
}

/* =========================
   Upgrade fees (per person, SAR)
   0 or undefined = not available
   ========================= */

export interface UpgradeFees {
  makkah?: {
    double?: number
    triple?: number
  }
  madinah?: {
    double?: number
    triple?: number
  }
  aziziya?: {
    double?: number
    triple?: number
  }
}

/* =========================
   Flight baseline (editable by user)
   ========================= */

export interface FlightInfo {
  gateway: string
  priceSAR?: number
}

/* =========================
   Package model (canonical)
   ========================= */

export interface HajjPackage {
  /** Identity */
  id: string
  provider: string
  packageName: string
  source: 'preloaded' | 'user'

  /** Dates */
  startDate: string
  endDate: string
  durationDays: number

  /** Structure */
  firstCity: StayLocation
  isShifting: boolean

  /** Locations */
  makkahZone: MakkahZone
  minaCamp: MinaCamp
  minaCampUpgradeAvailable?: boolean

  /** Hotel stays */
  hotels: HotelStay[]

  /** Base pricing (SAR per person) */
  basePriceSAR: number

  /** Occupancy upgrade fees */
  upgradeFees?: UpgradeFees

  /** Flight (baseline only, editable) */
  flight?: FlightInfo

  /** External reference */
  packageLink?: string

  /** Notes / disclaimer */
  notes?: string

  /** Metadata */
  lastUpdated?: string
}

/* =========================
   User preferences
   ========================= */

export interface Preferences {
  /** Recommendation filters */
  provider?: string | 'any'

  firstStay?: StayLocation | 'any'
  lastStay?: StayLocation | 'any'

  startDate?: string
  endDate?: string
  durationDays?: number

  makkahZone?: MakkahZone | 'any'
  minaCamp?: MinaCamp | 'any'

  occupancy?: OccupancyType | 'any'
  shifting?: ShiftingType | 'any'

  /** Budget */
  budgetAmount: number
  budgetCurrency: string
  hujjajCount: number
}

/* =========================
   Recommendation output
   ========================= */

export interface Recommendation {
  pkg: HajjPackage
  totalScore: number

  breakdown: {
    preferenceMatch: number
    valueQuality: number
    budgetFit: number
    scarcityPenalty: number
  }

  reasons: string[]
}

/* =========================
   Mina capacity (scarcity)
   ========================= */

export const MINA_CAPACITY: Record<MinaCamp, number> = {
  majr: 5000,
  muaisim: 44000
}

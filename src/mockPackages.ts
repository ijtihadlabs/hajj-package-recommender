import type { HajjPackage } from './models'

export const mockPackages: HajjPackage[] = [
  {
    id: 'p1',
    provider: 'Al Bait',
    packageName: 'AB-MAJR-A',
    source: 'preloaded',
    startDate: '2026-05-18',
    endDate: '2026-06-02',
    durationDays: 15,
    firstCity: 'madinah',
    isShifting: true,
    makkahZone: 'A',
    minaCamp: 'majr',
    hotels: [
      { city: 'madinah', hotelName: 'Madinah Hotel 1', checkInDate: '2026-05-18' },
      { city: 'makkah', hotelName: 'Makkah Hotel A', checkInDate: '2026-05-24' },
      { city: 'aziziya', hotelName: 'Aziziya Hotel 1', checkInDate: '2026-05-28' }
    ],
    basePriceSAR: 82000,
    upgradeFees: {
      makkah: { double: 0, triple: 6000 },
      madinah: { double: 0, triple: 0 },
      aziziya: { double: 0, triple: 0 }
    },
    flight: { gateway: 'LHR', priceSAR: 0 },
    packageLink: ''
  },
  {
    id: 'p2',
    provider: 'Rawaf Mina',
    packageName: 'RM-MUA-B',
    source: 'preloaded',
    startDate: '2026-05-20',
    endDate: '2026-06-03',
    durationDays: 14,
    firstCity: 'madinah',
    isShifting: true,
    makkahZone: 'B',
    minaCamp: 'muaisim',
    hotels: [
      { city: 'madinah', hotelName: 'Madinah Hotel 2', checkInDate: '2026-05-20' },
      { city: 'makkah', hotelName: 'Makkah Hotel B', checkInDate: '2026-05-25' },
      { city: 'aziziya', hotelName: 'Aziziya Hotel 2', checkInDate: '2026-05-29' }
    ],
    basePriceSAR: 76000,
    upgradeFees: {
      makkah: { double: 9000, triple: 0 },
      madinah: { double: 0, triple: 0 },
      aziziya: { double: 0, triple: 0 }
    },
    flight: { gateway: 'LHR', priceSAR: 0 },
    packageLink: ''
  },
  {
    id: 'p3',
    provider: 'Seera Group',
    packageName: 'SR-NONSHIFT-C',
    source: 'preloaded',
    startDate: '2026-05-17',
    endDate: '2026-06-05',
    durationDays: 19,
    firstCity: 'madinah',
    isShifting: false,
    makkahZone: 'C',
    minaCamp: 'muaisim',
    hotels: [
      { city: 'madinah', hotelName: 'Madinah Hotel 3', checkInDate: '2026-05-17' },
      { city: 'makkah', hotelName: 'Makkah Hotel C (Non-shifting)', checkInDate: '2026-05-22' }
    ],
    basePriceSAR: 72000,
    // non-shifting: aziziya-related upgrades not applicable (left undefined)
    upgradeFees: {
      makkah: { double: 0, triple: 0 },
      madinah: { double: 0, triple: 0 }
    },
    flight: { gateway: 'LHR', priceSAR: 0 },
    packageLink: ''
  },
  {
    id: 'p4',
    provider: 'Dur Hospitality',
    packageName: 'DH-MAJR-B',
    source: 'preloaded',
    startDate: '2026-05-19',
    endDate: '2026-06-01',
    durationDays: 14,
    firstCity: 'madinah',
    isShifting: true,
    makkahZone: 'B',
    minaCamp: 'majr',
    hotels: [
      { city: 'madinah', hotelName: 'Madinah Hotel 4', checkInDate: '2026-05-19' },
      { city: 'makkah', hotelName: 'Makkah Hotel B+', checkInDate: '2026-05-24' },
      { city: 'aziziya', hotelName: 'Aziziya Hotel 3', checkInDate: '2026-05-28' }
    ],
    basePriceSAR: 86000,
    upgradeFees: {
      makkah: { double: 12000, triple: 6000 },
      madinah: { double: 0, triple: 0 },
      aziziya: { double: 0, triple: 0 }
    },
    flight: { gateway: 'LHR', priceSAR: 0 },
    packageLink: ''
  },
  {
    id: 'p5',
    provider: 'User Added',
    packageName: 'USER-MUA-A',
    source: 'user',
    startDate: '2026-05-21',
    endDate: '2026-06-02',
    durationDays: 12,
    firstCity: 'madinah',
    isShifting: true,
    makkahZone: 'A',
    minaCamp: 'muaisim',
    hotels: [
      { city: 'madinah', hotelName: 'Madinah Hotel X', checkInDate: '2026-05-21' },
      { city: 'makkah', hotelName: 'Makkah Hotel A', checkInDate: '2026-05-26' },
      { city: 'aziziya', hotelName: 'Aziziya Hotel X', checkInDate: '2026-05-30' }
    ],
    basePriceSAR: 79000,
    flight: { gateway: 'MAN', priceSAR: 0 },
    packageLink: ''
  }
]

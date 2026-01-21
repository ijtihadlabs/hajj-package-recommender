/**
 * CSV template for bulk package import
 * -----------------------------------
 * Rules (important):
 * - Leave a cell BLANK if not applicable
 * - Use 0 ONLY when an option is explicitly NOT AVAILABLE
 * - Prices are SAR per person
 * - Upgrade fees are differences vs Quad
 */

const HEADERS = [
  // Identity
  'Provider',
  'PackageName',

  // Dates & duration
  'StartDate',
  'EndDate',
  'DurationDays',

  // Structure
  'FirstCity', // madinah | makkah | aziziya
  'Shifting', // shifting | non-shifting

  // Location quality
  'MakkahZone', // A | B | C | M
  'MinaCamp', // majr | muaisim

  // Pricing
  'BasePriceSAR', // quad baseline

  // Upgrade fees vs quad (SAR pp)
  'MakkahDoubleUpgrade',
  'MakkahTripleUpgrade',
  'MadinahDoubleUpgrade',
  'MadinahTripleUpgrade',
  'AziziyaDoubleUpgrade',
  'AziziyaTripleUpgrade',

  // Hotels
  'MadinahHotel',
  'MadinahCheckIn',
  'MakkahHotel',
  'MakkahCheckIn',
  'AziziyaHotel',
  'AziziyaCheckIn',

  // Flight (baseline)
  'FlightGateway',
  'FlightPriceSAR',

  // Meta
  'PackageLink'
]

export function downloadTemplateCsv() {
  const rows = [
    HEADERS.join(','),
    // Example row (can be deleted by user)
    [
      'Example Provider',
      'Example Package',
      '2026-05-20',
      '2026-06-05',
      '17',
      'madinah',
      'shifting',
      'A',
      'muaisim',
      '25000',
      '3000',
      '2000',
      '',
      '',
      '',
      '',
      'Hotel Madinah',
      '2026-05-20',
      'Hotel Makkah',
      '2026-05-28',
      'Hotel Aziziya',
      '2026-06-01',
      'LHR',
      '3500',
      'https://hajj.nusuk.sa/'
    ].join(',')
  ]

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = 'hajj-package-import-template.csv'
  a.click()

  URL.revokeObjectURL(url)
}

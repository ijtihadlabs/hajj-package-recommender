import { useMemo, useState } from 'react'
import type { HajjPackage, MinaCamp, MakkahZone, StayLocation } from './models'
import { clearPackageOverride, savePackageOverride } from './localStore'

type Props = {
  pkg: HajjPackage
  isPreloaded: boolean
  onClose: () => void
  onSaved: () => void
}

function FieldLabel({ children }: { children: string }) {
  return (
    <div style={{ fontSize: '0.9rem', marginBottom: '0.35rem', color: 'var(--muted)' }}>
      {children}
    </div>
  )
}

function Input({
  label,
  value,
  type = 'text',
  placeholder,
  onChange
}: {
  label: string
  value: string
  type?: string
  placeholder?: string
  onChange: (v: string) => void
}) {
  return (
    <label style={{ display: 'block', marginBottom: '0.85rem' }}>
      <FieldLabel>{label}</FieldLabel>
      <input
        value={value}
        type={type}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '0.75rem 0.8rem',
          borderRadius: '0.75rem',
          border: '1px solid var(--border)',
          fontSize: '1rem',
          background: 'var(--card-bg)',
          color: 'var(--text)'
        }}
      />
    </label>
  )
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <label style={{ display: 'block', marginBottom: '0.85rem' }}>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={{
          width: '100%',
          padding: '0.75rem 0.8rem',
          borderRadius: '0.75rem',
          border: '1px solid var(--border)',
          fontSize: '1rem',
          background: 'var(--card-bg)',
          color: 'var(--text)'
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Rule: blank or 0 => not available */
function parseUpgrade(v: string): number | undefined {
  const s = v.trim()
  if (!s) return undefined
  const n = Number(s)
  if (!Number.isFinite(n) || n === 0) return undefined
  return n
}

function fmtNumOrEmpty(n?: number): string {
  return typeof n === 'number' && n !== 0 ? String(n) : ''
}

export default function EditPackageModal({ pkg, isPreloaded, onClose, onSaved }: Props) {
  const [provider, setProvider] = useState(pkg.provider)
  const [packageName, setPackageName] = useState(pkg.packageName)

  const [startDate, setStartDate] = useState(pkg.startDate)
  const [endDate, setEndDate] = useState(pkg.endDate)
  const [durationDays, setDurationDays] = useState(String(pkg.durationDays))

  const [firstCity, setFirstCity] = useState<StayLocation>(pkg.firstCity)

  // ✅ strict type so TS is happy
  const [shifting, setShifting] = useState<'shifting' | 'non-shifting'>(
    pkg.isShifting ? 'shifting' : 'non-shifting'
  )

  const [makkahZone, setMakkahZone] = useState<MakkahZone>(pkg.makkahZone)
  const [minaCamp, setMinaCamp] = useState<MinaCamp>(pkg.minaCamp)

  const [basePriceSAR, setBasePriceSAR] = useState(String(pkg.basePriceSAR))

  const [flightGateway, setFlightGateway] = useState(pkg.flight?.gateway ?? '')
  const [flightPriceSAR, setFlightPriceSAR] = useState(
    pkg.flight?.priceSAR ? String(pkg.flight.priceSAR) : ''
  )

  const [packageLink, setPackageLink] = useState(pkg.packageLink ?? '')

  // Hotels
  const madinah = useMemo(() => pkg.hotels.find((h) => h.city === 'madinah'), [pkg.hotels])
  const makkah = useMemo(() => pkg.hotels.find((h) => h.city === 'makkah'), [pkg.hotels])
  const aziziya = useMemo(() => pkg.hotels.find((h) => h.city === 'aziziya'), [pkg.hotels])

  const [madinahHotel, setMadinahHotel] = useState(madinah?.hotelName ?? '')
  const [madinahCheckIn, setMadinahCheckIn] = useState(madinah?.checkInDate ?? '')
  const [makkahHotel, setMakkahHotel] = useState(makkah?.hotelName ?? '')
  const [makkahCheckIn, setMakkahCheckIn] = useState(makkah?.checkInDate ?? '')
  const [aziziyaHotel, setAziziyaHotel] = useState(aziziya?.hotelName ?? '')
  const [aziziyaCheckIn, setAziziyaCheckIn] = useState(aziziya?.checkInDate ?? '')

  // Upgrade fees (difference vs quad)
  const [makD, setMakD] = useState(fmtNumOrEmpty(pkg.upgradeFees?.makkah?.double))
  const [makT, setMakT] = useState(fmtNumOrEmpty(pkg.upgradeFees?.makkah?.triple))
  const [madD, setMadD] = useState(fmtNumOrEmpty(pkg.upgradeFees?.madinah?.double))
  const [madT, setMadT] = useState(fmtNumOrEmpty(pkg.upgradeFees?.madinah?.triple))
  const [aziD, setAziD] = useState(fmtNumOrEmpty(pkg.upgradeFees?.aziziya?.double))
  const [aziT, setAziT] = useState(fmtNumOrEmpty(pkg.upgradeFees?.aziziya?.triple))

  function save() {
    const duration = Number(durationDays)
    const base = Number(basePriceSAR)
    const fp = flightPriceSAR.trim() === '' ? undefined : Number(flightPriceSAR)

    const isShifting = shifting === 'shifting'

    const hotels: HajjPackage['hotels'] = [
      { city: 'madinah', hotelName: madinahHotel.trim(), checkInDate: madinahCheckIn },
      { city: 'makkah', hotelName: makkahHotel.trim(), checkInDate: makkahCheckIn }
    ]
    if (isShifting) {
      hotels.push({ city: 'aziziya', hotelName: aziziyaHotel.trim(), checkInDate: aziziyaCheckIn })
    }

    const upgradeFees = {
      makkah: { double: parseUpgrade(makD), triple: parseUpgrade(makT) },
      madinah: { double: parseUpgrade(madD), triple: parseUpgrade(madT) },
      aziziya: { double: parseUpgrade(aziD), triple: parseUpgrade(aziT) }
    }

    const hasAnyUpgrade =
      upgradeFees.makkah.double || upgradeFees.makkah.triple ||
      upgradeFees.madinah.double || upgradeFees.madinah.triple ||
      upgradeFees.aziziya.double || upgradeFees.aziziya.triple

    const override: Partial<HajjPackage> = {
      provider: provider.trim(),
      packageName: packageName.trim(),
      startDate,
      endDate,
      durationDays: Number.isFinite(duration) ? duration : pkg.durationDays,
      firstCity,
      isShifting,
      makkahZone,
      minaCamp,
      basePriceSAR: Number.isFinite(base) ? base : pkg.basePriceSAR,
      hotels,
      upgradeFees: hasAnyUpgrade ? upgradeFees : undefined,
      flight: flightGateway.trim()
        ? { gateway: flightGateway.trim(), priceSAR: Number.isFinite(fp as number) ? fp : undefined }
        : undefined,
      packageLink: packageLink.trim()
    }

    savePackageOverride(pkg.id, override)
    onSaved()
    onClose()
  }

  function resetToOriginal() {
    clearPackageOverride(pkg.id)
    onSaved()
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        zIndex: 50
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          background: 'var(--bg)',
          color: 'var(--text)',
          borderTopLeftRadius: '1.1rem',
          borderTopRightRadius: '1.1rem',
          border: '1px solid var(--border)',
          borderBottom: 'none',
          padding: '1rem',
          maxHeight: '85vh',
          overflowY: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: '1.15rem' }}>Edit package</div>
            <div className="muted" style={{ marginTop: '0.25rem' }}>
              Changes are saved only on your device.
            </div>
          </div>

          <button type="button" className="outline-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="card" style={{ marginTop: '0.9rem' }}>
          <strong>Warning:</strong>{' '}
          <span className="muted">
            If you edit package details, you are responsible for verifying accuracy with Nusuk and the provider.
          </span>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <Input label="Provider" value={provider} onChange={setProvider} />
          <Input label="Package name" value={packageName} onChange={setPackageName} />

          <Input label="Start date" type="date" value={startDate} onChange={setStartDate} />
          <Input label="End date" type="date" value={endDate} onChange={setEndDate} />
          <Input label="Duration (days)" type="number" value={durationDays} onChange={setDurationDays} />

          <Select<StayLocation>
            label="First city"
            value={firstCity}
            onChange={setFirstCity}
            options={[
              { value: 'madinah', label: 'Madinah' },
              { value: 'makkah', label: 'Makkah' },
              { value: 'aziziya', label: 'Aziziya' }
            ]}
          />

          <Select<'shifting' | 'non-shifting'>
            label="Shifting"
            value={shifting}
            onChange={setShifting}
            options={[
              { value: 'shifting', label: 'Shifting' },
              { value: 'non-shifting', label: 'Non-shifting' }
            ]}
          />

          <Select<MakkahZone>
            label="Makkah zone"
            value={makkahZone}
            onChange={setMakkahZone}
            options={[
              { value: 'A', label: 'A (closest)' },
              { value: 'B', label: 'B' },
              { value: 'C', label: 'C' },
              { value: 'M', label: 'M (farthest)' }
            ]}
          />

          <Select<MinaCamp>
            label="Mina camp"
            value={minaCamp}
            onChange={setMinaCamp}
            options={[
              { value: 'majr', label: 'Majr AlKabsh' },
              { value: 'muaisim', label: 'Al Muaisim' }
            ]}
          />

          <Input label="Listed price (SAR, quad baseline)" type="number" value={basePriceSAR} onChange={setBasePriceSAR} />

          <div className="card" style={{ marginTop: '0.5rem' }}>
            <strong>Occupancy upgrade fees (difference vs Quad)</strong>
            <div className="muted" style={{ marginTop: '0.35rem' }}>
              Leave blank (or 0) if not available.
            </div>

            <div style={{ marginTop: '0.75rem', fontWeight: 900 }}>Makkah</div>
            <Input label="Double upgrade (SAR pp)" type="number" value={makD} onChange={setMakD} />
            <Input label="Triple upgrade (SAR pp)" type="number" value={makT} onChange={setMakT} />

            <div style={{ marginTop: '0.5rem', fontWeight: 900 }}>Madinah</div>
            <Input label="Double upgrade (SAR pp)" type="number" value={madD} onChange={setMadD} />
            <Input label="Triple upgrade (SAR pp)" type="number" value={madT} onChange={setMadT} />

            {shifting === 'shifting' && (
              <>
                <div style={{ marginTop: '0.5rem', fontWeight: 900 }}>Aziziya</div>
                <Input label="Double upgrade (SAR pp)" type="number" value={aziD} onChange={setAziD} />
                <Input label="Triple upgrade (SAR pp)" type="number" value={aziT} onChange={setAziT} />
              </>
            )}
          </div>

          <Input label="Flight gateway (baseline)" value={flightGateway} onChange={setFlightGateway} />
          <Input label="Flight price (SAR, baseline)" type="number" value={flightPriceSAR} onChange={setFlightPriceSAR} />

          <Input label="Package link" value={packageLink} onChange={setPackageLink} />

          <div style={{ marginTop: '0.75rem', fontWeight: 900 }}>Hotels & check-in</div>

          <Input label="Madinah hotel" value={madinahHotel} onChange={setMadinahHotel} />
          <Input label="Madinah check-in" type="date" value={madinahCheckIn} onChange={setMadinahCheckIn} />

          <Input label="Makkah hotel" value={makkahHotel} onChange={setMakkahHotel} />
          <Input label="Makkah check-in" type="date" value={makkahCheckIn} onChange={setMakkahCheckIn} />

          {shifting === 'shifting' && (
            <>
              <Input label="Aziziya hotel" value={aziziyaHotel} onChange={setAziziyaHotel} />
              <Input label="Aziziya check-in" type="date" value={aziziyaCheckIn} onChange={setAziziyaCheckIn} />
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
          <button type="button" className="outline-btn" style={{ flex: 1 }} onClick={save}>
            Save locally
          </button>

          {isPreloaded && (
            <button type="button" className="outline-btn" style={{ flex: 1 }} onClick={resetToOriginal}>
              Reset to original
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

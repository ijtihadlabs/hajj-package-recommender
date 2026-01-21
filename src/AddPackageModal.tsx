import { useState } from 'react'
import type { HajjPackage, MinaCamp, MakkahZone, StayLocation } from './models'
import { saveUserPackage } from './localStore'

type Props = {
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

function newId(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `user_${Math.random().toString(16).slice(2)}_${Date.now()}`
}

/** User rule: blank or 0 means "not available" */
function parseUpgrade(v: string): number | undefined {
  const s = v.trim()
  if (!s) return undefined
  const n = Number(s)
  if (!Number.isFinite(n) || n === 0) return undefined
  return n
}

export default function AddPackageModal({ onClose, onSaved }: Props) {
  const [provider, setProvider] = useState('')
  const [packageName, setPackageName] = useState('')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [durationDays, setDurationDays] = useState('')

  const [firstCity, setFirstCity] = useState<StayLocation>('madinah')
  const [shifting, setShifting] = useState<'shifting' | 'non-shifting'>('shifting')

  const [makkahZone, setMakkahZone] = useState<MakkahZone>('A')
  const [minaCamp, setMinaCamp] = useState<MinaCamp>('muaisim')

  const [basePriceSAR, setBasePriceSAR] = useState('')

  const [flightGateway, setFlightGateway] = useState('')
  const [flightPriceSAR, setFlightPriceSAR] = useState('')

  const [packageLink, setPackageLink] = useState('')

  const [madinahHotel, setMadinahHotel] = useState('')
  const [madinahCheckIn, setMadinahCheckIn] = useState('')
  const [makkahHotel, setMakkahHotel] = useState('')
  const [makkahCheckIn, setMakkahCheckIn] = useState('')
  const [aziziyaHotel, setAziziyaHotel] = useState('')
  const [aziziyaCheckIn, setAziziyaCheckIn] = useState('')

  // Upgrade fees (difference vs quad), per person, SAR
  const [makD, setMakD] = useState('')
  const [makT, setMakT] = useState('')
  const [madD, setMadD] = useState('')
  const [madT, setMadT] = useState('')
  const [aziD, setAziD] = useState('')
  const [aziT, setAziT] = useState('')

  function save() {
    const dur = Number(durationDays)
    const base = Number(basePriceSAR)
    const fp = flightPriceSAR.trim() === '' ? undefined : Number(flightPriceSAR)

    const isShifting = shifting === 'shifting'

    if (!provider.trim() || !packageName.trim()) {
      alert('Please enter Provider and Package name.')
      return
    }
    if (!startDate || !endDate || !Number.isFinite(dur) || dur <= 0) {
      alert('Please enter valid Start date, End date, and Duration.')
      return
    }
    if (!Number.isFinite(base) || base <= 0) {
      alert('Please enter a valid Listed price (SAR).')
      return
    }
    if (!madinahHotel.trim() || !madinahCheckIn || !makkahHotel.trim() || !makkahCheckIn) {
      alert('Please enter Madinah and Makkah hotel + check-in dates.')
      return
    }
    if (isShifting && (!aziziyaHotel.trim() || !aziziyaCheckIn)) {
      alert('For shifting packages, please enter Aziziya hotel + check-in date.')
      return
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

    // ✅ typed hotels array prevents city widening to string
    const hotels: HajjPackage['hotels'] = [
      { city: 'madinah', hotelName: madinahHotel.trim(), checkInDate: madinahCheckIn },
      { city: 'makkah', hotelName: makkahHotel.trim(), checkInDate: makkahCheckIn }
    ]
    if (isShifting) {
      hotels.push({ city: 'aziziya', hotelName: aziziyaHotel.trim(), checkInDate: aziziyaCheckIn })
    }

    const pkg: HajjPackage = {
      id: newId(),
      source: 'user',

      provider: provider.trim(),
      packageName: packageName.trim(),

      startDate,
      endDate,
      durationDays: dur,

      firstCity,
      isShifting,

      makkahZone,
      minaCamp,

      basePriceSAR: base,

      hotels,

      upgradeFees: hasAnyUpgrade ? upgradeFees : undefined,

      flight: flightGateway.trim()
        ? { gateway: flightGateway.trim(), priceSAR: Number.isFinite(fp as number) ? fp : undefined }
        : undefined,

      packageLink: packageLink.trim() ? packageLink.trim() : undefined
    }

    saveUserPackage(pkg)
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
            <div style={{ fontWeight: 900, fontSize: '1.15rem' }}>Add new package</div>
            <div className="muted" style={{ marginTop: '0.25rem' }}>
              Saved only on your device.
            </div>
          </div>

          <button type="button" className="outline-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="card" style={{ marginTop: '0.9rem' }}>
          <strong>Reminder:</strong>{' '}
          <span className="muted">
            Do not share personal information or make payments anywhere except Nusuk.
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
              Enter the extra amount per person (SAR) compared to Quad. Leave blank (or 0) if not available.
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

          <Input label="Flight gateway (optional)" value={flightGateway} onChange={setFlightGateway} />
          <Input label="Flight price (SAR, optional)" type="number" value={flightPriceSAR} onChange={setFlightPriceSAR} />

          <Input label="Package link (optional)" value={packageLink} onChange={setPackageLink} />

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
        </div>
      </div>
    </div>
  )
}

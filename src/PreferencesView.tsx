import type {
  Preferences,
  MakkahZone,
  MinaCamp,
  OccupancyType,
  ShiftingType,
  StayLocation
} from './models'

type Props = {
  value: Preferences
  onChange: (next: Preferences) => void
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
    <label style={{ display: 'block', marginBottom: '0.9rem' }}>
      <div style={{ fontSize: '0.9rem', marginBottom: '0.35rem' }}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={{
          width: '100%',
          padding: '0.7rem 0.75rem',
          borderRadius: '0.5rem',
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
    <label style={{ display: 'block', marginBottom: '0.9rem' }}>
      <div style={{ fontSize: '0.9rem', marginBottom: '0.35rem' }}>{label}</div>
      <input
        value={value}
        type={type}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '0.7rem 0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid var(--border)',
          fontSize: '1rem',
          background: 'var(--card-bg)',
          color: 'var(--text)'
        }}
      />
    </label>
  )
}

export default function PreferencesView({ value, onChange }: Props) {
  const safeValue: Preferences = {
    ...value,
    budgetCurrency: 'SAR',
    hujjajCount: value.hujjajCount ?? 1
  }

  return (
    <section>
      <h1>Preferences</h1>

      <div className="card muted" style={{ marginTop: '0.75rem' }}>
        <strong>Budget note:</strong> Budget is SAR-only to keep recommendations accurate.
      </div>

      <h2 style={{ fontSize: '1.05rem', marginTop: '1.25rem' }}>Budget (SAR)</h2>

      <Input
        label="Budget amount (total for group) — SAR"
        type="number"
        value={String(safeValue.budgetAmount ?? '')}
        onChange={(v) =>
          onChange({
            ...safeValue,
            budgetAmount: Number(v) || 0,
            budgetCurrency: 'SAR'
          })
        }
      />

      <Input
        label="Number of hujjaj in your group"
        type="number"
        value={String(safeValue.hujjajCount)}
        onChange={(v) => {
          const n = Number(v)
          onChange({
            ...safeValue,
            hujjajCount: Number.isNaN(n) ? 1 : Math.max(1, n),
            budgetCurrency: 'SAR'
          })
        }}
      />

      <h2 style={{ fontSize: '1.05rem', marginTop: '1.25rem' }}>Package preferences</h2>

      <Select<StayLocation | 'any'>
        label="First stay"
        value={safeValue.firstStay ?? 'any'}
        onChange={(v) => onChange({ ...safeValue, firstStay: v })}
        options={[
          { value: 'any', label: 'No preference' },
          { value: 'madinah', label: 'Madinah' },
          { value: 'makkah', label: 'Makkah' },
          { value: 'aziziya', label: 'Aziziya' }
        ]}
      />

      <Select<StayLocation | 'any'>
        label="Last stay"
        value={safeValue.lastStay ?? 'any'}
        onChange={(v) => onChange({ ...safeValue, lastStay: v })}
        options={[
          { value: 'any', label: 'No preference' },
          { value: 'madinah', label: 'Madinah' },
          { value: 'makkah', label: 'Makkah' },
          { value: 'aziziya', label: 'Aziziya' }
        ]}
      />

      <Select<MakkahZone | 'any'>
        label="Makkah hotel zone"
        value={safeValue.makkahZone ?? 'any'}
        onChange={(v) => onChange({ ...safeValue, makkahZone: v })}
        options={[
          { value: 'any', label: 'No preference' },
          { value: 'A', label: 'Zone A' },
          { value: 'B', label: 'Zone B' },
          { value: 'C', label: 'Zone C' },
          { value: 'M', label: 'Zone M' }
        ]}
      />

      <Select<MinaCamp | 'any'>
        label="Mina camp"
        value={safeValue.minaCamp ?? 'any'}
        onChange={(v) => onChange({ ...safeValue, minaCamp: v })}
        options={[
          { value: 'any', label: 'No preference' },
          { value: 'majr', label: 'Majr AlKabsh' },
          { value: 'muaisim', label: 'Al Muaisim' }
        ]}
      />

      <Select<OccupancyType | 'any'>
        label="Occupancy"
        value={safeValue.occupancy ?? 'any'}
        onChange={(v) => onChange({ ...safeValue, occupancy: v })}
        options={[
          { value: 'any', label: 'No preference' },
          { value: 'double', label: 'Double' },
          { value: 'triple', label: 'Triple' },
          { value: 'quad', label: 'Quad' }
        ]}
      />

      <Select<ShiftingType | 'any'>
        label="Shifting"
        value={safeValue.shifting ?? 'any'}
        onChange={(v) => onChange({ ...safeValue, shifting: v })}
        options={[
          { value: 'any', label: 'No preference' },
          { value: 'shifting', label: 'Shifting' },
          { value: 'non-shifting', label: 'Non-shifting' }
        ]}
      />
    </section>
  )
}

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
          border: '1px solid #e2e8f0',
          fontSize: '1rem'
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
          border: '1px solid #e2e8f0',
          fontSize: '1rem'
        }}
      />
    </label>
  )
}

export default function PreferencesView({ value, onChange }: Props) {
  const provider = value.provider ?? 'any'
  const firstStay = value.firstStay ?? 'any'
  const lastStay = value.lastStay ?? 'any'
  const makkahZone = value.makkahZone ?? 'any'
  const minaCamp = value.minaCamp ?? 'any'
  const occupancy = value.occupancy ?? 'any'
  const shifting = value.shifting ?? 'any'

  return (
    <section>
      <h1>Preferences</h1>
      <p style={{ marginTop: '-0.25rem' }}>
        Choose what matters to you. Every option supports “No preference”.
      </p>

      <h2 style={{ fontSize: '1.05rem', marginTop: '1.25rem' }}>Budget</h2>

      <Input
        label="Budget amount (total for group)"
        type="number"
        value={String(value.budgetAmount ?? 0)}
        onChange={(v) => onChange({ ...value, budgetAmount: Number(v) || 0 })}
      />

      <Input
        label="Budget currency (e.g., GBP, USD, SAR)"
        value={value.budgetCurrency ?? 'GBP'}
        onChange={(v) => onChange({ ...value, budgetCurrency: v.toUpperCase().trim() })}
      />

      <Input
        label="Number of hujjaj in your group"
        type="number"
        value={String(value.hujjajCount ?? 1)}
        onChange={(v) => onChange({ ...value, hujjajCount: Math.max(1, Number(v) || 1) })}
      />

      <h2 style={{ fontSize: '1.05rem', marginTop: '1.25rem' }}>Package preferences</h2>

      <Input
        label="Provider"
        value={provider === 'any' ? '' : provider}
        placeholder="Leave empty for No preference"
        onChange={(v) => onChange({ ...value, provider: v.trim() === '' ? 'any' : v.trim() })}
      />

      <Select<StayLocation | 'any'>
        label="First stay"
        value={firstStay as StayLocation | 'any'}
        onChange={(v) => onChange({ ...value, firstStay: v })}
        options={[
          { value: 'any', label: 'No preference' },
          { value: 'madinah', label: 'Madinah' },
          { value: 'makkah', label: 'Makkah' },
          { value: 'aziziya', label: 'Aziziya' }
        ]}
      />

      <Select<StayLocation | 'any'>
        label="Last stay"
        value={lastStay as StayLocation | 'any'}
        onChange={(v) => onChange({ ...value, lastStay: v })}
        options={[
          { value: 'any', label: 'No preference' },
          { value: 'madinah', label: 'Madinah' },
          { value: 'makkah', label: 'Makkah' },
          { value: 'aziziya', label: 'Aziziya' }
        ]}
      />

      <Input
        label="Start date"
        type="date"
        value={value.startDate ?? ''}
        onChange={(v) => onChange({ ...value, startDate: v === '' ? undefined : v })}
      />

      <Input
        label="End date"
        type="date"
        value={value.endDate ?? ''}
        onChange={(v) => onChange({ ...value, endDate: v === '' ? undefined : v })}
      />

      <Input
        label="Duration (days)"
        type="number"
        value={value.durationDays ? String(value.durationDays) : ''}
        placeholder="Leave empty for No preference"
        onChange={(v) =>
          onChange({ ...value, durationDays: v.trim() === '' ? undefined : Number(v) })
        }
      />

      <Select<MakkahZone | 'any'>
        label="Makkah hotel zone"
        value={makkahZone as MakkahZone | 'any'}
        onChange={(v) => onChange({ ...value, makkahZone: v })}
        options={[
          { value: 'any', label: 'No preference' },
          { value: 'A', label: 'Zone A (closest)' },
          { value: 'B', label: 'Zone B' },
          { value: 'C', label: 'Zone C' },
          { value: 'M', label: 'Zone M (farthest)' }
        ]}
      />

      <Select<MinaCamp | 'any'>
        label="Mina camp"
        value={minaCamp as MinaCamp | 'any'}
        onChange={(v) => onChange({ ...value, minaCamp: v })}
        options={[
          { value: 'any', label: 'No preference' },
          { value: 'majr', label: 'Majr AlKabsh' },
          { value: 'muaisim', label: 'Al Muaisim' }
        ]}
      />

      <Select<OccupancyType | 'any'>
        label="Occupancy type"
        value={occupancy as OccupancyType | 'any'}
        onChange={(v) => onChange({ ...value, occupancy: v })}
        options={[
          { value: 'any', label: 'No preference' },
          { value: 'double', label: 'Double' },
          { value: 'triple', label: 'Triple' },
          { value: 'quad', label: 'Quad' }
        ]}
      />

      <Select<ShiftingType | 'any'>
        label="Shifting"
        value={shifting as ShiftingType | 'any'}
        onChange={(v) => onChange({ ...value, shifting: v })}
        options={[
          { value: 'any', label: 'No preference' },
          { value: 'shifting', label: 'Shifting' },
          { value: 'non-shifting', label: 'Non-shifting' }
        ]}
      />
    </section>
  )
}

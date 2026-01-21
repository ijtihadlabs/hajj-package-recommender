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
  // Force SAR-only budget for correctness (no currency conversion)
  const safeValue: Preferences = {
    ...value,
    budgetCurrency: 'SAR',
    hujjajCount: Math.max(1, value.hujjajCount || 1)
  }

  const provider = safeValue.provider ?? 'any'
  const firstStay = safeValue.firstStay ?? 'any'
  const lastStay = safeValue.lastStay ?? 'any'
  const makkahZone = safeValue.makkahZone ?? 'any'
  const minaCamp = safeValue.minaCamp ?? 'any'
  const occupancy = safeValue.occupancy ?? 'any'
  const shifting = safeValue.shifting ?? 'any'

  return (
    <section>
      <h1>Preferences</h1>
      <p style={{ marginTop: '-0.25rem' }}>
        Choose what matters to you. Every option supports “No preference”.
      </p>

      <div className="card muted" style={{ marginTop: '0.75rem' }}>
        <strong>Budget note:</strong> To keep recommendations accurate, budget is currently
        SAR-only (no currency conversion). Please enter your budget in <strong>SAR</strong>.
      </div>

      <h2 style={{ fontSize: '1.05rem', marginTop: '1.25rem' }}>Budget (SAR)</h2>

      <Input
        label="Budget amount (total for group) — SAR"
        type="number"
        value={String(safeValue.budgetAmount ?? 0)}
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
        onChange={(v) =>
          onChange({
            ...safeValue,
            hujjajCount: Math.max(1, Number(v) || 1),
            budgetCurrency: 'SAR'
          })
        }
      />

      <h2 style={{ fontSize: '1.05rem', marginTop: '1.25rem' }}>Package preferences</h2>

      <Input
        label="Provider"
        value={provider === 'any' ? '' : provider}
        placeholder="Leave empty for No preference"
        onChange={(v) =>
          onChange({
            ...safeValue,
            provider: v.trim() === '' ? 'any' : v.trim(),
            budgetCurrency: 'SAR'
          })
        }
      />

      <Select<StayLocation | 'any'>
        label="First stay"
        value={firstStay as StayLocation | 'any'}
        onChange={(v) => onChange({ ...safeValue, firstStay: v, budgetCurrency: 'SAR' })}
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
        onChange={(v) => onChange({ ...safeValue, lastStay: v, budgetCurrency: 'SAR' })}
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
        value={safeValue.startDate ?? ''}
        onChange={(v) =>
          onChange({ ...safeValue, startDate: v === '' ? undefined : v, budgetCurrency: 'SAR' })
        }
      />

      <Input
        label="End date"
        type="date"
        value={safeValue.endDate ?? ''}
        onChange={(v) =>
          onChange({ ...safeValue, endDate: v === '' ? undefined : v, budgetCurrency: 'SAR' })
        }
      />

      <Input
        label="Duration (days)"
        type="number"
        value={safeValue.durationDays ? String(safeValue.durationDays) : ''}
        placeholder="Leave empty for No preference"
        onChange={(v) =>
          onChange({
            ...safeValue,
            durationDays: v.trim() === '' ? undefined : Number(v),
            budgetCurrency: 'SAR'
          })
        }
      />

      <Select<MakkahZone | 'any'>
        label="Makkah hotel zone"
        value={makkahZone as MakkahZone | 'any'}
        onChange={(v) => onChange({ ...safeValue, makkahZone: v, budgetCurrency: 'SAR' })}
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
        onChange={(v) => onChange({ ...safeValue, minaCamp: v, budgetCurrency: 'SAR' })}
        options={[
          { value: 'any', label: 'No preference' },
          { value: 'majr', label: 'Majr AlKabsh' },
          { value: 'muaisim', label: 'Al Muaisim' }
        ]}
      />

      <Select<OccupancyType | 'any'>
        label="Occupancy type"
        value={occupancy as OccupancyType | 'any'}
        onChange={(v) => onChange({ ...safeValue, occupancy: v, budgetCurrency: 'SAR' })}
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
        onChange={(v) => onChange({ ...safeValue, shifting: v, budgetCurrency: 'SAR' })}
        options={[
          { value: 'any', label: 'No preference' },
          { value: 'shifting', label: 'Shifting' },
          { value: 'non-shifting', label: 'Non-shifting' }
        ]}
      />
    </section>
  )
}

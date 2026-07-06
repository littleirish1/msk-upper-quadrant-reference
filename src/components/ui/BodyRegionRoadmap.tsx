import Link from 'next/link'
import { CheckCircle2, Clock3, MapPinned } from 'lucide-react'

const liveRegions = [
  { label: 'Cervical', href: '/cervical' },
  { label: 'Thoracic', href: '/thoracic' },
  { label: 'Shoulder', href: '/shoulder' },
  { label: 'Elbow', href: '/elbow' },
  { label: 'Wrist/Hand', href: '/wrist-hand' },
]

const plannedMskRegions = [
  'Lumbar spine',
  'Hip',
  'Knee',
  'Ankle/Foot',
  'Broader spine',
  'Paediatrics',
  'Interactive body-region map',
]

const plannedNeuroAnatomy = [
  'Neuro reasoning',
  'Stroke / CVA',
  'Spinal cord injury / cord damage',
  'Brain structure',
  'Spinal column',
  'Spinal tracts',
  'Cranial nerve testing',
  'Anatomy foundation pages',
]

function PlannedChip({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs font-medium text-surface-600 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-300"
      aria-label={`${label} planned for a later phase`}
    >
      {label}
    </span>
  )
}

export function BodyRegionRoadmap() {
  return (
    <section aria-labelledby="body-region-roadmap-heading" className="mt-10">
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
          <MapPinned className="h-4 w-4" aria-hidden />
          Body-region roadmap
        </div>
        <h2 id="body-region-roadmap-heading" className="text-xl font-semibold text-surface-900 dark:text-surface-50">
          Live now and planned expansion
        </h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-800 dark:bg-brand-950/40">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-brand-600 dark:text-brand-300" aria-hidden />
            <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
              Currently live
            </h3>
          </div>
          <p className="mb-4 text-sm text-surface-600 dark:text-surface-300">
            The pilot build is focused on reviewed upper-quadrant learning areas.
          </p>
          <div className="flex flex-wrap gap-2">
            {liveRegions.map(region => (
              <Link
                key={region.href}
                href={region.href}
                className="inline-flex items-center rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm ring-1 ring-brand-200 transition-colors hover:bg-brand-100 dark:bg-surface-900 dark:text-brand-300 dark:ring-brand-800 dark:hover:bg-brand-950"
              >
                {region.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-700 dark:bg-surface-900">
          <div className="mb-3 flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-accent-600 dark:text-accent-300" aria-hidden />
            <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
              Planned MSK expansion
            </h3>
          </div>
          <p className="mb-4 text-sm text-surface-600 dark:text-surface-400">
            These areas are roadmap items only and are not live routes yet.
          </p>
          <div className="flex flex-wrap gap-2">
            {plannedMskRegions.map(label => (
              <PlannedChip key={label} label={label} />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-700 dark:bg-surface-900">
          <div className="mb-3 flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-accent-600 dark:text-accent-300" aria-hidden />
            <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
              Planned neuro/anatomy expansion
            </h3>
          </div>
          <p className="mb-4 text-sm text-surface-600 dark:text-surface-400">
            Future expansion may include neuro screening, cranial nerve testing, spinal tracts, and anatomy foundation pages.
          </p>
          <div className="flex flex-wrap gap-2">
            {plannedNeuroAnatomy.map(label => (
              <PlannedChip key={label} label={label} />
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm text-surface-500 dark:text-surface-400">
        Interactive body-region map planned for a later phase once the taxonomy is stable.
      </p>
    </section>
  )
}

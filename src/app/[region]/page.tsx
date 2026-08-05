import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronRight, Hash, Stethoscope } from 'lucide-react'
import { REGIONS, getRegion } from '@/data/taxonomy'
import { Sidebar } from '@/components/layout/Sidebar'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { getPublicConditionsForRegion } from '@/lib/publicConditions'
import { LearningJourneyLinks } from '@/components/ui/LearningJourneyLinks'
import { ShoulderLearningDashboard } from '@/components/shoulder/ShoulderLearningDashboard'
import { getAllCases } from '@/lib/mdx'

interface Props {
  params: { region: string }
}

export function generateStaticParams() {
  return REGIONS.map(r => ({ region: r.slug }))
}

export function generateMetadata({ params }: Props): Metadata {
  const region = getRegion(params.region)
  if (!region) return {}

  return {
    title: region.label,
    description: `Clinical reference for ${region.label} conditions — special tests, red flags, frameworks, and management.`,
  }
}

// Key test info per condition for preview cards
const conditionMeta: Record<string, { keyTest?: string; commonPresentation?: string }> = {
  'cervical-radiculopathy': { keyTest: "Spurling's", commonPresentation: 'Arm pain + dermatomal pattern' },
  'cervical-myelopathy': { keyTest: "Hoffman's Sign", commonPresentation: 'Gait disturbance + UMN signs' },
  'mechanical-neck-pain': { keyTest: 'CCFT', commonPresentation: 'Axial neck pain, movement-related' },
  'whiplash-associated-disorders': { keyTest: 'Canadian C-Spine Rule', commonPresentation: 'Post-MVC neck pain + stiffness' },
  'cervicogenic-headache': { keyTest: 'Flexion Rotation Test', commonPresentation: 'Unilateral headache from cervical origin' },
  'cervical-artery-dysfunction': { keyTest: '5 Ds and 3 Ns', commonPresentation: 'Dizziness + neck pain post-trauma' },
  'thoracic-outlet-syndrome': { keyTest: "Roos / Adson's", commonPresentation: 'Upper limb numbness + vascular signs' },
  'rotator-cuff-tendinopathy': { keyTest: 'Empty Can / Jobe', commonPresentation: 'Shoulder pain with overhead activities' },
  'rotator-cuff-tear': { keyTest: 'Drop Arm Test', commonPresentation: 'Weakness + pain, often post-trauma' },
  'subacromial-pain-syndrome': { keyTest: "Neer's / Hawkins", commonPresentation: 'Painful arc + impingement signs' },
  'adhesive-capsulitis': { keyTest: 'Passive ROM restriction', commonPresentation: 'Global ROM loss, esp. ER' },
  'shoulder-instability': { keyTest: 'Apprehension Test', commonPresentation: 'Recurrent subluxation/dislocation' },
  'lateral-epicondylalgia': { keyTest: "Cozen's Test", commonPresentation: 'Lateral elbow pain with gripping' },
  'medial-epicondylalgia': { keyTest: 'Reverse Cozen\'s', commonPresentation: 'Medial elbow pain with wrist flexion' },
  'cubital-tunnel-syndrome': { keyTest: "Tinel's (elbow)", commonPresentation: 'Ring/little finger numbness' },
  'carpal-tunnel-syndrome': { keyTest: "Phalen's / Tinel's", commonPresentation: 'Thumb-index-middle numbness, night pain' },
  'de-quervains-tenosynovitis': { keyTest: "Finkelstein's", commonPresentation: 'Radial wrist pain with thumb use' },
  'trigger-finger': { keyTest: 'Palpation + locking', commonPresentation: 'Finger catching/locking on flexion' },
  'scaphoid-fracture': { keyTest: 'Snuffbox tenderness', commonPresentation: 'FOOSH + radial-sided wrist pain' },
  'tfcc-injury': { keyTest: 'Press Test', commonPresentation: 'Ulnar-sided wrist pain' },
  'thumb-cmc-osteoarthritis': { keyTest: 'Grind Test', commonPresentation: 'Thumb base pain with pinch/grip' },
}

export default function RegionPage({ params }: Props) {
  const region = getRegion(params.region)
  if (!region) notFound()
  const publicConditionSlugs = new Set(
    getPublicConditionsForRegion(region.slug).map((condition) => condition.condition),
  )
  const shoulderCases = region.slug === 'shoulder'
    ? getAllCases().filter((item) => item.region === 'shoulder')
    : []

  return (
    <div className="flex">
      <Sidebar currentRegion={region.slug} />

      <div className="flex-1 overflow-x-hidden px-4 py-8 sm:px-8 lg:px-12">
        <Breadcrumb crumbs={[{ label: region.label }]} />

        <h1 className="mb-2 text-3xl font-bold text-surface-900 dark:text-surface-50">
          {region.label}
        </h1>
        <p className="mb-8 text-surface-500 dark:text-surface-400">{region.description}</p>

        <LearningJourneyLinks current="region" regionHref={`/${region.slug}`} />

        {region.slug === 'shoulder' && (
          <ShoulderLearningDashboard
            conditionCount={publicConditionSlugs.size}
            cases={shoulderCases}
          />
        )}

        <section id={region.slug === 'shoulder' ? 'shoulder-conditions' : undefined} aria-labelledby="region-conditions-title" className="scroll-mt-24">
        <h2 id="region-conditions-title" className="mb-4 text-xl font-semibold text-surface-950 dark:text-white">
          Published references
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {region.conditions.filter((condition) => publicConditionSlugs.has(condition.slug)).map(condition => {
            const meta = conditionMeta[condition.slug]
            return (
              <Link
                key={condition.slug}
                href={`/${region.slug}/${condition.slug}`}
                className="group rounded-xl border border-surface-200 bg-white p-5 shadow-sm transition-all hover:border-brand-300 hover:shadow-md dark:border-surface-700 dark:bg-surface-900 dark:hover:border-brand-600"
              >
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="font-semibold text-surface-900 group-hover:text-brand-700 dark:text-surface-100 dark:group-hover:text-brand-400">
                    {condition.label}
                  </h3>
                  {condition.icd10 && (
                    <span className="ml-2 shrink-0 flex items-center gap-1 rounded bg-surface-100 px-1.5 py-0.5 font-mono text-xs text-surface-500 dark:bg-surface-800 dark:text-surface-400">
                      <Hash className="h-2.5 w-2.5" />
                      {condition.icd10}
                    </span>
                  )}
                </div>

                {/* Key info preview */}
                {meta && (
                  <div className="mb-3 space-y-1.5">
                    {meta.commonPresentation && (
                      <p className="text-xs text-surface-500 dark:text-surface-400">
                        {meta.commonPresentation}
                      </p>
                    )}
                    {meta.keyTest && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Stethoscope className="h-3 w-3 text-blue-500" />
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          Key test: {meta.keyTest}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1 text-sm font-medium text-brand-600 group-hover:underline dark:text-brand-400">
                  View reference
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </div>
              </Link>
            )
          })}
        </div>
        </section>
      </div>
    </div>
  )
}

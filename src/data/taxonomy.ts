import type { Region } from '@/types'

/**
 * Master taxonomy — the source of truth for regions and conditions.
 * Slugs match actual MDX filenames in content/{region}/{condition}.mdx
 */

export const SECTIONS = [
  { slug: 'overview',                label: 'Overview & Pathophysiology' },
  { slug: 'special-tests',          label: 'Special Tests' },
  { slug: 'red-flags',              label: 'Red Flags' },
  { slug: 'clinical-frameworks',    label: 'Clinical Frameworks' },
  { slug: 'outcome-measures',       label: 'Outcome Measures' },
  { slug: 'evidence-based-diagnosis', label: 'Evidence-Based Diagnosis' },
  { slug: 'differential-diagnosis', label: 'Differential Diagnosis' },
  { slug: 'management',             label: 'Management & Treatment' },
] as const

export const REGIONS: Region[] = [
  {
    slug: 'cervical',
    label: 'Cervical Spine',
    description: 'C1–C7 nerve root syndromes, instability, and degenerative pathology.',
    icon: 'Brain',
    conditions: [
      { slug: 'cervical-radiculopathy',       label: 'Cervical Radiculopathy',           region: 'cervical', icd10: 'M54.12' },
      { slug: 'cervical-myelopathy',          label: 'Cervical Myelopathy',              region: 'cervical', icd10: 'M47.12' },
      { slug: 'mechanical-neck-pain',         label: 'Mechanical Neck Pain',             region: 'cervical', icd10: 'M54.2' },
      { slug: 'whiplash-associated-disorders',label: 'Whiplash-Associated Disorders',    region: 'cervical', icd10: 'S13.4' },
      { slug: 'cervicogenic-headache',        label: 'Cervicogenic Headache',            region: 'cervical', icd10: 'G44.841' },
      { slug: 'cervical-artery-dysfunction',  label: 'Cervical Artery Dysfunction',      region: 'cervical', icd10: 'M43.3' },
    ],
  },
  {
    slug: 'thoracic',
    label: 'Thoracic Spine',
    description: 'T1–T12 thoracic pain, dysfunction, and neurovascular conditions.',
    icon: 'Columns',
    conditions: [
      { slug: 'thoracic-outlet-syndrome',    label: 'Thoracic Outlet Syndrome',         region: 'thoracic', icd10: 'G54.0' },
      { slug: 'thoracic-disc-herniation',    label: 'Thoracic Disc Herniation',         region: 'thoracic', icd10: 'M51.1' },
      { slug: 'costochondritis',             label: 'Costochondritis',                  region: 'thoracic', icd10: 'M94.0' },
      { slug: 'thoracic-facet-joint-pain',   label: 'Thoracic Facet Joint Pain',        region: 'thoracic', icd10: 'M54.6' },
      { slug: 'scheuermanns-disease',        label: "Scheuermann's Disease",            region: 'thoracic', icd10: 'M42.0' },
      { slug: 'thoracic-radiculopathy',      label: 'Thoracic Radiculopathy',           region: 'thoracic', icd10: 'M54.14' },
    ],
  },
  {
    slug: 'shoulder',
    label: 'Shoulder',
    description: 'Glenohumeral, acromioclavicular, and rotator cuff pathology.',
    icon: 'CircleDot',
    conditions: [
      { slug: 'rotator-cuff-tendinopathy',   label: 'Rotator Cuff Tendinopathy',        region: 'shoulder', icd10: 'M75.1' },
      { slug: 'rotator-cuff-tear',           label: 'Rotator Cuff Tear',                region: 'shoulder', icd10: 'M75.1' },
      { slug: 'subacromial-pain-syndrome',   label: 'Subacromial Pain Syndrome',        region: 'shoulder', icd10: 'M75.1' },
      { slug: 'adhesive-capsulitis',         label: 'Adhesive Capsulitis',              region: 'shoulder', icd10: 'M75.0' },
      { slug: 'shoulder-instability',        label: 'Shoulder Instability',             region: 'shoulder', icd10: 'M25.31' },
      { slug: 'acromioclavicular-joint',     label: 'Acromioclavicular Joint',          region: 'shoulder', icd10: 'M75.5' },
      { slug: 'labral-tears',                label: 'Labral Tears',                     region: 'shoulder', icd10: 'S43.4' },
      { slug: 'calcific-tendinitis',         label: 'Calcific Tendinitis',              region: 'shoulder', icd10: 'M75.3' },
    ],
  },
  {
    slug: 'elbow',
    label: 'Elbow',
    description: 'Tendinopathy, nerve entrapment, and joint pathology of the elbow.',
    icon: 'GitBranch',
    conditions: [
      { slug: 'lateral-epicondylalgia',      label: 'Lateral Epicondylalgia',           region: 'elbow', icd10: 'M77.1' },
      { slug: 'medial-epicondylalgia',       label: 'Medial Epicondylalgia',            region: 'elbow', icd10: 'M77.0' },
      { slug: 'olecranon-bursitis',          label: 'Olecranon Bursitis',               region: 'elbow', icd10: 'M70.2' },
      { slug: 'cubital-tunnel-syndrome',     label: 'Cubital Tunnel Syndrome',          region: 'elbow', icd10: 'G56.2' },
      { slug: 'radial-tunnel-syndrome',      label: 'Radial Tunnel Syndrome',           region: 'elbow', icd10: 'G56.3' },
      { slug: 'elbow-osteoarthritis',        label: 'Elbow Osteoarthritis',             region: 'elbow', icd10: 'M19.02' },
    ],
  },
  {
    slug: 'wrist-hand',
    label: 'Wrist & Hand',
    description: 'Carpal, tendon, nerve, and joint conditions of the wrist and hand.',
    icon: 'Hand',
    conditions: [
      { slug: 'carpal-tunnel-syndrome',      label: 'Carpal Tunnel Syndrome',           region: 'wrist-hand', icd10: 'G56.0' },
      { slug: 'de-quervains-tenosynovitis',  label: "De Quervain's Tenosynovitis",      region: 'wrist-hand', icd10: 'M65.4' },
      { slug: 'trigger-finger',              label: 'Trigger Finger',                   region: 'wrist-hand', icd10: 'M65.3' },
      { slug: 'dupuytrens-contracture',      label: "Dupuytren's Contracture",          region: 'wrist-hand', icd10: 'M72.0' },
      { slug: 'scaphoid-fracture',           label: 'Scaphoid Fracture',                region: 'wrist-hand', icd10: 'S62.0' },
      { slug: 'tfcc-injury',                 label: 'TFCC Injury',                      region: 'wrist-hand', icd10: 'S63.2' },
      { slug: 'thumb-cmc-osteoarthritis',    label: 'Thumb CMC Osteoarthritis',         region: 'wrist-hand', icd10: 'M18.1' },
    ],
  },
]

export const PLANNED_REGIONS = [
  {
    slug: 'lumbar',
    label: 'Lumbar Spine',
    description: 'Planned lower-spine clinical reasoning module.',
  },
  {
    slug: 'pelvis-sij',
    label: 'Pelvis / SIJ',
    description: 'Planned pelvic and sacroiliac clinical reasoning module.',
  },
  {
    slug: 'hip',
    label: 'Hip',
    description: 'Planned hip clinical reasoning module.',
  },
  {
    slug: 'knee',
    label: 'Knee',
    description: 'Planned knee clinical reasoning module.',
  },
  {
    slug: 'ankle-foot',
    label: 'Ankle / Foot',
    description: 'Planned ankle and foot clinical reasoning module.',
  },
] as const

export const ROADMAP_MODULES = [
  'broader-spine',
  'paediatrics',
  'neuro-reasoning',
  'anatomy-foundations',
  'interactive-body-region-map',
] as const

export function getRegion(slug: string): Region | undefined {
  return REGIONS.find(r => r.slug === slug)
}

export function getCondition(regionSlug: string, conditionSlug: string) {
  const region = getRegion(regionSlug)
  return region?.conditions.find(c => c.slug === conditionSlug)
}

export function getSection(slug: string) {
  return SECTIONS.find(s => s.slug === slug)
}

/** All valid static paths for [region]/[condition] */
export function getAllConditionPaths() {
  return REGIONS.flatMap(region =>
    region.conditions.map(condition => ({
      region: region.slug,
      condition: condition.slug,
    }))
  )
}

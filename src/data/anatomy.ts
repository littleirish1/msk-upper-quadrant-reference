import type { AnatomyCategory } from '@/lib/contentSchemas'

export interface AnatomyCategoryDefinition {
  slug: AnatomyCategory
  label: string
  description: string
}

export const ANATOMY_CATEGORIES: AnatomyCategoryDefinition[] = [
  { slug: 'muscle', label: 'Muscles', description: 'Muscle structure and clinically relevant relationships.' },
  { slug: 'bone', label: 'Bones', description: 'Skeletal landmarks and clinically relevant relationships.' },
  { slug: 'joint', label: 'Joints', description: 'Joint structure and clinically relevant relationships.' },
  { slug: 'tendon', label: 'Tendons', description: 'Tendon structure and clinically relevant relationships.' },
  { slug: 'ligament', label: 'Ligaments', description: 'Ligament structure and clinically relevant relationships.' },
  { slug: 'peripheral-nerve', label: 'Peripheral nerves', description: 'Peripheral nerve course, examination, and lesion patterns.' },
  { slug: 'nerve-root', label: 'Nerve roots', description: 'Nerve-root relationships for neurological examination.' },
  { slug: 'dermatome', label: 'Dermatomes', description: 'Structured sensory-distribution learning records.' },
  { slug: 'myotome', label: 'Myotomes', description: 'Structured motor-examination learning records.' },
  { slug: 'cranial-nerve', label: 'Cranial nerves', description: 'Cranial nerve function, testing, and localisation.' },
  { slug: 'brain-region', label: 'Brain', description: 'Brain-region foundations linked to clinical reasoning.' },
  { slug: 'spinal-tract', label: 'Spinal cord and tracts', description: 'Spinal tract foundations linked to examination.' },
  { slug: 'blood-vessel', label: 'Blood vessels', description: 'Vascular anatomy where clinically relevant.' },
]

export function getAnatomyCategory(slug: string) {
  return ANATOMY_CATEGORIES.find((category) => category.slug === slug)
}

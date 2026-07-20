const REGION_MATCHERS = [
  ['hand', ['hand', 'wrist', 'finger', 'thumb', 'carpal']],
  ['upper-limb', ['upper limb', 'upperlimb', 'arm', 'forearm', 'shoulder', 'elbow']],
  ['spine', ['spine', 'vertebra', 'cervical', 'thoracic', 'lumbar']],
]

const LAYER_MATCHERS = [
  ['muscle', ['muscle', 'muscular', 'tendon']],
  ['bone', ['bone', 'skeleton', 'skeletal', 'vertebra', 'scapula', 'humerus', 'radius', 'ulna', 'carpal']],
  ['nerve', ['nerve', 'neural', 'plexus']],
  ['vessel', ['vessel', 'vascular', 'artery', 'vein']],
]

export function classifyRegion(node) {
  return classifyNearestAncestor(node, 'region', REGION_MATCHERS, 'unknown')
}

export function classifyLayer(node) {
  return classifyNearestAncestor(node, 'layer', LAYER_MATCHERS, 'other')
}

export function classifyNearestAncestor(node, userDataKey, matchers, fallback) {
  let current = node

  while (current && typeof current === 'object') {
    const explicitMatch = matchValue(normalize(current.userData?.[userDataKey]), matchers)
    if (explicitMatch) return explicitMatch

    const nameMatch = matchValue(normalize(current.name), matchers)
    if (nameMatch) return nameMatch

    current = current.parent ?? null
  }

  return fallback
}

function matchValue(value, matchers) {
  if (!value) return null

  for (const [classification, terms] of matchers) {
    if (value === classification || terms.some((term) => value.includes(term))) {
      return classification
    }
  }

  return null
}

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function joinedToken(...parts) {
  return new RegExp(parts.join('_'), 'g')
}

function joinedPrefix(...parts) {
  return parts.join('')
}

export const CREDENTIAL_RULES = [
  {
    label: 'Google API key',
    kind: 'credential-value',
    pattern: new RegExp(`${joinedPrefix('AI', 'za')}[0-9A-Za-z_-]{20,}`, 'g'),
  },
  {
    label: 'OpenAI-style secret key',
    kind: 'credential-value',
    pattern: new RegExp(
      String.raw`\b${joinedPrefix('s', 'k-')}[0-9A-Za-z_-]{20,}`,
      'g',
    ),
  },
  {
    label: 'OpenAI API key environment token',
    kind: 'policy-token',
    pattern: joinedToken('OPENAI', 'API', 'KEY'),
  },
  {
    label: 'generic API key token',
    kind: 'policy-token',
    pattern: joinedToken('API', 'KEY'),
  },
  {
    label: 'private key token',
    kind: 'policy-token',
    pattern: joinedToken('PRIVATE', 'KEY'),
  },
  {
    label: 'generic secret token',
    kind: 'policy-token',
    pattern: new RegExp(joinedPrefix('SEC', 'RET'), 'g'),
  },
]

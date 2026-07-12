import { Activity, Stethoscope, Hash, TrendingUp } from 'lucide-react'
import type { ConditionFrontmatterSchema } from '@/lib/contentSchemas'

interface QuickFactsProps {
  condition: {
    label: string
    icd10?: string
  }
  frontmatter: ConditionFrontmatterSchema
  sections: Array<{ heading: string; slug: string; content: string }>
}

function extractQuickFacts(sections: Array<{ heading: string; slug: string; content: string }>) {
  // Try to extract key facts from overview section
  const overview = sections.find(s => s.slug.includes('overview'))
  
  let prevalence = ''
  let keyTest = ''
  let typicalPresentation = ''

  if (overview) {
    // Extract prevalence/incidence from text
    const prevMatch = overview.content.match(/(?:incidence|prevalence)[^.]*?(\d[\d,.]+\s*(?:per|%|cases)[^.]*)/i)
    if (prevMatch) prevalence = prevMatch[0].replace(/^[^A-Za-z0-9]*/, '').slice(0, 80)

    // Extract typical presentation
    const presentMatch = overview.content.match(/(?:characterised by|presents? with|typical presentation)[^.]*\./i)
    if (presentMatch) typicalPresentation = presentMatch[0].slice(0, 120)
  }

  // Extract key test from special tests section
  const specialTests = sections.find(s => s.slug.includes('special-tests'))
  if (specialTests) {
    // Find the first test mentioned in a table row
    const testMatch = specialTests.content.match(/\|\s*([A-Z][^|]+?)\s*\|/)
    if (testMatch && testMatch[1] && !testMatch[1].match(/^(Test|Name|---|Sensitivity)/)) {
      keyTest = testMatch[1].trim()
    }
  }

  return { prevalence, keyTest, typicalPresentation }
}

export function QuickFacts({ condition, frontmatter, sections }: QuickFactsProps) {
  const facts = extractQuickFacts(sections)
  const hasAnyFact = condition.icd10 || frontmatter.evidenceGrade || frontmatter.evidence_level || facts.prevalence || facts.keyTest

  if (!hasAnyFact) return null

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
      {condition.icd10 && (
        <div className="rounded-lg border border-surface-200 bg-surface-50 p-3 dark:border-surface-700 dark:bg-surface-800/50">
          <div className="flex items-center gap-1.5 text-xs font-medium text-surface-400 dark:text-surface-500">
            <Hash className="h-3.5 w-3.5" />
            ICD-10
          </div>
          <p className="mt-1 font-mono text-sm font-semibold text-surface-800 dark:text-surface-200">
            {condition.icd10}
          </p>
        </div>
      )}

      {(frontmatter.evidenceGrade || frontmatter.evidence_level) && (
        <div className="rounded-lg border border-surface-200 bg-surface-50 p-3 dark:border-surface-700 dark:bg-surface-800/50">
          <div className="flex items-center gap-1.5 text-xs font-medium text-surface-400 dark:text-surface-500">
            <TrendingUp className="h-3.5 w-3.5" />
            Evidence
          </div>
          <p className="mt-1 text-sm font-semibold text-surface-800 dark:text-surface-200">
            {frontmatter.evidenceGrade ? `Grade ${frontmatter.evidenceGrade}` : frontmatter.evidence_level}
          </p>
        </div>
      )}

      {facts.keyTest && (
        <div className="rounded-lg border border-surface-200 bg-surface-50 p-3 dark:border-surface-700 dark:bg-surface-800/50">
          <div className="flex items-center gap-1.5 text-xs font-medium text-surface-400 dark:text-surface-500">
            <Stethoscope className="h-3.5 w-3.5" />
            Key Test
          </div>
          <p className="mt-1 text-sm font-semibold text-surface-800 dark:text-surface-200 truncate">
            {facts.keyTest}
          </p>
        </div>
      )}

      {facts.prevalence && (
        <div className="rounded-lg border border-surface-200 bg-surface-50 p-3 dark:border-surface-700 dark:bg-surface-800/50">
          <div className="flex items-center gap-1.5 text-xs font-medium text-surface-400 dark:text-surface-500">
            <Activity className="h-3.5 w-3.5" />
            Epidemiology
          </div>
          <p className="mt-1 text-xs font-medium text-surface-700 dark:text-surface-300 line-clamp-2">
            {facts.prevalence}
          </p>
        </div>
      )}
    </div>
  )
}

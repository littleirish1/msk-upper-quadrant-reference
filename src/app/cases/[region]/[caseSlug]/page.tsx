import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import { getRegion } from '@/data/taxonomy'
import {
  getAllCasePaths,
  getCaseContent,
  getCaseLearnerLabel,
  resolveCaseSlugFromPublicSlug,
} from '@/lib/mdx'
import {
  extractCasePresentationStem,
  stripPreRevealLinkedConditionSection,
} from '@/lib/caseContent'
import { getCaseRevealId } from '@/lib/caseRevealServer'
import { Sidebar } from '@/components/layout/Sidebar'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { mdxComponents } from '@/components/mdx/MDXComponents'
import { CaseReasoningPrompt } from '@/components/cases/CaseReasoningPrompt'
import { ConversationCase } from '@/components/cases/ConversationCase'

interface Props {
  params: { region: string; caseSlug: string }
}

export function generateStaticParams() {
  return getAllCasePaths()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const internalCaseSlug = resolveCaseSlugFromPublicSlug(params.region, params.caseSlug)
  const result = internalCaseSlug
    ? await getCaseContent(params.region, internalCaseSlug)
    : null
  const displayTitle = getCaseLearnerLabel(
    internalCaseSlug ?? params.caseSlug,
    result?.frontmatter.title,
    params.region,
  )

  return {
    title: `${displayTitle} - Guided Case`,
    description: 'Guided MSK clinical reasoning case.',
  }
}

export default async function GuidedCasePage({ params }: Props) {
  const { region: regionSlug, caseSlug: publicCaseSlug } = params

  const caseSlug = resolveCaseSlugFromPublicSlug(regionSlug, publicCaseSlug)
  if (!caseSlug) notFound()

  const result = await getCaseContent(regionSlug, caseSlug)
  if (!result) notFound()

  const region = getRegion(regionSlug)

  const displayTitle = getCaseLearnerLabel(caseSlug, result.frontmatter.title, regionSlug)
  const learnerContent = stripPreRevealLinkedConditionSection(
    result.content,
  )
  const casePresentationContent = extractCasePresentationStem(learnerContent)
  const showConversationPreview = caseSlug === 'visceral-referral-mimicking-thoracic-msk-case-01'
  const revealId = getCaseRevealId(regionSlug, publicCaseSlug)

  return (
    <div className="flex">
      <Sidebar currentRegion={regionSlug} showConditions={false} />

      <div className="flex-1 min-w-0 px-4 py-8 sm:px-8 lg:px-12 xl:pr-4 pb-24 lg:pb-8">
        <Breadcrumb
          crumbs={[
            { label: 'Cases', href: '/cases' },
            region
              ? { label: region.label, href: `/${regionSlug}` }
              : { label: regionSlug },
            { label: displayTitle },
          ]}
        />

        <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-800 dark:bg-brand-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            Guided clinical reasoning case
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-surface-900 dark:text-surface-50">
            {displayTitle}
          </h1>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {region && (
              <span className="rounded-full bg-white px-2.5 py-1 font-medium text-brand-700 dark:bg-surface-900 dark:text-brand-300">
                Region: {region.label}
              </span>
            )}

            {typeof result.frontmatter.difficulty === 'string' && (
              <span className="rounded-full bg-white px-2.5 py-1 font-medium text-brand-700 dark:bg-surface-900 dark:text-brand-300">
                Difficulty: {result.frontmatter.difficulty}
              </span>
            )}
          </div>
        </div>

        {showConversationPreview && <ConversationCase />}

        {casePresentationContent && (
          <section className="mb-6 rounded-xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              Case presentation
            </p>
            <h2 className="mt-2 text-xl font-semibold text-surface-900 dark:text-surface-50">
              What you know so far
            </h2>
            <div className="prose-clinical mt-4 max-w-none">
              <MDXRemote
                source={casePresentationContent}
                components={mdxComponents}
                options={{
                  mdxOptions: {
                    remarkPlugins: [remarkGfm],
                    rehypePlugins: [rehypeSlug],
                  },
                }}
              />
            </div>
          </section>
        )}

        <CaseReasoningPrompt
          displayTitle={displayTitle}
          revealId={revealId}
          enhancedFeedbackAvailable={caseSlug === 'cervical-radiculopathy-case-01'}
        />
      </div>
    </div>
  )
}

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import { getRegion, getCondition } from '@/data/taxonomy'
import { getAllCasePaths, getCaseContent, getCaseLearnerLabel } from '@/lib/mdx'
import { Sidebar } from '@/components/layout/Sidebar'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { mdxComponents } from '@/components/mdx/MDXComponents'
import { CaseReasoningPrompt } from '@/components/cases/CaseReasoningPrompt'

interface Props {
  params: { region: string; caseSlug: string }
}

export function generateStaticParams() {
  return getAllCasePaths()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await getCaseContent(params.region, params.caseSlug)
  const displayTitle = getCaseLearnerLabel(params.caseSlug, result?.frontmatter.title)

  return {
    title: `${displayTitle} - Guided Case`,
    description: 'Guided MSK clinical reasoning case.',
  }
}

export default async function GuidedCasePage({ params }: Props) {
  const { region: regionSlug, caseSlug } = params

  const result = await getCaseContent(regionSlug, caseSlug)
  if (!result) notFound()

  const region = getRegion(regionSlug)

  const conditionSlug =
    typeof result.frontmatter.condition === 'string'
      ? result.frontmatter.condition
      : undefined

  const condition =
    conditionSlug && region
      ? getCondition(regionSlug, conditionSlug)
      : null
  const displayTitle = getCaseLearnerLabel(caseSlug, result.frontmatter.title)
  const learnerContent = result.content.replace(/^# .*(?:\r?\n)+/, '')

  return (
    <div className="flex">
      <Sidebar currentRegion={regionSlug} currentCondition={conditionSlug} />

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

        <CaseReasoningPrompt
          displayTitle={displayTitle}
          actualTitle={result.frontmatter.title}
          conditionLabel={condition?.label}
        />

        {result.sections.length > 0 && (
          <nav aria-label="Case sections" className="mb-8 flex flex-wrap gap-2 xl:hidden">
            {result.sections.map((section) => (
              <a
                key={section.slug}
                href={`#${section.slug}`}
                className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-300 dark:hover:bg-brand-900 transition-colors"
              >
                {section.heading}
              </a>
            ))}
          </nav>
        )}

        <article className="prose-clinical">
          <MDXRemote
            source={learnerContent}
            components={mdxComponents}
            options={{
              mdxOptions: {
                remarkPlugins: [remarkGfm],
                rehypePlugins: [rehypeSlug],
              },
            }}
          />
        </article>
      </div>
    </div>
  )
}

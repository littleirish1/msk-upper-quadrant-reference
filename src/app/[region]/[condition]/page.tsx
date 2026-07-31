import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import { getRegion, getCondition } from '@/data/taxonomy'
import {
  getAllPublicConditionPaths,
  getPublicConditionContent,
} from '@/lib/publicConditions'
import { Sidebar } from '@/components/layout/Sidebar'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { mdxComponents } from '@/components/mdx/MDXComponents'
import { QuickFacts } from '@/components/ui/QuickFacts'
import { ConditionPageClient } from '@/components/ui/ConditionPageClient'
import { Clock, Tag } from 'lucide-react'
import { LearningJourneyLinks } from '@/components/ui/LearningJourneyLinks'

interface Props {
  params: { region: string; condition: string }
}

export function generateStaticParams() {
  return getAllPublicConditionPaths()
}

export const dynamicParams = false

export function generateMetadata({ params }: Props): Metadata {
  const condition = getCondition(params.region, params.condition)
  const region = getRegion(params.region)
  const content = getPublicConditionContent(params.region, params.condition)
  if (!condition || !region || !content) return {}

  return {
    title: `${condition.label} — ${region.label}`,
    description: `Clinical reference for ${condition.label}. Special tests with diagnostic accuracy, red flags, management, and evidence-based diagnosis.`,
  }
}

export default async function ConditionPage({ params }: Props) {
  const { region: regionSlug, condition: conditionSlug } = params

  const region = getRegion(regionSlug)
  const condition = getCondition(regionSlug, conditionSlug)

  if (!region || !condition) notFound()

  const result = getPublicConditionContent(regionSlug, conditionSlug)
  if (!result) notFound()

  return (
    <div className="flex">
      <Sidebar currentRegion={regionSlug} currentCondition={conditionSlug} />

      {/* Client-side interactive elements */}
      {result.sections.length > 0 && (
        <ConditionPageClient sections={result.sections} />
      )}

      <div className="flex-1 min-w-0 px-4 py-8 sm:px-8 lg:px-12 xl:pr-4 pb-24 lg:pb-8">
        {/* Breadcrumb */}
        <Breadcrumb crumbs={[
          { label: region.label, href: `/${regionSlug}` },
          { label: condition.label },
        ]} />

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-50 mb-2">
            {condition.label}
          </h1>
          {result.frontmatter.evidence_level && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
              Evidence: {result.frontmatter.evidence_level}
            </span>
          )}
        </div>

        {/* Quick Facts Card */}
        <QuickFacts
          condition={condition}
          frontmatter={result.frontmatter}
          sections={result.sections}
        />

        <section className="mb-8 rounded-xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-800 dark:bg-brand-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            Guided reasoning practice
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-surface-700 dark:text-surface-300">
            Practise clinical reasoning with neutral guided cases. Case answers are hidden until the reveal step.
          </p>
          <Link
            href="/cases"
            className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Browse neutral guided cases
          </Link>
        </section>

        <LearningJourneyLinks current="condition" regionHref={`/${regionSlug}`} />

        {/* Section anchor nav (mobile-friendly pills) */}
        {result.sections.length > 0 && (
          <nav aria-label="Page sections" className="mb-8 flex flex-wrap gap-2 xl:hidden">
            {result.sections.map(section => (
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
              source={result.content}
              components={mdxComponents}
              options={{
                mdxOptions: {
                  remarkPlugins: [remarkGfm],
                  rehypePlugins: [rehypeSlug],
                },
              }}
            />

            {/* Footer metadata */}
            {(result.frontmatter.lastReviewed || result.frontmatter.reviewedBy || result.frontmatter.lastUpdated) && (
              <footer className="mt-10 border-t border-surface-200 pt-6 text-xs text-surface-400 dark:border-surface-700 dark:text-surface-500">
                <div className="flex flex-wrap gap-4">
                  {(result.frontmatter.lastReviewed || result.frontmatter.lastUpdated) && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      Last reviewed: {result.frontmatter.lastReviewed || result.frontmatter.lastUpdated}
                    </span>
                  )}
                  {result.frontmatter.reviewedBy && (
                    <span className="flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5" aria-hidden />
                      Reviewed by: {result.frontmatter.reviewedBy}
                    </span>
                  )}
                </div>
              </footer>
            )}
        </article>
      </div>
    </div>
  )
}

import { ClinicalReasoningEngine } from '@/components/learning/ClinicalReasoningEngine'
import { DecisionTree } from '@/components/learning/DecisionTree'
import { DifferentialDiagnosisBuilder } from '@/components/learning/DifferentialDiagnosisBuilder'
import { LearningModeExamples } from '@/components/learning/LearningModeExamples'

export const metadata = {
  title: 'Learning Lab',
  description: 'Static, privacy-preserving clinical reasoning learning prototypes.',
}

export default function LearningPage() {
  return (
    <main className="mx-auto max-w-screen-xl px-4 py-8 pb-24 sm:px-6 sm:py-12 lg:px-8 lg:pb-12">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">Pilot learning tools</p>
        <h1 className="mt-2 text-3xl font-bold text-surface-900 dark:text-surface-50">Clinical reasoning learning lab</h1>
        <p className="mt-3 text-base leading-7 text-surface-600 dark:text-surface-300">These static prototypes demonstrate interaction patterns, not clinical answers. No account, network request, telemetry, or persistent answer storage is used.</p>
      </div>
      <div className="mt-8 space-y-6">
        <ClinicalReasoningEngine />
        <DifferentialDiagnosisBuilder />
        <DecisionTree />
        <LearningModeExamples />
      </div>
    </main>
  )
}

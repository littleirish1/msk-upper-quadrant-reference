import type { Metadata } from 'next'
import { BodyModelPage } from './BodyModelPage'

export const metadata: Metadata = {
  title: '3D Body Model',
  description: 'Interactive 3D upper quadrant body model — explore regions and conditions visually.',
}

export default function Page() {
  return <BodyModelPage />
}

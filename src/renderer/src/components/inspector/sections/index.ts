/**
 * Barrel export for inspector section components.
 *
 * Each section is a self-contained component that reads from the
 * workspace store and can be rendered in both:
 *   - PropertiesPanel (side panel / floating modal)
 *   - AdvancedSettingsModal (tabbed dialog)
 */

export { AttachmentsSection } from './AttachmentsSection'
export type { AttachmentsSectionProps } from './AttachmentsSection'

export { AgentSection } from './AgentSection'
export type { AgentSectionProps } from './AgentSection'

export { ContextSection } from './ContextSection'
export type { ContextSectionProps } from './ContextSection'

export { ExtractionsSection } from './ExtractionsSection'
export type { ExtractionsSectionProps } from './ExtractionsSection'

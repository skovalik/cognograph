// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Barrel export for inspector section components.
 *
 * Each section is a self-contained component that reads from the
 * workspace store and can be rendered in both:
 *   - PropertiesPanel (side panel / floating modal)
 *   - AdvancedSettingsModal (tabbed dialog)
 */

export type { AgentSectionProps } from './AgentSection'
export { AgentSection } from './AgentSection'
export type { AttachmentsSectionProps } from './AttachmentsSection'
export { AttachmentsSection } from './AttachmentsSection'
export type { ContextSectionProps } from './ContextSection'
export { ContextSection } from './ContextSection'
export type { ExtractionsSectionProps } from './ExtractionsSection'
export { ExtractionsSection } from './ExtractionsSection'

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { Database } from 'lucide-react'
import type { PluginRenderer } from '../../types'
import type { NotionMethods } from '../contract'
import { NotionSettingsTab } from './NotionSettingsTab'

export const renderer: PluginRenderer<NotionMethods> = {
  settingsTab: {
    label: 'Notion',
    icon: Database,
    component: NotionSettingsTab,
  },
}

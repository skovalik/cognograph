import type { PluginRenderer } from '../../types'
import type { NotionMethods } from '../contract'
import { NotionSettingsTab } from './NotionSettingsTab'
import { Database } from 'lucide-react'

export const renderer: PluginRenderer<NotionMethods> = {
  settingsTab: {
    label: 'Notion',
    icon: Database,
    component: NotionSettingsTab
  }
}

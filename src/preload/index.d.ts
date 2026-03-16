// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { ElectronAPI } from './index'

declare global {
  interface Window {
    api: ElectronAPI
  }
}

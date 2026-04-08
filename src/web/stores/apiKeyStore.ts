// Stub for desktop-only public repo. Full implementation in src/web/ (private repo).

import { create } from 'zustand'

export interface ApiKeyEntry {
  id: string
  provider: string
  label: string | null
  lastFour: string
  source: 'byok' | 'managed'
  createdAt: string
}

interface ApiKeyState {
  keys: ApiKeyEntry[]
  loading: boolean
  fetchKeys: () => Promise<void>
  addKey: (provider: string, key: string, label?: string) => Promise<boolean>
  removeKey: (id: string) => Promise<boolean>
  testKey: (provider: string, key: string) => Promise<boolean>
  hasProvider: (provider: string) => boolean
}

export const useApiKeyStore = create<ApiKeyState>()((_set, get) => ({
  keys: [],
  loading: false,
  fetchKeys: async () => {},
  addKey: async () => false,
  removeKey: async () => false,
  testKey: async () => false,
  hasProvider: (provider) => get().keys.some((k) => k.provider === provider),
}))

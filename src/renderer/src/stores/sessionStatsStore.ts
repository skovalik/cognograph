import { create } from 'zustand'

export interface ProviderModelStats {
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  costUSD: number
  requestCount: number
}

interface SessionStatsState {
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUSD: number
  totalRequests: number
  byModel: Record<string, ProviderModelStats>

  recordUsage: (params: {
    provider: string
    model: string
    inputTokens: number
    outputTokens: number
    costUSD: number
  }) => void

  resetStats: () => void
}

const INITIAL_STATE = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCostUSD: 0,
  totalRequests: 0,
  byModel: {} as Record<string, ProviderModelStats>,
}

export const useSessionStatsStore = create<SessionStatsState>((set) => ({
  ...INITIAL_STATE,

  recordUsage: ({ provider, model, inputTokens, outputTokens, costUSD }) => {
    const key = `${provider}:${model}`
    set((state) => ({
      totalInputTokens: state.totalInputTokens + inputTokens,
      totalOutputTokens: state.totalOutputTokens + outputTokens,
      totalCostUSD: state.totalCostUSD + costUSD,
      totalRequests: state.totalRequests + 1,
      byModel: {
        ...state.byModel,
        [key]: {
          provider,
          model,
          inputTokens: (state.byModel[key]?.inputTokens ?? 0) + inputTokens,
          outputTokens: (state.byModel[key]?.outputTokens ?? 0) + outputTokens,
          costUSD: (state.byModel[key]?.costUSD ?? 0) + costUSD,
          requestCount: (state.byModel[key]?.requestCount ?? 0) + 1,
        },
      },
    }))
  },

  resetStats: () => set(INITIAL_STATE),
}))

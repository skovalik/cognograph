// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { create } from 'zustand'

export interface GenerationJob {
  id: string
  nodeId: string
  toolName: string
  provider: string
  status: 'queued' | 'processing' | 'complete' | 'failed'
  progress?: number
  result?: { artifactNodeId: string; storageUrl: string }
  error?: string
  createdAt: number
  completedAt?: number
}

interface JobManagerState {
  jobs: Map<string, GenerationJob>
  addJob: (job: GenerationJob) => void
  updateJob: (id: string, update: Partial<GenerationJob>) => void
  removeJob: (id: string) => void
  getJobsForNode: (nodeId: string) => GenerationJob[]
}

export const useJobManager = create<JobManagerState>()((set, get) => ({
  jobs: new Map(),

  addJob: (job) =>
    set((state) => {
      const jobs = new Map(state.jobs)
      jobs.set(job.id, job)
      return { jobs }
    }),

  updateJob: (id, update) =>
    set((state) => {
      const jobs = new Map(state.jobs)
      const existing = jobs.get(id)
      if (existing) jobs.set(id, { ...existing, ...update })
      return { jobs }
    }),

  removeJob: (id) =>
    set((state) => {
      const jobs = new Map(state.jobs)
      jobs.delete(id)
      return { jobs }
    }),

  getJobsForNode: (nodeId) => {
    return Array.from(get().jobs.values()).filter((j) => j.nodeId === nodeId)
  },
}))

// Polling strategy: 3s for first 30s, then 10s. Max 10min.
export async function pollJob(
  jobId: string,
  checkFn: () => Promise<{ status: string; progress?: number; output?: string; error?: string }>,
  onUpdate: (status: string, progress?: number) => void,
): Promise<string> {
  const start = Date.now()
  const maxWait = 10 * 60 * 1000 // 10 minutes

  while (Date.now() - start < maxWait) {
    const result = await checkFn()

    if (result.status === 'succeeded' || result.status === 'complete') {
      onUpdate('complete', 100)
      return result.output || ''
    }

    if (result.status === 'failed') {
      onUpdate('failed')
      throw new Error(result.error || 'Job failed')
    }

    onUpdate('processing', result.progress)

    const elapsed = Date.now() - start
    const delay = elapsed < 30000 ? 3000 : 10000
    await new Promise((r) => setTimeout(r, delay))
  }

  throw new Error('Job timed out after 10 minutes')
}

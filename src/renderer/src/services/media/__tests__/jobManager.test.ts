// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { beforeEach, describe, expect, it } from 'vitest'
import { type GenerationJob, useJobManager } from '../jobManager'

describe('JobManager', () => {
  beforeEach(() => {
    useJobManager.setState({ jobs: new Map() })
  })

  it('adds and retrieves jobs', () => {
    const job: GenerationJob = {
      id: 'job-1',
      nodeId: 'node-1',
      toolName: 'generate_image',
      provider: 'stability',
      status: 'queued',
      createdAt: Date.now(),
    }

    useJobManager.getState().addJob(job)
    const jobs = useJobManager.getState().getJobsForNode('node-1')
    expect(jobs).toHaveLength(1)
    expect(jobs[0].toolName).toBe('generate_image')
  })

  it('updates job status', () => {
    const job: GenerationJob = {
      id: 'job-2',
      nodeId: 'node-1',
      toolName: 'generate_video',
      provider: 'runway',
      status: 'queued',
      createdAt: Date.now(),
    }

    useJobManager.getState().addJob(job)
    useJobManager.getState().updateJob('job-2', { status: 'processing', progress: 50 })

    const updated = useJobManager.getState().jobs.get('job-2')
    expect(updated?.status).toBe('processing')
    expect(updated?.progress).toBe(50)
  })

  it('removes completed jobs', () => {
    const job: GenerationJob = {
      id: 'job-3',
      nodeId: 'node-2',
      toolName: 'generate_3d',
      provider: 'replicate',
      status: 'complete',
      createdAt: Date.now(),
    }

    useJobManager.getState().addJob(job)
    expect(useJobManager.getState().jobs.size).toBe(1)

    useJobManager.getState().removeJob('job-3')
    expect(useJobManager.getState().jobs.size).toBe(0)
  })

  it('filters jobs by node ID', () => {
    useJobManager.getState().addJob({
      id: 'j1',
      nodeId: 'n1',
      toolName: 'a',
      provider: 'p',
      status: 'queued',
      createdAt: 0,
    })
    useJobManager.getState().addJob({
      id: 'j2',
      nodeId: 'n2',
      toolName: 'b',
      provider: 'p',
      status: 'queued',
      createdAt: 0,
    })
    useJobManager.getState().addJob({
      id: 'j3',
      nodeId: 'n1',
      toolName: 'c',
      provider: 'p',
      status: 'queued',
      createdAt: 0,
    })

    expect(useJobManager.getState().getJobsForNode('n1')).toHaveLength(2)
    expect(useJobManager.getState().getJobsForNode('n2')).toHaveLength(1)
    expect(useJobManager.getState().getJobsForNode('n3')).toHaveLength(0)
  })
})

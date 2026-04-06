// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { AlertCircle, CheckCircle, Loader2, X } from 'lucide-react'
import { memo, useEffect, useState } from 'react'
import { type GenerationJob, useJobManager } from '../../services/media/jobManager'

interface GenerationProgressProps {
  nodeId: string
}

export const GenerationProgress = memo(function GenerationProgress({
  nodeId,
}: GenerationProgressProps) {
  const jobs = useJobManager((state) => state.getJobsForNode(nodeId))
  const activeJobs = jobs.filter((j) => j.status === 'queued' || j.status === 'processing')

  if (activeJobs.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5 mt-2">
      {activeJobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  )
})

const JobCard = memo(function JobCard({ job }: { job: GenerationJob }) {
  const removeJob = useJobManager((state) => state.removeJob)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - job.createdAt) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [job.createdAt])

  const statusIcon = {
    queued: <Loader2 size={12} className="animate-spin text-[var(--text-secondary)]" />,
    processing: <Loader2 size={12} className="animate-spin text-blue-400" />,
    complete: <CheckCircle size={12} className="text-green-400" />,
    failed: <AlertCircle size={12} className="text-red-400" />,
  }[job.status]

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 bg-[var(--bg-secondary)] rounded text-xs border border-[var(--border-default)]">
      {statusIcon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-medium text-[var(--text-primary)] truncate">{job.toolName}</span>
          <span className="text-[var(--text-secondary)]">· {job.provider}</span>
        </div>
        {job.progress != null && job.status === 'processing' && (
          <div className="mt-1 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        )}
      </div>
      <span className="text-[var(--text-secondary)] tabular-nums">{elapsed}s</span>
      <button
        onClick={() => removeJob(job.id)}
        className="p-0.5 hover:bg-[var(--bg-hover)] rounded text-[var(--text-secondary)]"
        title="Cancel"
      >
        <X size={10} />
      </button>
    </div>
  )
})

// WPConfigBody -- Renders inside NoteNode when noteMode === 'wp-config'
// Displays WordPress connection settings: site URL, API endpoint, auth method, environment

import { memo, useCallback } from 'react'
import { Globe, Shield, ExternalLink } from 'lucide-react'
import type { WPConfigFields, WPAuthMethod, WPEnvironment } from '@shared/types'

const AUTH_METHODS: { value: WPAuthMethod; label: string }[] = [
  { value: 'application-password', label: 'Application Password' },
  { value: 'jwt', label: 'JWT' },
  { value: 'oauth', label: 'OAuth' },
]

const ENVIRONMENTS: { value: WPEnvironment; label: string; color: string }[] = [
  { value: 'development', label: 'dev', color: '#22c55e' },
  { value: 'staging', label: 'staging', color: '#f59e0b' },
  { value: 'production', label: 'prod', color: '#ef4444' },
]

interface WPConfigBodyProps {
  wpConfig: WPConfigFields | undefined
  onChange: (wpConfig: WPConfigFields) => void
  selected: boolean | undefined
}

function getDefaultWPConfig(): WPConfigFields {
  return {
    siteUrl: '',
    graphqlEndpoint: '/graphql',
    restEndpoint: '/wp-json/wp/v2',
    authMethod: 'application-password',
    credentialKey: 'wp-default',
    environment: 'development',
  }
}

function WPConfigBodyComponent({ wpConfig, onChange, selected }: WPConfigBodyProps): JSX.Element {
  const data = wpConfig || getDefaultWPConfig()

  const updateField = useCallback(
    <K extends keyof WPConfigFields>(field: K, value: WPConfigFields[K]) => {
      onChange({ ...data, [field]: value })
    },
    [data, onChange],
  )

  const envConfig = ENVIRONMENTS.find((e) => e.value === data.environment) || ENVIRONMENTS[0]

  // Extract hostname for compact display
  const hostname = (() => {
    if (!data.siteUrl) return 'Not configured'
    try {
      return new URL(data.siteUrl).hostname
    } catch {
      return data.siteUrl
    }
  })()

  return (
    <div className="flex flex-col gap-1.5 w-full nodrag nowheel" data-focusable="true">
      {/* Site URL */}
      <div className="flex items-center gap-1 px-1">
        <Globe className="w-3 h-3 flex-shrink-0" style={{ color: '#21759b' }} />
        {selected ? (
          <input
            type="text"
            value={data.siteUrl}
            onChange={(e) => updateField('siteUrl', e.target.value)}
            className="flex-1 text-[11px] font-mono bg-transparent border-none outline-none px-0.5"
            style={{ color: 'var(--node-text-primary)' }}
            placeholder="https://your-site.com"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1 text-[11px] font-mono truncate"
            style={{ color: 'var(--node-text-primary)' }}
            title={data.siteUrl || 'Not configured'}
          >
            {hostname}
          </span>
        )}
        {data.siteUrl && !selected && (
          <ExternalLink className="w-2.5 h-2.5 opacity-40 flex-shrink-0" />
        )}
      </div>

      {/* API endpoint */}
      <div className="flex items-center gap-1 px-1">
        <span className="text-[10px]" style={{ color: 'var(--node-text-muted)' }}>API:</span>
        {selected ? (
          <select
            value={data.graphqlEndpoint ? 'graphql' : 'rest'}
            onChange={(e) => {
              if (e.target.value === 'graphql') {
                updateField('graphqlEndpoint', '/graphql')
              } else {
                updateField('graphqlEndpoint', undefined)
                updateField('restEndpoint', '/wp-json/wp/v2')
              }
            }}
            className="text-[10px] bg-transparent border-none outline-none cursor-pointer"
            style={{ color: 'var(--node-text-secondary)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <option value="graphql">GraphQL</option>
            <option value="rest">REST</option>
          </select>
        ) : (
          <span className="text-[10px] font-mono" style={{ color: 'var(--node-text-secondary)' }}>
            {data.graphqlEndpoint ? `GraphQL (${data.graphqlEndpoint})` : `REST (${data.restEndpoint || '/wp-json/wp/v2'})`}
          </span>
        )}
      </div>

      {/* Auth method */}
      <div className="flex items-center gap-1 px-1">
        <Shield className="w-2.5 h-2.5 flex-shrink-0" style={{ color: 'var(--node-text-muted)' }} />
        {selected ? (
          <select
            value={data.authMethod}
            onChange={(e) => updateField('authMethod', e.target.value as WPAuthMethod)}
            className="text-[10px] bg-transparent border-none outline-none cursor-pointer"
            style={{ color: 'var(--node-text-secondary)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {AUTH_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        ) : (
          <span className="text-[10px]" style={{ color: 'var(--node-text-secondary)' }}>
            {AUTH_METHODS.find((m) => m.value === data.authMethod)?.label || data.authMethod}
          </span>
        )}
      </div>

      {/* Frontend URL (when selected or if set) */}
      {(selected || data.frontendUrl) && (
        <div className="flex items-center gap-1 px-1">
          <span className="text-[10px]" style={{ color: 'var(--node-text-muted)' }}>Frontend:</span>
          {selected ? (
            <input
              type="text"
              value={data.frontendUrl || ''}
              onChange={(e) => updateField('frontendUrl', e.target.value || undefined)}
              className="flex-1 text-[10px] font-mono bg-transparent border-none outline-none px-0.5"
              style={{ color: 'var(--node-text-secondary)' }}
              placeholder="https://frontend.vercel.app"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-[10px] font-mono truncate" style={{ color: 'var(--node-text-secondary)' }}>
              {data.frontendUrl}
            </span>
          )}
        </div>
      )}

      {/* Deploy hook URL (when selected) */}
      {selected && (
        <div className="flex items-center gap-1 px-1">
          <span className="text-[10px]" style={{ color: 'var(--node-text-muted)' }}>Deploy hook:</span>
          <input
            type="text"
            value={data.deployHookUrl || ''}
            onChange={(e) => updateField('deployHookUrl', e.target.value || undefined)}
            className="flex-1 text-[10px] font-mono bg-transparent border-none outline-none px-0.5"
            style={{ color: 'var(--node-text-secondary)' }}
            placeholder="https://api.vercel.com/v1/..."
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Environment badge + credential indicator */}
      <div className="flex items-center gap-1.5 px-1 mt-0.5">
        {selected ? (
          <select
            value={data.environment}
            onChange={(e) => updateField('environment', e.target.value as WPEnvironment)}
            className="text-[9px] bg-transparent border-none outline-none cursor-pointer"
            style={{ color: envConfig.color }}
            onClick={(e) => e.stopPropagation()}
          >
            {ENVIRONMENTS.map((env) => (
              <option key={env.value} value={env.value}>{env.label}</option>
            ))}
          </select>
        ) : (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium"
            style={{
              backgroundColor: `${envConfig.color}20`,
              color: envConfig.color,
            }}
          >
            {envConfig.label}
          </span>
        )}
        <span
          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px]"
          style={{
            backgroundColor: 'rgba(33, 117, 155, 0.12)',
            color: '#21759b',
          }}
          title={`Credential key: ${data.credentialKey}`}
        >
          <Shield className="w-2 h-2" />
          {data.credentialKey ? 'Credentials set' : 'No credentials'}
        </span>
      </div>
    </div>
  )
}

export const WPConfigBody = memo(WPConfigBodyComponent)

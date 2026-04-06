// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * PropertyField — Switch component that renders the appropriate field
 * based on the property definition type from BUILTIN_PROPERTIES.
 *
 * Reads the current value from the workspace store and writes updates
 * via `updateNode`. Each field applies changes immediately (no save button).
 */

import { useCallback, useMemo } from 'react'
import { BUILTIN_PROPERTIES } from '../../../constants/properties'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { BooleanField } from './BooleanField'
import { DateField } from './DateField'
import { SelectField, type SelectOption } from './SelectField'
import { TagsField } from './TagsField'
import { TextField } from './TextField'

/** Lightweight property definition accepted via extraDefs prop. */
export interface ExtraPropertyDef {
  name: string
  type: string
  options?: { value: string; label: string }[]
}

export interface PropertyFieldProps {
  nodeId: string
  fieldId: string
  /** Supplemental property definitions that take precedence over value-type
   *  inference but yield to BUILTIN_PROPERTIES. */
  extraDefs?: Record<string, ExtraPropertyDef>
}

/** Capitalize first letter of a camelCase string for display. */
function fieldLabel(fieldId: string): string {
  const spaced = fieldId.replace(/([A-Z])/g, ' $1')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function PropertyField({ nodeId, fieldId, extraDefs }: PropertyFieldProps): JSX.Element {
  const node = useWorkspaceStore((state) => state.nodes.find((n) => n.id === nodeId))
  const updateNode = useWorkspaceStore((state) => state.updateNode)

  const builtinDef = BUILTIN_PROPERTIES[fieldId]
  const extraDef = extraDefs?.[fieldId]
  const label = builtinDef?.name ?? extraDef?.name ?? fieldLabel(fieldId)
  const data = (node?.data ?? {}) as Record<string, unknown>
  const value = data[fieldId]

  // Stable update callback
  const handleChange = useCallback(
    (newValue: unknown) => {
      updateNode(nodeId, { [fieldId]: newValue } as Record<string, unknown>)
    },
    [nodeId, fieldId, updateNode],
  )

  // Resolve options for select-type fields — prefer builtin, fall back to extraDefs
  const options: SelectOption[] = useMemo(() => {
    if (builtinDef?.options) {
      return builtinDef.options.map((o) => ({
        value: o.value,
        label: o.label,
        color: o.color,
      }))
    }
    if (extraDef?.options) {
      return extraDef.options.map((o) => ({
        value: o.value,
        label: o.label,
      }))
    }
    return []
  }, [builtinDef, extraDef])

  // Determine the effective type — builtin takes priority, then extraDefs
  const type = builtinDef?.type ?? extraDef?.type

  // Select / Status / Priority — all render as a dropdown
  if (type === 'select' || type === 'status' || type === 'priority') {
    return (
      <SelectField
        nodeId={nodeId}
        fieldId={fieldId}
        label={label}
        value={(value as string) ?? (builtinDef?.defaultValue as string) ?? ''}
        options={options}
        onChange={handleChange as (v: string) => void}
      />
    )
  }

  // Date
  if (type === 'date' || type === 'datetime') {
    return (
      <DateField
        label={label}
        value={value as string | number | undefined}
        onChange={handleChange as (v: string | undefined) => void}
      />
    )
  }

  // Multi-select / Tags
  if (type === 'multi-select') {
    return (
      <TagsField
        label={label}
        value={Array.isArray(value) ? (value as string[]) : []}
        onChange={handleChange as (v: string[]) => void}
      />
    )
  }

  // Checkbox / Boolean
  if (type === 'checkbox') {
    return (
      <BooleanField
        label={label}
        value={Boolean(value)}
        onChange={handleChange as (v: boolean) => void}
      />
    )
  }

  // --------------------------------------------------------------------------
  // Unknown / unregistered property — infer from value type
  // --------------------------------------------------------------------------
  if (typeof value === 'boolean') {
    return (
      <BooleanField label={label} value={value} onChange={handleChange as (v: boolean) => void} />
    )
  }

  if (Array.isArray(value)) {
    return (
      <TagsField
        label={label}
        value={value as string[]}
        onChange={handleChange as (v: string[]) => void}
      />
    )
  }

  // Default: text field (covers text, url, email, and any unknown string props)
  return (
    <TextField
      label={label}
      value={value !== undefined && value !== null ? String(value) : ''}
      onChange={handleChange as (v: string) => void}
    />
  )
}

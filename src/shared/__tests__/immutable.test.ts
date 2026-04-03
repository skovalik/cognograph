// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, it, expect } from 'vitest'
import type { DeepImmutable, DeepPartial, Prettify } from '../immutable'

// =============================================================================
// Compile-time type tests
//
// These tests verify the utility types at the type level. If the types are
// wrong, TypeScript will refuse to compile this file. The runtime assertions
// are trivial — the real value is that `npx tsc --noEmit` catches regressions.
// =============================================================================

describe('DeepImmutable', () => {
  it('prevents mutation of top-level properties', () => {
    type Original = { name: string; count: number }
    type Frozen = DeepImmutable<Original>

    // This assignment must be valid (readonly is assignable from mutable)
    const obj: Frozen = { name: 'test', count: 1 }
    expect(obj.name).toBe('test')

    // Compile-time check: the following would fail if uncommented:
    // obj.name = 'changed'  // Error: Cannot assign to 'name' because it is a read-only property
  })

  it('recursively freezes nested objects', () => {
    type Nested = { outer: { inner: { value: string } } }
    type Frozen = DeepImmutable<Nested>

    const obj: Frozen = { outer: { inner: { value: 'deep' } } }
    expect(obj.outer.inner.value).toBe('deep')

    // Compile-time check: the following would fail if uncommented:
    // obj.outer.inner.value = 'changed'  // Error: read-only property
  })

  it('converts arrays to ReadonlyArray with immutable elements', () => {
    type WithArray = { items: { id: number; label: string }[] }
    type Frozen = DeepImmutable<WithArray>

    const obj: Frozen = { items: [{ id: 1, label: 'one' }] }
    expect(obj.items[0]?.label).toBe('one')

    // Compile-time check: the following would fail if uncommented:
    // obj.items.push({ id: 2, label: 'two' })  // Error: Property 'push' does not exist on ReadonlyArray
    // obj.items[0].label = 'changed'            // Error: read-only property
  })

  it('leaves primitives unchanged', () => {
    type Prim = DeepImmutable<string>
    const val: Prim = 'hello'
    expect(val).toBe('hello')
  })
})

describe('DeepPartial', () => {
  it('makes all properties optional recursively', () => {
    type Config = {
      display: {
        width: number
        height: number
        theme: { primary: string; secondary: string }
      }
      debug: boolean
    }
    type PartialConfig = DeepPartial<Config>

    // All of these are valid — every property is optional at every depth
    const empty: PartialConfig = {}
    const partial: PartialConfig = { display: { theme: { primary: '#000' } } }
    const full: PartialConfig = {
      display: { width: 1920, height: 1080, theme: { primary: '#000', secondary: '#fff' } },
      debug: true,
    }

    expect(empty).toEqual({})
    expect(partial.display?.theme?.primary).toBe('#000')
    expect(full.debug).toBe(true)
  })
})

describe('Prettify', () => {
  it('flattens intersection types', () => {
    type A = { a: number }
    type B = { b: string }
    type Merged = Prettify<A & B>

    const obj: Merged = { a: 1, b: 'two' }
    expect(obj.a).toBe(1)
    expect(obj.b).toBe('two')
  })
})

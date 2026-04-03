// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

// =============================================================================
// Shared Utility Types
// =============================================================================

/**
 * Recursively makes all properties of T (and nested objects/arrays) readonly.
 * Arrays become ReadonlyArray with recursively immutable elements.
 */
export type DeepImmutable<T> = T extends (infer R)[]
  ? ReadonlyArray<DeepImmutable<R>>
  : T extends object
    ? { readonly [K in keyof T]: DeepImmutable<T[K]> }
    : T

/**
 * Recursively makes all properties of T (and nested objects) optional.
 */
export type DeepPartial<T> = T extends (infer R)[]
  ? DeepPartial<R>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

/**
 * Flattens intersection types into a single object type for readable
 * tooltips and cleaner type signatures.
 *
 * @example
 *   type Merged = Prettify<{ a: 1 } & { b: 2 }>
 *   // => { a: 1; b: 2 }
 */
export type Prettify<T> = { [K in keyof T]: T[K] } & {}

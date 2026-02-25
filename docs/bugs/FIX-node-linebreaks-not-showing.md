# Fix: Node Cards Not Showing Line Breaks

**Date**: 2025-01-23
**Status**: Fixed
**Affected Components**: RichTextEditor, nodeUtils, PropertiesPanel

## Problem

Node cards (Note and Task nodes) were displaying content without respecting line breaks. Content entered with newlines appeared as a single continuous block of text on the canvas.

### Root Cause

The content storage and display had a format mismatch:

1. **Properties Panel** used a plain `<textarea>` for content editing, which stores text with `\n` newline characters
2. **Node Cards** use the `RichTextEditor` component (TipTap) which expects HTML with `<p>` tags for paragraph structure
3. When TipTap receives plain text with `\n` characters, it wraps everything in a single `<p>` tag, treating newlines as whitespace

## Solution

Two-part fix:

1. **Content normalization** - Added utilities to detect plain text and convert to HTML paragraphs
2. **Unified editing** - Replaced `<textarea>` with `RichTextEditor` in Properties Panel for consistent editing experience

### Changes Made

#### 1. `src/renderer/src/utils/nodeUtils.ts`

Added three new utility functions:

```typescript
// Checks if content is already HTML
export function isHtmlContent(content: string): boolean

// Converts plain text with \n to HTML paragraphs
export function plainTextToHtml(text: string): string

// Main normalization function used by RichTextEditor
export function normalizeContentForEditor(content: string | undefined): string
```

**Key implementation details:**
- `isHtmlContent()` checks for common HTML tags (p, br, ul, ol, li, strong, em, h1-h6, code, pre, blockquote, a)
- `plainTextToHtml()` splits by newlines and wraps each line in `<p>` tags
- `escapeHtml()` helper prevents XSS by escaping special characters
- Empty lines become empty `<p></p>` tags to preserve spacing

#### 2. `src/renderer/src/components/RichTextEditor.tsx`

Updated to normalize content in two places:

1. **Initial editor content** - normalizes on first render:
```typescript
content: normalizeContentForEditor(value)
```

2. **External value sync** - normalizes when value prop changes:
```typescript
const normalizedValue = normalizeContentForEditor(value)
```

#### 3. `src/renderer/src/components/PropertiesPanel.tsx`

Replaced `<textarea>` with `RichTextEditor` in both:

- **NoteFields** - Content field now uses RichTextEditor
- **TaskFields** - Description field now uses RichTextEditor

This ensures users get the same rich text editing experience whether editing on the card or in the panel.

## Testing Checklist

- [ ] Create a Note node with multi-line content via Properties Panel
- [ ] Verify line breaks display correctly on the canvas card
- [ ] Create a Task node with multi-line description
- [ ] Verify line breaks display correctly on the canvas card
- [ ] Edit content in Properties Panel - verify no HTML tags visible
- [ ] Edit content on node card - verify changes sync to Properties Panel
- [ ] Verify content with special characters (<, >, &, quotes) displays correctly
- [ ] Verify empty lines between paragraphs are preserved
- [ ] Verify existing HTML content (bold, lists, etc.) still works correctly
- [ ] Verify rich text toolbar appears on focus in Properties Panel

## Files Changed

1. `src/renderer/src/utils/nodeUtils.ts` - Added content normalization utilities
2. `src/renderer/src/components/RichTextEditor.tsx` - Added import and normalization calls
3. `src/renderer/src/components/PropertiesPanel.tsx` - Replaced textareas with RichTextEditor

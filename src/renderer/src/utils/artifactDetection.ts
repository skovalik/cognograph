import type { ArtifactContentType } from '@shared/types'

/**
 * Represents an artifact detected in an LLM response
 */
export interface DetectedArtifact {
  type: ArtifactContentType
  language?: string
  title?: string
  content: string
  startIndex: number
  endIndex: number
}

/**
 * Minimum size thresholds for artifact extraction
 */
const EXTRACTION_THRESHOLDS = {
  code: { minLines: 10, minChars: 300 },
  mermaid: { minLines: 3, minChars: 50 },
  html: { minLines: 5, minChars: 200 },
  json: { minLines: 5, minChars: 100 },
  csv: { minLines: 5, minChars: 100 }
}

/**
 * Map language tags to content types
 */
const LANGUAGE_TO_TYPE: Record<string, ArtifactContentType> = {
  mermaid: 'mermaid',
  html: 'html',
  svg: 'svg',
  json: 'json',
  csv: 'csv'
}

/**
 * Detect artifacts in an LLM response
 * Looks for substantial code blocks that could be extracted
 */
export function detectArtifacts(response: string): DetectedArtifact[] {
  const artifacts: DetectedArtifact[] = []

  // Match code blocks with optional language
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(response)) !== null) {
    const language = match[1]?.toLowerCase() || ''
    const content = match[2] || ''
    const lineCount = content.split('\n').length
    const charCount = content.length

    // Determine content type
    const contentType: ArtifactContentType = LANGUAGE_TO_TYPE[language] || 'code'

    // Get appropriate thresholds
    const thresholds =
      EXTRACTION_THRESHOLDS[contentType as keyof typeof EXTRACTION_THRESHOLDS] ||
      EXTRACTION_THRESHOLDS.code

    // Check if meets minimum requirements
    if (lineCount >= thresholds.minLines || charCount >= thresholds.minChars) {
      // Generate a title based on content
      const title = generateArtifactTitle(content, contentType, language)

      artifacts.push({
        type: contentType,
        language: contentType === 'code' ? language || undefined : undefined,
        title,
        content: content.trim(),
        startIndex: match.index,
        endIndex: match.index + match[0].length
      })
    }
  }

  return artifacts
}

/**
 * Generate a reasonable title for an artifact based on its content
 */
function generateArtifactTitle(
  content: string,
  contentType: ArtifactContentType,
  language?: string
): string {
  // Try to find a function/class/component name
  if (contentType === 'code') {
    // Function declaration
    const funcMatch = content.match(/(?:function|const|let|var)\s+(\w+)/)
    if (funcMatch?.[1]) {
      return `${funcMatch[1]}${language ? `.${language}` : ''}`
    }

    // Class declaration
    const classMatch = content.match(/class\s+(\w+)/)
    if (classMatch?.[1]) {
      return `${classMatch[1]}${language ? `.${language}` : ''}`
    }

    // React component
    const componentMatch = content.match(/(?:export\s+)?(?:default\s+)?function\s+(\w+Component|\w+)/)
    if (componentMatch?.[1]) {
      return `${componentMatch[1]}${language ? `.${language}` : ''}`
    }

    // Interface/type
    const typeMatch = content.match(/(?:interface|type)\s+(\w+)/)
    if (typeMatch?.[1]) {
      return `${typeMatch[1]}${language ? `.${language}` : ''}`
    }
  }

  // Mermaid diagram type
  if (contentType === 'mermaid') {
    if (content.includes('flowchart') || content.includes('graph')) return 'Flowchart'
    if (content.includes('sequenceDiagram')) return 'Sequence Diagram'
    if (content.includes('classDiagram')) return 'Class Diagram'
    if (content.includes('stateDiagram')) return 'State Diagram'
    if (content.includes('erDiagram')) return 'ER Diagram'
    if (content.includes('gantt')) return 'Gantt Chart'
    return 'Mermaid Diagram'
  }

  // Default titles
  const defaults: Record<ArtifactContentType, string> = {
    code: language ? `${language} code` : 'Code snippet',
    markdown: 'Document',
    html: 'HTML document',
    svg: 'SVG graphic',
    mermaid: 'Diagram',
    json: 'JSON data',
    text: 'Text content',
    csv: 'CSV data',
    image: 'Image',
    custom: 'Custom artifact'
  }

  return defaults[contentType] || 'Artifact'
}

/**
 * Check if a message contains extractable artifacts
 */
export function hasExtractableArtifacts(content: string): boolean {
  return detectArtifacts(content).length > 0
}

/**
 * Extract artifacts from message and return the modified content with placeholders
 */
export function extractAndReplace(
  content: string,
  artifacts: DetectedArtifact[]
): { content: string; artifacts: DetectedArtifact[] } {
  // Sort by startIndex descending so we can replace from end to start
  const sorted = [...artifacts].sort((a, b) => b.startIndex - a.startIndex)

  let modifiedContent = content

  for (const artifact of sorted) {
    const placeholder = `[Extracted: ${artifact.title}]`
    modifiedContent =
      modifiedContent.slice(0, artifact.startIndex) +
      placeholder +
      modifiedContent.slice(artifact.endIndex)
  }

  return { content: modifiedContent, artifacts }
}

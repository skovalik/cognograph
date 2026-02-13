/**
 * IPC Types
 *
 * Standard response envelope for all IPC communication between
 * main and renderer processes. Provides consistent error handling
 * and metadata across the application.
 *
 * Created as part of Batch 1B: IPC Standardization
 */

// =============================================================================
// Response Envelope
// =============================================================================

/**
 * Standard IPC response wrapper
 * All IPC handlers should return this format
 */
export interface IPCResponse<T = unknown> {
  success: boolean
  data?: T
  error?: IPCError
  meta?: IPCMeta
}

/**
 * Structured error information
 */
export interface IPCError {
  code: string
  message: string
  details?: string
  stack?: string
}

/**
 * Response metadata for debugging and monitoring
 */
export interface IPCMeta {
  timestamp: number
  duration?: number
  requestId?: string
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a successful IPC response
 */
export function createIPCSuccess<T>(data: T, meta?: Partial<IPCMeta>): IPCResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: Date.now(),
      ...meta
    }
  }
}

/**
 * Create an error IPC response
 */
export function createIPCError(
  code: string,
  message: string,
  details?: string
): IPCResponse<never> {
  return {
    success: false,
    error: { code, message, details },
    meta: {
      timestamp: Date.now()
    }
  }
}

/**
 * Create an error IPC response from an Error object
 */
export function createIPCErrorFromException(
  error: Error,
  code: string = 'UNKNOWN_ERROR'
): IPCResponse<never> {
  return {
    success: false,
    error: {
      code,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    },
    meta: {
      timestamp: Date.now()
    }
  }
}

// =============================================================================
// Error Codes
// =============================================================================

/**
 * Standard error codes for IPC operations
 */
export const IPC_ERROR_CODES = {
  // General errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  TIMEOUT: 'TIMEOUT',

  // Workspace errors
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  WORKSPACE_SAVE_FAILED: 'WORKSPACE_SAVE_FAILED',
  WORKSPACE_LOAD_FAILED: 'WORKSPACE_LOAD_FAILED',

  // LLM errors
  LLM_API_ERROR: 'LLM_API_ERROR',
  LLM_RATE_LIMITED: 'LLM_RATE_LIMITED',
  LLM_CONTEXT_TOO_LONG: 'LLM_CONTEXT_TOO_LONG',
  LLM_INVALID_RESPONSE: 'LLM_INVALID_RESPONSE',

  // AI Editor errors
  AI_EDITOR_GENERATION_FAILED: 'AI_EDITOR_GENERATION_FAILED',
  AI_EDITOR_PARSE_FAILED: 'AI_EDITOR_PARSE_FAILED',
  AI_EDITOR_CANCELLED: 'AI_EDITOR_CANCELLED',

  // File system errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  FILE_WRITE_ERROR: 'FILE_WRITE_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED'
} as const

export type IPCErrorCode = (typeof IPC_ERROR_CODES)[keyof typeof IPC_ERROR_CODES]

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a response is successful
 */
export function isIPCSuccess<T>(response: IPCResponse<T>): response is IPCResponse<T> & { success: true; data: T } {
  return response.success === true && response.data !== undefined
}

/**
 * Check if a response is an error
 */
export function isIPCError<T>(response: IPCResponse<T>): response is IPCResponse<T> & { success: false; error: IPCError } {
  return response.success === false && response.error !== undefined
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Wrap an async function with IPC response handling
 * Catches errors and returns proper IPCResponse format
 */
export async function wrapIPCHandler<T>(
  handler: () => Promise<T>,
  errorCode: string = IPC_ERROR_CODES.UNKNOWN_ERROR
): Promise<IPCResponse<T>> {
  const startTime = Date.now()
  try {
    const data = await handler()
    return {
      success: true,
      data,
      meta: {
        timestamp: Date.now(),
        duration: Date.now() - startTime
      }
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: errorCode,
        message: error instanceof Error ? error.message : String(error),
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      },
      meta: {
        timestamp: Date.now(),
        duration: Date.now() - startTime
      }
    }
  }
}

/**
 * Unwrap an IPC response, throwing if it's an error
 * Useful for call sites that want to use try/catch
 */
export function unwrapIPCResponse<T>(response: IPCResponse<T>): T {
  if (!response.success) {
    const error = new Error(response.error?.message || 'IPC call failed')
    ;(error as Error & { code: string }).code = response.error?.code || 'UNKNOWN_ERROR'
    throw error
  }
  return response.data as T
}

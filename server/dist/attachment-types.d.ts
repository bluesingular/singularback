/**
 * Shared attachment content-type configuration.
 *
 * By default a curated set of image/document/text types are allowed. Set the
 * `PAPERCLIP_ALLOWED_ATTACHMENT_TYPES` environment variable to a
 * comma-separated list of MIME types or wildcard patterns to expand the
 * allowed set for routes that use this allowlist.
 *
 * Examples:
 *   PAPERCLIP_ALLOWED_ATTACHMENT_TYPES=image/*,application/pdf
 *   PAPERCLIP_ALLOWED_ATTACHMENT_TYPES=image/*,application/pdf,text/*
 *
 * Supported pattern syntax:
 *   - Exact types:   "application/pdf"
 *   - Wildcards:     "image/*"  or  "application/vnd.openxmlformats-officedocument.*"
 */
export declare const DEFAULT_ALLOWED_TYPES: readonly string[];
export declare const DEFAULT_ATTACHMENT_CONTENT_TYPE = "application/octet-stream";
export declare const SVG_CONTENT_TYPE = "image/svg+xml";
export declare const INLINE_ATTACHMENT_TYPES: readonly string[];
/**
 * Parse a comma-separated list of MIME type patterns into a normalised array.
 * Returns the default image-only list when the input is empty or undefined.
 */
export declare function parseAllowedTypes(raw: string | undefined): string[];
/**
 * Check whether `contentType` matches any entry in `allowedPatterns`.
 *
 * Supports exact matches ("application/pdf") and wildcard / prefix
 * patterns ("image/*", "application/vnd.openxmlformats-officedocument.*").
 */
export declare function matchesContentType(contentType: string, allowedPatterns: string[]): boolean;
export declare function normalizeContentType(contentType: string | null | undefined): string;
export declare function isInlineAttachmentContentType(contentType: string): boolean;
/** Convenience wrapper using the process-level allowed list. */
export declare function isAllowedContentType(contentType: string): boolean;
export declare const MAX_ATTACHMENT_BYTES: number;
//# sourceMappingURL=attachment-types.d.ts.map
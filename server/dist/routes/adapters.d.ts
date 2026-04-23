/**
 * @fileoverview Adapter management REST API routes
 *
 * This module provides Express routes for managing external adapter plugins:
 * - Listing all registered adapters (built-in + external)
 * - Installing external adapters from npm packages or local paths
 * - Unregistering external adapters
 *
 * All routes require board-level authentication (assertBoard middleware).
 *
 * @module server/routes/adapters
 */
export declare function adapterRoutes(): import("express-serve-static-core").Router;
//# sourceMappingURL=adapters.d.ts.map
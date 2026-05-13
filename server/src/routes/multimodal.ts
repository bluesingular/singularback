/**
 * G11 — Multi-modal file upload route.
 *
 * POST /companies/:companyId/tasks/:taskId/attachments
 *   Accepts a multipart file upload, extracts text (or image content block),
 *   and returns the ExtractionResult for use by context assembly.
 *
 *   Supported: application/pdf, image/*, audio/*, text/csv, .xlsx
 *   Max size: 20 MB (configurable via MAX_ATTACHMENT_BYTES)
 *
 * GDPR: when the task's skill has gdprRequired=true, the response includes
 * gdprFlag=true — the caller must enforce EU-model routing for any subsequent
 * LLM call that uses this content.
 */

import { Router } from "express";
import multer from "multer";
import type { Db } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
import { badRequest } from "../errors.js";
import { extractInput, UnsupportedTypeError, ExtractionError } from "../tools/extractInput.js";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_BYTES },
});

export function multimodalRoutes(_db: Db): Router {
  const router = Router({ mergeParams: true });

  router.post(
    "/companies/:companyId/tasks/:taskId/attachments",
    upload.single("file"),
    async (req, res, next) => {
      try {
        const { companyId, taskId } = req.params as { companyId: string; taskId: string };
        assertCompanyAccess(req, companyId);

        if (!req.file) throw badRequest("No file uploaded — use multipart/form-data with field 'file'");

        const { buffer, mimetype } = req.file;
        const gdprRequired = req.body?.gdprRequired === "true" || req.body?.gdprRequired === true;

        let result;
        try {
          result = await extractInput(buffer, mimetype, {
            gdprRequired,
            companyId,
            taskId,
          });
        } catch (err) {
          if (err instanceof UnsupportedTypeError) throw badRequest(err.message);
          if (err instanceof ExtractionError)     throw badRequest(err.message);
          throw err;
        }

        res.status(201).json({
          ok:       true,
          taskId,
          mimeType: result.mimeType,
          byteSize: result.byteSize,
          gdprFlag: result.gdprFlag,
          // Text content (empty for image-only responses)
          text:     result.text,
          // Only present for images
          ...(result.imageData ? { imageData: result.imageData } : {}),
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

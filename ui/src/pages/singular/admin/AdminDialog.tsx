/**
 * AdminDialog — shared Radix Dialog wrapper for all admin screens.
 *
 * Light theme is forced at AdminLayout root (data-theme="light"), so all
 * dialogs rendered via Radix portal inherit it without per-component overrides.
 * Radix handles focus trapping and keyboard events correctly — no custom code needed.
 */
import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface AdminDialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: string
}

export function AdminDialog({ open, onClose, title, children, maxWidth = "max-w-md" }: AdminDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        className={`${maxWidth} p-0 gap-0 bg-white text-[#0F0F0D] border-[#E8E4DC]`}
        // Radix portals outside the admin layout div, so we re-apply light theme here
        data-theme="light"
        style={{ colorScheme: "light" }}
      >
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="font-[Georgia,serif] text-[#0F0F0D] text-lg font-normal">
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 pt-4 text-[#0F0F0D]">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * AdminDialog — shared modal wrapper for all admin screens.
 *
 * Uses Radix UI Dialog (same as the rest of Paperclip UI) so it correctly
 * handles focus trapping, keyboard events, and portal rendering.
 * All custom fixed-inset-0 modals in admin screens must use this instead.
 */
import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
      <DialogContent className={`${maxWidth} p-0 gap-0`}>
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="font-[Georgia,serif] text-[#0F0F0D] text-lg font-normal">
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 pt-4">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}

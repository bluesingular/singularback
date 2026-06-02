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
      <DialogContent
        className={`${maxWidth} p-0 gap-0`}
        style={{
          backgroundColor: "#ffffff",
          color: "#0F0F0D",
          borderColor: "#E8E4DC",
        }}
      >
        {/* Force light theme — Paperclip sets html.dark globally */}
        <div className="light" data-theme="light" style={{ colorScheme: "light" }}>
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle style={{ color: "#0F0F0D", fontFamily: "Georgia, serif", fontSize: "1.125rem", fontWeight: 400 }}>
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 pt-4" style={{ color: "#0F0F0D" }}>
            {children}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

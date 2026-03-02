"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  side?: "left" | "right"
}

interface SheetHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
}

interface SheetTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children?: React.ReactNode
}

interface SheetDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode
}

const Sheet = ({ open, onOpenChange, children }: SheetProps) => {
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false)
      }
    }

    if (open) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "unset"
    }
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />
      {children}
    </div>
  )
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, children, side = "right", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "fixed z-50 bg-white shadow-lg transition-transform duration-300 ease-in-out",
        side === "right" && "right-0 top-0 h-full w-full sm:w-[600px] lg:w-[800px]",
        side === "left" && "left-0 top-0 h-full w-full sm:w-[600px] lg:w-[800px]",
        "overflow-y-auto",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
SheetContent.displayName = "SheetContent"

const SheetHeader = ({ className, ...props }: SheetHeaderProps) => (
  <div
    className={cn("flex flex-col space-y-2 text-left", className)}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetTitle = React.forwardRef<HTMLHeadingElement, SheetTitleProps>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
)
SheetTitle.displayName = "SheetTitle"

const SheetDescription = React.forwardRef<HTMLParagraphElement, SheetDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-gray-600", className)}
      {...props}
    />
  )
)
SheetDescription.displayName = "SheetDescription"

const SheetClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:pointer-events-none",
      className
    )}
    {...props}
  >
    <X className="h-4 w-4" />
    <span className="sr-only">Close</span>
  </button>
))
SheetClose.displayName = "SheetClose"

export {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
}

"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

const SheetContext = React.createContext<{
  onOpenChange: (open: boolean) => void
} | null>(null)

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
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

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

  if (!open || !mounted) return null

  return createPortal(
    <SheetContext.Provider value={{ onOpenChange }}>
      <div className="fixed inset-0 z-[200]">
        <div
          className="fixed inset-0 bg-black/60"
          onClick={() => onOpenChange(false)}
        />
        {children}
      </div>
    </SheetContext.Provider>,
    document.body
  )
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, children, side = "right", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "fixed z-[210] bg-card text-card-foreground shadow-lg transition-transform duration-300 ease-in-out",
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
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
)
SheetDescription.displayName = "SheetDescription"

const SheetClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
  const context = React.useContext(SheetContext)

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(e)
    }
    context?.onOpenChange(false)
  }

  return (
    <button
      ref={ref}
      className={cn(
        "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none",
        className
      )}
      onClick={handleClick}
      {...props}
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </button>
  )
})
SheetClose.displayName = "SheetClose"

export {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
}

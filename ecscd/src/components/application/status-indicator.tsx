"use client";

import { Badge } from "@/components/ui/badge";
import {
    formatApplicationStatus,
    getApplicationStatusBadgeClass,
    getApplicationStatusDotClass,
    getApplicationStatusTextClass,
} from "@/lib/application-status-ui";
import {
    ApplicationDomain,
    ApplicationStatus,
    getApplicationStatus,
} from "@/lib/domain/application";
import { cn } from "@/lib/utils";
import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function StatusReasonPopover({
  label,
  reason,
  status,
  children,
}: {
  label: string;
  reason?: string;
  status: ApplicationStatus;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isPositionReady, setIsPositionReady] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const isVisible = isOpen || isHovered;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isVisible || !triggerRef.current) {
      setIsPositionReady(false);
      return;
    }

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const width = 256;
      const margin = 12;
      const centeredLeft = rect.left + rect.width / 2 - width / 2;
      const clampedLeft = Math.min(
        Math.max(centeredLeft, margin),
        window.innerWidth - width - margin
      );

      setPosition({
        top: rect.bottom + 8,
        left: clampedLeft,
      });
      setIsPositionReady(true);
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isVisible]);

  if (!reason) {
    return <>{children}</>;
  }

  return (
    <div
      ref={rootRef}
      className="inline-flex"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((value) => !value);
        }}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        className="inline-flex"
        aria-label={`${label}: ${reason}`}
        aria-expanded={isOpen}
      >
        {children}
      </button>
      {isMounted
        ? createPortal(
            <div
              className={cn(
                "pointer-events-none fixed z-220 w-64 rounded-md border border-border bg-popover px-3 py-2 text-left text-xs leading-5 text-popover-foreground transition-opacity duration-150 status-popover-shadow",
                isVisible && isPositionReady
                  ? "opacity-100"
                  : "opacity-0"
              )}
              style={{
                top: position.top,
                left: position.left,
              }}
            >
              <div
                className={cn(
                  "font-medium",
                  getApplicationStatusTextClass(status)
                )}
              >
                {label}
              </div>
              <div className="mt-1">{reason}</div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export function ApplicationStatusBadge({
  application,
}: {
  application: ApplicationDomain;
}) {
  const applicationStatus = getApplicationStatus(application);
  const { status } = applicationStatus;
  const reason =
    "reason" in applicationStatus ? applicationStatus.reason : undefined;
  const label = formatApplicationStatus(status);

  return (
    <StatusReasonPopover
      label={label}
      reason={reason}
      status={status}
    >
      <Badge
        variant="secondary"
        className={cn("cursor-help", getApplicationStatusBadgeClass(status))}
      >
        {label}
      </Badge>
    </StatusReasonPopover>
  );
}

export function ApplicationStatusDot({
  application,
}: {
  application: ApplicationDomain;
}) {
  const applicationStatus = getApplicationStatus(application);
  const { status } = applicationStatus;
  const reason =
    "reason" in applicationStatus ? applicationStatus.reason : undefined;
  const label = formatApplicationStatus(status);

  return (
    <StatusReasonPopover
      label={label}
      reason={reason}
      status={status}
    >
      <span
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full",
          getApplicationStatusDotClass(status),
          reason ? "cursor-help" : ""
        )}
        aria-label={`application-status-${status}`}
      />
    </StatusReasonPopover>
  );
}

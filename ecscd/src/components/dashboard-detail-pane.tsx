"use client";

import {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";

export function DashboardDetailPane({
  isDetailRoute,
  mobileHeader,
  stickyHeader,
  headerActions,
  body,
  syncActions,
}: {
  isDetailRoute: boolean;
  mobileHeader?: ReactNode;
  stickyHeader: ReactNode;
  headerActions?: ReactNode;
  body: ReactNode;
  syncActions?: ReactNode;
}) {
  const [isDetailsScrolled, setIsDetailsScrolled] = useState(false);
  const [isSyncActionsVisible, setIsSyncActionsVisible] = useState(true);
  const detailsScrollRef = useRef<HTMLElement | null>(null);
  const syncActionsRef = useRef<HTMLDivElement | null>(null);

  const updateSyncActionsVisibility = useCallback(() => {
    if (!syncActions) {
      setIsSyncActionsVisible(true);
      return;
    }

    const container = detailsScrollRef.current;
    const actions = syncActionsRef.current;
    if (!container || !actions) {
      setIsSyncActionsVisible(true);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const actionsRect = actions.getBoundingClientRect();
    const visible =
      actionsRect.bottom > containerRect.top &&
      actionsRect.top < containerRect.bottom;

    setIsSyncActionsVisible(visible);
  }, [syncActions]);

  useEffect(() => {
    const id = window.requestAnimationFrame(updateSyncActionsVisibility);
    return () => window.cancelAnimationFrame(id);
  }, [updateSyncActionsVisibility]);

  useEffect(() => {
    if (!syncActions) {
      return;
    }

    const handleResize = () => updateSyncActionsVisibility();
    window.addEventListener("resize", handleResize);

    const resizeObserver = new ResizeObserver(() => {
      updateSyncActionsVisibility();
    });

    if (detailsScrollRef.current) {
      resizeObserver.observe(detailsScrollRef.current);
    }
    if (syncActionsRef.current) {
      resizeObserver.observe(syncActionsRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
    };
  }, [syncActions, updateSyncActionsVisibility]);

  return (
    <main
      ref={detailsScrollRef}
      onScroll={(event) => {
        setIsDetailsScrolled(event.currentTarget.scrollTop > 0);
        updateSyncActionsVisibility();
      }}
      className={`subtle-scrollbar min-h-0 overflow-y-auto relative shadow-[-4px_0_14px_rgba(15,23,42,0.12)] ${
        isDetailRoute ? "block" : "hidden lg:block"
      }`}
    >
      {mobileHeader}
      <section
        className={`sticky top-16 z-10 h-[76px] bg-gray-50 px-4 sm:px-6 lg:top-0 lg:px-8 transition-shadow ${
          isDetailsScrolled
            ? "shadow-[0_6px_12px_-10px_rgba(15,23,42,0.35)]"
            : "shadow-none"
        }`}
      >
        <div className="flex h-full items-center justify-between gap-4">
          <div>{stickyHeader}</div>
          <div className="flex items-center">
            {headerActions}
            {syncActions ? (
              <div
                className={`overflow-hidden transition-all duration-300 ease-out ${
                  isSyncActionsVisible
                    ? "ml-0 max-w-0 opacity-0"
                    : "ml-3 max-w-[140px] opacity-100"
                }`}
              >
                <Button
                  onClick={() =>
                    syncActionsRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    })
                  }
                  aria-hidden={isSyncActionsVisible}
                  tabIndex={isSyncActionsVisible ? -1 : 0}
                  className={isSyncActionsVisible ? "pointer-events-none" : ""}
                >
                  <ArrowDown className="h-4 w-4 mr-2" />
                  Sync...
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {body}

      {syncActions ? <div ref={syncActionsRef}>{syncActions}</div> : null}
    </main>
  );
}

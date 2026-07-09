"use client";

import { ReactNode, useLayoutEffect, useRef, useState } from "react";

let sidebarScrollTop = 0;

export function DashboardSidebarPane({
  filter,
  list,
}: {
  filter: ReactNode;
  list: ReactNode;
}) {
  const [isListScrolled, setIsListScrolled] = useState(sidebarScrollTop > 0);
  const listRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const listElement = listRef.current;
    if (!listElement) {
      return;
    }

    listElement.scrollTop = sidebarScrollTop;
    // Re-syncs isListScrolled with the cached sidebarScrollTop (module-level, survives remounts)
    // in case it changed after the initial useState call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsListScrolled(sidebarScrollTop > 0);
  }, []);

  return (
    <>
      <div
        className={`p-4 relative transition-shadow ${
          isListScrolled
            ? "header-scroll-shadow"
            : "shadow-none"
        }`}
      >
        {filter}
      </div>
      <div
        ref={listRef}
        onScroll={(event) => {
          const nextScrollTop = event.currentTarget.scrollTop;
          sidebarScrollTop = nextScrollTop;
          setIsListScrolled(nextScrollTop > 0);
        }}
        className="subtle-scrollbar flex-1 overflow-y-auto relative"
      >
        {list}
      </div>
    </>
  );
}

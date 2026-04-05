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
    setIsListScrolled(sidebarScrollTop > 0);
  }, []);

  return (
    <>
      <div
        className={`p-4 relative transition-shadow ${
          isListScrolled
            ? "shadow-[0_6px_12px_-10px_rgba(15,23,42,0.35)]"
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

"use client";

import { ReactNode, useState } from "react";

export function DashboardSidebarPane({
  filter,
  list,
}: {
  filter: ReactNode;
  list: ReactNode;
}) {
  const [isListScrolled, setIsListScrolled] = useState(false);

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
        onScroll={(event) =>
          setIsListScrolled(event.currentTarget.scrollTop > 0)
        }
        className="subtle-scrollbar flex-1 overflow-y-auto relative"
      >
        {list}
      </div>
    </>
  );
}

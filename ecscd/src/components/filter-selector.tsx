"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { FilterDomain } from "@/lib/domain/filter";
import { ApplicationStatus } from "@/lib/domain/application";
import {
  formatApplicationStatus,
  getApplicationStatusDotClass,
} from "@/lib/application-status-ui";
import { Search, Save, X, ChevronDown, Trash2 } from "lucide-react";
import { SaveFilterDialog } from "./save-filter-dialog";

interface FilterSelectorProps {
  initialFilter: string;
  initialFilters: FilterDomain[];
  initialSelectedStatuses: ApplicationStatus[];
  statusOptions: {
    status: ApplicationStatus;
    count: number;
    total: number;
  }[];
}

const STATUS_ORDER: ApplicationStatus[] = [
  "Loading",
  "Error",
  "OutOfSync",
  "Deploying",
  "Failed",
  "InSync",
];

let lastStatusButtonWidth = 104;

export function FilterSelector({
  initialFilter,
  initialFilters,
  initialSelectedStatuses,
  statusOptions,
}: FilterSelectorProps) {
  const nameFilterMinWidth = 180;
  const statusButtonMaxWidth = 168;
  const filterGapWidth = 8;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [filters, setFilters] = useState<FilterDomain[]>(initialFilters);
  const [currentFilter, setCurrentFilter] = useState(initialFilter);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<ApplicationStatus[]>(
    initialSelectedStatuses
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const statusButtonRef = useRef<HTMLButtonElement | null>(null);
  const statusDropdownRef = useRef<HTMLDivElement | null>(null);
  const [statusButtonWidth, setStatusButtonWidth] = useState(
    lastStatusButtonWidth
  );

  useEffect(() => {
    setCurrentFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  useEffect(() => {
    setSelectedStatuses(initialSelectedStatuses);
  }, [initialSelectedStatuses]);

  useLayoutEffect(() => {
    const updateStatusButtonWidth = () => {
      if (selectedStatuses.length === 0) {
        lastStatusButtonWidth = 104;
        setStatusButtonWidth(104);
        return;
      }

      const label = selectedStatuses
        .map((status) => formatApplicationStatus(status))
        .join(", ");
      const dotsWidth = selectedStatuses.length * 10 + (selectedStatuses.length - 1) * 4;
      const buttonStyle = statusButtonRef.current
        ? window.getComputedStyle(statusButtonRef.current)
        : null;
      const font = buttonStyle
        ? [
            buttonStyle.fontStyle,
            buttonStyle.fontVariant,
            buttonStyle.fontWeight,
            buttonStyle.fontSize,
            buttonStyle.lineHeight === "normal" ? "" : `/${buttonStyle.lineHeight}`,
            buttonStyle.fontFamily,
          ]
            .filter(Boolean)
            .join(" ")
        : "14px sans-serif";
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      const textWidth = (() => {
        if (!context) return 0;
        context.font = font;
        return context.measureText(label).width;
      })();
      const horizontalPadding = 24;
      const chevronWidth = 16;
      const contentGap = 8;
      const textGap = 8;
      const rootWidth = rootRef.current?.clientWidth ?? 0;
      const availableMaxWidth =
        rootWidth > 0
          ? Math.max(
              104,
              rootWidth - nameFilterMinWidth - filterGapWidth
            )
          : statusButtonMaxWidth;
      const nextWidth = Math.min(
          statusButtonMaxWidth,
          availableMaxWidth,
          Math.ceil(
            horizontalPadding +
              chevronWidth +
              contentGap +
              dotsWidth +
              textGap +
              textWidth
          )
        );

      lastStatusButtonWidth = nextWidth;
      setStatusButtonWidth(nextWidth);
    };

    updateStatusButtonWidth();
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateStatusButtonWidth)
        : null;

    if (rootRef.current && resizeObserver) {
      resizeObserver.observe(rootRef.current);
    }

    return () => {
      resizeObserver?.disconnect();
    };
  }, [
    selectedStatuses,
    statusButtonMaxWidth,
    nameFilterMinWidth,
    filterGapWidth,
  ]);

  useEffect(() => {
    if (!showStatusDropdown) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        statusButtonRef.current?.contains(target) ||
        statusDropdownRef.current?.contains(target)
      ) {
        return;
      }

      setShowStatusDropdown(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [showStatusDropdown]);

  const navigateWithFilters = (
    nameFilter: string,
    nextStatuses: ApplicationStatus[]
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nameFilter) {
      params.set("filter", nameFilter);
    } else {
      params.delete("filter");
    }
    if (nextStatuses.length > 0) {
      params.set("status", nextStatuses.join(","));
    } else {
      params.delete("status");
    }

    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  };

  const handleFilterChange = (value: string) => {
    setCurrentFilter(value);
    navigateWithFilters(value, selectedStatuses);
  };

  const handleSelectFilter = (filter: FilterDomain) => {
    setCurrentFilter(filter.pattern);
    setShowDropdown(false);
    navigateWithFilters(filter.pattern, selectedStatuses);
  };

  const handleToggleStatus = (status: ApplicationStatus) => {
    const nextStatuses = selectedStatuses.includes(status)
      ? selectedStatuses.filter((value) => value !== status)
      : [...selectedStatuses, status].sort(
          (left, right) =>
            STATUS_ORDER.indexOf(left) - STATUS_ORDER.indexOf(right)
        );
    setSelectedStatuses(nextStatuses);
    navigateWithFilters(currentFilter, nextStatuses);
  };

  const handleDeleteFilter = async (
    e: React.MouseEvent,
    filterId: string
  ) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/filters/${filterId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete filter");
      }

      setFilters((previousFilters) =>
        previousFilters.filter((filter) => filter.id !== filterId)
      );
    } catch (error) {
      console.error("Failed to delete filter:", error);
    }
  };

  const normalizedFilter = currentFilter.trim().toLowerCase();
  const normalizedStatusOptions = useMemo(
    () =>
      [...statusOptions].sort(
        (left, right) =>
          STATUS_ORDER.indexOf(left.status) - STATUS_ORDER.indexOf(right.status)
      ),
    [statusOptions]
  );
  const visibleFilters = useMemo(
    () =>
      filters.filter((filter) => {
        if (!normalizedFilter) return true;
        return (
          filter.name.toLowerCase().includes(normalizedFilter) ||
          filter.pattern.toLowerCase().includes(normalizedFilter)
        );
      }),
    [filters, normalizedFilter]
  );

  return (
    <div ref={rootRef} className="flex items-center gap-2 min-w-0">
      <div
        className="relative w-full flex-1"
        style={{ minWidth: `${nameFilterMinWidth}px` }}
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={currentFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
          placeholder="Filter by name..."
          className="border-zinc-200 pl-10 pr-20"
          aria-busy={isPending}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          <button
            type="button"
            onClick={() => handleFilterChange("")}
            aria-hidden={!currentFilter}
            tabIndex={currentFilter ? 0 : -1}
            className={`rounded p-1 transition-opacity duration-150 hover:bg-gray-100 ${
              currentFilter ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
          <button
            type="button"
            onClick={() => setShowDropdown((currentValue) => !currentValue)}
            className="rounded p-1 hover:bg-gray-100"
          >
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {showDropdown ? (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border border-zinc-100 bg-white shadow-[0_8px_20px_-14px_rgba(15,23,42,0.25)] ui-dropdown-in">
            {currentFilter.trim() ? (
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 border-b border-zinc-100"
                onClick={() => {
                  setShowDropdown(false);
                  setShowSaveDialog(true);
                }}
              >
                <Save className="h-3.5 w-3.5 text-gray-500" />
                <span>
                  Save{" "}
                  <span className="font-medium">
                    &quot;{currentFilter.trim()}&quot;
                  </span>
                </span>
              </button>
            ) : null}

            {visibleFilters.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                {filters.length === 0
                  ? "No saved filters"
                  : "No matching saved filters"}
              </div>
            ) : (
              visibleFilters.map((filter) => (
                <div
                  key={filter.id}
                  className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-gray-50"
                  onClick={() => handleSelectFilter(filter)}
                >
                  <div>
                    <div className="font-medium text-sm">{filter.name}</div>
                    <div className="text-xs text-gray-500">{filter.pattern}</div>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => handleDeleteFilter(event, filter.id)}
                    className="group rounded p-1 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3 text-gray-400 transition-colors group-hover:text-red-500" />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>

      <div ref={statusDropdownRef} className="relative shrink-0">
        <button
          ref={statusButtonRef}
          type="button"
          onClick={() => setShowStatusDropdown((currentValue) => !currentValue)}
          className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm transition-[width,background-color,border-color,color] duration-200 ${
            selectedStatuses.length > 0
              ? "border-zinc-200 bg-zinc-100 text-zinc-900"
              : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
          }`}
          style={{ width: `${statusButtonWidth}px` }}
        >
          <span className="min-w-0 overflow-hidden">
            {selectedStatuses.length === 0 ? (
              <span className="min-w-0 truncate">Status...</span>
            ) : (
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex shrink-0 items-center gap-1">
                  {selectedStatuses.map((status) => (
                    <span
                      key={status}
                      className={`h-2.5 w-2.5 rounded-full ${getApplicationStatusDotClass(
                        status
                      )}`}
                    />
                  ))}
                </span>
                <span className="truncate">
                  {selectedStatuses
                    .map((status) => formatApplicationStatus(status))
                    .join(", ")}
                </span>
              </span>
            )}
          </span>
          <ChevronDown className="ml-auto h-4 w-4 shrink-0" />
        </button>

        {showStatusDropdown ? (
          <div className="absolute right-0 top-full z-50 mt-1 min-w-[240px] rounded-md border border-zinc-100 bg-white py-1 shadow-[0_8px_20px_-14px_rgba(15,23,42,0.25)] ui-dropdown-in">
            {normalizedStatusOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                No statuses available
              </div>
            ) : (
              normalizedStatusOptions.map((option) => {
                const percent =
                  option.total === 0
                    ? 0
                    : Math.round((option.count / option.total) * 100);
                const isSelected = selectedStatuses.includes(option.status);

                return (
                  <button
                    key={option.status}
                    type="button"
                    onClick={() => handleToggleStatus(option.status)}
                    className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm text-zinc-900">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${getApplicationStatusDotClass(
                            option.status
                          )}`}
                        />
                        <span>{formatApplicationStatus(option.status)}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {option.count}/{option.total} ({percent}%)
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      <SaveFilterDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        pattern={currentFilter}
        onSuccess={(filter) => {
          setFilters((previousFilters) => [...previousFilters, filter]);
        }}
      />
    </div>
  );
}

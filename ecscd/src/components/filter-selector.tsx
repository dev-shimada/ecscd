"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { FilterDomain } from "@/lib/domain/filter";
import { Search, Save, X, ChevronDown, Trash2 } from "lucide-react";
import { SaveFilterDialog } from "./save-filter-dialog";

interface FilterSelectorProps {
  initialFilter: string;
  initialFilters: FilterDomain[];
}

export function FilterSelector({
  initialFilter,
  initialFilters,
}: FilterSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [filters, setFilters] = useState<FilterDomain[]>(initialFilters);
  const [currentFilter, setCurrentFilter] = useState(initialFilter);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  useEffect(() => {
    setCurrentFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const navigateWithFilter = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("filter", value);
    } else {
      params.delete("filter");
    }

    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  };

  const handleFilterChange = (value: string) => {
    setCurrentFilter(value);
    navigateWithFilter(value);
  };

  const handleSelectFilter = (filter: FilterDomain) => {
    setCurrentFilter(filter.pattern);
    setShowDropdown(false);
    navigateWithFilter(filter.pattern);
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
    <div className="flex items-center">
      <div className="relative w-full flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={currentFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
          placeholder="Filter by name..."
          className="pl-10 pr-20"
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

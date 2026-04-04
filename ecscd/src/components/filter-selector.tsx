"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { FilterDomain } from "@/lib/domain/filter";
import { Search, Save, X, ChevronDown, Trash2 } from "lucide-react";
import { SaveFilterDialog } from "./save-filter-dialog";

interface FilterSelectorProps {
  onFilterChange: (pattern: string, isInitializing?: boolean) => void;
}

export function FilterSelector({ onFilterChange }: FilterSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<FilterDomain[]>([]);
  const [currentFilter, setCurrentFilter] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const loadFilters = useCallback(async () => {
    try {
      const response = await fetch("/api/filters");
      const data = await response.json();
      setFilters(data.filters || []);
    } catch (error) {
      console.error("Failed to load filters:", error);
    }
  }, []);

  // Initialize filter from URL on mount
  useEffect(() => {
    const filterParam = searchParams.get("filter") || "";
    setCurrentFilter(filterParam);
    onFilterChange(filterParam, true); // Mark as initializing
  }, [searchParams, onFilterChange]);

  // Load saved filters on mount
  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  // Update URL when filter changes
  const handleFilterChange = useCallback(
    (value: string) => {
      setCurrentFilter(value);

      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("filter", value);
      } else {
        params.delete("filter");
      }
      router.push(`?${params.toString()}`, { scroll: false });

      onFilterChange(value);
    },
    [searchParams, router, onFilterChange]
  );

  const handleSelectFilter = (filter: FilterDomain) => {
    handleFilterChange(filter.pattern);
    setShowDropdown(false);
  };

  const handleClearFilter = () => {
    handleFilterChange("");
  };

  const handleDeleteFilter = async (
    e: React.MouseEvent,
    filterId: string
  ) => {
    e.stopPropagation();
    try {
      await fetch(`/api/filters/${filterId}`, { method: "DELETE" });
      loadFilters();
    } catch (error) {
      console.error("Failed to delete filter:", error);
    }
  };

  const normalizedFilter = currentFilter.trim().toLowerCase();
  const visibleFilters = filters.filter((filter) => {
    if (!normalizedFilter) return true;
    return (
      filter.name.toLowerCase().includes(normalizedFilter) ||
      filter.pattern.toLowerCase().includes(normalizedFilter)
    );
  });

  return (
    <div className="flex items-center">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={currentFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
          placeholder="Filter by name..."
          className="pl-10 pr-20"
        />
        {currentFilter && (
          <button
            onClick={handleClearFilter}
            className="absolute right-12 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
        >
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>

        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-100 rounded-md shadow-[0_8px_20px_-14px_rgba(15,23,42,0.25)] z-50 max-h-60 overflow-auto ui-dropdown-in">
            {currentFilter.trim() && (
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
                  Save <span className="font-medium">&quot;{currentFilter.trim()}&quot;</span>
                </span>
              </button>
            )}

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
                  className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleSelectFilter(filter)}
                >
                  <div>
                    <div className="font-medium text-sm">{filter.name}</div>
                    <div className="text-xs text-gray-500">{filter.pattern}</div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteFilter(e, filter.id)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <Trash2 className="h-3 w-3 text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <SaveFilterDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        pattern={currentFilter}
        onSuccess={loadFilters}
      />
    </div>
  );
}

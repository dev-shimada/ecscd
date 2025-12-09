"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export interface Tab {
  id: string;
  name: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onTabCreate: (name: string) => void;
  onTabDelete: (tabId: string) => void;
}

export function TabBar({
  tabs,
  activeTabId,
  onTabChange,
  onTabCreate,
  onTabDelete,
}: TabBarProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingTabId, setDeletingTabId] = useState<string | null>(null);
  const [newTabName, setNewTabName] = useState("");

  const handleCreate = () => {
    if (newTabName.trim()) {
      onTabCreate(newTabName.trim());
      setNewTabName("");
      setShowCreateDialog(false);
    }
  };

  const handleDeleteClick = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) {
      return;
    }
    setDeletingTabId(tabId);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (deletingTabId) {
      onTabDelete(deletingTabId);
      setDeletingTabId(null);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <div className="w-48 bg-white border-r border-gray-200 flex flex-col h-screen">
        <div className="p-4 border-b border-gray-200">
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="w-full"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            新規タブ
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                group relative px-4 py-3 cursor-pointer border-b border-gray-100
                ${
                  activeTabId === tab.id
                    ? "bg-blue-50 border-l-4 border-l-blue-500"
                    : "hover:bg-gray-50"
                }
              `}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm font-medium truncate flex-1 ${
                    activeTabId === tab.id ? "text-blue-700" : "text-gray-700"
                  }`}
                >
                  {tab.name}
                </span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => handleDeleteClick(tab.id, e)}
                    className="ml-2 p-1 rounded hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3 text-red-600" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Tab Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新しいタブを作成</DialogTitle>
            <DialogDescription>
              タブの名前を入力してください(例: 開発環境, 本番環境)
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="tab-name">タブ名</Label>
              <Input
                id="tab-name"
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreate();
                  }
                }}
                placeholder="例: 開発環境"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setNewTabName("");
              }}
            >
              キャンセル
            </Button>
            <Button onClick={handleCreate} disabled={!newTabName.trim()}>
              作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>タブを削除</DialogTitle>
            <DialogDescription>
              このタブを削除してもよろしいですか?
              タブ内のアプリケーション設定も削除されます。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeletingTabId(null);
              }}
            >
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import { ApplicationDomain } from "@/lib/domain/application";

interface UseApplicationOptions {
  appName: string;
  isDeploymentActive?: boolean;
  onDataLoaded?: (application: ApplicationDomain) => void;
}

export function useApplication({
  appName,
  isDeploymentActive = false,
  onDataLoaded,
}: UseApplicationOptions) {
  const [application, setApplication] = useState<ApplicationDomain | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const previousApplicationRef = useRef<ApplicationDomain | null>(null);

  const loadApplication = useCallback(async () => {
    try {
      const response = await fetch(`/api/apps/${encodeURIComponent(appName)}`);
      if (!response.ok) {
        throw new Error("Failed to fetch application");
      }
      const data = await response.json();
      const newApplication = data.application as ApplicationDomain;

      // 実際に変更があった場合のみ更新
      const hasChanges =
        JSON.stringify(newApplication) !==
        JSON.stringify(previousApplicationRef.current);

      if (hasChanges) {
        previousApplicationRef.current = newApplication;
        setApplication(newApplication);
        onDataLoaded?.(newApplication);
      }
    } catch (error) {
      console.error(`Failed to load application ${appName}:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [appName, onDataLoaded]);

  // 初回ロード
  useEffect(() => {
    loadApplication();
  }, [loadApplication]);

  // デプロイメント進行中の場合、5秒ごとにポーリング
  useEffect(() => {
    const hasInProgressDeployment =
      isDeploymentActive ||
      application?.service?.deployments.some(
        (d) => d.rolloutState === "IN_PROGRESS"
      );

    if (!hasInProgressDeployment) {
      return;
    }

    const interval = setInterval(() => {
      loadApplication();
    }, 5000);

    return () => clearInterval(interval);
  }, [application, isDeploymentActive, loadApplication]);

  // アクティブなデプロイメントがあるかチェック
  const hasActiveDeployment =
    isDeploymentActive ||
    application?.service?.deployments.some(
      (d) => d.rolloutState === "IN_PROGRESS"
    ) ||
    false;

  // ロールバック中のデプロイメントがあるかチェック
  const hasRollbackDeployment =
    application?.service?.deployments.some((d) =>
      d.rolloutStateReason.includes("rolling back to")
    ) || false;

  return {
    application,
    isLoading,
    hasActiveDeployment,
    hasRollbackDeployment,
    loadApplication,
  };
}

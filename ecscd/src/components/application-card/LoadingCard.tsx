import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";

interface LoadingCardProps {
  appName: string;
}

export function LoadingCard({ appName }: LoadingCardProps) {
  return (
    <Card className="w-full">
      <CardContent className="py-8">
        <div className="flex items-center justify-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin text-gray-600" />
          <span className="text-gray-600">Loading {appName}...</span>
        </div>
      </CardContent>
    </Card>
  );
}

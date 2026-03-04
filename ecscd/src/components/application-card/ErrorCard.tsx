import { Card, CardContent } from "@/components/ui/card";

interface ErrorCardProps {
  appName: string;
}

export function ErrorCard({ appName }: ErrorCardProps) {
  return (
    <Card className="w-full">
      <CardContent className="py-8">
        <div className="text-center text-gray-600">
          Failed to load application: {appName}
        </div>
      </CardContent>
    </Card>
  );
}

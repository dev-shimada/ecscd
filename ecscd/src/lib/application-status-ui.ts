import { ApplicationStatus } from "@/lib/domain/application";

export function formatApplicationStatus(status: ApplicationStatus) {
  switch (status) {
    case "Loading":
      return "Loading";
    case "InSync":
      return "In Sync";
    case "OutOfSync":
      return "Out of Sync";
    case "Deploying":
      return "Deploying";
    case "Failed":
      return "Deploy Failed";
    case "Error":
      return "Error";
    default:
      return status;
  }
}

export function getApplicationStatusDotClass(status: ApplicationStatus) {
  switch (status) {
    case "Loading":
      return "bg-zinc-400";
    case "InSync":
      return "bg-emerald-500";
    case "OutOfSync":
      return "bg-yellow-500";
    case "Deploying":
      return "bg-yellow-500";
    case "Failed":
      return "bg-rose-500";
    case "Error":
      return "bg-rose-500";
    default:
      return "bg-zinc-400";
  }
}

export function getApplicationStatusTextClass(status: ApplicationStatus) {
  switch (status) {
    case "Loading":
      return "text-muted-foreground";
    case "InSync":
      return "text-emerald-600";
    case "OutOfSync":
      return "text-amber-600";
    case "Deploying":
      return "text-amber-600";
    case "Failed":
      return "text-rose-600";
    case "Error":
      return "text-rose-600";
    default:
      return "text-muted-foreground";
  }
}

export function getApplicationStatusBadgeClass(status: ApplicationStatus) {
  switch (status) {
    case "Loading":
      return "border-transparent bg-secondary text-secondary-foreground";
    case "InSync":
      return "border-transparent bg-emerald-500 text-white";
    case "OutOfSync":
      return "border-transparent bg-yellow-500 text-white";
    case "Deploying":
      return "border-transparent bg-yellow-500 text-white";
    case "Failed":
      return "border-transparent bg-rose-500 text-white";
    case "Error":
      return "border-transparent bg-rose-500 text-white";
    default:
      return "border-transparent bg-secondary text-secondary-foreground";
  }
}

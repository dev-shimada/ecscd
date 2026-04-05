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
      return "bg-sky-500";
    case "Failed":
      return "bg-orange-500";
    case "Error":
      return "bg-rose-500";
    default:
      return "bg-zinc-400";
  }
}

export function getApplicationStatusTextClass(status: ApplicationStatus) {
  switch (status) {
    case "Loading":
      return "text-zinc-700";
    case "InSync":
      return "text-emerald-700";
    case "OutOfSync":
      return "text-yellow-700";
    case "Deploying":
      return "text-sky-700";
    case "Failed":
      return "text-orange-700";
    case "Error":
      return "text-rose-700";
    default:
      return "text-zinc-700";
  }
}

export function getApplicationStatusBadgeClass(status: ApplicationStatus) {
  switch (status) {
    case "Loading":
      return "border-transparent bg-zinc-100 text-zinc-700";
    case "InSync":
      return "border-transparent bg-emerald-500 text-white";
    case "OutOfSync":
      return "border-transparent bg-yellow-500 text-white";
    case "Deploying":
      return "border-transparent bg-sky-500 text-white";
    case "Failed":
      return "border-transparent bg-orange-500 text-white";
    case "Error":
      return "border-transparent bg-rose-500 text-white";
    default:
      return "border-transparent bg-zinc-100 text-zinc-700";
  }
}

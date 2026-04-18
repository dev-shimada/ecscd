import {
  ApplicationDomain,
  ObservedApplicationDomain,
} from "../domain/application";

export interface ApplicationObserver {
  observe(application: ApplicationDomain): Promise<ObservedApplicationDomain>;
}

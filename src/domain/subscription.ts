import { lastDayOfPeriod } from "@/domain/dates";

export function accessEndsOn(lastBilledOn: string): string {
    return lastDayOfPeriod(lastBilledOn)
}

export function canBookAfterTermination(lastBilledOn: string, classDate: string): boolean {
    return classDate <= accessEndsOn(lastBilledOn)
}

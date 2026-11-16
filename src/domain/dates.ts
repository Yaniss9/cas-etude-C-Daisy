const MILLISECONDS_PER_HOUR = 60 * 60 * 1000

export function subtractDays(isoDate: string, days: number): string {
    const date = new Date(`${isoDate}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() - days)
    return date.toISOString().slice(0, 10)
}

export function lastDayOfPeriod(periodStartsOn: string): string {
    const date = new Date(`${periodStartsOn}T00:00:00Z`)
    date.setUTCMonth(date.getUTCMonth() + 1)
    date.setUTCDate(date.getUTCDate() - 1)
    return date.toISOString().slice(0, 10)
}

export function hoursBetween(from: string, to: string): number {
    return (Date.parse(to) - Date.parse(from)) / MILLISECONDS_PER_HOUR
}

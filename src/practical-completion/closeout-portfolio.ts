export const closeoutPortfolioPolicy={approachingDays:7,breachedDays:1} as const;
export interface ProjectCloseoutRecord{projectId:string;commercialManager:string;contractor:string;dueOn:string;openDocuments:number;totalDocuments:number;commercialExposureCents:number;sourceReference:string}
export const seededCloseoutPortfolio:ProjectCloseoutRecord[]=[{projectId:'PROJECT-NORTH',commercialManager:'commercial',contractor:'Fit-out contractor',dueOn:'2026-10-19',openDocuments:2,totalDocuments:2,commercialExposureCents:120000,sourceReference:'FA-2026-017'},{projectId:'PROJECT-EAST',commercialManager:'commercial-east',contractor:'Envelope contractor',dueOn:'2026-10-26',openDocuments:1,totalDocuments:4,commercialExposureCents:45000,sourceReference:'FA-2026-021'},{projectId:'PROJECT-SOUTH',commercialManager:'commercial-south',contractor:'MEP contractor',dueOn:'2026-10-10',openDocuments:3,totalDocuments:5,commercialExposureCents:280000,sourceReference:'FA-2026-009'}];
export function assessCloseoutPortfolio(records: ProjectCloseoutRecord[], asOf: string) {
  const urgencyRank = { breached: 0, approaching: 1, 'on-track': 2 } as const
  return records.map((record) => {
    const daysToDue = Math.floor((Date.parse(record.dueOn) - Date.parse(asOf)) / 86_400_000)
    const coveragePercent = Math.round(((record.totalDocuments - record.openDocuments) / record.totalDocuments) * 100)
    const urgency: keyof typeof urgencyRank = daysToDue < 0 ? 'breached' : daysToDue <= closeoutPortfolioPolicy.approachingDays ? 'approaching' : 'on-track'
    return { ...record, daysToDue, coveragePercent, urgency }
  }).sort((a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency] || b.commercialExposureCents - a.commercialExposureCents)
}

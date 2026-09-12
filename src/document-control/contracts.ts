export interface Contract {
    id: string;
    originalValue: number;
    executedChanges: number;
    contingency: number;
}
export interface ChangeImpact {
    id: string;
    directCost: number;
    contingencyUse: number;
    scheduleDays: number;
}
export function forecastContract(contract: Contract, changes: ChangeImpact[]) {
    const pendingChanges = changes.reduce((sum, change) => sum + change.directCost, 0);
    const contingencyUse = changes.reduce((sum, change) => sum + change.contingencyUse, 0);
    return { committed: contract.originalValue + contract.executedChanges, pendingChanges, forecast: contract.originalValue + contract.executedChanges + pendingChanges, contingencyRemaining: contract.contingency - contingencyUse };
}
export function validateChangeImpact(contract: Contract, change: ChangeImpact): string[] {
    const issues: string[] = [];
    if (change.directCost < 0 || change.contingencyUse < 0)
        issues.push('Cost impacts cannot be negative.');
    if (change.contingencyUse > contract.contingency)
        issues.push('Requested contingency exceeds the contract reserve.');
    if (change.scheduleDays < -30 || change.scheduleDays > 365)
        issues.push('Schedule impact is outside the reviewable range.');
    return issues;
}

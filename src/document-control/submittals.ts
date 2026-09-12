export interface ReviewStep {
    discipline: string;
    reviewer: string;
    state: 'waiting' | 'active' | 'approved' | 'rejected';
    respondedAt?: string;
}
export interface Submittal {
    id: string;
    specification: string;
    revision: number;
    steps: ReviewStep[];
}
export function activeReviewStep(submittal: Submittal): ReviewStep | undefined { return submittal.steps.find((step) => step.state === 'active'); }
export function recordReview(submittal: Submittal, reviewer: string, decision: 'approved' | 'rejected', at: string): Submittal {
    const index = submittal.steps.findIndex((step) => step.state === 'active');
    const active = submittal.steps[index];
    if (!active)
        throw new Error('This submittal has no active review step.');
    if (active.reviewer !== reviewer)
        throw new Error('The active discipline reviewer must record this decision.');
    const steps = submittal.steps.map((step, stepIndex) => stepIndex === index ? { ...step, state: decision, respondedAt: at } : stepIndex === index + 1 && decision === 'approved' ? { ...step, state: 'active' as const } : step);
    return { ...submittal, steps };
}

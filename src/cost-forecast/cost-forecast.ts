export type ForecastRole = 'Cost Engineer' | 'Package Manager' | 'Project Director' | 'Finance Controller';
export interface CostForecastState {
  revision: number;
  package: { id: string; originalBudget: number; approvedChanges: number; committed: number; actualCost: number; progressPercent: number; version: number };
  project: { id: string; approvedBudget: number; forecastAtCompletion: number; contingency: number; version: number };
  forecast: null | { id: string; status: 'draft' | 'validated' | 'approved' | 'published'; estimateToComplete: number; forecastAtCompletion: number; variance: number; packageVersion: number; projectVersion: number; owner: string; manager?: string; approver?: string };
  snapshots: { id: string; packageId: string; forecastAtCompletion: number; variance: number; immutable: true }[];
  events: { id: string; action: string; actor: string; detail: string }[];
}
export const initialCostForecastState: CostForecastState = { revision: 0, package: { id: 'PKG-STRUCT-08', originalBudget: 1200000, approvedChanges: 85000, committed: 1100000, actualCost: 620000, progressPercent: 55, version: 9 }, project: { id: 'PROJECT-NORTH', approvedBudget: 8000000, forecastAtCompletion: 7800000, contingency: 350000, version: 12 }, forecast: null, snapshots: [], events: [] };
interface Meta { id: string; expectedRevision: number; actor: { id: string; role: ForecastRole } }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function begin(state: CostForecastState, command: Meta) { assert(state.revision === command.expectedRevision, 'Cost forecast changed. Refresh before retrying.'); assert(!state.events.some((event) => event.id === command.id), 'Command already applied.'); return structuredClone(state); }
function finish(state: CostForecastState, command: Meta, action: string, detail: string) { state.revision += 1; state.events.push({ id: command.id, action, actor: command.actor.id, detail }); return state; }
function currentForecast(state: CostForecastState) { assert(state.forecast, 'No cost forecast exists.'); return state.forecast; }
function assertCurrent(state: CostForecastState) { const forecast = currentForecast(state); assert(forecast.packageVersion === state.package.version, 'Package commercial data changed after forecasting.'); assert(forecast.projectVersion === state.project.version, 'Project forecast changed after package forecasting.'); }

export function draftCostForecast(state: CostForecastState, command: Meta & { estimateToComplete: number }) {
  assert(command.actor.role === 'Cost Engineer', 'Only cost engineers can draft forecasts.');
  const next = begin(state, command);
  assert(!next.forecast, 'An active package forecast already exists.');
  assert(command.estimateToComplete >= 0, 'Estimate to complete cannot be negative.');
  assert(next.package.progressPercent > 0 && next.package.progressPercent < 100, 'Package progress must be active for forecasting.');
  const forecastAtCompletion = next.package.actualCost + command.estimateToComplete;
  const currentBudget = next.package.originalBudget + next.package.approvedChanges;
  next.forecast = { id: `${command.id}-forecast`, status: 'draft', estimateToComplete: command.estimateToComplete, forecastAtCompletion, variance: currentBudget - forecastAtCompletion, packageVersion: next.package.version, projectVersion: next.project.version, owner: command.actor.id };
  return finish(next, command, 'cost-forecast-drafted', String(forecastAtCompletion));
}

export function validateCommitments(state: CostForecastState, command: Meta) {
  assert(command.actor.role === 'Package Manager', 'Only package managers can validate forecasts.');
  const next = begin(state, command), forecast = currentForecast(next);
  assert(forecast.status === 'draft' && command.actor.id !== forecast.owner, 'Independent package validation is required.');
  assertCurrent(next);
  assert(forecast.forecastAtCompletion >= next.package.committed, 'Forecast cannot be below committed package value.');
  assert(forecast.estimateToComplete >= next.package.committed - next.package.actualCost, 'Estimate does not cover remaining commitments.');
  forecast.status = 'validated'; forecast.manager = command.actor.id;
  return finish(next, command, 'forecast-commitments-validated', String(next.package.committed));
}

export function approveCostForecast(state: CostForecastState, command: Meta) {
  assert(command.actor.role === 'Project Director', 'Only project directors can approve forecasts.');
  const next = begin(state, command), forecast = currentForecast(next);
  assert(forecast.status === 'validated', 'Validated cost forecast is required.');
  assert(command.actor.id !== forecast.owner && command.actor.id !== forecast.manager, 'Forecast approval must be independent.');
  assertCurrent(next);
  const overrun = Math.max(0, -forecast.variance);
  assert(overrun <= next.project.contingency, 'Forecast overrun exceeds available project contingency.');
  forecast.status = 'approved'; forecast.approver = command.actor.id;
  return finish(next, command, 'cost-forecast-approved', String(forecast.variance));
}

export function publishCostForecast(state: CostForecastState, command: Meta) {
  assert(command.actor.role === 'Finance Controller', 'Only finance controllers can publish forecasts.');
  const next = begin(state, command), forecast = currentForecast(next);
  assert(forecast.status === 'approved', 'Approved cost forecast is required.');
  assertCurrent(next);
  const priorPackageForecast = next.package.originalBudget + next.package.approvedChanges;
  const projectDelta = forecast.forecastAtCompletion - priorPackageForecast;
  if (projectDelta > 0) { assert(projectDelta <= next.project.contingency, 'Project contingency no longer covers the forecast.'); next.project.contingency -= projectDelta; }
  next.project.forecastAtCompletion += projectDelta; next.project.version += 1;
  forecast.projectVersion = next.project.version; forecast.status = 'published';
  next.snapshots.push({ id: `${command.id}-snapshot`, packageId: next.package.id, forecastAtCompletion: forecast.forecastAtCompletion, variance: forecast.variance, immutable: true });
  return finish(next, command, 'cost-forecast-published', String(next.project.forecastAtCompletion));
}

export class CostForecastRepository {
  static key = 'buildledger:cost-forecast:v1'; private storage: Pick<Storage, 'getItem' | 'setItem'>;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; }
  read() { const raw = this.storage.getItem(CostForecastRepository.key); return raw ? JSON.parse(raw) as CostForecastState : structuredClone(initialCostForecastState); }
  commit(expectedRevision: number, operation: (state: CostForecastState) => CostForecastState) { const current = this.read(); assert(current.revision === expectedRevision, 'Another session changed cost forecasting. Refresh before retrying.'); const next = operation(current); this.storage.setItem(CostForecastRepository.key, JSON.stringify(next)); return next; }
}

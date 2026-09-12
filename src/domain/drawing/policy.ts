import type { Product } from '../../workspace/types';
export function drawingStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'drawing')?.states ?? []; }
export function canEditDrawing(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'drawing')?.editors.includes(role) ?? false; }
export function drawingOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'drawing' && operation.roles.includes(role) && operation.from.includes(state)); }

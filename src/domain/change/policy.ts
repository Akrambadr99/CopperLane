import type { Product } from '../../workspace/types';
export function changeStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'change')?.states ?? []; }
export function canEditChange(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'change')?.editors.includes(role) ?? false; }
export function changeOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'change' && operation.roles.includes(role) && operation.from.includes(state)); }

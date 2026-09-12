import type { Product } from '../../workspace/types';
export function contractStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'contract')?.states ?? []; }
export function canEditContract(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'contract')?.editors.includes(role) ?? false; }
export function contractOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'contract' && operation.roles.includes(role) && operation.from.includes(state)); }

import type { Product } from '../../workspace/types';
export function paymentStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'payment')?.states ?? []; }
export function canEditPayment(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'payment')?.editors.includes(role) ?? false; }
export function paymentOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'payment' && operation.roles.includes(role) && operation.from.includes(state)); }

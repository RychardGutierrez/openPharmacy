import { Subject } from 'rxjs';

export const DASHBOARD_EVENTS = Symbol('DASHBOARD_EVENTS');
export type DashboardEvents = Subject<MessageEvent>;

import { Subject } from 'rxjs';
import { ReportSseEvent } from './types';

/** Injection token for the shared in-process report event bus (SSE fan-out). */
export const REPORT_EVENTS = Symbol('REPORT_EVENTS');
export type ReportEvents = Subject<ReportSseEvent>;

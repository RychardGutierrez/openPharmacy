import {
  labelExpiryStatus,
  labelMovementType,
  labelPaymentMethod,
  labelProductCategory,
  labelPurchaseOrderStatus,
  labelReportType,
  labelReturnSource,
} from './report-labels.util';

describe('report-labels.util', () => {
  it('translates known enum values to Spanish', () => {
    expect(labelReportType('SALES_DETAIL')).toBe('Detalle de ventas');
    expect(labelMovementType('SALE')).toBe('Venta');
    expect(labelPaymentMethod('CASH')).toBe('Efectivo');
    expect(labelProductCategory('OTC')).toBe('Venta libre');
    expect(labelPurchaseOrderStatus('PARTIAL')).toBe('Recibida parcialmente');
    expect(labelReturnSource('CANCELLATION')).toBe('Cancelación');
    expect(labelExpiryStatus('RED')).toBe('Vencido / Por vencer');
    expect(labelExpiryStatus('GREEN')).toBe('Vigente');
  });

  it('falls back to the raw value for unknown codes', () => {
    expect(labelReportType('FUTURE_TYPE')).toBe('FUTURE_TYPE');
    expect(labelMovementType('FUTURE_TYPE')).toBe('FUTURE_TYPE');
    expect(labelPaymentMethod('FUTURE_TYPE')).toBe('FUTURE_TYPE');
    expect(labelProductCategory('FUTURE_TYPE')).toBe('FUTURE_TYPE');
    expect(labelPurchaseOrderStatus('FUTURE_TYPE')).toBe('FUTURE_TYPE');
    expect(labelReturnSource('FUTURE_TYPE')).toBe('FUTURE_TYPE');
  });
});

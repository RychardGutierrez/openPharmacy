import { ProductCategory } from '@prisma/client';
import { ProductRulesService } from './product-rules.service';

describe('ProductRulesService', () => {
  let service: ProductRulesService;

  beforeEach(() => {
    service = new ProductRulesService();
  });

  describe('isControlled', () => {
    it.each([
      [ProductCategory.PSYCHOTROPIC, true],
      [ProductCategory.NARCOTIC, true],
      [ProductCategory.PRESCRIPTION_ONLY, false],
      [ProductCategory.OTC, false],
      [ProductCategory.NON_PHARMACEUTICAL, false],
    ])('isControlled(%s) === %s', (category, expected) => {
      expect(service.isControlled({ category })).toBe(expected);
    });
  });

  describe('requiresPrescription', () => {
    it.each([
      [ProductCategory.PSYCHOTROPIC, true],
      [ProductCategory.NARCOTIC, true],
      [ProductCategory.PRESCRIPTION_ONLY, true],
      [ProductCategory.OTC, false],
      [ProductCategory.NON_PHARMACEUTICAL, false],
    ])('requiresPrescription(%s) === %s', (category, expected) => {
      expect(service.requiresPrescription({ category })).toBe(expected);
    });
  });
});

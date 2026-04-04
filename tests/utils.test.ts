import { describe, it, expect } from 'vitest';
import { validateIMEI, formatPrice, formatDate, generateWhatsAppLink, validRepairTransitions } from '@/lib/utils';

describe('validateIMEI', () => {
  it('should validate a correct 15-digit IMEI', () => {
    // Known valid IMEI (Luhn check digit correct)
    expect(validateIMEI('490154203237518')).toBe(true);
  });

  it('should reject IMEI with wrong check digit', () => {
    expect(validateIMEI('490154203237519')).toBe(false);
  });

  it('should reject IMEI with less than 15 digits', () => {
    expect(validateIMEI('12345678901234')).toBe(false);
  });

  it('should reject IMEI with more than 15 digits', () => {
    expect(validateIMEI('1234567890123456')).toBe(false);
  });

  it('should reject IMEI with non-numeric characters', () => {
    expect(validateIMEI('49015420323751A')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(validateIMEI('')).toBe(false);
  });

  it('should validate another known valid IMEI', () => {
    expect(validateIMEI('353879234252633')).toBe(true);
  });
});

describe('formatPrice', () => {
  it('should format price in MAD', () => {
    const result = formatPrice(3200);
    expect(result).toContain('3');
    expect(result).toContain('200');
    expect(result).toContain('MAD');
  });

  it('should format zero', () => {
    expect(formatPrice(0)).toContain('0');
    expect(formatPrice(0)).toContain('MAD');
  });
});

describe('formatDate', () => {
  it('should format date in dd/MM/yyyy', () => {
    const result = formatDate('2024-01-15');
    expect(result).toBe('15/01/2024');
  });
});

describe('generateWhatsAppLink', () => {
  it('should generate link with country code', () => {
    const link = generateWhatsAppLink('0612345678', 'Bonjour');
    expect(link).toContain('wa.me/212612345678');
    expect(link).toContain('Bonjour');
  });

  it('should handle number already with country code', () => {
    const link = generateWhatsAppLink('212612345678', 'Test');
    expect(link).toContain('wa.me/212612345678');
  });
});

describe('validRepairTransitions', () => {
  it('received can go to diagnosing or cancelled', () => {
    expect(validRepairTransitions.received).toContain('diagnosing');
    expect(validRepairTransitions.received).toContain('cancelled');
    expect(validRepairTransitions.received).not.toContain('delivered');
  });

  it('ready can go to delivered or cancelled', () => {
    expect(validRepairTransitions.ready).toContain('delivered');
    expect(validRepairTransitions.ready).toContain('cancelled');
  });

  it('delivered has no transitions', () => {
    expect(validRepairTransitions.delivered).toHaveLength(0);
  });

  it('cancelled has no transitions', () => {
    expect(validRepairTransitions.cancelled).toHaveLength(0);
  });
});

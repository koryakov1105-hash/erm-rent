import { describe, it, expect } from 'vitest';
import { getFormatFromFilename } from './parseStatement';

describe('bank statement helpers', () => {
  it('detects format by filename extension', () => {
    expect(getFormatFromFilename('statement.xml')).toBe('xml');
    expect(getFormatFromFilename('report.XLSX')).toBe('xlsx');
    expect(getFormatFromFilename('old.xls')).toBe('xlsx');
    expect(getFormatFromFilename('unknown.txt')).toBeNull();
  });
});


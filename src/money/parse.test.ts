import { describe, it, expect } from 'vitest';
import { parseCashInput } from './parse';

describe('parseCashInput', () => {
  it('parses plain decimal', () => {
    const r = parseCashInput('1234.56');
    expect(r.ok).toBe(true);
    expect(r.value!.toString()).toBe('1234.5600');
  });

  it('strips dollar sign and thousands commas', () => {
    const r = parseCashInput('$1,234,567.89');
    expect(r.ok).toBe(true);
    expect(r.value!.toString()).toBe('1234567.8900');
  });

  it('parses negative with leading minus', () => {
    expect(parseCashInput('-42.50').value!.toString()).toBe('-42.5000');
    expect(parseCashInput('-$42.50').value!.toString()).toBe('-42.5000');
  });

  it('parses accounting-style parentheses as negative', () => {
    expect(parseCashInput('(42.50)').value!.toString()).toBe('-42.5000');
    expect(parseCashInput('($1,234.56)').value!.toString()).toBe('-1234.5600');
  });

  it('rejects empty and garbage', () => {
    expect(parseCashInput('').ok).toBe(false);
    expect(parseCashInput('abc').ok).toBe(false);
    expect(parseCashInput('$.').ok).toBe(false);
  });

  it('tolerates whitespace', () => {
    expect(parseCashInput('  $ 100.00  ').value!.toString()).toBe('100.0000');
  });
});

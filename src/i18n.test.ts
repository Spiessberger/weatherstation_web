import { describe, expect, it } from 'vitest';
import { getInitialLocale } from './i18n';

describe('locale preference', () => {
  it('defaults to German and only restores an explicit English choice', () => {
    expect(getInitialLocale({ getItem: () => null })).toBe('de');
    expect(getInitialLocale({ getItem: () => 'de' })).toBe('de');
    expect(getInitialLocale({ getItem: () => 'en' })).toBe('en');
    expect(getInitialLocale({ getItem: () => 'fr' })).toBe('de');
  });
});

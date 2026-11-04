/** Attach browser error listeners before any journey navigation. */
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await use(page);
    expect(errors, 'No browser errors during the complete journey').toEqual([]);
  },
});
export { expect };

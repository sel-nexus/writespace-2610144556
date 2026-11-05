/** Isolate each test while retaining the real jsdom Storage implementation. */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { beforeEach, afterEach, vi } from 'vitest';

beforeEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });
afterEach(() => {
  cleanup();
  document.documentElement.classList.remove('dark');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Express app creation
vi.mock('express', () => ({
  default: vi.fn(() => ({
    use: vi.fn(),
    listen: vi.fn((port, callback) => {
      if (callback) callback();
      return { close: vi.fn() };
    }),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  })),
}));

describe('Server', () => {
  let mockConsole: any;

  beforeEach(() => {
    // Mock console.log to avoid noise in test output
    mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    mockConsole.mockRestore();
    vi.resetModules();
  });

  it('should create an Express app', async () => {
    const express = await import('express');

    // Import the server module to trigger app creation
    await import('./index');

    expect(express.default).toHaveBeenCalled();
  });

  it('should start server on correct port', async () => {
    const express = await import('express');
    const mockApp = {
      use: vi.fn(),
      listen: vi.fn((port, callback) => {
        if (callback) callback();
        return { close: vi.fn() };
      }),
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    vi.mocked(express.default).mockReturnValue(mockApp as any);

    // Import the server module
    await import('./index');

    expect(mockApp.listen).toHaveBeenCalledWith(expect.any(Number), expect.any(Function));
  });
});

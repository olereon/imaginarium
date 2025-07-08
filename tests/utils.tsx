import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Test utilities for React components
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
}

const AllTheProviders = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <BrowserRouter>{children}</BrowserRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders>{children}</AllTheProviders>
    ),
    ...options,
  });
};

// Test data factories
export const createMockPipeline = (overrides = {}) => ({
  id: 'test-pipeline-1',
  name: 'Test Pipeline',
  description: 'A test pipeline for unit testing',
  nodes: [],
  connections: [],
  version: '1.0.0',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides,
});

export const createMockUser = (overrides = {}) => ({
  id: 'test-user-1',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date('2023-01-01'),
  ...overrides,
});

export const createMockExecution = (overrides = {}) => ({
  id: 'test-execution-1',
  pipelineId: 'test-pipeline-1',
  userId: 'test-user-1',
  status: 'pending' as const,
  startedAt: new Date('2023-01-01'),
  completedAt: null,
  logs: [],
  outputs: [],
  ...overrides,
});

// Mock API responses
export const mockApiResponse = <T,>(data: T, delay = 0) => {
  return new Promise<{ data: T }>((resolve) => {
    setTimeout(() => resolve({ data }), delay);
  });
};

export const mockApiError = (message = 'API Error', status = 500, delay = 0) => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error(message);
      (error as any).status = status;
      reject(error);
    }, delay);
  });
};

// Async test helpers
export const waitForLoadingToFinish = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

// Custom assertions
export const expectToBeVisible = (element: HTMLElement) => {
  expect(element).toBeInTheDocument();
  expect(element).toBeVisible();
};

export const expectToHaveAccessibleName = (
  element: HTMLElement,
  name: string
) => {
  expect(element).toHaveAccessibleName(name);
};

// Re-export everything
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
export { customRender as render };
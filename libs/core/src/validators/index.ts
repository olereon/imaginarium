import { z } from 'zod';

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateRequired<T>(
  value: T | undefined | null,
  fieldName: string
): asserts value is T {
  if (value === undefined || value === null) {
    throw new ValidationError(`${fieldName} is required`, fieldName, value);
  }
}

export function validateRange(value: number, min: number, max: number, fieldName: string): void {
  if (value < min || value > max) {
    throw new ValidationError(`${fieldName} must be between ${min} and ${max}`, fieldName, value);
  }
}

export function validateEnum<T extends string>(
  value: T,
  validValues: readonly T[],
  fieldName: string
): void {
  if (!validValues.includes(value)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${validValues.join(', ')}`,
      fieldName,
      value
    );
  }
}

export function createValidator<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        throw new ValidationError(
          firstError?.message ?? 'Validation failed',
          firstError?.path.join('.'),
          data
        );
      }
      throw error;
    }
  };
}

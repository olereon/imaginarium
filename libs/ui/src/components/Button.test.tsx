import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '../../../tests/utils';
import { Button } from './Button';

describe('Button', () => {
  it('should render with default props', () => {
    render(<Button>Click me</Button>);
    
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('ant-btn');
  });

  it('should handle click events', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click me</Button>);
    
    const button = screen.getByRole('button', { name: /click me/i });
    await user.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled button</Button>);
    
    const button = screen.getByRole('button', { name: /disabled button/i });
    expect(button).toBeDisabled();
  });

  it('should apply custom variant classes', () => {
    render(<Button variant="primary">Primary button</Button>);
    
    const button = screen.getByRole('button', { name: /primary button/i });
    expect(button).toHaveClass('btn-primary');
  });

  it('should apply custom size classes', () => {
    render(<Button size="large">Large button</Button>);
    
    const button = screen.getByRole('button', { name: /large button/i });
    expect(button).toHaveClass('ant-btn-lg');
  });

  it('should show loading state', () => {
    render(<Button loading>Loading button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('ant-btn-loading');
    expect(button).toBeDisabled();
  });

  it('should render as different HTML elements when "as" prop is provided', () => {
    const { container } = render(
      <Button as="a" href="/test">
        Link button
      </Button>
    );
    
    const link = container.querySelector('a');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/test');
  });

  it('should forward ref correctly', () => {
    const ref = vi.fn();
    render(<Button ref={ref}>Button with ref</Button>);
    
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLElement));
  });
});
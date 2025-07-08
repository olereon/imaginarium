import React from 'react';
import { Button as AntButton, ButtonProps as AntButtonProps } from 'antd';
import { clsx } from 'clsx';

export interface ButtonProps extends Omit<AntButtonProps, 'variant'> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  className,
  type,
  ...props
}) => {
  const buttonType =
    variant === 'primary' ? 'primary' : variant === 'secondary' ? 'default' : 'text';

  return (
    <AntButton
      type={type ?? buttonType}
      className={clsx('imaginarium-button', className)}
      {...props}
    />
  );
};

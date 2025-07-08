import React from 'react';
import { Input as AntInput, InputProps as AntInputProps } from 'antd';
import { clsx } from 'clsx';

export interface InputProps extends Omit<AntInputProps, 'variant'> {
  customVariant?: 'default' | 'filled' | 'borderless';
}

export const Input: React.FC<InputProps> = ({
  customVariant = 'default',
  className,
  ...props
}) => {
  const antVariant = customVariant === 'default' ? 'outlined' : 
                     customVariant as 'filled' | 'borderless';

  return (
    <AntInput
      variant={antVariant}
      className={clsx('imaginarium-input', className)}
      {...props}
    />
  );
};
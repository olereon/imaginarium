import React from 'react';
import { Card as AntCard, CardProps as AntCardProps } from 'antd';
import { clsx } from 'clsx';

export interface CardProps extends Omit<AntCardProps, 'variant'> {
  variant?: 'default' | 'bordered' | 'shadow';
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  className,
  bordered,
  ...props
}) => {
  return (
    <AntCard
      bordered={bordered ?? variant === 'bordered'}
      className={clsx(
        'imaginarium-card',
        {
          'shadow-lg': variant === 'shadow',
        },
        className
      )}
      {...props}
    />
  );
};
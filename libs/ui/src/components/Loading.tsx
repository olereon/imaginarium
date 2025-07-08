import React from 'react';
import { Spin, SpinProps } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { clsx } from 'clsx';

export interface LoadingProps extends SpinProps {
  fullScreen?: boolean;
  text?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  fullScreen,
  text,
  className,
  size = 'default',
  ...props
}) => {
  const antIcon = <LoadingOutlined style={{ fontSize: size === 'large' ? 48 : 24 }} spin />;

  const spinner = (
    <Spin
      indicator={antIcon}
      size={size}
      tip={text}
      className={clsx('imaginarium-loading', className)}
      {...props}
    />
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-80 z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};
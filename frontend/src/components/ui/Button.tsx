import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'text';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  fullWidth = false,
  className = '',
  style,
  ...props
}) => {
  const getClassName = () => {
    let base = 'btn';
    if (variant === 'primary') base = 'btn btn-primary';
    else if (variant === 'secondary') base = 'btn-secondary';
    else if (variant === 'danger') base = 'btn-danger';
    else if (variant === 'text') base = 'btn btn-text';

    if (fullWidth) base += ' btn-block';
    return `${base} ${className}`.trim();
  };

  return (
    <button className={getClassName()} style={style} {...props}>
      {children}
    </button>
  );
};

export default Button;

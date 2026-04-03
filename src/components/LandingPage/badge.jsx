import * as React from "react";

const Badge = ({ children, variant = 'default', style = {}, ...props }) => {
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '6px',
    border: '1px solid transparent',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: '600',
    transition: 'all 0.2s',
  };

  const variantStyles = {
    default: {
      backgroundColor: '#F6AD56',
      color: '#FFFFFF',
    },
    secondary: {
      backgroundColor: '#F1F5F9',
      color: '#475569',
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: '#E2E8F0',
      color: '#0F172A',
    },
  };

  return (
    <div
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export { Badge };
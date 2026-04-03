import * as React from "react";

const buttonStyles = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
    cursor: 'pointer',
    border: 'none',
  },
  default: {
    backgroundColor: '#F6AD56',
    color: '#FFFFFF',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  },
  outline: {
    backgroundColor: 'transparent',
    color: '#0F172A',
    border: '1px solid #E2E8F0',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: '#475569',
  },
  sizeDefault: {
    height: '36px',
    padding: '8px 16px',
  },
  sizeLg: {
    height: '40px',
    padding: '8px 24px',
    fontSize: '16px',
  },
  sizeSm: {
    height: '32px',
    padding: '4px 12px',
    fontSize: '12px',
  },
};

const Button = React.forwardRef(({ 
  children, 
  variant = 'default', 
  size = 'default', 
  style = {}, 
  ...props 
}, ref) => {
  const variantStyle = variant === 'outline' ? buttonStyles.outline : 
                       variant === 'ghost' ? buttonStyles.ghost : 
                       buttonStyles.default;
  
  const sizeStyle = size === 'lg' ? buttonStyles.sizeLg : 
                    size === 'sm' ? buttonStyles.sizeSm : 
                    buttonStyles.sizeDefault;

  return (
    <button
      ref={ref}
      style={{
        ...buttonStyles.base,
        ...variantStyle,
        ...sizeStyle,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
});

Button.displayName = "Button";

export { Button };
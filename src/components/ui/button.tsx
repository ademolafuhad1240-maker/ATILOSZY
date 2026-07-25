import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-bold uppercase tracking-[0.13em] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b79145] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45';

  const variants = {
    primary: 'bg-[#0b2a20] text-white hover:bg-[#153c30]',
    secondary: 'bg-[#c7a35d] text-[#13251e] hover:bg-[#d6b873]',
    outline: 'border border-black/20 bg-transparent text-[#171815] hover:border-[#0b2a20] hover:bg-[#0b2a20] hover:text-white',
  };

  const sizes = {
    sm: 'min-h-10 px-5 text-[10px]',
    md: 'min-h-12 px-6 text-[11px]',
    lg: 'min-h-14 px-8 text-xs',
  };

  return (
    <button className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}

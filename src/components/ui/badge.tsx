interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'sale';
}

export default function Badge({ children, variant = 'default' }: BadgeProps) {
  const variants = {
    default: 'bg-emerald-dark text-cream-off',
    sale: 'bg-gold-warm text-charcoal',
  };

  return (
    <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${variants[variant]}`}>
      {children}
    </span>
  );
}

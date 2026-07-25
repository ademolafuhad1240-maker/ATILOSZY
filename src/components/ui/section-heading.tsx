interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  centered?: boolean;
}

export default function SectionHeading({
  title,
  subtitle,
  centered = true,
}: SectionHeadingProps) {
  return (
    <div className={centered ? 'text-center' : ''}>
      <h2 className="text-4xl font-bold mb-4 text-charcoal">{title}</h2>
      {subtitle && <p className="text-lg text-text-muted">{subtitle}</p>}
    </div>
  );
}

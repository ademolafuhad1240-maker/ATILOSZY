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
    <div className={centered ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.32em] text-[#9b7c3d]">
        The ATILOSZY edit
      </p>
      <h2 className="font-display text-5xl font-semibold leading-none tracking-[-0.025em] text-[#171815] md:text-6xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-5 text-sm leading-7 text-[#70736c] md:text-base">
          {subtitle}
        </p>
      )}
    </div>
  );
}

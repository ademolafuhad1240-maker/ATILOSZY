const categories = [
  'Home & Living',
  'Beauty & Personal Care',
  'Fashion Accessories',
  'Electronics & Gadgets',
  'Kids & Gifts',
  'Everyday Essentials',
];

export default function CategoryMarquee() {
  const repeatedCategories = [...categories, ...categories];

  return (
    <section
      className="category-marquee border-y border-[#d3b066]/30 bg-[#d3b066] py-4 text-[#10231b]"
      aria-label="ATILOSZY product categories"
    >
      <div className="category-marquee-track">
        {repeatedCategories.map((category, index) => (
          <span
            key={`${category}-${index}`}
            className="flex shrink-0 items-center gap-8 px-8 text-[10px] font-extrabold uppercase tracking-[0.26em]"
          >
            {category}
            <span aria-hidden="true" className="text-base">
              ✦
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}

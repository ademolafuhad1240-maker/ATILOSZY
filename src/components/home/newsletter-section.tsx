import Container from '@/components/ui/container';

export default function NewsletterSection() {
  return (
    <section className="bg-[#d7bb7b] py-20 text-[#172119] md:py-24">
      <Container>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.32em]">
              The private edit
            </p>
            <h2 className="mt-5 max-w-xl font-display text-5xl font-semibold leading-none tracking-[-0.03em] md:text-6xl">
              New finds, delivered thoughtfully.
            </h2>
          </div>

          <div>
            <div className="flex flex-col border-b border-black/50 sm:flex-row">
              <label htmlFor="newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="newsletter-email"
                type="email"
                placeholder="Your email address"
                className="min-h-14 flex-1 bg-transparent px-0 text-sm outline-none placeholder:text-black/55"
              />
              <button
                type="button"
                className="min-h-14 text-left text-[10px] font-bold uppercase tracking-[0.2em] sm:text-right"
                title="Newsletter integration will be added later"
              >
                Coming soon
              </button>
            </div>
            <p className="mt-4 text-xs leading-5 text-black/60">
              Newsletter registration will open when the store officially launches.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  HardHat,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import StorefrontLiveCatalogSection from '@/components/catalog/storefront-live-catalog-section';
import {
  denaldServices,
  denaldSolutions,
} from '@/data/denald-store';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'DENALD Solar | CCTV | Computer',
  description:
    'Shop solar, CCTV and computer products and request installation, inspection, maintenance and quotation services from DENALD.',
};

const navigation = [
  { label: 'Products', href: '#denald-products' },
  { label: 'Solar', href: '#denald-solutions' },
  { label: 'CCTV', href: '#denald-solutions' },
  { label: 'Computers', href: '#denald-solutions' },
  { label: 'Services', href: '#denald-services' },
  { label: 'Request quote', href: '/ng/denald/request-quote' },
];

const processSteps = [
  'Request submitted',
  'Staff review',
  'Inspection arranged if required',
  'Quotation prepared',
  'Customer accepts',
  'Installation scheduled',
  'Project completed',
];

export default function DenaldPage() {
  return (
    <>
      <section className="border-b border-[#f4c642]/20 bg-[#06162a] text-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/ng/denald" className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden border border-[#f4c642]/30 bg-[#020b16] shadow-[0_0_24px_rgba(244,198,66,0.1)]">
              <Image
                src="/brand/denald-logo-clean.png"
                alt="DENALD logo"
                fill
                sizes="64px"
                className="object-contain p-1"
              />
            </div>

            <div>
              <p className="text-xl font-extrabold tracking-[0.1em]">
                DENALD
              </p>
              <p className="mt-1 text-[7px] font-extrabold uppercase tracking-[0.28em] text-[#f4c642]">
                Solar · CCTV · Computer · Ibadan
              </p>
            </div>
          </Link>

          <nav
            className="hide-scrollbar flex gap-7 overflow-x-auto"
            aria-label="DENALD departments"
          >
            {navigation.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="shrink-0 text-[8px] font-extrabold uppercase tracking-[0.17em] text-white/58 transition hover:text-[#f4c642]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <a
            href="https://wa.me/2348186710526"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border border-[#f4c642]/40 px-5 text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#f4c642] transition hover:bg-[#f4c642] hover:text-[#071a31]"
          >
            <MessageCircle size={15} />
            Technical support
          </a>
        </div>
      </section>

      <section className="denald-commerce-hero bg-[#071a31] px-5 py-6 text-white md:py-10">
        <div className="mx-auto grid max-w-[1440px] gap-4 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="relative flex min-h-[620px] flex-col justify-center overflow-hidden border border-white/10 bg-[#0b2948] p-8 sm:p-12 lg:p-16">
            <div className="absolute right-[-100px] top-[-100px] h-80 w-80 rounded-full bg-[#1b76ba]/20 blur-3xl" />
            <div className="absolute bottom-[-110px] left-[-80px] h-72 w-72 rounded-full bg-[#f4c642]/10 blur-3xl" />

            <div className="relative">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.28em] text-[#f4c642]">
                Reliable power, security and technology
              </p>

              <h1 className="mt-7 max-w-3xl font-display text-6xl font-semibold leading-[0.88] tracking-[-0.04em] sm:text-7xl">
                Build smarter.
                <br />
                Power confidently.
              </h1>

              <p className="mt-8 max-w-xl text-base leading-8 text-white/64">
                Shop solar equipment, CCTV systems and computers, or request
                assessment, installation, maintenance and technical support.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/ng/denald/shop"
                  className="inline-flex min-h-14 items-center justify-center gap-3 bg-[#f4c642] px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#071a31] transition hover:bg-[#ffdb54]"
                >
                  Shop equipment
                  <ArrowRight size={16} />
                </Link>

                <Link
                  href="/ng/denald/request-quote"
                  className="inline-flex min-h-14 items-center justify-center border border-white/25 px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] transition hover:bg-white hover:text-[#071a31]"
                >
                  Request quotation
                </Link>
              </div>

              <div className="mt-12 grid gap-5 border-t border-white/10 pt-7 sm:grid-cols-3">
                <span className="flex items-center gap-3 text-[10px] text-white/58">
                  <MapPin size={16} className="text-[#f4c642]" />
                  Oyo State and nationwide coverage
                </span>

                <span className="flex items-center gap-3 text-[10px] text-white/58">
                  <HardHat size={16} className="text-[#62b8ea]" />
                  Installation and maintenance
                </span>

                <span className="flex items-center gap-3 text-[10px] text-white/58">
                  <ShieldCheck size={16} className="text-[#f4c642]" />
                  Manufacturer warranty where applicable
                </span>
              </div>
            </div>
          </div>

          <div className="grid min-h-[620px] grid-cols-2 grid-rows-2 gap-4">
            <div className="group relative col-span-2 overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=1400&auto=format&fit=crop&q=90"
                alt="Solar panels"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 49vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#06172d]/92 via-transparent to-transparent" />

              <div className="absolute inset-x-0 bottom-0 p-7">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.2em] text-[#f4c642]">
                  Solar power solutions
                </p>

                <h2 className="mt-2 font-display text-4xl font-semibold">
                  Energy designed around your needs.
                </h2>
              </div>
            </div>

            <div className="group relative overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=900&auto=format&fit=crop&q=90"
                alt="CCTV security system"
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#06172d]/95 via-transparent to-transparent" />

              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#f4c642]">
                  CCTV security
                </p>

                <h2 className="mt-2 font-display text-2xl font-semibold">
                  Protect what matters.
                </h2>
              </div>
            </div>

            <div className="group relative overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=900&auto=format&fit=crop&q=90"
                alt="Computer system"
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#06172d]/95 via-transparent to-transparent" />

              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#62b8ea]">
                  Computers
                </p>

                <h2 className="mt-2 font-display text-2xl font-semibold">
                  Technology that works.
                </h2>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="denald-solutions"
        className="bg-[#e8eef3] px-5 py-20 md:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-[#37658e]">
                Solutions and equipment
              </p>

              <h2 className="mt-4 font-display text-5xl font-semibold tracking-[-0.03em] text-[#071a31] sm:text-6xl">
                Technology for real environments.
              </h2>
            </div>

            <Link
              href="/ng/denald/shop"
              className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#071a31]"
            >
              Shop all products
              <ArrowRight size={15} />
            </Link>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {denaldSolutions.map((solution) => (
              <Link
                key={solution.name}
                href={solution.href}
                className="group relative min-h-[430px] overflow-hidden"
              >
                <Image
                  src={solution.image}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover transition duration-700 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#06172d]/96 via-black/15 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-7 text-white">
                  <h3 className="font-display text-4xl font-semibold">
                    {solution.name}
                  </h3>

                  <p className="mt-4 max-w-lg text-sm leading-7 text-white/62">
                    {solution.description}
                  </p>

                  <span className="mt-6 inline-flex items-center gap-2 text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#f4c642]">
                    Explore solutions
                    <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div id="denald-products">
        <StorefrontLiveCatalogSection storefrontCode="DEN" />
      </div>

      <section
        id="denald-services"
        className="bg-[#071a31] px-5 py-20 text-white md:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.25em] text-[#f4c642]">
                Professional services
              </p>

              <h2 className="mt-5 font-display text-5xl font-semibold leading-[0.95] sm:text-6xl">
                From assessment to installation.
              </h2>

              <p className="mt-7 max-w-xl text-sm leading-8 text-white/56">
                DENALD handles product supply, inspection, quotation,
                installation, maintenance and technical support through one
                managed workflow.
              </p>

              <Link
                href="/ng/denald/request-quote"
                className="mt-9 inline-flex min-h-14 items-center justify-center gap-3 bg-[#f4c642] px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#071a31]"
              >
                Start a service request
                <ArrowRight size={16} />
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {denaldServices.map((service, index) => (
                <article
                  key={service}
                  className="border border-white/10 bg-[#0b2948] p-6"
                >
                  <p className="text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#62b8ea]">
                    Service {String(index + 1).padStart(2, '0')}
                  </p>

                  <h3 className="mt-5 font-display text-2xl font-semibold">
                    {service}
                  </h3>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-20 border-t border-white/10 pt-16">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.25em] text-[#f4c642]">
              How a DENALD project works
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
              {processSteps.map((step, index) => (
                <div
                  key={step}
                  className="relative border border-white/10 bg-white/[0.035] p-5"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[#f4c642] text-[9px] font-extrabold text-[#071a31]">
                    {index + 1}
                  </span>

                  <p className="mt-5 text-xs font-bold leading-6 text-white/72">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#dce8f1] px-5 py-20 text-[#071a31]">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-3">
          <article className="border border-[#173d63]/12 bg-white/60 p-8">
            <BadgeCheck size={27} className="text-[#1667a4]" />

            <h3 className="mt-7 font-display text-3xl font-semibold">
              Product support
            </h3>

            <p className="mt-4 text-sm leading-7 text-[#5b7186]">
              Product guidance, system compatibility checks and technical
              assistance before and after purchase.
            </p>
          </article>

          <article className="border border-[#173d63]/12 bg-white/60 p-8">
            <Wrench size={27} className="text-[#1667a4]" />

            <h3 className="mt-7 font-display text-3xl font-semibold">
              Maintenance
            </h3>

            <p className="mt-4 text-sm leading-7 text-[#5b7186]">
              Inspection, troubleshooting and repair support for eligible
              systems and equipment.
            </p>
          </article>

          <article className="border border-[#173d63]/12 bg-white/60 p-8">
            <ClipboardCheck size={27} className="text-[#1667a4]" />

            <h3 className="mt-7 font-display text-3xl font-semibold">
              Project quotations
            </h3>

            <p className="mt-4 text-sm leading-7 text-[#5b7186]">
              Custom pricing based on location, equipment, installation needs
              and the result of any required site inspection.
            </p>
          </article>
        </div>
      </section>

      <section className="bg-[#f4c642] px-5 py-16 text-[#071a31]">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.23em] text-[#476073]">
              Have a project in mind?
            </p>

            <h2 className="mt-3 max-w-4xl font-display text-4xl font-semibold leading-none sm:text-5xl">
              Tell DENALD what you need and receive a project review.
            </h2>
          </div>

          <Link
            href="/ng/denald/request-quote"
            className="inline-flex min-h-14 shrink-0 items-center justify-center gap-3 bg-[#071a31] px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] text-white"
          >
            Request quotation
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}

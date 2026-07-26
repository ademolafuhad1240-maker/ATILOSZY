import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft,
  ClipboardCheck,
  MapPin,
  SearchCheck,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import QuoteRequestForm from '@/components/denald/quote-request-form';

export const metadata: Metadata = {
  title: 'Request a Quotation | DENALD',
  description:
    'Request a quotation for solar, CCTV, computer setup, inspection, maintenance or installation from DENALD.',
};

const expectations = [
  {
    icon: SearchCheck,
    title: 'Project review',
    description:
      'DENALD reviews the information and confirms whether an inspection is required.',
  },
  {
    icon: MapPin,
    title: 'Inspection where needed',
    description:
      'Site-inspection fees are determined according to the project location.',
  },
  {
    icon: ClipboardCheck,
    title: 'Custom quotation',
    description:
      'Pricing is based on equipment, installation requirements and project conditions.',
  },
  {
    icon: Wrench,
    title: 'Installation scheduling',
    description:
      'Work is scheduled after the quotation and required payment terms are accepted.',
  },
];

export default function DenaldQuotePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-[#071a31] px-5 py-16 text-white md:py-24">
        <div className="absolute right-[-90px] top-[-100px] h-80 w-80 rounded-full bg-[#1667a4]/22 blur-3xl" />
        <div className="absolute bottom-[-120px] left-[-80px] h-72 w-72 rounded-full bg-[#f4c642]/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          <Link
            href="/ng/denald"
            className="inline-flex items-center gap-2 text-[8px] font-extrabold uppercase tracking-[0.2em] text-[#f4c642]"
          >
            <ArrowLeft size={14} />
            Back to DENALD
          </Link>

          <p className="mt-12 text-[9px] font-extrabold uppercase tracking-[0.27em] text-[#62b8ea]">
            Project and service enquiry
          </p>

          <h1 className="mt-5 max-w-4xl font-display text-6xl font-semibold leading-[0.9] tracking-[-0.04em] sm:text-7xl">
            Request a DENALD
            <br />
            project quotation.
          </h1>

          <p className="mt-7 max-w-2xl text-sm leading-8 text-white/60 md:text-base">
            Tell us what you need. DENALD will review the request, confirm
            whether an inspection is required and prepare a suitable
            quotation.
          </p>
        </div>
      </section>

      <section className="bg-[#e8eef3] px-5 py-20 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-[#37658e]">
              What happens next
            </p>

            <h2 className="mt-4 font-display text-5xl font-semibold leading-none text-[#071a31]">
              A clear process from enquiry to completion.
            </h2>

            <div className="mt-10 grid gap-4">
              {expectations.map(({ icon: Icon, title, description }) => (
                <article
                  key={title}
                  className="border border-[#173d63]/12 bg-white/55 p-6"
                >
                  <Icon size={24} className="text-[#1667a4]" />

                  <h3 className="mt-5 text-sm font-extrabold uppercase tracking-[0.14em] text-[#071a31]">
                    {title}
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-[#60758a]">
                    {description}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-6 flex items-start gap-4 border border-[#f4c642]/50 bg-[#f4c642]/25 p-5">
              <ShieldCheck
                size={23}
                className="mt-0.5 shrink-0 text-[#071a31]"
              />

              <p className="text-xs leading-6 text-[#354f66]">
                Manufacturer warranty applies to eligible solar products,
                batteries, inverters and equipment according to the
                manufacturer terms.
              </p>
            </div>
          </div>

          <div className="border border-[#173d63]/12 bg-[#f8fafc] p-7 shadow-[0_25px_70px_rgba(7,26,49,0.08)] sm:p-10">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-[#37658e]">
              Quotation form
            </p>

            <h2 className="mt-4 font-display text-4xl font-semibold text-[#071a31]">
              Tell us about your project.
            </h2>

            <p className="mt-4 text-sm leading-7 text-[#60758a]">
              Complete the details below. Your information will be placed into
              a WhatsApp message for the DENALD team.
            </p>

            <div className="mt-9">
              <QuoteRequestForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

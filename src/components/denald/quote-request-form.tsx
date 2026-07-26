'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, MessageCircle } from 'lucide-react';

interface QuoteFormState {
  name: string;
  phone: string;
  email: string;
  service: string;
  propertyType: string;
  location: string;
  description: string;
}

const initialForm: QuoteFormState = {
  name: '',
  phone: '',
  email: '',
  service: 'Solar Installation',
  propertyType: 'Residential',
  location: '',
  description: '',
};

export default function QuoteRequestForm() {
  const [form, setForm] = useState<QuoteFormState>(initialForm);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const message = [
      'Hello DENALD, I would like to request a quotation.',
      '',
      `Name: ${form.name}`,
      `Phone: ${form.phone}`,
      `Email: ${form.email || 'Not provided'}`,
      `Service: ${form.service}`,
      `Property type: ${form.propertyType}`,
      `Project location: ${form.location}`,
      `Project details: ${form.description}`,
    ].join('\n');

    const url = `https://wa.me/2348186710526?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const inputClass =
    'min-h-13 w-full border border-[#173d63]/18 bg-white px-4 text-sm text-[#071a31] outline-none transition focus:border-[#1667a4] focus:ring-2 focus:ring-[#1667a4]/10';

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#31597e]">
          Full name
          <input
            required
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            className={inputClass}
            placeholder="Your full name"
          />
        </label>

        <label className="grid gap-2 text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#31597e]">
          Phone number
          <input
            required
            type="tel"
            value={form.phone}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                phone: event.target.value,
              }))
            }
            className={inputClass}
            placeholder="Your phone number"
          />
        </label>
      </div>

      <label className="grid gap-2 text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#31597e]">
        Email address
        <input
          type="email"
          value={form.email}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              email: event.target.value,
            }))
          }
          className={inputClass}
          placeholder="Optional email address"
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#31597e]">
          Service required
          <select
            value={form.service}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                service: event.target.value,
              }))
            }
            className={inputClass}
          >
            <option>Solar Installation</option>
            <option>CCTV Installation</option>
            <option>Computer Setup</option>
            <option>Power Assessment</option>
            <option>System Inspection</option>
            <option>Maintenance and Repairs</option>
            <option>Site Survey</option>
            <option>Product Quotation</option>
          </select>
        </label>

        <label className="grid gap-2 text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#31597e]">
          Property type
          <select
            value={form.propertyType}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                propertyType: event.target.value,
              }))
            }
            className={inputClass}
          >
            <option>Residential</option>
            <option>Business</option>
            <option>Office</option>
            <option>School</option>
            <option>Religious Centre</option>
            <option>Other</option>
          </select>
        </label>
      </div>

      <label className="grid gap-2 text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#31597e]">
        Project location
        <input
          required
          value={form.location}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              location: event.target.value,
            }))
          }
          className={inputClass}
          placeholder="City, state and area"
        />
      </label>

      <label className="grid gap-2 text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#31597e]">
        Project details
        <textarea
          required
          rows={6}
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          className="w-full resize-y border border-[#173d63]/18 bg-white p-4 text-sm leading-7 text-[#071a31] outline-none transition focus:border-[#1667a4] focus:ring-2 focus:ring-[#1667a4]/10"
          placeholder="Describe what you need, the approximate size of the property and any existing equipment."
        />
      </label>

      <p className="text-xs leading-6 text-[#60758a]">
        Submitting opens WhatsApp with your request prefilled. A final quotation
        is issued only after DENALD reviews the project and any required
        inspection.
      </p>

      <button
        type="submit"
        className="inline-flex min-h-14 items-center justify-center gap-3 bg-[#f4c642] px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#071a31] transition hover:bg-[#ffdb54]"
      >
        <MessageCircle size={16} />
        Send quotation request
        <ArrowRight size={16} />
      </button>
    </form>
  );
}

'use client';

import { useState } from 'react';
import Container from '@/components/ui/container';
import Button from '@/components/ui/button';

export default function ContactPage() {
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, you'd send this to a server
    console.log('Form submitted:', formState);
    setSubmitted(true);
    setFormState({ name: '', email: '', message: '' });
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <>
      {/* Hero */}
      <section className="bg-cream-warm py-12 md:py-16">
        <Container>
          <h1 className="text-4xl font-bold text-charcoal">Contact Us</h1>
          <p className="text-lg text-text-muted mt-4">
            We&apos;d love to hear from you. Get in touch with any questions or feedback.
          </p>
        </Container>
      </section>

      {/* Contact Section */}
      <section className="py-16 md:py-24">
        <Container>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
            <div className="text-center">
              <div className="text-4xl mb-4">📧</div>
              <h3 className="text-xl font-bold text-charcoal mb-2">Email</h3>
              <a
                href="mailto:hello@atiloszy.com"
                className="text-emerald-rich hover:text-emerald-dark transition-colors"
              >
                hello@atiloszy.com
              </a>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">📱</div>
              <h3 className="text-xl font-bold text-charcoal mb-2">Phone</h3>
              <a
                href="tel:+1234567890"
                className="text-emerald-rich hover:text-emerald-dark transition-colors"
              >
                +1 (234) 567-890
              </a>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">🕐</div>
              <h3 className="text-xl font-bold text-charcoal mb-2">Hours</h3>
              <p className="text-text-muted">Mon-Fri: 9AM - 6PM</p>
              <p className="text-text-muted">Sat-Sun: 10AM - 4PM</p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="max-w-2xl mx-auto bg-cream-warm p-8 rounded-sm border border-border-color">
            <h2 className="text-3xl font-bold text-charcoal mb-8">Send us a Message</h2>
            {submitted ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">✓</div>
                <h3 className="text-2xl font-bold text-emerald-rich mb-2">Thank you!</h3>
                <p className="text-text-muted">We&apos;ve received your message and will get back to you soon.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-charcoal mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formState.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-border-color rounded-sm focus:outline-none focus:ring-2 focus:ring-emerald-rich"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-charcoal mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formState.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-border-color rounded-sm focus:outline-none focus:ring-2 focus:ring-emerald-rich"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-charcoal mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formState.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    className="w-full px-4 py-3 border border-border-color rounded-sm focus:outline-none focus:ring-2 focus:ring-emerald-rich"
                    placeholder="Your message here..."
                  />
                </div>

                <Button type="submit" variant="primary" size="lg" className="w-full">
                  Send Message
                </Button>
              </form>
            )}
          </div>
        </Container>
      </section>
    </>
  );
}

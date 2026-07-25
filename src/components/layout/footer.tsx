import Link from 'next/link';
import Container from '@/components/ui/container';
import { categories } from '@/data/categories';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-charcoal text-cream-off border-t border-border-color">
      <Container className="py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Brand Info */}
          <div>
            <h3 className="text-xl font-bold mb-4">ATILOSZY</h3>
            <p className="text-sm text-cream-warm mb-2">A SORVYRA Brand</p>
            <p className="text-sm text-text-muted">
              Everyday finds, thoughtfully chosen.
            </p>
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-bold mb-4">Categories</h4>
            <nav className="flex flex-col gap-2 text-sm">
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/category/${category.slug}`}
                  className="text-cream-warm hover:text-gold-soft transition-colors"
                >
                  {category.name}
                </Link>
              ))}
            </nav>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-bold mb-4">Company</h4>
            <nav className="flex flex-col gap-2 text-sm">
              <Link
                href="/about"
                className="text-cream-warm hover:text-gold-soft transition-colors"
              >
                About Us
              </Link>
              <Link
                href="/contact"
                className="text-cream-warm hover:text-gold-soft transition-colors"
              >
                Contact
              </Link>
              <Link
                href="/"
                className="text-cream-warm hover:text-gold-soft transition-colors"
              >
                Home
              </Link>
            </nav>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border-color pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-text-muted">
          <p>&copy; {currentYear} ATILOSZY. All rights reserved.</p>
          <p className="mt-4 md:mt-0">A SORVYRA Brand</p>
        </div>
      </Container>
    </footer>
  );
}

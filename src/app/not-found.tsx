import Link from 'next/link';
import Container from '@/components/ui/container';
import Button from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-warm">
      <Container>
        <div className="text-center py-16">
          <h1 className="text-7xl font-bold text-charcoal mb-4">404</h1>
          <h2 className="text-4xl font-bold text-charcoal mb-4">Page Not Found</h2>
          <p className="text-lg text-text-muted mb-8 max-w-2xl">
            The page you&apos;re looking for doesn&apos;t exist. It might have been moved or removed.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/">
              <Button variant="primary" size="lg">
                Go Home
              </Button>
            </Link>
            <Link href="/shop">
              <Button variant="secondary" size="lg">
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}

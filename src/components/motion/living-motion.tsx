'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function LivingMotion() {
  const pathname = usePathname();

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('main > section'),
    );

    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('main article, main a.group'),
    );

    const actions = Array.from(
      document.querySelectorAll<HTMLElement>('main a.inline-flex'),
    );

    const heroes = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.sorvyra-commerce-hero, .sorvyra-nigeria-hero, .atiloszy-commerce-hero, .zee-nigeria-commerce-hero',
      ),
    );

    sections.forEach((section, index) => {
      section.classList.add('living-reveal');
      section.style.setProperty(
        '--living-delay',
        `${Math.min(index, 4) * 70}ms`,
      );
    });

    cards.forEach((card, index) => {
      card.classList.add('living-card');
      card.style.setProperty(
        '--living-delay',
        `${(index % 6) * 65}ms`,
      );
    });

    actions.forEach((action) => {
      action.classList.add('living-action');
    });

    heroes.forEach((hero) => {
      hero.classList.add('living-spotlight');

      const images = Array.from(hero.querySelectorAll<HTMLElement>('img'));

      images.forEach((image, index) => {
        image.classList.add('living-cinematic-image');
        image.style.setProperty('--living-image-delay', `${index * -2.4}s`);
      });
    });

    const revealElements = [...sections, ...cards];

    let observer: IntersectionObserver | null = null;

    if (prefersReducedMotion) {
      revealElements.forEach((element) => {
        element.classList.add('is-visible');
      });
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              return;
            }

            entry.target.classList.add('is-visible');
            observer?.unobserve(entry.target);
          });
        },
        {
          threshold: 0.08,
          rootMargin: '0px 0px -7% 0px',
        },
      );

      revealElements.forEach((element) => {
        observer?.observe(element);
      });
    }

    const pointerCleanups = heroes.map((hero) => {
      let frameId: number | null = null;

      const handlePointerMove = (event: PointerEvent) => {
        if (prefersReducedMotion) {
          return;
        }

        if (frameId !== null) {
          cancelAnimationFrame(frameId);
        }

        frameId = requestAnimationFrame(() => {
          const bounds = hero.getBoundingClientRect();
          const x = ((event.clientX - bounds.left) / bounds.width) * 100;
          const y = ((event.clientY - bounds.top) / bounds.height) * 100;

          hero.style.setProperty('--living-pointer-x', `${x}%`);
          hero.style.setProperty('--living-pointer-y', `${y}%`);
        });
      };

      const resetPointer = () => {
        hero.style.setProperty('--living-pointer-x', '72%');
        hero.style.setProperty('--living-pointer-y', '30%');
      };

      hero.addEventListener('pointermove', handlePointerMove);
      hero.addEventListener('pointerleave', resetPointer);

      return () => {
        if (frameId !== null) {
          cancelAnimationFrame(frameId);
        }

        hero.removeEventListener('pointermove', handlePointerMove);
        hero.removeEventListener('pointerleave', resetPointer);
      };
    });

    document.body.classList.add('living-motion-ready');

    return () => {
      observer?.disconnect();

      pointerCleanups.forEach((cleanup) => cleanup());

      sections.forEach((section) => {
        section.classList.remove('living-reveal', 'is-visible');
        section.style.removeProperty('--living-delay');
      });

      cards.forEach((card) => {
        card.classList.remove('living-card', 'is-visible');
        card.style.removeProperty('--living-delay');
      });

      actions.forEach((action) => {
        action.classList.remove('living-action');
      });

      heroes.forEach((hero) => {
        hero.classList.remove('living-spotlight');
        hero.style.removeProperty('--living-pointer-x');
        hero.style.removeProperty('--living-pointer-y');

        hero.querySelectorAll<HTMLElement>('img').forEach((image) => {
          image.classList.remove('living-cinematic-image');
          image.style.removeProperty('--living-image-delay');
        });
      });

      document.body.classList.remove('living-motion-ready');
    };
  }, [pathname]);

  return null;
}

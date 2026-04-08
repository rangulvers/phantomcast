import type {ReactNode} from 'react';
import {useEffect, useRef, useCallback} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

/**
 * Cursor glow — a soft projected light that follows the mouse.
 */
function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);
  const pos = useRef({x: 0, y: 0});
  const target = useRef({x: 0, y: 0});
  const raf = useRef<number>(0);

  const animate = useCallback(() => {
    pos.current.x += (target.current.x - pos.current.x) * 0.08;
    pos.current.y += (target.current.y - pos.current.y) * 0.08;
    if (glowRef.current) {
      glowRef.current.style.transform =
        `translate(${pos.current.x - 200}px, ${pos.current.y - 200}px)`;
    }
    raf.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      target.current = {x: e.clientX, y: e.clientY};
    };
    window.addEventListener('mousemove', onMove);
    raf.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf.current);
    };
  }, [animate]);

  return <div ref={glowRef} className={styles.cursorGlow} />;
}

/**
 * Hook: observe elements and add `.visible` when they enter the viewport.
 */
function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]');
    if (!els.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = el.dataset.revealDelay || '0';
            el.style.transitionDelay = `${delay}ms`;
            el.classList.add(styles.visible);
            observer.unobserve(el);
          }
        });
      },
      {threshold: 0.15, rootMargin: '0px 0px -40px 0px'},
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={styles.hero}>
      <div className={styles.heroGrid} />
      <div className={styles.heroGlow} />
      <div className="container">
        <div className={styles.heroContent}>
          <Heading as="h1" className={styles.heroTitle}>
            {siteConfig.title}
          </Heading>
          <p className={styles.heroSubtitle}>
            Projection mapping software with a web-based editor.
            <br />
            Map video onto any surface. Calibrate from any device.
          </p>
          <div className={styles.heroButtons}>
            <Link className={clsx('button button--lg', styles.ctaPrimary)} to="/docs/intro">
              Documentation
            </Link>
            <Link className={clsx('button button--lg', styles.ctaSecondary)} href="https://github.com/rangulvers/phantomcast">
              View on GitHub
            </Link>
          </div>
        </div>
      </div>
      <div className={styles.heroScreenshot}>
        <div className="container">
          <div className={styles.screenshotFrame} data-reveal data-reveal-delay="200">
            <div className={styles.screenshotBar}>
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </div>
            <img
              src="/phantomcast/img/screenshots/ui-workspace.png"
              alt="PhantomCast workspace"
              className={styles.screenshotImg}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

type FeatureItem = {
  title: string;
  description: string;
  accent: string;
};

const features: FeatureItem[] = [
  {
    title: 'Multiple Warp Types',
    description: 'Quad, triangle, bezier curves, and mesh grid — choose the right warp for any surface geometry.',
    accent: '#00F0FF',
  },
  {
    title: 'Web-Based Editor',
    description: 'Drag control points, adjust parameters, and preview results in real-time from any browser on your network.',
    accent: '#9D00FF',
  },
  {
    title: 'Headless Output',
    description: 'Direct HDMI framebuffer rendering. No desktop environment, no window manager. Configure once, run unattended.',
    accent: '#00F0FF',
  },
  {
    title: 'Per-Surface Video',
    description: 'Independent video sources, effects, blend modes, and adjustments for each mapped surface.',
    accent: '#9D00FF',
  },
  {
    title: 'Exclusion Masks',
    description: 'Black out windows, doors, or any area within a surface. Draw masks directly in the editor.',
    accent: '#00F0FF',
  },
  {
    title: 'Effects & Blending',
    description: 'Strobe, color shift, fade effects. Additive, multiply, and screen blend modes between layers.',
    accent: '#9D00FF',
  },
];

function FeaturesSection() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className={styles.featuresGrid}>
          {features.map((feature, idx) => (
            <div
              key={idx}
              className={clsx(styles.featureCard, styles.reveal)}
              data-reveal
              data-reveal-delay={String(idx * 80)}
            >
              <div className={styles.featureAccent} style={{background: feature.accent}} />
              <Heading as="h3" className={styles.featureTitle}>{feature.title}</Heading>
              <p className={styles.featureDescription}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CapabilitiesSection() {
  return (
    <section className={styles.capabilities}>
      <div className="container">
        <div className={styles.capRow}>
          <div className={clsx(styles.capText, styles.reveal)} data-reveal>
            <Heading as="h2" className={styles.capTitle}>Media Library</Heading>
            <p className={styles.capDescription}>
              Upload videos and images directly through the web interface. Assign different content
              to each surface with drag-and-drop simplicity. Supports MP4, H.264, and common image formats.
            </p>
            <Link className={styles.capLink} to="/docs/guide/media">
              Learn more
            </Link>
          </div>
          <div className={clsx(styles.capImage, styles.reveal)} data-reveal data-reveal-delay="150">
            <img src="/phantomcast/img/screenshots/ui-media.png" alt="Media Library" />
          </div>
        </div>
        <div className={clsx(styles.capRow, styles.capRowReverse)}>
          <div className={clsx(styles.capText, styles.reveal)} data-reveal>
            <Heading as="h2" className={styles.capTitle}>System Configuration</Heading>
            <p className={styles.capDescription}>
              Save and load project configurations. Monitor system health and performance.
              Export your entire setup as a portable config bundle.
            </p>
            <Link className={styles.capLink} to="/docs/guide/projects">
              Learn more
            </Link>
          </div>
          <div className={clsx(styles.capImage, styles.reveal)} data-reveal data-reveal-delay="150">
            <img src="/phantomcast/img/screenshots/ui-settings.png" alt="Configuration" />
          </div>
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className={styles.cta}>
      <div className={styles.ctaGlow} />
      <div className="container">
        <div className={clsx(styles.ctaContent, styles.reveal)} data-reveal>
          <Heading as="h2" className={styles.ctaTitle}>Ready to start mapping?</Heading>
          <p className={styles.ctaDescription}>
            Read the documentation to learn how to set up and use PhantomCast.
          </p>
          <Link className={clsx('button button--lg', styles.ctaPrimary)} to="/docs/getting-started">
            Get Started
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  useScrollReveal();

  return (
    <Layout
      title="Projection Mapping Made Simple"
      description="PhantomCast — open-source projection mapping with a web-based calibration UI. Map video onto any surface.">
      <CursorGlow />
      <HomepageHeader />
      <main>
        <FeaturesSection />
        <CapabilitiesSection />
        <CTASection />
      </main>
    </Layout>
  );
}

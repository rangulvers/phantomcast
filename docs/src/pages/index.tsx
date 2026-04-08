import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={styles.hero}>
      <div className={styles.heroGlow} />
      <div className="container">
        <div className={styles.heroContent}>
          <span className={styles.badge}>Open Source</span>
          <Heading as="h1" className={styles.heroTitle}>
            {siteConfig.title}
          </Heading>
          <p className={styles.heroSubtitle}>{siteConfig.tagline}</p>
          <p className={styles.heroDescription}>
            Map video onto any surface — walls, buildings, windows, doors.
            Calibrate from your phone or laptop with the built-in web editor,
            then let it run headless.
          </p>
          <div className={styles.heroButtons}>
            <Link className={clsx('button button--primary button--lg', styles.ctaButton)} to="/docs/getting-started">
              Get Started
            </Link>
            <Link className="button button--secondary button--lg" to="/docs/intro">
              Learn More
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

type FeatureItem = {
  icon: string;
  title: string;
  description: string;
};

const features: FeatureItem[] = [
  {
    icon: '🎯',
    title: 'Precision Mapping',
    description: 'Quad, triangle, bezier, and mesh warp types let you fit video onto any surface with pixel-perfect accuracy.',
  },
  {
    icon: '🖥️',
    title: 'Web-Based Editor',
    description: 'Calibrate from any device on your network. Live preview, drag-and-drop control points, and real-time adjustments.',
  },
  {
    icon: '🔧',
    title: 'Headless Operation',
    description: 'Set it up once, then let it run. Direct HDMI output with no desktop environment required.',
  },
  {
    icon: '⚡',
    title: 'Smooth Playback',
    description: 'Optimized render pipeline with hardware-efficient compositing for fluid real-time projection.',
  },
  {
    icon: '🎭',
    title: 'Effects & Masks',
    description: 'Strobe, color shift, fade effects. Exclusion masks for windows and doors. Multiple blend modes.',
  },
  {
    icon: '🎬',
    title: 'Per-Surface Video',
    description: 'Assign different videos to different surfaces with independent playback, effects, and adjustments.',
  },
];

function FeatureCard({icon, title, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className={styles.featureCard}>
        <div className={styles.featureIcon}>{icon}</div>
        <Heading as="h3" className={styles.featureTitle}>{title}</Heading>
        <p className={styles.featureDescription}>{description}</p>
      </div>
    </div>
  );
}

function FeaturesSection() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <Heading as="h2" className={styles.sectionTitle}>Built for Projection Artists</Heading>
          <p className={styles.sectionSubtitle}>
            Everything you need to turn physical spaces into dynamic canvases
          </p>
        </div>
        <div className="row">
          {features.map((feature, idx) => (
            <FeatureCard key={idx} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ScreenshotSection() {
  return (
    <section className={styles.screenshotSection}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <Heading as="h2" className={styles.sectionTitle}>See It in Action</Heading>
        </div>
        <div className={styles.screenshotWrapper}>
          <img
            src="/phantomcast/img/screenshots/ui-workspace.png"
            alt="PhantomCast workspace showing projection mapping editor"
            className={styles.screenshot}
          />
        </div>
      </div>
    </section>
  );
}

function QuickStartSection() {
  return (
    <section className={styles.quickStart}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <Heading as="h2" className={styles.sectionTitle}>Up and Running in Minutes</Heading>
        </div>
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepNumber}>1</div>
            <div>
              <Heading as="h3" className={styles.stepTitle}>Clone & Install</Heading>
              <code className={styles.codeSnippet}>git clone https://github.com/rangulvers/phantomcast && cd phantomcast && ./setup.sh</code>
            </div>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>2</div>
            <div>
              <Heading as="h3" className={styles.stepTitle}>Start PhantomCast</Heading>
              <code className={styles.codeSnippet}>./start.sh</code>
            </div>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>3</div>
            <div>
              <Heading as="h3" className={styles.stepTitle}>Open the Editor</Heading>
              <code className={styles.codeSnippet}>http://&lt;your-ip&gt;:8000</code>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Projection Mapping Made Simple"
      description="PhantomCast — open-source projection mapping with a web-based calibration UI. Map video onto any surface.">
      <HomepageHeader />
      <main>
        <FeaturesSection />
        <ScreenshotSection />
        <QuickStartSection />
      </main>
    </Layout>
  );
}

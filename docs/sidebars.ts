import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    'getting-started',
    {
      type: 'category',
      label: 'User Guide',
      collapsed: false,
      items: [
        'guide/workspace',
        'guide/surfaces',
        'guide/calibration',
        'guide/media',
        'guide/effects',
        'guide/masks',
        'guide/motions',
        'guide/projects',
      ],
    },
    'troubleshooting',
  ],
};

export default sidebars;

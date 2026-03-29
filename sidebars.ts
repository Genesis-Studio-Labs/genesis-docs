import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'index',
    {
      type: 'category',
      label: 'Architecture & Backend',
      items: [
        '01-Architecture-Overview',
        '02-Database-Schema',
        '03-Directus-CMS-Integration',
        '04-API-Reference',
        '05-Authentication-System',
        '06-Payment-Subscription-System',
        '07-Image-Pipeline',
        '08-State-Management',
      ],
    },
    {
      type: 'category',
      label: 'Frontend & UI',
      items: [
        '09-UI-Homepage',
        '10-UI-Novels-Listing',
        '11-UI-Novel-Detail',
        '12-UI-Chapter-Viewer',
        '13-UI-Comments-System',
        '14-UI-Store',
        '15-UI-Library',
        '16-UI-Common-Components',
        '17-UI-Styling-System',
        '20-UI-Settings-Profile',
      ],
    },
    {
      type: 'category',
      label: 'Operations',
      items: ['18-SEO-Metadata', '19-Scripts-Development-Setup'],
    },
  ],
};

export default sidebars;

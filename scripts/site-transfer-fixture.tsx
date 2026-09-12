import React from 'react';
import {createRoot} from 'react-dom/client';
import {SiteImport} from '../src/studio/SiteImport';
import '../src/styles.css';
const host=document.createElement('div');host.id='site-transfer-fixture';host.style.cssText='position:fixed;inset:0;z-index:99999;overflow:auto;background:#e1e7eb;padding:20px';document.body.appendChild(host);createRoot(host).render(<SiteImport projectId="site-transfer-fixture"/>);

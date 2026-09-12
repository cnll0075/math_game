import './shell.css';
import { createShell } from './shell.js';

const root = document.querySelector<HTMLElement>('#app');
if (root) createShell(root).showLauncher();

import type { AudioBus, Settings } from '@bundle/core';
import { SOUND_EVENTS, createSeesawSoundPack } from '@bundle/seesaw';

export interface SettingsPanelDeps {
  settings: Settings;
  audio: AudioBus;
  onClose(): void;
}

const toggleRow = (label: string, checked: boolean, onChange: (value: boolean) => void): HTMLElement => {
  const row = document.createElement('label');
  row.className = 'setting';
  row.textContent = label;

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.dataset.setting = label.toLowerCase();
  input.addEventListener('change', () => onChange(input.checked));
  row.appendChild(input);
  return row;
};

/**
 * Settings live in the shell so every game shares one mute, one volume, and one
 * music toggle. The sound lab is here too, behind a long press, so sounds can
 * be auditioned without replaying a level.
 */
export function createSettingsPanel(deps: SettingsPanelDeps): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.dataset.panel = 'settings';

  const card = document.createElement('div');
  card.className = 'panel__card';
  card.innerHTML = '<h2>Settings</h2>';

  card.appendChild(
    toggleRow('Sound', !deps.settings.values.muted, (on) => {
      deps.settings.set('muted', !on);
    }),
  );
  card.appendChild(
    toggleRow('Music', deps.settings.values.music, (on) => {
      deps.settings.set('music', on);
    }),
  );

  const volume = document.createElement('label');
  volume.className = 'setting';
  volume.textContent = 'Volume';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '1';
  slider.step = '0.05';
  slider.value = String(deps.settings.values.volume);
  slider.dataset.setting = 'volume';
  slider.addEventListener('input', () => deps.settings.set('volume', Number(slider.value)));
  volume.appendChild(slider);
  card.appendChild(volume);

  const close = document.createElement('button');
  close.className = 'corner corner--settings';
  close.textContent = '×';
  close.dataset.action = 'close-settings';
  close.setAttribute('aria-label', 'Close settings');
  close.addEventListener('click', deps.onClose);
  panel.appendChild(close);

  // Hidden developer tool: a long press on the heading opens it, so a child
  // poking at the screen will not find it.
  const heading = card.querySelector('h2')!;
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  const startPress = () => {
    pressTimer = setTimeout(() => card.appendChild(buildSoundLab(deps.audio)), 3000);
  };
  const endPress = () => clearTimeout(pressTimer);
  heading.addEventListener('pointerdown', startPress);
  heading.addEventListener('pointerup', endPress);
  heading.addEventListener('pointerleave', endPress);

  panel.appendChild(card);
  return panel;
}

/** One button per sound event, for auditioning candidate sounds side by side. */
export function buildSoundLab(audio: AudioBus): HTMLElement {
  const pack = createSeesawSoundPack(audio);
  const lab = document.createElement('div');
  lab.dataset.panel = 'sound-lab';
  lab.innerHTML = '<h2>Sound lab</h2>';

  const grid = document.createElement('div');
  grid.className = 'sound-lab';
  for (const event of SOUND_EVENTS) {
    const button = document.createElement('button');
    button.textContent = event;
    button.dataset.soundEvent = event;
    button.addEventListener('click', () => {
      void audio.unlock().then(() => pack.play(event));
    });
    grid.appendChild(button);
  }
  lab.appendChild(grid);
  return lab;
}

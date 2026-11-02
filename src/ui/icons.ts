import { createElement, Search, Clapperboard, Sparkles, Heart, Download, SlidersHorizontal, Pause, Play, X, ChevronLeft, ChevronRight, Orbit, type IconNode } from 'lucide';

export function setIconButton(button: HTMLElement, icon: IconNode, label: string, text = true) {
  const svg = createElement(icon, { width: 16, height: 16, 'stroke-width': 1.5, 'aria-hidden': 'true' });
  button.replaceChildren(svg);
  button.title = label;
  button.setAttribute('aria-label', label);
  if (text) { const span = document.createElement('span'); span.textContent = label; button.append(span); }
}

export function polishIcons(root: ParentNode = document) {
  const mapping: [string, IconNode, string, boolean][] = [
    ['open-explorer', Search, '探索天体', true], ['start-tour', Clapperboard, '电影巡游', true],
    ['cinema', Sparkles, '浪漫模式', true], ['open-letter', Heart, '写给你', true],
    ['capture', Download, '留念', true], ['toggle-details', SlidersHorizontal, '观测', true],
    ['close', X, '关闭', false], ['tour-prev', ChevronLeft, '上一站', false],
    ['tour-next', ChevronRight, '下一站', false], ['tour-stop', X, '结束巡游', false],
    ['visit-comet', Orbit, '追寻彗星', true],
  ];
  for (const [id, icon, label, text] of mapping) {
    const el = root.querySelector<HTMLElement>(`#${id}`);
    if (el) setIconButton(el, icon, label, text);
  }
  root.querySelectorAll<HTMLElement>('[data-close]').forEach(el => setIconButton(el, X, '关闭', false));
}

export function setPlaybackIcon(button: HTMLElement, playing: boolean) {
  setIconButton(button, playing ? Pause : Play, playing ? '暂停' : '继续', false);
}

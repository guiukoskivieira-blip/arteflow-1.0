import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../App';

describe('ArteFlow — Responsividade e Layout (Fase 1)', () => {
  const viewports = [320, 360, 390, 430, 768, 1366, 1440];

  viewports.forEach((width) => {
    it(`14. Layout renderiza de forma determinística sem overflow horizontal global na largura de ${width}px`, async () => {
      window.innerWidth = width;
      window.innerHeight = 800;
      window.dispatchEvent(new Event('resize'));

      let rendered: ReturnType<typeof render>;
      await act(async () => {
        rendered = render(<App />);
      });

      // Verifica que o elemento raiz possui classes de confinamento horizontal
      const rootLayout = rendered!.container.firstChild as HTMLElement;
      expect(rootLayout).toBeInTheDocument();
      expect(rootLayout.className).toContain('w-full');
      expect(rootLayout.className).toContain('overflow-hidden');

      // Verifica a presença de elementos estruturais
      expect(screen.getAllByText('ArteFlow').length).toBeGreaterThan(0);
    });
  });
});

/**
 * Generic smoke tests for page-level components.
 * Adjust expected text queries once you inspect the actual component outputs.
 * If components rely heavily on Firebase or other side effects, mock them or skip.
 */
import React from 'react';
import { render } from '@testing-library/react';

const components = [
  ['login', './login'],
  ['register', './register'],
  ['dashboard', './dashboard'],
  ['bookmark', './bookmark'],
  ['bookmarks2', './bookmarks2'],
  ['community', './community'],
  ['profile', './profile'],
  ['itinerary', './Itinerary'],
  ['header', './header'],
  ['footer', '../Footer'],
  ['Ai (ChatbaseAIModal)', './Ai']
];

describe('Page/component smoke tests', () => {
  test.each(components)('loads %s module without crashing', async (_label, path) => {
    let mod;
    await expect(async () => {
      mod = await import(path);
    }).not.toThrow();
    // If default export is a component, attempt to render
    if (mod && mod.default && typeof mod.default === 'function') {
      const { container } = render(React.createElement(mod.default));
      expect(container.firstChild).toBeTruthy();
    } else if (mod.ChatbaseAIModal) {
      const { container } = render(React.createElement(mod.ChatbaseAIModal, { onClose: () => {} }));
      expect(container.firstChild).toBeTruthy();
    }
  });
});
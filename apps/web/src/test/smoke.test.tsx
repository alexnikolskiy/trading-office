import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('component-test harness', () => {
  it('renders a component into jsdom', () => {
    render(<button>hello</button>);
    expect(screen.getByRole('button', { name: 'hello' })).toBeInTheDocument();
  });
});

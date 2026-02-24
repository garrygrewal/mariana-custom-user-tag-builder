import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';

vi.mock('../../src/lib/icons', () => ({
  ICON_REGISTRY: [],
}));

import IconPicker from '../../src/components/IconPicker';

describe('IconPicker', () => {
  it('shows empty search/dropdown state when icon registry is empty', () => {
    const onSelect = vi.fn();
    render(<IconPicker selectedId="" onSelect={onSelect} />);

    const searchInput = screen.getByRole('textbox', { name: /search icons/i });
    const trigger = screen.getByRole('button', { name: /select icon/i });

    fireEvent.change(searchInput, { target: { value: 'star' } });
    expect(trigger).toBeDisabled();
    expect(screen.getByText(/no matching icons/i)).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

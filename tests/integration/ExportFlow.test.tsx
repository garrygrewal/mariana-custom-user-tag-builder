import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
import App from '../../src/App';
import { ICON_REGISTRY } from '../../src/lib/icons';

vi.mock('../../src/lib/exportZip', () => ({
  exportTagZip: vi.fn().mockResolvedValue(undefined),
}));

import { exportTagZip } from '../../src/lib/exportZip';

describe('Export flow integration', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables export when form is incomplete', () => {
    render(<App />);
    const btn = screen.getByRole('button', { name: /download zip/i });
    expect(btn).toBeDisabled();
  });

  it('enables export after filling text', () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/text \(a-z/i), {
      target: { value: 'AB' },
    });

    const btn = screen.getByRole('button', { name: /download zip/i });
    expect(btn).not.toBeDisabled();
  });

  it('calls exportTagZip with correct config on click', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/text \(a-z/i), {
      target: { value: 'XY' },
    });

    const btn = screen.getByRole('button', { name: /download zip/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(exportTagZip).toHaveBeenCalledTimes(1);
    });

    const call = vi.mocked(exportTagZip).mock.calls[0][0];
    expect(call.label).toBe('');
    expect(call.mode).toBe('text');
    expect(call.text).toBe('XY');
    expect(call.bgHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('switches to icon mode and exports with icon config', async () => {
    expect(ICON_REGISTRY.length).toBeGreaterThan(0);
    render(<App />);

    const iconToggle = screen.getByRole('button', { name: /^Icon$/ });
    fireEvent.click(iconToggle);

    const selectIconBtn = screen.queryByRole('button', { name: /select icon/i });
    if (selectIconBtn) {
      fireEvent.click(selectIconBtn);
    } else {
      fireEvent.focus(screen.getByRole('textbox', { name: /search icons/i }));
    }

    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].querySelector('svg')).not.toBeNull();
    fireEvent.click(options[0]);

    const btn = screen.getByRole('button', { name: /download zip/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(exportTagZip).toHaveBeenCalledTimes(1);
    });

    const call = vi.mocked(exportTagZip).mock.calls[0][0];
    expect(call.mode).toBe('icon');
    expect(call.iconId).toBe(ICON_REGISTRY[0].id);
  });

  it('shows inline error when invalid text chars are entered', () => {
    render(<App />);

    const textInput = screen.getByLabelText(/text \(a-z/i);
    fireEvent.change(textInput, { target: { value: 'A!' } });

    expect(screen.getByRole('alert')).toHaveTextContent(
      /only a.z, 0.9, and "\." are allowed/i,
    );
  });

  it('clears inline error when valid text is entered after invalid', () => {
    render(<App />);

    const textInput = screen.getByLabelText(/text \(a-z/i);

    fireEvent.change(textInput, { target: { value: 'A@' } });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.change(textInput, { target: { value: 'AB' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('accepts "." in text tags and exports dotted text value', async () => {
    render(<App />);

    const textInput = screen.getByLabelText(/text \(a-z/i);
    fireEvent.change(textInput, { target: { value: 'A.' } });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    const btn = screen.getByRole('button', { name: /download zip/i });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);

    await waitFor(() => {
      expect(exportTagZip).toHaveBeenCalledTimes(1);
    });

    const call = vi.mocked(exportTagZip).mock.calls[0][0];
    expect(call.mode).toBe('text');
    expect(call.text).toBe('A.');
  });
});

import { describe, it, expect } from 'vitest';
import { validateComplexSvg } from '../../server/svgValidate';

const BG = '#3DAE2B';
const FG = '#FFFFFF';

function svg(inner: string, attrs = 'width="30" height="30" viewBox="0 0 30 30"'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`;
}

const goodInner = `<circle cx="15" cy="15" r="15" fill="${BG}"/><path d="M10 10h10v10h-10z" fill="${FG}"/>`;

describe('validateComplexSvg', () => {
  it('accepts a well-formed tag', () => {
    const v = validateComplexSvg(svg(goodInner), BG, FG);
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
  });

  it('rejects a missing background circle', () => {
    const v = validateComplexSvg(svg(`<path d="M0 0h5v5h-5z" fill="${FG}"/>`), BG, FG);
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toMatch(/circle/i);
  });

  it('rejects the wrong viewBox', () => {
    const v = validateComplexSvg(
      svg(goodInner, 'width="30" height="30" viewBox="0 0 24 24"'),
      BG,
      FG,
    );
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toMatch(/viewBox/i);
  });

  it('rejects scripts and event handlers', () => {
    const v = validateComplexSvg(
      svg(`${goodInner}<script>alert(1)</script>`),
      BG,
      FG,
    );
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toMatch(/script/i);
  });

  it('rejects a missing requested background color', () => {
    const wrongBg = svg(
      `<circle cx="15" cy="15" r="15" fill="#123456"/><path d="M10 10h5v5h-5z" fill="${FG}"/>`,
    );
    const v = validateComplexSvg(wrongBg, BG, FG);
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toMatch(/background color/i);
  });

  it('rejects surrounding prose', () => {
    const v = validateComplexSvg(`Here is your tag: ${svg(goodInner)}`, BG, FG);
    expect(v.ok).toBe(false);
  });
});

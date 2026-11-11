import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProgressiveImage from '../components/common/ProgressiveImage';
import ShopLinks from '../components/layout/ShopLinks';
import { optimizedImage } from '../lib/utils';

afterEach(cleanup);

it('keeps product information visible while its image loads, then reveals the image', () => {
  render(
    <article>
      <ProgressiveImage src="/dress.webp" alt="Ivory dress" width={600} height={800} />
      <h2>Ivory dress</h2>
      <button>Add to bag</button>
    </article>,
  );
  const image = screen.getByRole('img', { name: 'Ivory dress' });
  expect(image.parentElement).toHaveAttribute('data-image-state', 'loading');
  expect(screen.getByRole('button', { name: 'Add to bag' })).toBeVisible();
  fireEvent.load(image);
  expect(image.parentElement).toHaveAttribute('data-image-state', 'loaded');
});

it('falls back after failure and stops its skeleton even if the fallback fails', () => {
  const failed = vi.fn();
  render(<ProgressiveImage src="/missing.webp" alt="Product" onError={failed} />);
  const image = screen.getByRole('img');
  fireEvent.error(image);
  expect(image).toHaveAttribute('src', '/images/product-placeholder.svg');
  fireEvent.error(image);
  expect(image.parentElement).toHaveClass('image-ready');
  expect(failed).toHaveBeenCalledTimes(1);
});

it('resets the image loading state when the product image changes', () => {
  const { rerender } = render(<ProgressiveImage src="/one.webp" alt="Product" />);
  fireEvent.load(screen.getByRole('img'));
  rerender(<ProgressiveImage src="/two.webp" alt="Product" />);
  expect(screen.getByRole('img').parentElement).toHaveAttribute('data-image-state', 'loading');
});

it('provides responsive Cloudinary delivery without changing unrelated image URLs', () => {
  const url = 'https://res.cloudinary.com/luna/image/upload/v1/dress.jpg';
  render(<ProgressiveImage src={url} alt="Dress" />);
  expect(screen.getByRole('img')).toHaveAttribute('src', optimizedImage(url, 960));
  expect(screen.getByRole('img').getAttribute('srcset')).toContain('w_240');
  expect(optimizedImage('/images/local.webp')).toBe('/images/local.webp');
  expect(optimizedImage('https://example.com/photo.jpg')).toBe('https://example.com/photo.jpg');
});

it.each([
  ['/products', 'Shop'],
  ['/products?sort=newest', 'New arrivals'],
  ['/products?sort=newest&category=dresses', 'New arrivals'],
  ['/products?sort=price-asc', 'Shop'],
  ['/products/ivory-dress', 'Shop'],
])('marks only the correct catalog link at %s', (path, selected) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ShopLinks />
    </MemoryRouter>,
  );
  expect(
    screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page'),
  ).toHaveLength(1);
  expect(screen.getByRole('link', { name: selected })).toHaveAttribute('aria-current', 'page');
});

it('changes the selected catalog link when its query changes through navigation', () => {
  render(
    <MemoryRouter initialEntries={['/products']}>
      <ShopLinks />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('link', { name: 'New arrivals' }));
  expect(screen.getByRole('link', { name: 'New arrivals' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(screen.getByRole('link', { name: 'Shop' })).not.toHaveAttribute('aria-current');
});

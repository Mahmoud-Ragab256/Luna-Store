import { useEffect, useRef, useState } from 'react';
import { optimizedImage, responsiveImageSet } from '../../lib/utils';

function ImageState({
  src,
  srcSet,
  alt,
  className = '',
  width,
  height,
  sizes = '(max-width: 760px) 50vw, 25vw',
  placeholder,
  loading = 'lazy',
  onLoad,
  onError,
  ...props
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const image = useRef(null);
  const source = failed ? '/images/product-placeholder.svg' : optimizedImage(src, 960);
  useEffect(() => {
    if (image.current?.complete && image.current.naturalWidth > 0) setLoaded(true);
  }, []);
  return (
    <span
      className={`progressive-image ${className} ${loaded ? 'image-ready' : 'image-pending'} ${placeholder ? 'image-preview' : ''}`}
      data-image-state={failed ? 'error' : loaded ? 'loaded' : 'loading'}
      style={width && height ? { aspectRatio: `${width} / ${height}` } : undefined}
    >
      <span
        className="image-placeholder"
        aria-hidden="true"
        style={placeholder ? { backgroundImage: `url("${placeholder}")` } : undefined}
      />
      <img
        {...props}
        ref={image}
        src={source}
        srcSet={failed ? undefined : srcSet || responsiveImageSet(src)}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        onLoad={(event) => {
          setLoaded(true);
          onLoad?.(event);
        }}
        onError={(event) => {
          if (!failed) onError?.(event);
          if (failed) setLoaded(true);
          else setFailed(true);
        }}
      />
    </span>
  );
}

export default function ProgressiveImage(props) {
  return <ImageState key={props.src} {...props} />;
}

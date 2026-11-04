import { useEffect, useState } from 'react';
import { WORLD_HEIGHT } from './roadGeometry';

/** The width of the visible world, in world units, for the window's shape. */
export function useViewWidth(): number {
  const [width, setWidth] = useState(measure);

  useEffect(() => {
    const onResize = () => setWidth(measure());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return width;
}

function measure(): number {
  return (WORLD_HEIGHT * window.innerWidth) / window.innerHeight;
}

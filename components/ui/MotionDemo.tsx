'use client';

import { useState } from 'react';
import styles from '@/app/styleguide/styleguide.module.css';

/** Shows the camera easing and duration tokens; collapses to a short crossfade under reduced motion. */
export function MotionDemo() {
  const [on, setOn] = useState(false);
  return (
    <div className={styles.motion}>
      <button
        type="button"
        className={styles.button}
        onClick={() => setOn((x) => !x)}
        aria-pressed={on}
      >
        Play camera move
      </button>
      <div className={styles.track} aria-hidden="true">
        <span className={`${styles.disc} ${on ? styles.discOn : ''}`} />
      </div>
    </div>
  );
}

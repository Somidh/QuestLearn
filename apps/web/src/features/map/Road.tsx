import { motion, useMotionTemplate, type MotionValue } from 'motion/react';
import { ROAD_LENGTH, ROAD_PATH } from './roadGeometry';

type RoadProps = {
  /** Distance to the end of the planned road. */
  plannedLength: number;
  /** Distance the van has driven. */
  drivenLength: MotionValue<number>;
};

export function Road({ plannedLength, drivenLength }: RoadProps) {
  const driven = useMotionTemplate`${drivenLength} ${ROAD_LENGTH}`;

  return (
    <g fill="none" strokeLinecap="round">
      <defs>
        <filter id="road-glow" x="-5%" y="-60%" width="110%" height="220%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
      </defs>

      <path d={ROAD_PATH} stroke="#3b2c78" strokeWidth="58" />

      <motion.path
        d={ROAD_PATH}
        stroke="#ffb72b"
        strokeWidth="46"
        opacity="0.55"
        filter="url(#road-glow)"
        strokeDasharray={`${plannedLength} ${ROAD_LENGTH}`}
      />
      <path
        d={ROAD_PATH}
        stroke="#ffb72b"
        strokeWidth="58"
        opacity="0.2"
        strokeDasharray={`${plannedLength} ${ROAD_LENGTH}`}
      />

      <motion.path
        d={ROAD_PATH}
        stroke="#ffb72b"
        strokeWidth="58"
        style={{ strokeDasharray: driven }}
      />

      <path
        d={ROAD_PATH}
        stroke="#f6efdc"
        strokeWidth="3.5"
        strokeDasharray="20 30"
        strokeLinecap="butt"
        opacity="0.55"
      />
    </g>
  );
}

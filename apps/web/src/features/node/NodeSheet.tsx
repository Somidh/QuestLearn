import type { FoundResource, NodeView } from '@questlearn/core';
import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { useGame } from '../../store/game';

function VideoCard({ video }: { video: FoundResource }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noreferrer"
      className="group block overflow-hidden rounded-xl bg-plum"
    >
      {video.thumbnailUrl && (
        <img
          src={video.thumbnailUrl}
          alt=""
          className="aspect-video w-full object-cover transition-opacity group-hover:opacity-85"
        />
      )}
      <span className="block px-4 py-3">
        <span className="line-clamp-2 font-medium text-paper">{video.title}</span>
        <span className="mt-1 block text-sm text-mist">{video.source}</span>
      </span>
    </a>
  );
}

function DocLink({ doc }: { doc: FoundResource }) {
  return (
    <a
      href={doc.url}
      target="_blank"
      rel="noreferrer"
      className="block rounded-xl bg-plum px-4 py-3 transition-colors hover:bg-[#3b2c78]"
    >
      <span className="line-clamp-2 font-medium text-paper">{doc.title}</span>
      <span className="mt-1 block text-sm text-mist">{doc.source}</span>
    </a>
  );
}

export function NodeSheet({ node }: { node: NodeView }) {
  const closeNode = useGame((state) => state.closeNode);
  const closeButton = useRef<HTMLButtonElement>(null);

  const videos = node.resources.filter((resource) => resource.kind === 'video');
  const docs = node.resources.filter((resource) => resource.kind === 'doc');

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeNode();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeNode]);

  return (
    <motion.section
      role="dialog"
      aria-label={node.title}
      className="absolute inset-y-0 right-0 z-20 flex w-[min(460px,92vw)] flex-col overflow-y-auto bg-dusk px-7 py-6 shadow-[-24px_0_60px_rgba(10,5,30,0.55)]"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-display text-3xl leading-tight font-semibold text-paper">
          {node.title}
        </h2>
        <button
          ref={closeButton}
          type="button"
          onClick={closeNode}
          className="rounded-full border border-mist/40 px-3 py-1 text-sm text-mist hover:border-paper hover:text-paper"
        >
          Close
        </button>
      </div>
      <p className="mt-3 leading-relaxed text-mist">{node.summary}</p>

      {videos.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="font-display text-xl text-glow">Watch</h3>
          {videos.map((video) => (
            <VideoCard key={video.url} video={video} />
          ))}
        </div>
      )}

      {docs.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="font-display text-xl text-glow">Read</h3>
          {docs.map((doc) => (
            <DocLink key={doc.url} doc={doc} />
          ))}
        </div>
      )}

      {node.resources.length === 0 && (
        <p className="mt-6 rounded-xl bg-plum px-4 py-3 text-mist">
          No resource passed verification for this checkpoint, so none is shown.
        </p>
      )}
    </motion.section>
  );
}

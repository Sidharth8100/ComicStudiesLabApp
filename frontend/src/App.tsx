import { useState, useEffect, useRef, useCallback } from "react";
import type { ReactNode, FormEvent } from "react";
import { PageFlip } from "page-flip";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Library,
  Compass,
  Bookmark,
  Plus,
  Search,
  Settings2,
  Headphones,
  Upload,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  X,
  Check,
  LoaderCircle,
  FileText,
  Users,
  SlidersHorizontal,
  Sparkles,
  Keyboard,
  Trash2,
  RotateCcw,
  Download,
  Eye,
  Type,
  Sun,
  Moon,
  MoreHorizontal,
  Heart,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { api, media, progressOf } from "./api";
import type { Book, Character, Line } from "./api";

const voiceNames: Record<string, string> = {
  warm: "Atlas · Warm",
  bright: "Juniper · Bright",
  deep: "Orion · Deep",
  soft: "Sage · Soft",
  electric: "Echo · Animated",
};
const colors = ["#9eaed7", "#edab77", "#9ec4b4", "#d1a3c8", "#b6c985"];
const sample: Book = {
  id: "sample",
  title: "After the Light",
  status: "ready",
  progress: 100,
  pageCount: 4,
  created: 0,
  demo: true,
  engine: "authored",
  characters: [
    {
      id: "NARRATOR",
      name: "Narrator",
      voice: "warm",
      appearance: "",
      age: "unspecified",
      presentation: "unspecified",
      confidence: "authored",
    },
    {
      id: "CHAR-01",
      name: "Nova",
      voice: "bright",
      appearance: "Dark hair, terracotta jacket",
      age: "adult",
      presentation: "feminine",
      confidence: "authored",
    },
    {
      id: "CHAR-02",
      name: "Echo",
      voice: "electric",
      appearance: "Silver robot, green eyes",
      age: "unspecified",
      presentation: "unspecified",
      confidence: "authored",
    },
  ],
  pages: [
    ["Some stories begin at the end."],
    [
      "The city forgot how to dream.",
      "Maybe it just needs someone to remind it.",
    ],
    [
      "Do you really think we can bring it back?",
      "One small light can change everything!",
    ],
    ["There. Can you see it?", "I can. And this time, we are not alone."],
  ].map((texts, index) => ({
    index,
    width: 900,
    height: 1200,
    lines: texts.map((text, j) => ({
      id: `sample-${index}-${j}`,
      text,
      character: index === 0 ? "NARRATOR" : j === 0 ? "CHAR-01" : "CHAR-02",
      emotion: index === 2 ? "excited" : "neutral",
      box: [0.05, 0.05 + j * 0.53, 0.8, 0.25 + j * 0.53],
      assignment: "authored",
    })),
  })),
};
function IconButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
  className = "",
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`icon-button ${active ? "active" : ""} ${className}`}
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const node = ref.current!;
    const focusable = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button,input,select,textarea,[tabindex="0"]',
        ),
      ).filter((e) => !e.hasAttribute("disabled"));
    focusable()[0]?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const items = focusable();
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
          e.preventDefault();
          items[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""}`}
        ref={ref}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={21} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
function Cover({ book, onClick }: { book: Book; onClick: () => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    if (book.demo) return;
    let alive = true,
      object = "";
    media(`/books/${book.id}/pages/0`)
      .then((u) => {
        object = u;
        if (alive) setUrl(u);
      })
      .catch(() => setError(true));
    return () => {
      alive = false;
      if (object) URL.revokeObjectURL(object);
    };
  }, [book.id, book.demo, book.status]);
  return (
    <button
      className="cover-button"
      aria-label={`Read ${book.title}`}
      onClick={onClick}
    >
      {book.demo ? (
        <img
          src="./comic-0.svg"
          alt="After the Light: Nova and Echo in a sunset city"
        />
      ) : url ? (
        <img src={url} alt={`${book.title} cover`} />
      ) : (
        <div className="cover-placeholder">
          <FileText size={40} />
          <span>
            {error
              ? "Preview unavailable"
              : book.status === "ready"
                ? "Loading cover…"
                : `${book.progress}% processed`}
          </span>
        </div>
      )}
      <span className="cover-open">
        <BookOpen size={19} /> Open story
      </span>
    </button>
  );
}
function FlipBook({
  urls,
  page,
  onPage,
  reduced,
}: {
  urls: string[];
  page: number;
  onPage: (n: number) => void;
  reduced: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    flip = useRef<PageFlip | null>(null),
    callback = useRef(onPage),
    requested = useRef(page);
  callback.current = onPage;
  requested.current = page;
  useEffect(() => {
    if (!host.current || !urls.length) return;
    const parent = host.current;
    const node = document.createElement("div");
    parent.appendChild(node);
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    const pageHeight = Math.min(
      height - 20,
      ((width > 720 ? (width - 60) / 2 : width - 40) * 4) / 3,
      690,
    );
    const p = new PageFlip(node, {
      width: Math.round(pageHeight * 0.75),
      height: Math.round(pageHeight),
      size: "fixed",
      minWidth: 180,
      maxWidth: 650,
      minHeight: 240,
      maxHeight: 900,
      showCover: true,
      drawShadow: !reduced,
      maxShadowOpacity: 0.3,
      flippingTime: reduced ? 1 : 850,
      usePortrait: true,
      autoSize: true,
      startPage: page,
      mobileScrollSupport: true,
      clickEventForward: true,
      useMouseEvents: true,
      swipeDistance: 35,
      showPageCorners: !reduced,
    });
    p.on("flip", (e) => {
      const n = Number(e.data);
      if (
        n !== requested.current &&
        !(
          p.getOrientation() === "landscape" &&
          n > 0 &&
          n + 1 === requested.current
        )
      )
        callback.current(n);
    });
    p.loadFromImages(urls);
    flip.current = p;
    return () => {
      p.destroy();
      flip.current = null;
      node.remove();
    };
  }, [urls, reduced]);
  useEffect(() => {
    const p = flip.current;
    if (
      p &&
      p.getCurrentPageIndex() !== page &&
      !(
        p.getOrientation() === "landscape" &&
        p.getCurrentPageIndex() > 0 &&
        p.getCurrentPageIndex() + 1 === page
      )
    ) {
      if (reduced) p.turnToPage(page);
      else p.flip(page);
    }
  }, [page, reduced]);
  return (
    <div
      className="flip-host"
      ref={host}
      role="img"
      aria-label={`Comic page ${page + 1} of ${urls.length}. Use the page buttons or arrow keys to turn pages.`}
    />
  );
}


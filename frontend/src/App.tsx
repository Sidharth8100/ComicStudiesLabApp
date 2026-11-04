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
import { api, media, progressOf, savedBookmarks } from "./api";
import type { Book, Character, Line } from "./api";
import voiceCatalog from "./voices.json";
import Showcase from "./components/Showcase";

const defaultVoiceNames: Record<string, string> = Object.fromEntries(
  Object.entries(voiceCatalog).map(([id, v]) => [
    id,
    `${v.name} · ${v.description}`,
  ]),
);
const defaultEmotions = [
  "neutral",
  "excited",
  "angry",
  "sad",
  "whispering",
  "surprised",
  "joyful",
  "fearful",
  "hopeful",
  "sarcastic",
  "calm",
  "confident",
  "tense",
];
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
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!host.current || !urls.length || size.width < 50 || size.height < 50)
      return;
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
  }, [urls, reduced, size.width, size.height]);
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

export default function App() {
  const [books, setBooks] = useState<Book[]>([]),
    [book, setBook] = useState<Book | null>(null),
    [nav, setNav] = useState("Discover"),
    [query, setQuery] = useState(""),
    [uploadOpen, setUploadOpen] = useState(false),
    [drag, setDrag] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uploadProgress, setUploadProgress] = useState<Book | null>(null),
    [service, setService] = useState(true),
    [settings, setSettings] = useState(false),
    [help, setHelp] = useState(false);
  const [page, setPage] = useState(0),
    [urls, setUrls] = useState<string[]>([]),
    [mediaError, setMediaError] = useState(""),
    [tab, setTab] = useState("listen"),
    [castEdit, setCastEdit] = useState<Character | null>(null),
    [lineEdit, setLineEdit] = useState<Line | null>(null),
    [saving, setSaving] = useState(false),
    [playing, setPlaying] = useState(false),
    [lineIndex, setLineIndex] = useState(0),
    [rate, setRate] = useState(1),
    [volume, setVolume] = useState(0.8),
    [expanded, setExpanded] = useState(false),
    [bookmarked, setBookmarked] = useState<string[]>(savedBookmarks);
  const [prefs, setPrefs] = useState(() => {
    try {
      return {
        theme: "paper",
        large: false,
        spacing: false,
        simple: false,
        motion: matchMedia("(prefers-reduced-motion: reduce)").matches,
        ...JSON.parse(localStorage.getItem("panel-preferences") || "{}"),
      };
    } catch {
      return {
        theme: "paper",
        large: false,
        spacing: false,
        simple: false,
        motion: false,
      };
    }
  });
  const [voiceNames, setVoiceNames] =
    useState<Record<string, string>>(defaultVoiceNames);
  const [emotionNames, setEmotionNames] = useState<string[]>(defaultEmotions);
  const [mergeTarget, setMergeTarget] = useState("");
  const [temporaryStorage, setTemporaryStorage] = useState(false);
  useEffect(() => {
    api<{ storage?: string }>("/health")
      .then((health) => setTemporaryStorage(health.storage === "temporary"))
      .catch(() => {});
    api<Record<string, { name: string; description: string }>>("/voices")
      .then((v) =>
        setVoiceNames(
          Object.fromEntries(
            Object.entries(v).map(([id, p]) => [
              id,
              `${p.name} · ${p.description}`,
            ]),
          ),
        ),
      )
      .catch(() => {});
    api<string[]>("/emotions")
      .then(setEmotionNames)
      .catch(() => {});
  }, []);
  // Ephemeral hosts can scale down between page turns. Keep a visible reading
  // session warm; leaving the reader or hiding the tab allows idle shutdown.
  useEffect(() => {
    if (!temporaryStorage || !book || book.id === "sample") return;
    const keepSession = () => {
      if (document.visibilityState === "visible")
        api("/health").catch(() => {});
    };
    const heartbeat = window.setInterval(keepSession, 25000);
    document.addEventListener("visibilitychange", keepSession);
    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", keepSession);
    };
  }, [temporaryStorage, book?.id]);
  useEffect(() => setMergeTarget(""), [castEdit?.id]);
  const input = useRef<HTMLInputElement>(null),
    audio = useRef<HTMLAudioElement | null>(null),
    lastBook = useRef(""),
    reader = useRef<HTMLDivElement>(null);
  const refresh = useCallback(
    () =>
      api<Book[]>("/books")
        .then((b) => {
          setBooks(b);
          setService(true);
        })
        .catch(() => setService(false)),
    [],
  );
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    localStorage.setItem("panel-preferences", JSON.stringify(prefs));
    document.documentElement.dataset.theme = prefs.theme;
    document.documentElement.classList.toggle("large-text", prefs.large);
    document.documentElement.classList.toggle("spaced", prefs.spacing);
    document.documentElement.classList.toggle("reduce-motion", prefs.motion);
  }, [prefs]);
  useEffect(() => {
    localStorage.setItem("panel-bookmarks", JSON.stringify(bookmarked));
  }, [bookmarked]);
  useEffect(() => {
    if (!uploadProgress || ["ready", "error"].includes(uploadProgress.status))
      return;
    let stopped = false;
    const t = setInterval(
      () =>
        api<Book>(`/books/${uploadProgress.id}`)
          .then((b) => {
            if (stopped) return;
            setUploadProgress(b);
            if (b.status === "ready") {
              refresh();
              setBook(b);
              setPage(0);
              setUploadOpen(false);
            }
          })
          .catch((e) => {
            if (!stopped) setError(e.message);
          }),
      1500,
    );
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [uploadProgress?.id, uploadProgress?.status, refresh]);
  useEffect(() => {
    if (!book) return;
    let alive = true;
    const controller = new AbortController();
    const objects: string[] = [];
    setUrls([]);
    setMediaError("");
    if (book.demo) {
      setUrls([0, 1, 2, 3].map((i) => `./comic-${i}.svg`));
      return;
    }
    Promise.all(
      book.pages.map(async (p) => {
        const u = await media(
          `/books/${book.id}/pages/${p.index}`,
          controller.signal,
        );
        objects.push(u);
        return u;
      }),
    )
      .then((u) => {
        if (alive) setUrls(u);
      })
      .catch((e) => {
        if (alive) setMediaError(e.message);
      });
    return () => {
      alive = false;
      controller.abort();
      objects.forEach(URL.revokeObjectURL);
    };
  }, [book?.id]);
  const turn = useCallback(
    (n: number) => {
      setPlaying(false);
      setLineIndex(0);
      setPage(Math.max(0, Math.min((book?.pageCount || 1) - 1, n)));
    },
    [book?.pageCount],
  );
  useEffect(() => {
    if (book) localStorage.setItem("panel-progress-" + book.id, String(page));
  }, [page, book?.id]);
  useEffect(() => {
    if (!book) return;
    const handler = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).matches("input,textarea,select") ||
        uploadOpen ||
        settings ||
        castEdit ||
        lineEdit ||
        help
      )
        return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        turn(page + 1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        turn(page - 1);
      }
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [book, page, turn, uploadOpen, settings, castEdit, lineEdit, help]);
  const lines = book?.pages[page]?.lines || [];
  useEffect(() => {
    if (!playing || !book) return;
    if (!lines.length) {
      setPlaying(false);
      return;
    }
    let cancelled = false,
      obj = "";
    const line = lines[Math.min(lineIndex, lines.length - 1)];
    const next = () => {
      if (cancelled) return;
      if (lineIndex < lines.length - 1) setLineIndex((i) => i + 1);
      else if (page < book.pageCount - 1) {
        setLineIndex(0);
        setPage((p) => p + 1);
      } else setPlaying(false);
    };
    if (book.id === "sample") {
      if (!("speechSynthesis" in window)) {
        setError(
          "Your browser does not support speech. Start the backend for generated narration.",
        );
        setPlaying(false);
        return;
      }
      const c = book.characters.find((c) => c.id === line.character);
      const u = new SpeechSynthesisUtterance(line.text);
      const voices = speechSynthesis
        .getVoices()
        .filter((v) => v.lang.startsWith("en"));
      const ci = book.characters.findIndex((x) => x.id === c?.id);
      if (voices.length) u.voice = voices[ci % voices.length];
      u.rate = rate;
      u.volume = volume;
      u.pitch =
        c?.voice === "bright" ? 1.2 : c?.voice === "electric" ? 1.4 : 0.9;
      u.onend = next;
      u.onerror = (e) => {
        if (!cancelled && e.error !== "interrupted" && e.error !== "canceled") {
          setError("Browser narration is unavailable. Try another browser.");
          setPlaying(false);
        }
      };
      speechSynthesis.speak(u);
    } else
      media(`/books/${book.id}/speech/${line.id}`)
        .then((u) => {
          obj = u;
          if (cancelled) {
            URL.revokeObjectURL(u);
            return;
          }
          const a = new Audio(u);
          audio.current = a;
          a.playbackRate = rate;
          a.volume = volume;
          a.onended = next;
          a.onerror = () => {
            setError("Audio could not be played. Try again.");
            setPlaying(false);
          };
          a.play().catch((e) => {
            if (!cancelled) {
              setError(e.message);
              setPlaying(false);
            }
          });
        })
        .catch((e) => {
          if (!cancelled) {
            setError(e.message);
            setPlaying(false);
          }
        });
    return () => {
      cancelled = true;
      audio.current?.pause();
      audio.current = null;
      if (book.id === "sample") speechSynthesis.cancel();
      if (obj) URL.revokeObjectURL(obj);
    };
  }, [playing, lineIndex, page, book?.id, book?.characters, rate, volume]);
  useEffect(() => {
    if (book?.id !== lastBook.current) {
      setPlaying(false);
      setLineIndex(0);
      lastBook.current = book?.id || "";
      if (book) window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [book?.id]);
  async function openDemo() {
    setBusy(true);
    setError("");
    try {
      const b = await api<Book>("/demo", { method: "POST" });
      setBook(b);
      setPage(Math.min(progressOf(b.id), b.pageCount - 1));
      refresh();
    } catch {
      setBook(sample);
      setPage(Math.min(progressOf("sample"), sample.pageCount - 1));
      setService(false);
    } finally {
      setBusy(false);
    }
  }
  function open(b: Book) {
    if (b.status !== "ready") {
      setUploadProgress(b);
      setUploadOpen(true);
      return;
    }
    setBook(b);
    setPage(Math.min(progressOf(b.id), b.pageCount - 1));
  }
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      setError("Please choose a PDF smaller than 40 MB.");
      return;
    }
    setBusy(true);
    setUploadOpen(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const b = await api<Book>("/books", { method: "POST", body: form });
      setUploadProgress(b);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function remove(b: Book) {
    setBusy(true);
    try {
      await api(`/books/${b.id}`, { method: "DELETE" });
      setBooks((x) => x.filter((i) => i.id !== b.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveCast(e: FormEvent) {
    e.preventDefault();
    if (!castEdit || !book) return;
    if (
      book.characters.some(
        (c) => c.id !== castEdit.id && c.voice === castEdit.voice,
      )
    ) {
      setError(
        "This voice already belongs to another character. Choose an unused voice or merge identities.",
      );
      return;
    }
    setSaving(true);
    try {
      if (book.id === "sample")
        setBook({
          ...book,
          characters:
            castEdit.id === "NEW"
              ? [
                  ...book.characters,
                  {
                    ...castEdit,
                    id: `CHAR-${String(book.characters.length).padStart(2, "0")}`,
                    confidence: "reviewed",
                  },
                ]
              : book.characters.map((c) =>
                  c.id === castEdit.id
                    ? { ...castEdit, confidence: "reviewed" }
                    : c,
                ),
        });
      else
        setBook(
          await api<Book>(
            `/books/${book.id}/characters${castEdit.id === "NEW" ? "" : "/" + castEdit.id}`,
            {
              method: castEdit.id === "NEW" ? "POST" : "PATCH",
              body: JSON.stringify(castEdit),
            },
          ),
        );
      setCastEdit(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function saveLine(e: FormEvent) {
    e.preventDefault();
    if (!lineEdit || !book) return;
    setSaving(true);
    try {
      if (book.id === "sample")
        setBook({
          ...book,
          pages: book.pages.map((p) => ({
            ...p,
            lines: p.lines.map((l) => (l.id === lineEdit.id ? lineEdit : l)),
          })),
        });
      else
        setBook(
          await api<Book>(`/books/${book.id}/lines/${lineEdit.id}`, {
            method: "PATCH",
            body: JSON.stringify(lineEdit),
          }),
        );
      setLineEdit(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function mergeCharacter() {
    if (!book || !castEdit || !mergeTarget) return;
    setSaving(true);
    setPlaying(false);
    try {
      if (book.id === "sample")
        setBook({
          ...book,
          characters: book.characters.filter((c) => c.id !== castEdit.id),
          pages: book.pages.map((p) => ({
            ...p,
            lines: p.lines.map((l) =>
              l.character === castEdit.id
                ? { ...l, character: mergeTarget, assignment: "reviewed merge" }
                : l,
            ),
          })),
        });
      else
        setBook(
          await api<Book>(`/books/${book.id}/characters/${castEdit.id}/merge`, {
            method: "POST",
            body: JSON.stringify({ target: mergeTarget }),
          }),
        );
      setCastEdit(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function downloadTranscript() {
    if (!book) return;
    const text =
      book.title +
      "\n\n" +
      book.pages
        .map(
          (p) =>
            "PAGE " +
            (p.index + 1) +
            "\n" +
            p.lines
              .map(
                (l) =>
                  (book.characters.find((c) => c.id === l.character)?.name ||
                    "Narrator") +
                  ": " +
                  l.text,
              )
              .join("\n"),
        )
        .join("\n\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download =
      book.title.replace(/[^a-zA-Z0-9 -]/g, "") + " transcript.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function bookmark(id: string) {
    setBookmarked((b) =>
      b.includes(id) ? b.filter((x) => x !== id) : [...b, id],
    );
  }
  const displayed = books.filter(
    (b) =>
      (nav !== "Bookmarks" || bookmarked.includes(b.id)) &&
      b.title.toLowerCase().includes(query.toLowerCase()),
  );
  const showcasing = !book && nav === "Discover" && !query;
  const importComic = () => {
    setUploadOpen(true);
    setUploadProgress(null);
    setError("");
  };
  const currentChar = (line: Line) =>
    book?.characters.find((c) => c.id === line.character);
  return (
    <div
      className={`app ${book ? "reading" : ""} ${expanded ? "immersive" : ""} ${showcasing ? "is-showcase" : ""}`}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <input
        type="file"
        accept="application/pdf,.pdf"
        ref={input}
        onChange={(e) => upload(e.target.files?.[0])}
        className="visually-hidden"
        aria-label="Choose a comic PDF"
        tabIndex={-1}
      />
      {!book && !showcasing && (
        <aside className="sidebar">
          <a
            className="logo"
            href="#"
            aria-label="Panel home"
            onClick={(e) => {
              e.preventDefault();
              setNav("Discover");
            }}
          >
            <span className="logo-mark">
              <BookOpen size={25} />
            </span>
            panel<span className="logo-period">.</span>
          </a>
          <div className="sidebar-caption">YOUR NEXT ADVENTURE</div>
          <nav aria-label="Main navigation">
            {[
              [Compass, "Discover"],
              [Library, "My library"],
              [Bookmark, "Bookmarks"],
            ].map(([I, label]) => {
              const Icon = I as typeof Compass;
              return (
                <button
                  key={String(label)}
                  aria-label={String(label)}
                  aria-current={nav === label ? "page" : undefined}
                  title={String(label)}
                  className={nav === label ? "nav-item selected" : "nav-item"}
                  onClick={() => {
                    setNav(String(label));
                    setQuery("");
                  }}
                >
                  <Icon size={20} />
                  <span>{String(label)}</span>
                  {label === "My library" && <small>{books.length}</small>}
                </button>
              );
            })}
          </nav>
          <button
            className="sidebar-upload"
            onClick={() => {
              setUploadOpen(true);
              setUploadProgress(null);
              setError("");
            }}
          >
            <Plus size={19} /> Import a comic
          </button>
          <div className="sidebar-note">
            <span className="tiny-orbit">✳</span>
            <h3>
              Good stories are
              <br />
              for everyone.
            </h3>
            <p>
              Read it. Hear it.
              <br />
              Make it your own.
            </p>
            <button onClick={() => setSettings(true)}>
              Explore accessibility <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="sidebar-bottom">
            <button onClick={() => setSettings(true)}>
              <Settings2 size={18} /> Reading preferences
            </button>
            <div className="profile">
              <span className="avatar">Y</span>
              <span>
                Your little universe<small>Personal library</small>
              </span>
              <span
                className="status-dot"
                title={service ? "Backend connected" : "Sample mode"}
              />
            </div>
          </div>
        </aside>
      )}
      <div className="main-shell">
        {!book ? (
          <>
            {!showcasing && (
              <header className="topbar">
                <div className="breadcrumb">
                  Your space <span>/</span> <b>{nav}</b>
                </div>
                <div className="topbar-right">
                  <label className="search">
                    <Search size={17} />
                    <input
                      placeholder="Find your next story"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      aria-label="Search your library"
                    />
                    <kbd>/</kbd>
                  </label>
                  <IconButton
                    label="Reading preferences"
                    onClick={() => setSettings(true)}
                  >
                    <SlidersHorizontal size={19} />
                  </IconButton>
                  <span className="mini-avatar">Y</span>
                </div>
              </header>
            )}
            <main id="main" className="library-main">
              {showcasing && (
                <Showcase
                  onImport={importComic}
                  onExplore={openDemo}
                  onPreferences={() => setSettings(true)}
                  onNavigate={(n) => {
                    setNav(n);
                    setQuery("");
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }}
                  busy={busy}
                  reducedMotion={prefs.motion}
                />
              )}
              <section className="shelf" id="shelf">
                {temporaryStorage && (
                  <p className="temporary-storage-notice">
                    Temporary demo library. Comics and voice edits disappear
                    when this server is recycled. Keep your original PDF.
                  </p>
                )}
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      {nav === "Bookmarks"
                        ? "KEEP THE GOOD ONES CLOSE"
                        : "YOUR PERSONAL ESCAPE"}
                    </span>
                    <h2>
                      {query
                        ? "Search results"
                        : nav === "Bookmarks"
                          ? "Saved for another day"
                          : nav === "My library"
                            ? "Your story collection"
                            : "A story worth getting lost in"}
                      <span className="heading-dot">.</span>
                    </h2>
                  </div>
                  <span className="shelf-counter">
                    {displayed.length + (nav !== "Bookmarks" && !query ? 1 : 0)}{" "}
                    {displayed.length === 0 ? "story" : "stories"}
                  </span>
                </div>
                <div className="book-grid">
                  {(nav !== "Bookmarks" ||
                    bookmarked.includes("sample") ||
                    books.some((b) => b.demo && bookmarked.includes(b.id))) &&
                    (!query ||
                      "after the light".includes(query.toLowerCase())) && (
                      <article className="book-card sample-card">
                        <div className="book-card-top">
                          <span className="book-badge">
                            <Sparkles size={12} /> PANEL ORIGINAL
                          </span>
                          <button
                            className="sample-cover"
                            onClick={openDemo}
                            aria-label="Read After the Light"
                          >
                            <img
                              src="./comic-0.svg"
                              alt="After the Light illustrated cover"
                            />
                            <span className="sample-read">
                              <Play size={20} fill="currentColor" /> Read the
                              first chapter
                            </span>
                          </button>
                          <span className="cover-number">
                            01 / THE BEGINNING
                          </span>
                        </div>
                        <div className="book-info">
                          <div>
                            <h3>After the Light</h3>
                            <p>Sci-fi · A small light. A big adventure.</p>
                          </div>
                          <IconButton
                            label="Read After the Light"
                            onClick={openDemo}
                          >
                            <ArrowUpRight size={20} />
                          </IconButton>
                        </div>
                        <div className="book-meta">
                          <span>
                            <Headphones size={13} /> Full-cast narration
                          </span>
                          <span>4 pages</span>
                        </div>
                      </article>
                    )}
                  {displayed
                    .filter((b) => !b.demo)
                    .map((b) => (
                      <article className="book-card" key={b.id}>
                        <div className="uploaded-cover">
                          <Cover book={b} onClick={() => open(b)} />
                          <div className="card-buttons">
                            <IconButton
                              label={`Bookmark ${b.title}`}
                              active={bookmarked.includes(b.id)}
                              onClick={() => bookmark(b.id)}
                            >
                              <Bookmark size={16} />
                            </IconButton>
                            <IconButton
                              label={`Delete ${b.title}`}
                              disabled={
                                busy ||
                                ["processing", "queued"].includes(b.status)
                              }
                              onClick={() => remove(b)}
                            >
                              <Trash2 size={16} />
                            </IconButton>
                          </div>
                        </div>
                        <div className="book-info">
                          <div>
                            <h3>{b.title}</h3>
                            <p>
                              {b.status === "ready"
                                ? `${b.characters.length} voices · Ready to read`
                                : b.status === "error"
                                  ? "Processing needs attention"
                                  : `${b.progress}% processed`}
                            </p>
                          </div>
                          <IconButton
                            label={`Open ${b.title}`}
                            onClick={() => open(b)}
                          >
                            <ArrowUpRight size={20} />
                          </IconButton>
                        </div>
                        <div className="book-meta">
                          <span>
                            {progressOf(b.id) > 0
                              ? "Continue reading"
                              : "Your upload"}
                          </span>
                          <span>{b.pageCount} pages</span>
                        </div>
                      </article>
                    ))}
                  <button
                    className="import-card"
                    onClick={() => {
                      setUploadOpen(true);
                      setUploadProgress(null);
                      setError("");
                    }}
                  >
                    <span className="import-icon">
                      <Plus size={29} strokeWidth={1.4} />
                    </span>
                    <h3>
                      Your next story
                      <br />
                      belongs here.
                    </h3>
                    <p>
                      Drop in a PDF.
                      <br />
                      We’ll bring the pages to life.
                    </p>
                    <span className="import-link">
                      Import a comic <ArrowUpRight size={16} />
                    </span>
                    <small>PDF · UP TO 40 MB · 100 PAGES</small>
                  </button>
                </div>
                {nav === "Bookmarks" && displayed.length === 0 && (
                  <p className="empty-copy">
                    Save a comic with the bookmark button to find it here.
                  </p>
                )}
                {query &&
                  displayed.length === 0 &&
                  !"after the light".includes(query.toLowerCase()) && (
                    <p className="empty-copy">
                      No stories match “{query}”. Try a different title.
                    </p>
                  )}
              </section>
              <footer className="library-footer">
                <span className="footer-brand">panel.</span>
                <p>A little more wonder. One page at a time.</p>
                <button onClick={() => setHelp(true)}>
                  Made for the way you read <ArrowUpRight size={14} />
                </button>
              </footer>
            </main>
          </>
        ) : (
          <div className="reader" ref={reader}>
            <header className="reader-topbar">
              <button
                className="back-library"
                onClick={() => {
                  setPlaying(false);
                  setBook(null);
                  refresh();
                }}
              >
                <ArrowLeft size={18} />
                <span>Library</span>
              </button>
              <div className="reader-title">
                <span className="eyebrow">NOW READING</span>
                <h1>{book.title}</h1>
              </div>
              <div className="reader-actions">
                <IconButton
                  label="Download transcript"
                  onClick={downloadTranscript}
                >
                  <Download size={18} />
                </IconButton>
                <span className="reader-private">
                  <span className="green-dot" /> Your reading space
                </span>
                <IconButton
                  label="Bookmark this comic"
                  active={bookmarked.includes(book.id)}
                  onClick={() => bookmark(book.id)}
                >
                  <Bookmark size={19} />
                </IconButton>
                <IconButton
                  label="Reading preferences"
                  onClick={() => setSettings(true)}
                >
                  <Settings2 size={19} />
                </IconButton>
                <IconButton
                  label={expanded ? "Exit focus mode" : "Enter focus mode"}
                  active={expanded}
                  onClick={() => setExpanded((e) => !e)}
                >
                  {expanded ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
                </IconButton>
              </div>
            </header>
            <main id="main" className="reader-body">
              <section className="reading-stage" aria-label="Comic viewer">
                <div className="stage-topline">
                  <span>
                    <BookOpen size={15} />{" "}
                    {book.demo ? "PANEL ORIGINAL" : "YOUR COMIC"}{" "}
                    <span className="stage-tag">
                      {prefs.simple ? "SIMPLE VIEW" : "PAGE-TURN VIEW"}
                    </span>
                  </span>
                  <button onClick={() => setHelp(true)}>
                    <Keyboard size={16} />
                    <span>Reader shortcuts</span>
                  </button>
                </div>
                {mediaError ? (
                  <div className="viewer-loading">
                    <AlertCircle />
                    <p>{mediaError}</p>
                    <button
                      className="button"
                      onClick={() => {
                        setBook(null);
                        refresh();
                      }}
                    >
                      Return to library
                    </button>
                  </div>
                ) : urls.length === 0 ? (
                  <div className="viewer-loading">
                    <LoaderCircle className="spin" />
                    <p>Opening your story…</p>
                  </div>
                ) : prefs.simple ? (
                  <div className="simple-page">
                    <img
                      src={urls[page]}
                      alt={`Page ${page + 1} of ${book.title}`}
                    />
                  </div>
                ) : (
                  <FlipBook
                    key={book.id + String(expanded)}
                    urls={urls}
                    page={page}
                    reduced={prefs.motion}
                    onPage={(n) => {
                      if (n !== page) turn(n);
                    }}
                  />
                )}
                <div className="page-navigation">
                  <IconButton
                    label="Previous page"
                    disabled={page === 0}
                    onClick={() => turn(page - 1)}
                  >
                    <ChevronLeft size={20} />
                  </IconButton>
                  <div>
                    <span>
                      PAGE <b>{String(page + 1).padStart(2, "0")}</b> OF{" "}
                      {String(book.pageCount).padStart(2, "0")}
                    </span>
                    <input
                      type="range"
                      aria-label="Comic page"
                      min={1}
                      max={book.pageCount}
                      value={page + 1}
                      onChange={(e) => turn(Number(e.target.value) - 1)}
                    />
                  </div>
                  <IconButton
                    label="Next page"
                    disabled={page === book.pageCount - 1}
                    onClick={() => turn(page + 1)}
                  >
                    <ChevronRight size={20} />
                  </IconButton>
                </div>
              </section>
              <aside
                className="narration-panel"
                aria-label="Narration and characters"
              >
                <div className="narration-tabs">
                  <button
                    className={tab === "listen" ? "selected" : ""}
                    onClick={() => setTab("listen")}
                  >
                    <Headphones size={16} /> Story audio
                  </button>
                  <button
                    className={tab === "cast" ? "selected" : ""}
                    onClick={() => setTab("cast")}
                  >
                    <Users size={16} /> The cast{" "}
                    <small>{book.characters.length}</small>
                  </button>
                </div>
                {tab === "listen" ? (
                  <>
                    <div className="narration-intro">
                      <span className="eyebrow">
                        LET THE STORY FIND ITS VOICE
                      </span>
                      <h2>
                        Close your eyes.
                        <br />
                        <em>Stay in the story.</em>
                      </h2>
                      <div className="audio-engine">
                        <span className="green-dot" />
                        {book.id === "sample"
                          ? "Browser narration"
                          : book.engine === "authored"
                            ? "Full-cast sample · local voices"
                            : book.engine === "vision"
                              ? "Vision-assisted cast · local voices"
                              : "Local OCR · review cast"}
                      </div>
                    </div>
                    <div className="transcript-heading">
                      <span>THE TRANSCRIPT</span>
                      <span>PAGE {page + 1}</span>
                    </div>
                    <div
                      className="transcript"
                      aria-label={`Page ${page + 1} dialogue`}
                    >
                      {lines.length === 0 ? (
                        <div className="no-dialogue">
                          <Eye size={24} />
                          <h3>A quiet moment.</h3>
                          <p>
                            No dialogue was found on this page. Take in the
                            artwork or turn the page.
                          </p>
                        </div>
                      ) : (
                        lines.map((l, i) => {
                          const c = currentChar(l);
                          const ci = book.characters.findIndex(
                            (c) => c.id === l.character,
                          );
                          return (
                            <div
                              key={l.id}
                              className={`transcript-line ${playing && i === lineIndex ? "speaking" : ""}`}
                            >
                              <div
                                className="speaker-avatar"
                                style={{
                                  background: colors[ci % colors.length],
                                }}
                              >
                                {c?.name[0] || "N"}
                              </div>
                              <div className="line-content">
                                <div className="speaker-heading">
                                  <span>{c?.name || "Narrator"}</span>
                                  <small>{l.emotion}</small>
                                </div>
                                <button
                                  className="dialogue-text"
                                  onClick={() => {
                                    setLineIndex(i);
                                    setPlaying(true);
                                  }}
                                  aria-label={`Listen to ${c?.name}: ${l.text}`}
                                >
                                  {l.text}
                                </button>
                                <div className="line-tools">
                                  <span>
                                    {playing && i === lineIndex ? (
                                      <>
                                        <span className="mini-bars">▂▅▃▆</span>{" "}
                                        Speaking now
                                      </>
                                    ) : (
                                      c?.id
                                    )}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setPlaying(false);
                                      setLineEdit(l);
                                    }}
                                    aria-label={`Edit dialogue ${i + 1}`}
                                  >
                                    Edit
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="narration-tip">
                      <Sparkles size={17} />
                      <p>
                        Every character, their own voice.
                        <br />
                        <button onClick={() => setTab("cast")}>
                          Make the cast your own <ArrowRight size={13} />
                        </button>
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="cast-intro">
                      <span className="eyebrow">
                        THE PEOPLE BEHIND THE PANELS
                      </span>
                      <h2>
                        Meet the voices<span className="heading-dot">.</span>
                      </h2>
                      <p>
                        {book.demo
                          ? "An original cast, ready to tell their story."
                          : "Speaker matches are suggestions. Review identities, age, presentation and voices for the best narration."}
                      </p>
                    </div>
                    <div className="cast-list">
                      {book.characters.map((c, i) => (
                        <button
                          className="cast-card"
                          key={c.id}
                          onClick={() => {
                            setPlaying(false);
                            setCastEdit(c);
                          }}
                        >
                          <span
                            className="cast-avatar"
                            style={{ background: colors[i % colors.length] }}
                          >
                            {c.name[0]}
                          </span>
                          <span>
                            <strong>{c.name}</strong>
                            <small>{c.id}</small>
                            <span className="cast-voice">
                              <Volume2 size={12} />
                              {voiceNames[c.voice]}
                            </span>
                          </span>
                          <SlidersHorizontal size={16} />
                          <p>
                            {c.appearance || "The voice between the panels."}
                          </p>
                          <span className="cast-confidence">
                            {c.confidence === "authored" ||
                            c.confidence === "reviewed" ? (
                              <Check size={12} />
                            ) : (
                              <Eye size={12} />
                            )}{" "}
                            {c.confidence}
                          </span>
                        </button>
                      ))}
                      <button
                        className="button full add-character"
                        onClick={() =>
                          setCastEdit({
                            id: "NEW",
                            name: "New character",
                            voice:
                              Object.keys(voiceNames).find(
                                (v) =>
                                  !book.characters.some((c) => c.voice === v),
                              ) || "warm",
                            age: "unspecified",
                            presentation: "unspecified",
                            appearance: "",
                            confidence: "new",
                          })
                        }
                      >
                        <Plus size={16} /> Add character
                      </button>
                    </div>
                  </>
                )}
              </aside>
            </main>
            <footer className="audio-player">
              <div className="player-story">
                <img
                  src="./comic-0.svg"
                  alt=""
                  style={{ display: book.demo ? "block" : "none" }}
                />
                <div>
                  <b>{book.title}</b>
                  <span>
                    {playing
                      ? currentChar(lines[lineIndex])?.name || "Narrating"
                      : "Your story is ready when you are"}
                  </span>
                </div>
                <span className={`player-waves ${playing ? "is-playing" : ""}`}>
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </div>
              <div className="player-controls">
                <IconButton
                  label="Restart page narration"
                  onClick={() => {
                    setLineIndex(0);
                    setPlaying(false);
                  }}
                >
                  <RotateCcw size={17} />
                </IconButton>
                <button
                  className="play-button"
                  aria-label={playing ? "Pause narration" : "Play narration"}
                  onClick={() => setPlaying((p) => !p)}
                  disabled={!lines.length}
                >
                  {playing ? (
                    <Pause size={20} fill="currentColor" />
                  ) : (
                    <Play size={20} fill="currentColor" />
                  )}
                </button>
                <div className="player-track">
                  <div>
                    <span>
                      {playing ? "NOW PLAYING" : "LISTEN AT YOUR OWN PACE"}
                    </span>
                    <span>
                      {lines.length ? Math.min(lineIndex + 1, lines.length) : 0}{" "}
                      / {lines.length} lines
                    </span>
                  </div>
                  <div className="track">
                    <i
                      style={{
                        width: `${lines.length ? ((lineIndex + 1) / lines.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="player-options">
                <select
                  aria-label="Narration speed"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                >
                  {[0.75, 1, 1.25, 1.5, 2].map((n) => (
                    <option key={n} value={n}>
                      {n}×
                    </option>
                  ))}
                </select>
                <IconButton
                  label={volume ? "Mute narration" : "Unmute narration"}
                  onClick={() => setVolume((v) => (v ? 0 : 0.8))}
                >
                  {volume ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </IconButton>
                <input
                  aria-label="Narration volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                />
              </div>
            </footer>
          </div>
        )}
      </div>
      {error && (
        <div className="toast" role="alert">
          <AlertCircle size={19} />
          <span>{error}</span>
          <IconButton label="Dismiss error" onClick={() => setError("")}>
            <X size={17} />
          </IconButton>
        </div>
      )}
      {uploadOpen && (
        <Modal
          title={
            uploadProgress
              ? "Bringing your story to life"
              : "A new adventure starts here."
          }
          onClose={() => setUploadOpen(false)}
        >
          <p className="modal-description">
            Your comic. Your cast. Your own little escape.
          </p>
          {temporaryStorage && (
            <p className="temporary-storage-notice">
              This is a temporary demo. Your PDF and cast stay available while
              the server is active and can disappear when it shuts down. Keep
              your original file.
            </p>
          )}
          {uploadProgress ? (
            <div className="processing">
              <div className="processing-icon">
                {uploadProgress.status === "error" ? (
                  <AlertCircle size={36} />
                ) : uploadProgress.status === "ready" ? (
                  <CheckCircle2 size={36} />
                ) : (
                  <BookOpen size={36} />
                )}
              </div>
              <h3>{uploadProgress.title}</h3>
              <p aria-live="polite">
                {uploadProgress.status === "error"
                  ? uploadProgress.error
                  : uploadProgress.status === "ready"
                    ? "Your story is ready."
                    : uploadProgress.progress < 30
                      ? "Unfolding the pages…"
                      : uploadProgress.progress < 75
                        ? "Finding the words and characters…"
                        : "Putting the finishing touches on your story…"}
              </p>
              <progress
                max={100}
                value={uploadProgress.progress}
                aria-label="Comic processing progress"
              />
              <span>{uploadProgress.progress}%</span>
              {uploadProgress.status === "error" && (
                <button
                  className="button primary"
                  onClick={async () => {
                    try {
                      setUploadProgress(
                        await api<Book>(`/books/${uploadProgress.id}/retry`, {
                          method: "POST",
                        }),
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <RotateCcw size={17} /> Try again
                </button>
              )}
              {uploadProgress.status === "ready" && (
                <button
                  className="button primary"
                  onClick={() => {
                    open(uploadProgress);
                    setUploadOpen(false);
                  }}
                >
                  Open comic <ArrowRight size={17} />
                </button>
              )}
            </div>
          ) : (
            <>
              <button
                className={`dropzone ${drag ? "drag-over" : ""}`}
                disabled={busy}
                onClick={() => input.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  upload(e.dataTransfer.files[0]);
                }}
              >
                <span className="upload-cloud">
                  {busy ? (
                    <LoaderCircle className="spin" size={30} />
                  ) : (
                    <Upload size={30} />
                  )}
                </span>
                <h3>
                  {busy ? "Uploading your story…" : "Drop your comic PDF here"}
                </h3>
                <p>
                  or <u>browse your files</u>
                </p>
                <small>PDF · Up to 40 MB · Maximum 100 pages</small>
              </button>
              <div className="import-features">
                <span>
                  <CheckCircle2 size={16} /> Real page turning
                </span>
                <span>
                  <CheckCircle2 size={16} /> Character voices
                </span>
                <span>
                  <CheckCircle2 size={16} /> Editable transcript
                </span>
              </div>
              <p className="privacy-note">
                Your files stay in your personal library on this server. This
                browser holds your library access key. Clear browser storage and
                you lose access; this is not a synced account.
              </p>
              {!service && (
                <p className="service-note">
                  Uploads need the Panel backend. You can still explore the
                  original sample comic.
                </p>
              )}
            </>
          )}
        </Modal>
      )}
      {settings && (
        <Modal
          title="A reader that feels like you."
          onClose={() => setSettings(false)}
        >
          <p className="modal-description">
            A few small adjustments. A more comfortable escape.
          </p>
          <div className="settings-section">
            <label className="setting-label">YOUR READING ATMOSPHERE</label>
            <div className="theme-options">
              {[
                ["paper", "Paper", Sun],
                ["night", "Midnight", Moon],
                ["contrast", "High contrast", Eye],
              ].map(([v, l, I]) => {
                const Icon = I as typeof Sun;
                return (
                  <button
                    key={String(v)}
                    className={prefs.theme === v ? "selected" : ""}
                    onClick={() => setPrefs({ ...prefs, theme: v })}
                  >
                    <Icon size={20} />
                    {String(l)}
                    {prefs.theme === v && <Check size={14} />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="setting-toggles">
            {[
              [
                "large",
                "Larger transcript",
                "A little more room for every word.",
                Type,
              ],
              [
                "spacing",
                "Comfortable spacing",
                "More space between letters and lines.",
                MoreHorizontal,
              ],
              [
                "simple",
                "Simple page view",
                "One static page with a readable transcript.",
                FileText,
              ],
              [
                "motion",
                "Reduce motion",
                "Skip animations and page-turn effects.",
                Eye,
              ],
            ].map(([v, l, d, I]) => {
              const Icon = I as typeof Type;
              return (
                <label className="setting-row" key={String(v)}>
                  <Icon size={21} />
                  <span>
                    <strong>{String(l)}</strong>
                    <small>{String(d)}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={prefs[v as keyof typeof prefs]}
                    onChange={(e) =>
                      setPrefs({ ...prefs, [String(v)]: e.target.checked })
                    }
                  />
                </label>
              );
            })}
          </div>
          <button
            className="button primary full"
            onClick={() => setSettings(false)}
          >
            Make yourself comfortable <Check size={17} />
          </button>
        </Modal>
      )}
      {help && (
        <Modal title="Find your reading rhythm." onClose={() => setHelp(false)}>
          <p className="modal-description">
            Drag a corner, tap a page, or use these shortcuts.
          </p>
          <div className="shortcuts">
            <span>
              Turn a page{" "}
              <span>
                <kbd>←</kbd> <kbd>→</kbd>
              </span>
            </span>
            <span>
              Play or pause narration <kbd>Space</kbd>
            </span>
            <span>
              Leave focus mode / close dialog <kbd>Esc</kbd>
            </span>
          </div>
          <p className="privacy-note">
            Use Reading preferences for larger transcripts, extra spacing, high
            contrast, and motion-free pages. Dialogue can be corrected and
            reassigned to any cast member.
          </p>
        </Modal>
      )}
      {castEdit && (
        <Modal
          title={`A voice for ${castEdit.name}`}
          onClose={() => setCastEdit(null)}
        >
          <form onSubmit={saveCast} className="edit-form">
            <span className="code-label">
              {castEdit.id} · {castEdit.confidence}
            </span>
            <label>
              Character name
              <input
                required
                maxLength={60}
                value={castEdit.name}
                onChange={(e) =>
                  setCastEdit({ ...castEdit, name: e.target.value })
                }
              />
            </label>
            <label>
              Voice
              <select
                value={castEdit.voice}
                onChange={(e) =>
                  setCastEdit({ ...castEdit, voice: e.target.value })
                }
              >
                {Object.entries(voiceNames).map(([v, n]) => (
                  <option
                    key={v}
                    value={v}
                    disabled={book?.characters.some(
                      (c) => c.id !== castEdit.id && c.voice === v,
                    )}
                  >
                    {n}
                    {book?.characters.some(
                      (c) => c.id !== castEdit.id && c.voice === v,
                    )
                      ? " (in use)"
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-two">
              <label>
                Age cue
                <select
                  value={castEdit.age}
                  onChange={(e) =>
                    setCastEdit({ ...castEdit, age: e.target.value })
                  }
                >
                  {["unspecified", "child", "teen", "adult", "older adult"].map(
                    (x) => (
                      <option key={x}>{x}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Presentation
                <select
                  value={castEdit.presentation}
                  onChange={(e) =>
                    setCastEdit({ ...castEdit, presentation: e.target.value })
                  }
                >
                  {["unspecified", "masculine", "feminine", "androgynous"].map(
                    (x) => (
                      <option key={x}>{x}</option>
                    ),
                  )}
                </select>
              </label>
            </div>
            <label>
              Appearance notes
              <textarea
                maxLength={300}
                value={castEdit.appearance}
                onChange={(e) =>
                  setCastEdit({ ...castEdit, appearance: e.target.value })
                }
              />
            </label>
            <p className="privacy-note">
              Choose the voice that fits your interpretation. Visual matches and
              inferred attributes are suggestions you can always change.
            </p>
            {castEdit.id !== "NEW" && castEdit.id !== "NARRATOR" && (
              <div className="merge-controls">
                <label>
                  Same character as…
                  <select
                    aria-label="Merge into character"
                    value={mergeTarget}
                    onChange={(e) => setMergeTarget(e.target.value)}
                  >
                    <option value="">Choose an existing identity</option>
                    {book?.characters
                      .filter((c) => c.id !== castEdit.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · {c.id}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="button full"
                  disabled={!mergeTarget || saving}
                  onClick={mergeCharacter}
                >
                  Merge character across all pages
                </button>
                <p className="privacy-note">
                  All dialogue moves to the selected identity and keeps that
                  identity’s voice.
                </p>
              </div>
            )}
            <button className="button primary full" disabled={saving}>
              {saving ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Check size={17} />
              )}{" "}
              Save character
            </button>
          </form>
        </Modal>
      )}
      {lineEdit && book && (
        <Modal title="Make every word count." onClose={() => setLineEdit(null)}>
          <form className="edit-form" onSubmit={saveLine}>
            <label>
              Dialogue
              <textarea
                required
                maxLength={1500}
                rows={4}
                value={lineEdit.text}
                onChange={(e) =>
                  setLineEdit({ ...lineEdit, text: e.target.value })
                }
              />
            </label>
            <label>
              Who’s speaking?
              <select
                value={lineEdit.character}
                onChange={(e) =>
                  setLineEdit({ ...lineEdit, character: e.target.value })
                }
              >
                {book.characters.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name} · {c.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Emotion
              <select
                value={lineEdit.emotion}
                onChange={(e) =>
                  setLineEdit({ ...lineEdit, emotion: e.target.value })
                }
              >
                {emotionNames.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <button className="button primary full" disabled={saving}>
              <Check size={17} /> Save dialogue
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

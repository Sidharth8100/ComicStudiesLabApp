import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Headphones,
  Layers3,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Volume2,
} from "lucide-react";
import BookSculpture from "./BookSculpture";
import { api, media } from "../api";
import type { Book } from "../api";
import "./showcase.css";

type Props = {
  onImport: () => void;
  onExplore: () => void;
  onPreferences: () => void;
  onNavigate: (nav: string) => void;
  busy: boolean;
  reducedMotion: boolean;
};
const cast = [
  {
    id: "CHAR-01",
    name: "Nova",
    letter: "N",
    descriptor: "The courage to begin again.",
    line: "The city forgot how to dream.",
    color: "#f0b58c",
    image: "./nova-portrait.svg",
    tone: "Warm. Reflective. Unmistakably Nova.",
  },
  {
    id: "CHAR-02",
    name: "Echo",
    letter: "E",
    descriptor: "A small friend. A very big heart.",
    line: "One small light can change everything!",
    color: "#bfd6c4",
    image: "./echo-portrait.svg",
    tone: "Bright. Curious. A little electric.",
  },
  {
    id: "NARRATOR",
    name: "Narrator",
    letter: "P",
    descriptor: "The voice between the panels.",
    line: "Some stories begin at the end.",
    color: "#d1c6e4",
    image: "./comic-0.svg",
    tone: "Measured. Grounded. Always with you.",
  },
];

function useScrollScenes(
  root: React.RefObject<HTMLDivElement | null>,
  reduced: boolean,
) {
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const calm = reduced || query.matches;
      node
        .querySelectorAll<HTMLElement>("[data-scroll-scene]")
        .forEach((scene) => {
          const r = scene.getBoundingClientRect();
          const progress = calm
            ? 0.5
            : Math.max(
                0,
                Math.min(1, (innerHeight - r.top) / (innerHeight + r.height)),
              );
          scene.style.setProperty("--scene-progress", progress.toFixed(4));
        });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const reveal = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("sc-revealed");
            reveal.unobserve(entry.target);
          }
        }),
      { threshold: 0.08 },
    );
    node.querySelectorAll("[data-reveal]").forEach((el) => reveal.observe(el));
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    query.addEventListener("change", schedule);
    update();
    return () => {
      reveal.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      query.removeEventListener("change", schedule);
    };
  }, [root, reduced]);
}

function VoiceStudio() {
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Choose a character. Hear their world.");
  const sound = useRef<HTMLAudioElement | null>(null);
  const url = useRef("");
  const sequence = useRef(0);
  const browserSpeech = useRef(false);
  const stop = () => {
    sequence.current++;
    sound.current?.pause();
    sound.current = null;
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = "";
    if (browserSpeech.current) window.speechSynthesis?.cancel();
    browserSpeech.current = false;
    setPlaying(false);
    setLoading(false);
  };
  useEffect(
    () => () => {
      sequence.current++;
      sound.current?.pause();
      if (url.current) URL.revokeObjectURL(url.current);
      if (browserSpeech.current) window.speechSynthesis?.cancel();
    },
    [],
  );
  async function preview() {
    if (playing || loading) {
      stop();
      setStatus("Preview paused.");
      return;
    }
    const current = ++sequence.current;
    const character = cast[selected];
    setLoading(true);
    setStatus(`Preparing ${character.name}’s voice…`);
    try {
      const book = await api<Book>("/demo", { method: "POST" });
      const line = book.pages
        .flatMap((p) => p.lines)
        .find((l) => l.character === character.id);
      if (!line)
        throw Error(
          "This sample character was merged. Open the story to review your cast.",
        );
      const objectUrl = await media(`/books/${book.id}/speech/${line.id}`);
      if (current !== sequence.current) {
        URL.revokeObjectURL(objectUrl);
        return;
      }
      url.current = objectUrl;
      const audio = new Audio(objectUrl);
      sound.current = audio;
      audio.onended = () => {
        if (current === sequence.current) {
          stop();
          setStatus("Another voice. The same story.");
        }
      };
      audio.onerror = () => {
        if (current === sequence.current) {
          stop();
          setStatus("This voice could not be played. Try the reader.");
        }
      };
      await audio.play();
      if (current === sequence.current) {
        setPlaying(true);
        setLoading(false);
        setStatus(`Playing ${character.name}’s sample narration.`);
      }
    } catch (error) {
      if (current !== sequence.current) return;
      if (
        "speechSynthesis" in window &&
        !(error instanceof Error && error.message.includes("merged"))
      ) {
        const speech = new SpeechSynthesisUtterance(character.line);
        const voices = speechSynthesis
          .getVoices()
          .filter((v) => v.lang.startsWith("en"));
        if (voices.length) speech.voice = voices[selected % voices.length];
        speech.pitch = selected === 0 ? 1.1 : selected === 1 ? 1.35 : 0.85;
        speech.onend = () => {
          if (current === sequence.current) {
            stop();
            setStatus("Browser voice preview finished.");
          }
        };
        speech.onerror = () => {
          if (current === sequence.current) {
            stop();
            setStatus(
              "Preview unavailable. Open the sample to explore the cast.",
            );
          }
        };
        browserSpeech.current = true;
        speechSynthesis.speak(speech);
        setLoading(false);
        setPlaying(true);
        setStatus("Playing a browser voice preview.");
      } else {
        setLoading(false);
        setStatus(
          error instanceof Error
            ? error.message
            : "Preview unavailable. Please try again.",
        );
      }
    }
  }
  const c = cast[selected];
  return (
    <div className="sc-voice-console" data-reveal>
      <div
        className="sc-cast-selector"
        role="tablist"
        aria-label="Preview a character voice"
      >
        {cast.map((person, i) => (
          <button
            role="tab"
            aria-selected={i === selected}
            aria-controls="voice-preview-panel"
            id={`voice-tab-${i}`}
            key={person.id}
            onClick={() => {
              stop();
              setSelected(i);
              setStatus(`Ready to hear ${person.name}.`);
            }}
          >
            <span style={{ background: person.color }}>{person.letter}</span>
            {person.name}
            <i>{i === selected ? "SELECTED" : "HEAR THEIR VOICE"}</i>
            {i === selected && <Check size={14} />}
          </button>
        ))}
      </div>
      <div
        className="sc-voice-performance"
        role="tabpanel"
        id="voice-preview-panel"
        aria-labelledby={`voice-tab-${selected}`}
      >
        <div
          className="sc-portrait-window"
          style={{ "--cast-color": c.color } as React.CSSProperties}
        >
          <span className="sc-portrait-halo" />
          <img
            src={c.image}
            alt={
              c.name === "Narrator"
                ? "After the Light original comic cover"
                : `${c.name}, an original comic character`
            }
          />
          <span className="sc-character-code">
            {c.id} <span>ONE VOICE. EVERY PAGE.</span>
          </span>
        </div>
        <div className="sc-voice-caption">
          <span className="sc-kicker">
            {c.name.toUpperCase()} / {c.descriptor}
          </span>
          <blockquote>“{c.line}”</blockquote>
          <p>{c.tone}</p>
          <div className={`sc-listen-row ${playing ? "is-playing" : ""}`}>
            <button
              onClick={preview}
              className="sc-audio-button"
              aria-label={
                loading
                  ? "Cancel voice preview"
                  : playing
                    ? "Pause voice preview"
                    : `Preview ${c.name} voice`
              }
            >
              {loading ? (
                <LoaderCircle size={19} className="spin" />
              ) : playing ? (
                <Pause size={18} fill="currentColor" />
              ) : (
                <Play size={18} fill="currentColor" />
              )}
            </button>
            <div className="sc-waveform" aria-hidden="true">
              {Array.from({ length: 38 }, (_, i) => (
                <i
                  key={i}
                  style={
                    {
                      "--bar-height": `${9 + ((i * 17 + 11) % 32)}px`,
                      "--bar-delay": `${(i % 7) * -0.13}s`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
            <Volume2 size={17} />
          </div>
          <p className="sc-preview-status" role="status">
            {status}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Showcase({
  onImport,
  onExplore,
  onPreferences,
  onNavigate,
  busy,
  reducedMotion,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [experience, setExperience] = useState<"pages" | "voices" | "focus">(
    "pages",
  );
  useScrollScenes(root, reducedMotion);
  return (
    <div
      className={`sc-experience ${reducedMotion ? "sc-calm" : ""}`}
      ref={root}
    >
      <header className="sc-header">
        <a className="sc-wordmark" href="#main" aria-label="Panel home">
          <BookOpen size={24} strokeWidth={1.6} />
          panel<span>®</span>
        </a>
        <nav aria-label="Main navigation">
          <button
            aria-current="page"
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: reducedMotion ? "instant" : "smooth",
              })
            }
          >
            Discover
          </button>
          <button onClick={() => onNavigate("My library")}>Your library</button>
          <button onClick={() => onNavigate("Bookmarks")}>Bookmarks</button>
        </nav>
        <div className="sc-header-tools">
          <button
            className="sc-icon"
            aria-label="Search your library"
            onClick={() => onNavigate("My library")}
          >
            <Search size={18} />
          </button>
          <button
            className="sc-icon"
            aria-label="Reading preferences"
            onClick={onPreferences}
          >
            <Settings2 size={18} />
          </button>
          <button className="sc-header-import" onClick={onImport}>
            Import PDF <Plus size={15} />
          </button>
        </div>
      </header>
      <section className="sc-hero" data-scroll-scene aria-labelledby="sc-title">
        <div className="sc-hero-orb" aria-hidden="true" />
        <div className="sc-hero-orbit" aria-hidden="true" />
        <div className="sc-hero-heading">
          <span className="sc-kicker">
            <span className="sc-live-dot" /> THE NEXT DIMENSION OF COMICS
          </span>
          <h1 id="sc-title">
            Every panel.
            <br />
            <span>
              A whole new <em>world.</em>
            </span>
          </h1>
          <p>Your stories have never felt so alive.</p>
        </div>
        <div className="sc-product-stage">
          <div className="sc-side-note sc-note-left">
            <span className="sc-note-index">01 / FEEL THE STORY</span>
            <h2>
              A page.
              <br />
              With presence.
            </h2>
            <p>
              Paper-like turns.
              <br />
              Entirely new possibilities.
            </p>
            <span className="sc-fine-rule" />
          </div>
          <BookSculpture reducedMotion={reducedMotion} />
          <div className="sc-side-note sc-note-right">
            <span className="sc-note-index">02 / HEAR THE CHARACTERS</span>
            <span className="sc-floating-voice">
              <span className="sc-dot-wave">
                <i />
                <i />
                <i />
                <i />
              </span>{" "}
              A voice of their own.
            </span>
            <p>
              Distinct characters.
              <br />A consistent voice.
              <br />A more human story.
            </p>
            <span className="sc-issue-stamp">
              PANEL ORIGINAL
              <br />
              <strong>001</strong>
              <span>AFTER THE LIGHT</span>
            </span>
          </div>
        </div>
        <div className="sc-hero-bottom">
          <div className="sc-hero-actions">
            <button className="sc-button sc-button-dark" onClick={onImport}>
              Import your comic <Plus size={17} />
            </button>
            <button
              className="sc-text-link"
              onClick={onExplore}
              disabled={busy}
            >
              Explore a story{" "}
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <ArrowUpRight size={17} />
              )}
            </button>
          </div>
          <div className="sc-hero-meta">
            <span>YOUR PDF. A NEW PERSPECTIVE.</span>
            <span>NO PAID SPEECH API. JUST POSSIBILITY.</span>
          </div>
          <a
            className="sc-scroll-cue"
            href="#the-experience"
            aria-label="Discover the reading experience"
          >
            <ArrowDown size={16} />
            <span>THERE’S MORE BELOW</span>
          </a>
        </div>
      </section>
      <section className="sc-manifesto" id="the-experience" data-reveal>
        <span className="sc-kicker">LESS INTERFACE. MORE IMMERSION.</span>
        <h2>
          Some stories are read.
          <br />
          <span>
            Others are <em>experienced.</em>
          </span>
        </h2>
        <p>
          We made room for both. Bring a comic you love.
          <br />
          Rediscover everything that made you love it.
        </p>
      </section>
      <section
        className={`sc-features sc-feature-${experience}`}
        aria-label="Explore the reader features"
        data-scroll-scene
      >
        <div className="sc-feature-heading" data-reveal>
          <div>
            <span className="sc-kicker">BUILT AROUND THE STORY</span>
            <h2>
              A familiar feeling.
              <br />
              An entirely new dimension.
            </h2>
          </div>
          <div
            className="sc-feature-tabs"
            role="tablist"
            aria-label="Reader experience"
          >
            {(
              [
                ["pages", "Feel the page", BookOpen],
                ["voices", "Hear the cast", Headphones],
                ["focus", "Find your focus", Layers3],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                role="tab"
                id={`experience-tab-${id}`}
                aria-controls="experience-panel"
                aria-selected={experience === id}
                onClick={() => setExperience(id)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div
          className="sc-feature-stage"
          id="experience-panel"
          role="tabpanel"
          aria-labelledby={`experience-tab-${experience}`}
        >
          <span className="sc-stage-grid" aria-hidden="true" />
          <div className="sc-spread" aria-hidden="true">
            <div className="sc-spread-left">
              <img src="./comic-1.svg" alt="" />
            </div>
            <div className="sc-spread-right">
              <img src="./comic-2.svg" alt="" />
            </div>
            <div className="sc-spread-shadow" />
          </div>
          <div
            className="sc-floating-caption sc-caption-one"
            aria-hidden="true"
          >
            <span className="sc-caption-icon">
              <BookOpen size={15} />
            </span>
            <span>
              {experience === "pages"
                ? "A little paper. A little magic."
                : experience === "voices"
                  ? "Nova · a voice that stays with her"
                  : "The world can wait."}
              <small>
                {experience === "pages"
                  ? "DRAG. TURN. GET LOST."
                  : experience === "voices"
                    ? "ONE CHARACTER. EVERY PAGE."
                    : "JUST YOU AND THE STORY."}
              </small>
            </span>
          </div>
          <div
            className="sc-floating-caption sc-caption-two"
            aria-hidden="true"
          >
            <span className="sc-mini-pulse" />
            <span>
              {experience === "pages"
                ? "Your next chapter awaits."
                : experience === "voices"
                  ? "A little hope. A little wonder."
                  : "A quieter kind of immersive."}
            </span>
          </div>
          <div className="sc-feature-copy">
            <span className="sc-kicker">
              {experience === "pages"
                ? "THE ART OF TURNING A PAGE"
                : experience === "voices"
                  ? "A CAST, NOT JUST A VOICE"
                  : "LESS DISTRACTION. MORE DISCOVERY."}
            </span>
            <h3>
              {experience === "pages" ? (
                <>
                  It feels like
                  <br />a real page.<em>Because that matters.</em>
                </>
              ) : experience === "voices" ? (
                <>
                  Same character.
                  <br />
                  Same voice.<em>A new way to feel.</em>
                </>
              ) : (
                <>
                  One story.
                  <br />
                  Your whole attention.<em>Find your flow.</em>
                </>
              )}
            </h3>
            <p>
              {experience === "pages"
                ? "Lift a corner. Watch the paper follow. A familiar, tactile rhythm, right in your browser."
                : experience === "voices"
                  ? "Recurring characters keep their voices across the comic. Sentiment shapes the expression. You keep the final say."
                  : "Hide the controls. Open a single page. Choose a reading atmosphere that lets everything else fall away."}
            </p>
            <button
              className="sc-text-link"
              onClick={onExplore}
              disabled={busy}
            >
              Step inside the reader <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <div className="sc-feature-footnotes">
          <span>
            <Check size={13} /> Real page turns
          </span>
          <span>
            <Check size={13} /> Keyboard & touch
          </span>
          <span>
            <Check size={13} /> Pick up where you left off
          </span>
        </div>
      </section>
      <section className="sc-voices" aria-labelledby="sc-voices-title">
        <div className="sc-section-intro" data-reveal>
          <span className="sc-kicker">MEET THE VOICES BETWEEN THE LINES</span>
          <h2 id="sc-voices-title">
            You know their faces.
            <br />
            <em>Now meet their voices.</em>
          </h2>
          <p>
            A different voice for every character. A little more feeling in
            every line.
            <br />
            Local, open-source speech. No paid speech service required.
          </p>
        </div>
        <VoiceStudio />
        <div className="sc-voice-stats" data-reveal>
          <div>
            <strong>
              28<span> voices</span>
            </strong>
            <p>A whole cast of possibilities.</p>
          </div>
          <div>
            <strong>
              13<span> expressions</span>
            </strong>
            <p>Sentiment-driven pace, pitch and feeling.</p>
          </div>
          <div>
            <strong>
              One<span> identity</span>
            </strong>
            <p>Their voice stays theirs, page after page.</p>
          </div>
        </div>
        <p className="sc-honest-note">
          Casting and age/presentation cues are suggestions. Review the matches,
          edit a voice, or merge identities in the reader.
        </p>
      </section>
      <section className="sc-access" data-scroll-scene>
        <div className="sc-access-copy" data-reveal>
          <span className="sc-kicker">DESIGNED TO INVITE EVERYONE IN</span>
          <h2>
            There’s no one
            <br />
            way to <em>read.</em>
          </h2>
          <p>
            So we didn’t build one. Larger words. More breathing room. A
            different atmosphere. A voice to follow. Make your reading space
            feel like yours.
          </p>
          <button className="sc-button sc-button-light" onClick={onPreferences}>
            Find your reading mode <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="sc-reading-stack" aria-hidden="true">
          <div className="sc-mode-card sc-mode-paper">
            <span>PAPER / THE ORIGINAL FEELING</span>
            <p>
              A small light
              <br />
              can change
              <br />
              <em>everything.</em>
            </p>
            <i>A STORY THAT MAKES ROOM FOR YOU.</i>
          </div>
          <div className="sc-mode-card sc-mode-night">
            <span>MIDNIGHT / AFTER HOURS</span>
            <p>
              The world
              <br />
              gets quiet.
              <br />
              <em>The story stays.</em>
            </p>
          </div>
          <div className="sc-mode-card sc-mode-contrast">
            <span>HIGH CONTRAST / EVERY WORD, CLEAR</span>
            <p>
              Room for
              <br />
              <em>every reader.</em>
            </p>
          </div>
        </div>
        <div className="sc-access-foot">
          <span>
            <Check size={13} /> Screen-reader transcript
          </span>
          <span>
            <Check size={13} /> Reduced-motion mode
          </span>
          <span>
            <Check size={13} /> Larger text & spacing
          </span>
        </div>
      </section>
      <section className="sc-finale" data-reveal>
        <span className="sc-kicker">YOUR NEXT CHAPTER STARTS WITH A PDF</span>
        <h2>
          A whole world.
          <br />
          <em>Waiting in your files.</em>
        </h2>
        <div>
          <button className="sc-button sc-button-dark" onClick={onImport}>
            Bring your own story <Plus size={17} />
          </button>
          <button className="sc-text-link" onClick={onExplore} disabled={busy}>
            Open the sample <ArrowUpRight size={16} />
          </button>
        </div>
        <p>PDF · Up to 40 MB · Up to 100 pages</p>
        <span className="sc-finale-spark" aria-hidden="true">
          ✳
        </span>
      </section>
    </div>
  );
}

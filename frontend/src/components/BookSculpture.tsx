import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";

type Props = { reducedMotion: boolean };

/** A real, locally textured WebGL book. No models, trackers or remote assets. */
export default function BookSculpture({ reducedMotion }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<(action: "left" | "right" | "reset") => void>(
    () => {},
  );
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const reduced = useRef(reducedMotion);
  reduced.current = reducedMotion;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let failed = false;
    let cleanup = () => {};
    // Keep the reading interface free of the WebGL bundle and GPU work.
    const load = async () => {
      try {
        const T = await import("three");
        if (disposed) return;
        const renderer = new T.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.45;
        renderer.domElement.setAttribute("aria-hidden", "true");
        element.appendChild(renderer.domElement);
        cleanup = () => {
          renderer.dispose();
          renderer.domElement.remove();
        };
        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(32, 1, 0.1, 40);
        camera.position.set(0, 0.22, 6.15);
        camera.lookAt(0, 0.12, 0);
        scene.add(new T.HemisphereLight(0xfffaf1, 0x777569, 3.1));
        const key = new T.DirectionalLight(0xfff1dc, 4.2);
        key.position.set(-3, 5, 5);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.left = -4;
        key.shadow.camera.right = 4;
        key.shadow.camera.top = 4;
        key.shadow.camera.bottom = -4;
        key.shadow.normalBias = 0.035;
        scene.add(key);
        const rim = new T.DirectionalLight(0xdcd1ff, 2);
        rim.position.set(4, 1, -2);
        scene.add(rim);
        const book = new T.Group();
        scene.add(book);
        const paper = new T.MeshStandardMaterial({
          color: 0xfff7e8,
          roughness: 0.9,
        });
        const linen = new T.MeshStandardMaterial({
          color: 0x152c2c,
          roughness: 0.76,
        });
        const pageBody = new T.Mesh(new T.BoxGeometry(1.76, 2.36, 0.16), paper);
        pageBody.castShadow = true;
        book.add(pageBody);
        const lineMaterial = new T.MeshStandardMaterial({
          color: 0xc5bba6,
          roughness: 0.9,
        });
        for (let i = 0; i < 15; i++) {
          const line = new T.Mesh(
            new T.BoxGeometry(1.756, 0.003, 0.002),
            lineMaterial,
          );
          line.position.set(0.008, -1.15 + i * 0.158, 0.081);
          book.add(line);
          const edge = new T.Mesh(
            new T.BoxGeometry(0.002, 2.33, 0.002),
            lineMaterial,
          );
          edge.position.set(0.882, 0, -0.071 + i * 0.01);
          book.add(edge);
        }
        const back = new T.Mesh(new T.BoxGeometry(1.83, 2.43, 0.035), linen);
        back.position.z = -0.108;
        back.castShadow = true;
        book.add(back);
        const spine = new T.Mesh(new T.BoxGeometry(0.045, 2.43, 0.23), linen);
        spine.position.x = -0.902;
        spine.castShadow = true;
        book.add(spine);
        const frontGroup = new T.Group();
        frontGroup.position.set(-0.908, 0, 0.105);
        book.add(frontGroup);
        const coverMat = new T.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.65,
        });
        const cover = new T.Mesh(new T.BoxGeometry(1.83, 2.43, 0.027), [
          linen,
          linen,
          linen,
          linen,
          coverMat,
          paper,
        ]);
        cover.position.x = 0.915;
        cover.castShadow = true;
        frontGroup.add(cover);
        const loader = new T.TextureLoader();
        const coverTexture = loader.load(
          "./comic-0.svg",
          () => {
            if (disposed || failed) return;
            coverTexture.colorSpace = T.SRGBColorSpace;
            coverTexture.anisotropy = Math.min(
              8,
              renderer.capabilities.getMaxAnisotropy(),
            );
            coverMat.map = coverTexture;
            coverMat.needsUpdate = true;
            setReady(true);
            draw();
          },
          undefined,
          () => {
            if (!disposed) {
              failed = true;
              if (frame) cancelAnimationFrame(frame);
              setFallback(true);
              setReady(false);
            }
          },
        );
        const backCanvas = document.createElement("canvas");
        backCanvas.width = 600;
        backCanvas.height = 800;
        const ctx = backCanvas.getContext("2d")!;
        ctx.fillStyle = "#172f2c";
        ctx.fillRect(0, 0, 600, 800);
        ctx.fillStyle = "#d6e4b3";
        ctx.font = "24px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("P A N E L   O R I G I N A L", 300, 100);
        ctx.font = "italic 54px Georgia";
        ctx.fillStyle = "#fff1db";
        ["Some stories", "begin at", "the end."].forEach((s, i) =>
          ctx.fillText(s, 300, 340 + i * 70),
        );
        ctx.font = "17px sans-serif";
        ctx.fillText("AFTER THE LIGHT / ISSUE 001", 300, 710);
        const backTexture = new T.CanvasTexture(backCanvas);
        backTexture.colorSpace = T.SRGBColorSpace;
        const backFace = new T.Mesh(
          new T.PlaneGeometry(1.82, 2.42),
          new T.MeshStandardMaterial({ map: backTexture, roughness: 0.8 }),
        );
        backFace.position.z = -0.127;
        backFace.rotation.y = Math.PI;
        book.add(backFace);
        const ground = new T.Mesh(
          new T.PlaneGeometry(15, 15),
          new T.ShadowMaterial({ opacity: 0.18 }),
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -1.53;
        ground.receiveShadow = true;
        scene.add(ground);
        let yaw = -0.34,
          pitch = -0.12,
          targetYaw = yaw,
          targetPitch = pitch;
        let frame = 0,
          active = true,
          dragging = false,
          downX = 0,
          downY = 0,
          startYaw = 0,
          startPitch = 0;
        let scroll = 0,
          lastTime = 0;
        const prefersReduced = () =>
          reduced.current ||
          matchMedia("(prefers-reduced-motion: reduce)").matches;
        function draw(time = 0) {
          if (disposed || failed) return;
          const calm = prefersReduced();
          yaw += (targetYaw - yaw) * (calm ? 1 : 0.09);
          pitch += (targetPitch - pitch) * (calm ? 1 : 0.09);
          book.rotation.set(
            pitch + (calm ? 0 : Math.sin(time * 0.00045) * 0.025),
            yaw +
              (calm || dragging ? 0 : Math.sin(time * 0.0003) * 0.035) +
              scroll * 0.12,
            -0.065,
          );
          book.position.y = calm
            ? 0.06
            : 0.06 + Math.sin(time * 0.00075) * 0.055;
          frontGroup.rotation.y = calm
            ? -0.015
            : -0.025 - Math.sin(time * 0.0006) * 0.012;
          renderer.render(scene, camera);
          lastTime = time;
        }
        const animate = (time: number) => {
          frame = 0;
          if (disposed || failed || !active || document.hidden) return;
          draw(time);
          if (
            !prefersReduced() ||
            Math.abs(yaw - targetYaw) > 0.002 ||
            Math.abs(pitch - targetPitch) > 0.002
          )
            frame = requestAnimationFrame(animate);
        };
        const wake = () => {
          if (!frame && !failed && active && !document.hidden)
            frame = requestAnimationFrame(animate);
        };
        const resize = new ResizeObserver(() => {
          const w = element.clientWidth,
            h = element.clientHeight;
          if (!w || !h) return;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          draw(lastTime);
          wake();
        });
        resize.observe(element);
        const visible = new IntersectionObserver(
          ([entry]) => {
            active = entry.isIntersecting;
            if (active) wake();
            else if (frame) {
              cancelAnimationFrame(frame);
              frame = 0;
            }
          },
          { threshold: 0.02 },
        );
        visible.observe(element);
        const visibility = () => {
          if (document.hidden && frame) {
            cancelAnimationFrame(frame);
            frame = 0;
          } else wake();
        };
        document.addEventListener("visibilitychange", visibility);
        const contextLost = (event: Event) => {
          event.preventDefault();
          failed = true;
          if (frame) cancelAnimationFrame(frame);
          frame = 0;
          setReady(false);
          setFallback(true);
        };
        renderer.domElement.addEventListener("webglcontextlost", contextLost);
        const scrollHandler = () => {
          scroll = Math.max(
            0,
            Math.min(1, -element.getBoundingClientRect().top / innerHeight),
          );
          wake();
        };
        window.addEventListener("scroll", scrollHandler, { passive: true });
        const down = (e: PointerEvent) => {
          dragging = true;
          downX = e.clientX;
          downY = e.clientY;
          startYaw = targetYaw;
          startPitch = targetPitch;
          element.setPointerCapture(e.pointerId);
          element.classList.add("is-grabbing");
          wake();
        };
        const move = (e: PointerEvent) => {
          if (dragging) {
            targetYaw = startYaw + (e.clientX - downX) * 0.008;
            targetPitch = Math.max(
              -0.45,
              Math.min(0.45, startPitch + (e.clientY - downY) * 0.004),
            );
          } else if (e.pointerType === "mouse" && !prefersReduced()) {
            const r = element.getBoundingClientRect();
            targetPitch = -0.12 + ((e.clientY - r.top) / r.height - 0.5) * 0.1;
          }
          wake();
        };
        const up = () => {
          dragging = false;
          element.classList.remove("is-grabbing");
        };
        const lost = () => {
          up();
          targetPitch = -0.12;
          wake();
        };
        element.addEventListener("pointerdown", down);
        element.addEventListener("pointermove", move);
        element.addEventListener("pointerup", up);
        element.addEventListener("pointercancel", lost);
        element.addEventListener("pointerleave", lost);
        const motionChange = () => {
          if (prefersReduced() && frame) {
            cancelAnimationFrame(frame);
            frame = 0;
            draw();
          } else wake();
        };
        const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
        motionQuery.addEventListener("change", motionChange);
        controls.current = (action) => {
          targetYaw =
            action === "reset"
              ? -0.34
              : targetYaw + (action === "left" ? -0.55 : 0.55);
          targetPitch = -0.12;
          setAnnouncement(
            action === "reset" ? "Book view reset" : `Book rotated ${action}`,
          );
          wake();
        };
        cleanup = () => {
          cancelAnimationFrame(frame);
          resize.disconnect();
          visible.disconnect();
          document.removeEventListener("visibilitychange", visibility);
          window.removeEventListener("scroll", scrollHandler);
          motionQuery.removeEventListener("change", motionChange);
          element.removeEventListener("pointerdown", down);
          element.removeEventListener("pointermove", move);
          element.removeEventListener("pointerup", up);
          element.removeEventListener("pointercancel", lost);
          element.removeEventListener("pointerleave", lost);
          coverTexture.dispose();
          backTexture.dispose();
          scene.traverse((object) => {
            if (object instanceof T.Mesh) {
              object.geometry.dispose();
              const materials = Array.isArray(object.material)
                ? object.material
                : [object.material];
              materials.forEach((m) => m.dispose());
            }
          });
          renderer.domElement.removeEventListener(
            "webglcontextlost",
            contextLost,
          );
          renderer.dispose();
          renderer.domElement.remove();
          controls.current = () => {};
        };
        wake();
      } catch {
        failed = true;
        cleanup();
        if (!disposed) setFallback(true);
      }
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          void load();
        }
      },
      { rootMargin: "150px" },
    );
    observer.observe(element);
    return () => {
      disposed = true;
      observer.disconnect();
      cleanup();
    };
  }, []);

  useEffect(() => {
    controls.current("reset");
  }, [reducedMotion]);
  const fallbackAngle = useRef(0);
  const act = (action: "left" | "right" | "reset") => {
    if (!fallback) controls.current(action);
    else {
      fallbackAngle.current =
        action === "reset"
          ? 0
          : fallbackAngle.current + (action === "left" ? -25 : 25);
      host.current?.style.setProperty(
        "--fallback-angle",
        `${fallbackAngle.current}deg`,
      );
      setAnnouncement(
        action === "reset" ? "Book view reset" : `Book rotated ${action}`,
      );
    }
  };
  return (
    <div
      className={`sc-sculpture ${ready && !fallback ? "is-ready" : ""} ${fallback ? "is-fallback" : ""}`}
    >
      <div
        className="sc-book-stage"
        ref={host}
        aria-label="Interactive three-dimensional comic book"
        role="img"
        aria-describedby="sc-book-instructions"
      >
        <div className="hero-book sc-book-poster">
          <img
            src="./comic-0.svg"
            alt="After the Light comic cover, Nova and Echo overlooking a sunset city"
          />
          <span className="sc-fallback-pages" />
        </div>
      </div>
      <div className="sc-sculpture-bottom">
        <span id="sc-book-instructions">
          {fallback
            ? "A new perspective on your story"
            : "Drag to discover another side"}
        </span>
        <div className="sc-orbit-controls" aria-label="Book rotation controls">
          <button
            aria-label="Rotate book left"
            disabled={!ready && !fallback}
            onClick={() => act("left")}
          >
            <ArrowLeft size={15} />
          </button>
          <button
            aria-label="Reset book view"
            disabled={!ready && !fallback}
            onClick={() => act("reset")}
          >
            <RotateCcw size={13} />
          </button>
          <button
            aria-label="Rotate book right"
            disabled={!ready && !fallback}
            onClick={() => act("right")}
          >
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
      <span className="visually-hidden" role="status">
        {announcement}
      </span>
    </div>
  );
}

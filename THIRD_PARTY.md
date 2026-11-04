# Credits and design references

Panel's application interface, generated sample story and illustrations were created for this repository. The original research notebooks remain unchanged and retain their original authorship.

- Realistic page turns use [StPageFlip](https://github.com/Nodlik/StPageFlip), MIT. Its README and documented canvas API were reviewed during implementation. No third-party reader interface was copied.
- [Three.js](https://threejs.org/) (MIT) renders the custom 3D discovery book. Its geometry, textures and original character portraits are generated from this repository's authored sample artwork; no external model or product-page assets are included.
- React, Vite, Lucide icons, DM Sans and Manrope provide the interface foundations. Font files are self-hosted through Fontsource; font licenses are included in those packages (SIL Open Font License).
- [Kokoro ONNX](https://github.com/thewh1teagle/kokoro-onnx) provides the local neural speech runtime. Runtime license: MIT. Kokoro model: Apache 2.0. Model files come from the upstream official release, with pinned SHA-256 digests in scripts/models.json. The upstream voices are synthetic presets, not voice clones of uploaded characters.
- eSpeak NG (GPL-3.0-or-later) is the optional subprocess fallback. FFmpeg distribution licenses depend on the platform build; neither executable is vendored in this source repository.
- PyMuPDF is AGPL/commercial dual licensed. The default Docker stack includes the open-source AGPL edition. Review its license before redistributing this application or using it in a proprietary service. No proprietary license is supplied by this repository.
- EasyOCR, OpenCV, NumPy, CairoSVG and ONNX Runtime support local extraction, rendering and inference. See their respective distribution licenses.

The science-fiction sample "After the Light" is an original four-page demonstration, not a third-party comic. Do not upload comics you do not have permission to process or distribute.

- [OpenCLIP](https://github.com/mlfoundations/open_clip) (MIT) supplies local image/text embeddings. The official LAION-400M ViT-B/32 QuickGELU checkpoint is fetched from the upstream GitHub release and checked against its pinned SHA-256 digest. It is used for fictional-character appearance matching and editable voice-design suggestions, not identification of real people.
- [VADER sentiment](https://github.com/cjhutto/vaderSentiment) (MIT) supplies the bundled offline sentiment lexicon. Additional transparent affect cues map sentiment to the app's prosody controls.

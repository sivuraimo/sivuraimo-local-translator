# Sivuraimo Local Translator

Chrome/Chromium extension for translating and working with selected text through a local LM Studio server.

The extension sends selected text or screenshots to a local OpenAI-compatible endpoint, so no cloud API key is required.

## Features

- Translate selected text on any regular web page.
- Explain selected text in simple words.
- Summarize longer selected text.
- Ask follow-up questions in the result popup.
- Copy the answer or export it as a Markdown file.
- Translate visible text from images via the image context menu.
- Capture an area of the page and extract, translate, or ask a custom question about it.
- Configure LM Studio port and target language from the extension popup.

## Requirements

- Google Chrome or another Chromium-based browser.
- [LM Studio](https://lmstudio.ai/) with Local Server enabled.
- A local model loaded in LM Studio. Current configured model: `qwen/qwen3.5-9b`.
- For image translation and screenshot analysis, use a vision-capable model.

Default endpoint:

```text
http://127.0.0.1:1234/v1/chat/completions
```

## Installation

1. Clone or download this repository.
2. Open `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select this project folder.
6. Open LM Studio, go to `Local Server`, load a model, and click `Start`.

## Usage

1. Select text on a page.
2. Click `Translate`, `Explain`, or `Summarize`.
3. Use the popup to copy, export, resize, move, or ask follow-up questions.

For images:

1. Right-click an image.
2. Choose `Translate image`.

For screen capture:

1. Click the extension icon.
2. Click `Capture area`.
3. Select an area on the page.
4. Choose `Translate`, `Extract text`, or `Custom prompt`.

## Settings

Click the extension icon to configure:

- `LM Studio port`: default is `1234`.
- `Target language`: Russian, Ukrainian, English, German, French, or Spanish.

## Permissions

The extension uses:

- `activeTab`, `tabs`, and `scripting` to inject the content script when needed.
- `storage` to save the LM Studio port and target language.
- `contextMenus` to add image translation from the right-click menu.
- `<all_urls>` because the content UI works on pages where the user selects text or captures an area.
- `localhost` and `127.0.0.1` to call the local LM Studio server.

## Development

This project has no build step. Edit the files directly and reload the unpacked extension in `chrome://extensions`.

Main files:

- `manifest.json`: extension manifest.
- `background.js`: LM Studio requests, streaming responses, context menu, screenshot capture.
- `content.js`: page UI, text selection, popup, chat, capture overlay.
- `content.css`: injected UI styles.
- `popup.html` and `popup.js`: extension popup settings and capture entry point.

## Notes

- The extension expects an OpenAI-compatible chat completions API exposed by LM Studio.
- The model name is currently hardcoded in `background.js` as `qwen/qwen3.5-9b`.
- Some browser pages such as `chrome://extensions` do not allow content script injection.
- Image translation requires a model that supports image input.

## License

MIT

# Handy Actions — Chrome Extension

Visual web automation and custom on-page action buttons managed from Chrome's Side Panel.

## Features

- **Visual Element Picker**: Click **Pick Element** in the side panel, hover over any element on a webpage, and click to select it automatically.
- **Rich JS Actions**:
  - **Click**, **Double Click**, **Right Click**, **Hover**
  - **Fill Input (Instant)** (works with standard inputs, textareas, `contenteditable`, checkboxes/radios, and React/Vue controlled fields)
  - **Type Sequentially** (character-by-character typing with configurable `ms/char` speed and optional clear-first)
  - **Select Dropdown Option**, **Press Key** (with `Ctrl`/`Shift`/`Alt`/`Cmd` modifiers), **Clear Input**, **Focus**, **Scroll Into View**
  - **Wait (Delay)** & **Wait for Element**
- **Custom On-Page Buttons**:
  - Add buttons directly onto any webpage.
  - Choose where the button appears: **Near a picked webpage element** (`Before`, `After`, `Inside Start`, `Inside End`) or in a **Floating Corner** (`Top Left`, `Top Right`, `Bottom Left`, `Bottom Right`).
  - Assign either inline steps or a saved workflow to run when clicked.
- **Website & Wildcard URL Matching (`*` anywhere)**:
  - Use `*` anywhere in a URL pattern (e.g., `https://*.example.com/*/edit?tab=*`, `*://app.site.com/*`, or an exact URL).
  - Use 1-click presets (`Exact URL`, `Path /*`, `Whole Website *`, `All Subdomains *`, `Everywhere *`).
- **Side Panel Management**:
  - **Current Page** view for actions matching the active tab.
  - **All Sites** view to search, enable/disable, edit, or delete rules for any website.
  - **Export / Import** JSON backups.

## Install (Load Unpacked in Chrome)

1. Open `chrome://extensions` in Google Chrome.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select `/Users/amankrshah/Workspace/handy`.
4. Pin **Handy Actions** to your toolbar and click the extension icon to open the Side Panel.

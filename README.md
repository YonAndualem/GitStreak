# GitStreak 🚀

GitStreak is a sleek, ultra-fast Chrome extension and Next.js API that tracks your GitHub commit streaks directly from your browser. Keep your momentum going and never miss a day again!

## 🌟 Features
- **Real-Time Tracking:** Instantly pulls your GitHub contribution graph data using the GraphQL API.
- **Lightning Fast UI:** Uses optimistic UI caching and local storage for 0ms load times.
- **Smart Notifications:** An intelligent background worker monitors your streak and sends a native desktop notification at 8:00 PM if you haven't pushed code yet.
- **Dynamic Action Banner:** An animated dashboard in the popup dynamically tracks exactly how many hours you have left until your streak resets.
- **GitHub Native Theme:** Seamlessly clones GitHub's dark mode aesthetic, including a perfectly matching 365-day HTML/CSS native contribution heatmap.
- **Shareable Markdown:** Generates a dynamic SVG badge of your streak that you can instantly copy into your `README.md` with 1 click.

## 🛠️ Architecture
GitStreak is divided into two parts:
1. **The API (`/src/app/api/streak`)**: A Next.js serverless route that queries the GitHub GraphQL API, processes the rolling 365-day window, and serves both raw JSON arrays (for the extension) and a beautifully formatted SVG badge (for Markdown embeds).
2. **The Extension (`/extension`)**: A lightweight Chrome Extension built with pure vanilla JS (Manifest V3).

## 🚀 Installation (Local Development)
1. Clone this repository.
2. In the root directory, create a `.env` file and add your GitHub Personal Access Token: `GITHUB_TOKEN=your_token_here`
3. Run `npm install` and `npm run dev` to start the Next.js API on port 3000.
4. Open Google Chrome and navigate to `chrome://extensions`.
5. Enable **Developer mode** in the top right corner.
6. Click **Load unpacked** and select the `/extension` folder from this repository.
7. Click the GitStreak icon in your browser, enter your GitHub username, and you're good to go!

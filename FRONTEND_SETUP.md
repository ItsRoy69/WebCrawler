# Frontend Build & Development Guide

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python backend running (see main README)

### Build for Production

```bash
cd frontend
npm install
npm run build
```

This builds the React app to `../webcrawler/static/dist/` which the backend serves at http://localhost:8000.

### Development with Hot Reload

**Terminal 1 - Backend:**
```bash
python -m venv .venv
.venv\Scripts\Activate.ps1  # Windows
# or: source .venv/bin/activate  # macOS/Linux
pip install -e .
webcrawler crawl --seed https://example.org --max-pages 50 --data-dir data
webcrawler build-index --data-dir data
webcrawler serve --data-dir data  # Runs on :8000
```

**Terminal 2 - Frontend dev server:**
```bash
cd frontend
npm install
npm run dev  # Runs on :3000 with hot reload, proxies API calls to :8000
```

Then open http://localhost:3000 in your browser.

## Features

✨ **Modern UI:**
- Responsive design (mobile-first)
- Dark mode support
- Rich result cards with relevance scores
- Query highlighting in snippets

🔍 **Search Filters:**
- Sort by relevance or date
- Filter by domain
- Pagination with smart page numbers

💾 **User Experience:**
- Search history (saved to localStorage)
- Real-time crawl progress modal
- Live stats (document count, index status)
- Keyboard navigation

♿ **Accessibility:**
- WCAG 2.1 AA compliant
- Semantic HTML
- Proper ARIA labels
- Keyboard accessible

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **Tailwind CSS** - Styling  
- **Zustand** - State management
- **date-fns** - Date formatting

## Structure

```
frontend/
├── src/
│   ├── App.tsx                # Main app
│   ├── main.tsx               # Entry point
│   ├── api.ts                 # Backend API client
│   ├── store.ts               # Zustand state store
│   ├── styles/
│   │   └── globals.css        # Tailwind + global styles
│   └── components/
│       ├── Header.tsx         # Title + stats
│       ├── SearchBar.tsx      # Search input
│       ├── FilterSidebar.tsx  # Filters
│       ├── ResultsList.tsx    # Results container
│       ├── ResultCard.tsx     # Individual result
│       ├── Pagination.tsx     # Page navigation
│       ├── SearchHistory.tsx  # Recent searches
│       └── CrawlProgress.tsx  # Crawl modal
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── index.html
```

## Environment Variables

The frontend proxies to the backend during development. To point to a different backend:

```bash
# frontend/.env.local
VITE_API_URL=http://localhost:8000
```

(This is optional - by default it proxies via the Vite config)

## Building & Deployment

### Production Build
```bash
npm run build
# Outputs to ../webcrawler/static/dist/
```

The Python backend serves this automatically when running `webcrawler serve`.

### Type Checking
```bash
npm run type-check
```

## Common Tasks

### Update dependencies
```bash
npm update
npm outdated  # See what needs updating
```

### Add new component
1. Create `src/components/MyComponent.tsx`
2. Import and use in `App.tsx` or other components
3. Use Zustand store for state: `import { useAppStore } from '../store'`

### Change styling
- Global styles: `src/styles/globals.css`
- Component styles: Use Tailwind classes directly in JSX
- Dark mode: Use `dark:` prefix in Tailwind classes

## API Endpoints Used

- `GET /search?q=...&limit=10&offset=0` - Search results
- `GET /stats` - Index statistics  
- `GET /api/crawl-status` - Crawl progress (polling)
- `GET /health` - Health check

See backend [api.py](../webcrawler/api.py) for details.

## Troubleshooting

**Frontend won't connect to backend:**
- Make sure backend is running on :8000
- Check CORS settings (should be proxied)
- Open browser DevTools Console to see errors

**Tailwind styles not appearing:**
- Check that you're using `npm run build` (not just `dev`)
- Styles in `dist/` should be bundled

**Dark mode not working:**
- LocalStorage is required for dark mode preference
- Check browser console for errors

## Next Steps

- [ ] Add infinite scroll pagination
- [ ] Add search autocomplete/suggestions
- [ ] Export results (CSV, JSON)
- [ ] Save searches / watchlists
- [ ] Advanced date range filter
- [ ] Content type filter (articles, code, docs, etc.)

# Frontend

Modern React + TypeScript frontend for WebCrawler search engine.

## Development

```bash
# Install dependencies
npm install

# Start dev server (proxied to http://localhost:8000)
npm run dev

# Open browser at http://localhost:3000
```

## Building

```bash
# Build for production
npm run build

# Output goes to ../webcrawler/static/dist/
```

## Features

- ✨ Modern, responsive UI (mobile-first)
- 🎨 Dark mode support
- 📊 Rich result cards with scores, dates, highlights
- 🔍 Real-time filters (domain, sort)
- 📖 Pagination with smart page numbers
- 💾 Search history (localStorage)
- ⏳ Live crawl progress with stats
- ♿ Accessibility (WCAG 2.1 AA)

## Architecture

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool (fast, modern)
- **Zustand** - State management (lightweight)
- **Tailwind CSS** - Styling
- **date-fns** - Date formatting

## Project Structure

```
src/
├── App.tsx              # Main app component
├── main.tsx             # React entry point
├── api.ts               # API client (fetch wrapper)
├── store.ts             # Zustand state store
├── styles/
│   └── globals.css      # Tailwind + global styles
└── components/
    ├── Header.tsx       # Header with stats
    ├── SearchBar.tsx    # Search input + submit
    ├── FilterSidebar.tsx # Filters (sort, domain)
    ├── ResultsList.tsx  # Results container
    ├── ResultCard.tsx   # Individual result
    ├── Pagination.tsx   # Page navigation
    ├── SearchHistory.tsx # Recent searches
    └── CrawlProgress.tsx # Crawl modal
```

## Styling

Uses Tailwind CSS for styling with custom components:
- `.btn-primary` - Blue primary button
- `.btn-secondary` - Gray secondary button
- `.card` - Result card styles
- `.input-field` - Text input styles

Dark mode is supported via `dark:` classes and automatic `document.documentElement.classList` toggling.

## API Integration

The frontend proxies requests to the backend:
- `/search?q=...` - Search results
- `/stats` - Index statistics
- `/api/crawl-status` - Crawl progress (polling)

See [api.ts](src/api.ts) for the client implementation.

## Performance

- Code splitting with Vite
- Lazy component loading
- Efficient re-renders with Zustand
- Optimized bundle size

## Future Improvements

- [ ] Infinite scroll (instead of pagination)
- [ ] Autocomplete search suggestions
- [ ] Advanced filters (date range, content type)
- [ ] Result export (CSV, JSON)
- [ ] Saved searches
- [ ] Crawl scheduling UI

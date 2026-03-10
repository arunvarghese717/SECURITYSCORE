# Auto-Updating Security News & Video Feed Implementation Guide

## Overview

This implementation adds **real-time, auto-updating security news and video content** to your MySecurity Scores website. The system fetches fresh content from multiple sources and automatically refreshes every 30 minutes, ensuring your site always has current security information.

### Benefits for AdSense Compliance
- ✅ **Fresh Content**: Regular updates signal active site maintenance
- ✅ **Substantial Content**: Mix of user-provided and API-sourced content
- ✅ **User Engagement**: Auto-updating feeds keep visitors returning
- ✅ **Relevance**: Content automatically categorized and prioritized
- ✅ **Credibility**: Content sourced from authoritative security organizations

---

## Files Created

### 1. **JavaScript Feed System**
- **File**: `/js/auto-news-feed.js`
- **Size**: ~15 KB
- **Purpose**: Fetches and manages news feeds and videos
- **Features**:
  - Multi-source news aggregation
  - Smart caching with 6-hour expiration
  - Automatic categorization
  - Fallback mechanisms
  - Auto-refresh every 30 minutes

### 2. **CSS Styles**
- **File**: `/css/news-videos.css`
- **Size**: ~5 KB
- **Purpose**: Responsive video grid styling
- **Features**:
  - Hover animations
  - Play button overlay
  - Loading shimmer effects
  - Mobile responsive
  - Accessibility optimized

---

## Implementation Steps

### Step 1: Add the Script to Your News Page

In `security-news.html`, add this script reference before the closing `</body>` tag:

```html
<!-- Auto-updating News and Video Feed System -->
<script src="/js/auto-news-feed.js"></script>
```

### Step 2: Add CSS Link

In the `<head>` section of `security-news.html`, add:

```html
<!-- News and Video Feed Styles -->
<link rel="stylesheet" href="/css/news-videos.css">
```

### Step 3: Create Video Container

Add this section to `security-news.html` (after the news grid):

```html
<!-- Featured Security Videos Section -->
<section class="featured-videos">
    <h2>🎬 Featured Security Videos</h2>
    <div class="video-grid" id="videoGrid">
        <!-- Videos will be auto-populated here -->
    </div>
</section>
```

### Step 4: Update Selectors (if needed)

The script looks for `.news-grid` and `.video-grid` elements. Ensure your HTML structure matches:

```html
<!-- News cards grid -->
<div class="news-grid" id="newsGrid">
    <!-- Existing hardcoded news cards stay here -->
    <!-- New dynamic cards will be appended -->
</div>

<!-- Video grid (add this) -->
<div class="video-grid" id="videoGrid"></div>
```

---

## How It Works

### News Fetching Process

```
1. Page Load
   ↓
2. Check LocalStorage Cache
   ├─ Cache Valid? → Display cached news
   └─ Cache Invalid? → Fetch from sources
   ↓
3. Fetch from Multiple Sources (in parallel)
   ├─ Hacker News API
   ├─ CISA Website
   ├─ NIST NVD Feed
   ├─ CVE Details
   └─ TechCrunch RSS
   ↓
4. Combine Results
   ├─ Remove duplicates
   ├─ Sort by date
   └─ Limit to 20 articles
   ↓
5. Cache Results (6 hours)
   ↓
6. Display on Page
   └─ Refresh every 30 minutes
```

### Video System

The system provides two approaches:

**Option A: Pre-configured Videos (Current)**
- Hardcoded list of popular security channels
- No API key required
- Always available
- Manual updates needed

**Option B: YouTube API (Requires Configuration)**
- Real-time video updates
- Requires YouTube API key (free tier available)
- Automatic latest videos
- Better user engagement

---

## Data Sources

### Free News Sources (No API Key Required)

| Source | Type | Update Frequency | Coverage |
|--------|------|-----------------|----------|
| **Hacker News** | Aggregator | Real-time | General tech/security |
| **CISA** | Government | Daily | Official US security alerts |
| **NIST NVD** | CVE Database | Real-time | Vulnerability disclosures |
| **CVE Details** | Vulnerability | Hourly | Detailed CVE information |
| **TechCrunch** | News | Daily | Tech/security news |

### Configuration

Each source is optional. If one fails, others are used. The system gracefully degrades to cached content.

---

## Adding More News Sources

To add a new news source, create a method in the `SecurityNewsFeed` class:

```javascript
/**
 * Fetch from your source
 */
async fetchFromYourSource() {
    try {
        const response = await fetch('https://your-api-endpoint.com/feed');
        const data = await response.json();

        return data.map(item => ({
            title: item.headline || '',
            summary: item.description || '',
            url: item.link || '',
            published: new Date(item.date),
            source: 'Your Source Name',
            category: this.categorizeArticle(item.headline || '')
        }));
    } catch (error) {
        console.error('Your source fetch failed:', error);
        return [];
    }
}
```

Then add it to the sources array in `fetchNews()`:

```javascript
const sources = [
    this.fetchFromSecurityNewsAPI(),
    this.fetchFromCISA(),
    this.fetchFromNIST(),
    this.fetchFromCVEDetails(),
    this.fetchFromTechCrunch(),
    this.fetchFromYourSource(),  // ← Add here
];
```

---

## YouTube Integration (Optional)

For real-time YouTube videos, use the YouTube Data API:

### Step 1: Get API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable "YouTube Data API v3"
4. Create an API key (no OAuth needed for public data)
5. Restrict to YouTube Data API

### Step 2: Update the Script

Replace the `fetchVideos()` method:

```javascript
async fetchVideos() {
    const apiKey = 'YOUR_YOUTUBE_API_KEY';
    const channelIds = [
        'UCP3LSPyB9CuM6Qzlq4Eu8rA', // IppSec
        'UCJiB0pnH4K-Pe5LWWyL8tEQ', // Professor Messer
        'UCaxAEfWyKqpRakrPv-t9hXw', // John Hammond
    ];

    try {
        const videos = [];

        for (const channelId of channelIds) {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/search?` +
                `key=${apiKey}&` +
                `channelId=${channelId}&` +
                `part=snippet&` +
                `order=date&` +
                `maxResults=5&` +
                `type=video`
            );

            const data = await response.json();

            data.items.forEach(item => {
                videos.push({
                    title: item.snippet.title,
                    channel: item.snippet.channelTitle,
                    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
                    thumbnail: item.snippet.thumbnails.medium.url,
                    published: new Date(item.snippet.publishedAt)
                });
            });
        }

        return videos.slice(0, 12);
    } catch (error) {
        console.error('YouTube fetch failed:', error);
        return this.getPopularSecurityVideos();
    }
}
```

---

## Customization

### Change Update Frequency

In the constructor:

```javascript
// Update news every 15 minutes instead of 30
this.newsUpdateInterval = 15 * 60 * 1000;

// Change cache duration to 12 hours instead of 6
this.cacheDuration = 12 * 60 * 60 * 1000;
```

### Limit Number of Articles

In `displayNews()` method:

```javascript
// Show only 10 articles instead of 20
articles.forEach((article, index) => {
    if (index < 10) {
        const card = this.createNewsCard(article);
        this.newsContainer.appendChild(card);
    }
});
```

### Change Categories

Edit the `categories` mapping in the constructor:

```javascript
this.categories = {
    'vulnerability': 'vulnerabilities',
    'breach': 'data-breaches',
    'ransomware': 'ransomware',
    // Add more keyword → category mappings
    'your-keyword': 'your-category',
};
```

---

## Caching Strategy

### LocalStorage Cache

- **Key**: `securityNewsFeedCache`
- **Duration**: 6 hours
- **Storage**: ~100 KB (JSON)
- **Expiration**: Automatic

### Fallback Behavior

```
1. Try fetching from all sources
   ↓
2. If any succeed → cache and display new content
   ↓
3. If all fail → display cached content (if available)
   ↓
4. If no cache → display hardcoded fallback items
```

---

## Security Considerations

### Content Security Policy

Ensure your CSP allows external APIs:

```html
<!-- In <head> -->
<meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self' https://hacker-news.firebaseio.com https://www.cisa.gov https://nvd.nist.gov;
    connect-src 'self' https://hacker-news.firebaseio.com https://www.cisa.gov https://nvd.nist.gov;
">
```

### XSS Prevention

- All content is HTML-escaped before insertion
- `innerHTML` only used for safe content
- User inputs are sanitized

### Rate Limiting

- APIs are called only every 30 minutes
- Uses caching to reduce requests
- Falls back gracefully if rate-limited

---

## Testing

### Test the Implementation

```javascript
// Open browser console and run:

// Force fetch new news
const feed = new SecurityNewsFeed();
feed.fetchNews();

// Check cached data
console.log(localStorage.getItem('securityNewsFeedCache'));

// Clear cache and refresh
localStorage.removeItem('securityNewsFeedCache');
location.reload();
```

### Check Network Activity

1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "XHR"
4. Reload page
5. You should see API requests to:
   - `hacker-news.firebaseio.com`
   - `cvedetails.com`
   - Other sources

---

## Troubleshooting

### News Not Updating

**Problem**: No articles appearing or old articles cached

**Solution**:
```javascript
// Clear cache and reload
localStorage.clear();
location.reload();
```

### Videos Not Showing

**Problem**: Video grid is empty

**Solution**:
1. Check that `<div class="video-grid"></div>` exists in HTML
2. Check browser console for errors
3. Verify CSS is loaded (`/css/news-videos.css`)

### CORS Errors

**Problem**: API calls failing with CORS error

**Solution**:
- Some APIs require CORS headers
- Use a CORS proxy if needed: `https://cors-anywhere.herokuapp.com/`
- Consider server-side proxy for reliability

### Performance Issues

**Problem**: Page loads slowly with news feed

**Solution**:
```javascript
// Reduce number of fetched articles
articles.slice(0, 10); // Instead of 20

// Increase cache duration
this.cacheDuration = 24 * 60 * 60 * 1000; // 24 hours

// Disable auto-refresh during business hours
// setInterval(() => this.fetchNews(), 60 * 60 * 1000); // 1 hour
```

---

## Monitoring & Analytics

### Track Feed Performance

Add Google Analytics tracking:

```javascript
// In createNewsCard() method, add:
card.addEventListener('click', () => {
    gtag('event', 'news_click', {
        article_title: article.title,
        article_source: article.source,
        article_category: article.category
    });
});
```

### Monitor API Health

```javascript
// Add to fetchNews():
fetch('/api/log-feed-status', {
    method: 'POST',
    body: JSON.stringify({
        timestamp: new Date(),
        sources_successful: successCount,
        articles_loaded: articles.length,
        cache_used: usedCache
    })
});
```

---

## AdSense Best Practices

### Content Quality Signals
✅ Auto-updating content shows active maintenance
✅ Multiple authoritative sources build authority
✅ Fresh news attracts repeat visitors
✅ Proper categorization improves user experience

### Implementation Tips
- Keep hardcoded content for fallback
- Monitor click-through rates
- Update article selection weekly
- Use descriptive titles for articles
- Maintain consistent publishing

---

## Next Steps

1. **Deploy**: Add script to production website
2. **Test**: Verify news and videos load correctly
3. **Monitor**: Check browser console for errors
4. **Optimize**: Adjust update frequency based on performance
5. **Enhance**: Add YouTube API for video feeds
6. **Track**: Monitor user engagement with analytics

---

## Support & Updates

For issues or improvements:
1. Check browser console (F12) for error messages
2. Clear LocalStorage cache if problems persist
3. Verify API endpoints are accessible
4. Check Content Security Policy settings

---

## License

This implementation is part of MySecurity Scores.
All code is proprietary and for internal use only.

**Last Updated**: February 2026
**Version**: 1.0

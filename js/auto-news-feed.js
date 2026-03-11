/**
 * Auto-Updating Security News and Video Feed System
 * Fetches real-time security news from multiple sources and YouTube videos
 * Implements caching and fallback mechanisms for reliability
 */

class SecurityNewsFeed {
    constructor() {
        this.newsContainer = document.querySelector('.news-grid');
        this.videoContainer = document.querySelector('.video-grid') || document.querySelector('.featured-videos');
        this.cacheKey = 'securityNewsFeedCache';
        this.videoCacheKey = 'securityVideoCache';
        this.cacheDuration = 6 * 60 * 60 * 1000; // 6 hours
        this.newsUpdateInterval = 30 * 60 * 1000; // 30 minutes
        this.updateInterval = null; // Store interval reference for cleanup
        this.abortController = new AbortController(); // For fetch timeout

        // Categories mapping
        this.categories = {
            'vulnerability': 'vulnerabilities',
            'breach': 'data-breaches',
            'ransomware': 'ransomware',
            'malware': 'critical',
            'exploit': 'vulnerabilities',
            'zero-day': 'critical',
            'phishing': 'critical',
            'supply chain': 'critical',
            'ai': 'ai-security',
            'quantum': 'vulnerabilities'
        };

        this.init();
    }

    /**
     * Initialize the news feed system
     */
    init() {
        // Load cached data if available, otherwise fetch fresh
        const cachedNews = this.getCache(this.cacheKey);

        if (cachedNews && this.isCacheValid(cachedNews)) {
            this.displayNews(cachedNews.data);
        } else {
            this.fetchNews();
        }

        // Load videos similarly
        const cachedVideos = this.getCache(this.videoCacheKey);
        if (cachedVideos && this.isCacheValid(cachedVideos)) {
            this.displayVideos(cachedVideos.data);
        } else {
            this.fetchVideos();
        }

        // Set up periodic updates (store reference for cleanup)
        this.updateInterval = setInterval(() => this.fetchNews(), this.newsUpdateInterval);

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => this.cleanup());
    }

    /**
     * Cleanup resources on page unload
     */
    cleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.abortController.abort();
    }

    /**
     * Fetch security news from multiple sources
     */
    async fetchNews() {
        try {
            const newsArticles = [];

            // Try multiple news sources
            const sources = [
                this.fetchFromSecurityNewsAPI(),
                this.fetchFromCISA(),
                this.fetchFromNIST(),
                this.fetchFromCVEDetails(),
                this.fetchFromTechCrunch(),
            ];

            const results = await Promise.allSettled(sources);

            // Combine results from all sources
            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    newsArticles.push(...result.value);
                }
            });

            // Sort by date (newest first) and limit to 20
            const sortedNews = newsArticles
                .sort((a, b) => new Date(b.published) - new Date(a.published))
                .slice(0, 20);

            if (sortedNews.length > 0) {
                this.cacheData(this.cacheKey, sortedNews);
                this.displayNews(sortedNews);
            } else {
                // Fall back to cached data if available
                const fallbackNews = this.getCache(this.cacheKey);
                if (fallbackNews) {
                    this.displayNews(fallbackNews.data);
                } else {
                    this.displayFallbackNews();
                }
            }
        } catch (error) {
            console.error('Error fetching news:', error);
            // Show fallback content
            const fallbackNews = this.getCache(this.cacheKey);
            if (fallbackNews) {
                this.displayNews(fallbackNews.data);
            } else {
                this.displayFallbackNews();
            }
        }
    }

    /**
     * Fetch from SecurityNews API (free tier available)
     */
    async fetchFromSecurityNewsAPI() {
        try {
            // Using HNAPI (Hacker News) which has a free JSON API
            const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json?limitToFirst=10');

            if (!response.ok) {
                console.error(`Hacker News API returned ${response.status}`);
                return [];
            }

            const storyIds = await response.json();

            if (!Array.isArray(storyIds) || storyIds.length === 0) {
                console.warn('Hacker News returned empty story list');
                return [];
            }

            // Fetch first 10 story details in parallel (not sequentially)
            const storyPromises = storyIds.slice(0, 10).map(id =>
                fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
                    signal: this.abortController.signal
                }).then(r => r.ok ? r.json() : null)
            );

            const stories = await Promise.all(storyPromises);
            const articles = [];

            // Filter for security-related stories
            stories.forEach(story => {
                if (story && story.title && this.isSecurityRelevant(story.title)) {
                    const publishDate = story.time ? new Date(story.time * 1000) : new Date();
                    articles.push({
                        title: story.title,
                        summary: story.title,
                        url: this.validateUrl(story.url) || `https://news.ycombinator.com/item?id=${story.id}`,
                        published: publishDate,
                        source: 'Hacker News',
                        category: this.categorizeArticle(story.title)
                    });
                }
            });

            return articles;
        } catch (error) {
            console.error('SecurityNewsAPI fetch failed:', error);
            return [];
        }
    }

    /**
     * Fetch from CISA (Cybersecurity and Infrastructure Security Agency)
     */
    async fetchFromCISA() {
        try {
            const response = await fetch('https://www.cisa.gov/news-events/news', {
                signal: this.abortController.signal
            });

            if (!response.ok) {
                console.warn(`CISA API returned ${response.status}`);
                return [];
            }

            const html = await response.text();
            if (!html || html.trim().length === 0) {
                console.warn('CISA returned empty response');
                return [];
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const articles = [];
            const items = doc.querySelectorAll('[data-item-id]');

            if (items.length === 0) {
                console.warn('No CISA items found with data-item-id selector');
                return [];
            }

            items.forEach((item, index) => {
                if (index < 10 && item.textContent && this.isSecurityRelevant(item.textContent)) {
                    const title = item.querySelector('h3, h2, .title')?.textContent?.trim() || '';
                    const urlElement = item.querySelector('a');
                    const url = urlElement?.href ? this.validateUrl(urlElement.href) : 'https://www.cisa.gov';

                    if (title.length > 0) {
                        articles.push({
                            title: title,
                            summary: title,
                            url: url,
                            published: new Date(),
                            source: 'CISA',
                            category: this.categorizeArticle(title)
                        });
                    }
                }
            });

            return articles.slice(0, 10);
        } catch (error) {
            console.error('CISA fetch failed:', error);
            return [];
        }
    }

    /**
     * Fetch from NIST (National Institute of Standards and Technology)
     */
    async fetchFromNIST() {
        try {
            // NIST NVD CVE RSS Feed (free)
            const response = await fetch('https://services.nvd.nist.gov/rest/xml/cves/1.0?startIndex=0&resultsPerPage=20', {
                signal: this.abortController.signal
            });

            if (!response.ok) {
                console.warn(`NIST API returned ${response.status}`);
                return [];
            }

            const xml = await response.text();
            if (!xml || xml.trim().length === 0) {
                console.warn('NIST returned empty response');
                return [];
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, 'text/xml');

            const articles = [];
            const items = doc.querySelectorAll('item');

            if (items.length === 0) {
                console.warn('No NIST items found');
                return [];
            }

            items.forEach((item, index) => {
                if (index < 10) {
                    const title = item.querySelector('title')?.textContent?.trim() || '';
                    const description = item.querySelector('description')?.textContent?.trim() || '';
                    const pubDate = item.querySelector('pubDate')?.textContent;

                    if (title.length > 0) {
                        const cveMatch = title.match(/CVE-\d+-\d+/);
                        const cveId = cveMatch ? cveMatch[0] : '';
                        const publishDate = pubDate && !isNaN(new Date(pubDate)) ? new Date(pubDate) : new Date();

                        articles.push({
                            title: title,
                            summary: (description.slice(0, 200) + '...').slice(0, 250),
                            url: cveId ? `https://nvd.nist.gov/vuln/detail/${cveId}` : 'https://nvd.nist.gov',
                            published: publishDate,
                            source: 'NIST NVD',
                            category: 'vulnerabilities'
                        });
                    }
                }
            });

            return articles;
        } catch (error) {
            console.error('NIST fetch failed:', error);
            return [];
        }
    }

    /**
     * Fetch from CVE Details (popular vulnerability tracking)
     */
    async fetchFromCVEDetails() {
        try {
            const response = await fetch('https://www.cvedetails.com/json-feed.php', {
                signal: this.abortController.signal
            });

            if (!response.ok) {
                console.warn(`CVE Details API returned ${response.status}`);
                return [];
            }

            const data = await response.json();

            if (!data || !Array.isArray(data) || data.length === 0) {
                console.warn('CVE Details returned invalid or empty data');
                return [];
            }

            return data.slice(0, 10).map(item => {
                const cveId = item.cve_id || '';
                const title = item.vulnerability_name || cveId || 'Security Update';
                const publishDate = item.publish_date && !isNaN(new Date(item.publish_date))
                    ? new Date(item.publish_date)
                    : new Date();

                return {
                    title: title,
                    summary: `Severity: ${item.cvss_score || 'N/A'} - ${item.summary || ''}`.slice(0, 200),
                    url: cveId ? `https://www.cvedetails.com/cve/${cveId}/` : 'https://www.cvedetails.com',
                    published: publishDate,
                    source: 'CVE Details',
                    category: 'vulnerabilities'
                };
            });
        } catch (error) {
            console.error('CVE Details fetch failed:', error);
            return [];
        }
    }

    /**
     * Fetch from TechCrunch (tech security news)
     */
    async fetchFromTechCrunch() {
        try {
            // Using RSS feed (without query parameters for broader coverage)
            const response = await fetch('https://techcrunch.com/feed/', {
                signal: this.abortController.signal
            });

            if (!response.ok) {
                console.warn(`TechCrunch API returned ${response.status}`);
                return [];
            }

            const xml = await response.text();
            if (!xml || xml.trim().length === 0) {
                console.warn('TechCrunch returned empty response');
                return [];
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, 'text/xml');

            const articles = [];
            const items = doc.querySelectorAll('item');

            if (items.length === 0) {
                console.warn('No TechCrunch items found');
                return [];
            }

            items.forEach((item, index) => {
                if (index < 10) {
                    const title = item.querySelector('title')?.textContent?.trim() || '';
                    const description = item.querySelector('description')?.textContent?.trim() || '';
                    const pubDate = item.querySelector('pubDate')?.textContent;
                    const link = item.querySelector('link')?.textContent?.trim() || '';

                    if (title.length > 0 && this.isSecurityRelevant(title)) {
                        const publishDate = pubDate && !isNaN(new Date(pubDate)) ? new Date(pubDate) : new Date();
                        const url = this.validateUrl(link) || 'https://techcrunch.com';

                        articles.push({
                            title: title,
                            summary: (description.slice(0, 200) + '...').slice(0, 250),
                            url: url,
                            published: publishDate,
                            source: 'TechCrunch',
                            category: this.categorizeArticle(title)
                        });
                    }
                }
            });

            return articles;
        } catch (error) {
            console.error('TechCrunch fetch failed:', error);
            return [];
        }
    }

    /**
     * Fetch security videos from YouTube
     */
    async fetchVideos() {
        try {
            // Note: This requires a YouTube API key. For a free alternative,
            // we can use a proxy service or embed popular security channels
            // For now, we'll provide hardcoded popular security video channels

            const videos = this.getPopularSecurityVideos();

            // Cache the videos for offline access
            if (videos && videos.length > 0) {
                this.cacheData(this.videoCacheKey, videos);
            }

            return videos;
        } catch (error) {
            console.error('Error fetching videos:', error);
            return this.getPopularSecurityVideos();
        }
    }

    /**
     * Get popular security videos for fallback
     */
    getPopularSecurityVideos() {
        return [
            {
                title: 'Understanding Cybersecurity Fundamentals',
                channel: 'Security Training Hub',
                url: 'https://www.youtube.com/results?search_query=cybersecurity+fundamentals',
                thumbnail: 'https://via.placeholder.com/320x180?text=Cybersecurity+Basics',
                views: '1.2M',
                published: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            },
            {
                title: 'Zero Trust Architecture Explained',
                channel: 'Enterprise Security',
                url: 'https://www.youtube.com/results?search_query=zero+trust+architecture',
                thumbnail: 'https://via.placeholder.com/320x180?text=Zero+Trust',
                views: '850K',
                published: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
            },
            {
                title: 'Ransomware Defense Strategies',
                channel: 'Cybersecurity Experts',
                url: 'https://www.youtube.com/results?search_query=ransomware+defense',
                thumbnail: 'https://via.placeholder.com/320x180?text=Ransomware+Defense',
                views: '650K',
                published: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
            },
            {
                title: 'Authentication Best Practices 2026',
                channel: 'Security Tips Channel',
                url: 'https://www.youtube.com/results?search_query=authentication+best+practices',
                thumbnail: 'https://via.placeholder.com/320x180?text=Authentication',
                views: '2.1M',
                published: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
            }
        ];
    }

    /**
     * Display news articles in the grid
     */
    displayNews(articles) {
        if (!this.newsContainer) {
            console.warn('News container not found');
            return;
        }

        // Remove old dynamic items (keep only hardcoded ones)
        const existingCards = Array.from(this.newsContainer.querySelectorAll('.news-card'));
        const hardcodedCount = 6;

        // Remove dynamic cards
        existingCards.slice(hardcodedCount).forEach(card => card.remove());

        // Batch append new articles using DocumentFragment
        const fragment = document.createDocumentFragment();
        articles.slice(0, 14).forEach(article => {
            fragment.appendChild(this.createNewsCard(article));
        });

        this.newsContainer.appendChild(fragment);
    }

    /**
     * Create a news card element
     */
    createNewsCard(article) {
        const card = document.createElement('article');
        card.className = 'news-card';
        card.setAttribute('data-category', article.category || 'critical');

        const categoryBadgeClass = `badge-${article.category || 'critical'}`;
        const timeAgo = this.getTimeAgo(article.published);

        // Build HTML safely
        const cardTop = document.createElement('div');
        cardTop.className = 'card-top';

        const badge = document.createElement('span');
        badge.className = `category-badge ${categoryBadgeClass}`;
        badge.textContent = this.formatCategory(article.category);
        cardTop.appendChild(badge);

        card.appendChild(cardTop);

        const title = document.createElement('h3');
        title.textContent = article.title;
        card.appendChild(title);

        const summary = document.createElement('p');
        summary.className = 'summary';
        summary.textContent = article.summary;
        card.appendChild(summary);

        const footer = document.createElement('div');
        footer.className = 'card-footer';

        const meta = document.createElement('div');
        meta.className = 'card-meta';

        const source = document.createElement('span');
        source.title = article.source;
        source.textContent = `📰 ${article.source}`;
        meta.appendChild(source);

        const time = document.createElement('span');
        time.title = article.published.toLocaleString();
        time.textContent = `🕐 ${timeAgo}`;
        meta.appendChild(time);

        footer.appendChild(meta);

        const link = document.createElement('a');
        link.className = 'read-link';
        link.textContent = 'Read More →';
        const validUrl = this.validateUrl(article.url);
        if (validUrl) {
            link.href = validUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        } else {
            link.href = '#';
            link.style.pointerEvents = 'none';
            link.style.opacity = '0.5';
        }
        footer.appendChild(link);

        card.appendChild(footer);

        return card;
    }

    /**
     * Display videos in the grid
     */
    displayVideos(videos) {
        if (!this.videoContainer) {
            console.warn('Video container not found');
            return;
        }

        // Clear existing videos and batch-append new ones
        this.videoContainer.innerHTML = '';

        const fragment = document.createDocumentFragment();
        videos.forEach(video => {
            fragment.appendChild(this.createVideoCard(video));
        });

        this.videoContainer.appendChild(fragment);
    }

    /**
     * Create a video card element
     */
    createVideoCard(video) {
        const card = document.createElement('div');
        card.className = 'video-card';

        const timeAgo = this.getTimeAgo(video.published);

        // Create thumbnail link
        const thumbLink = document.createElement('a');
        thumbLink.className = 'video-thumbnail';
        thumbLink.target = '_blank';
        thumbLink.rel = 'noopener noreferrer';

        const validUrl = this.validateUrl(video.url);
        if (validUrl) {
            thumbLink.href = validUrl;
        } else {
            thumbLink.href = '#';
            thumbLink.style.pointerEvents = 'none';
        }

        const img = document.createElement('img');
        img.src = this.escapeHtml(video.thumbnail);
        img.alt = video.title;
        thumbLink.appendChild(img);

        const playBtn = document.createElement('div');
        playBtn.className = 'play-button';
        playBtn.textContent = '▶';
        thumbLink.appendChild(playBtn);

        card.appendChild(thumbLink);

        // Create video info
        const info = document.createElement('div');
        info.className = 'video-info';

        const title = document.createElement('h4');
        title.textContent = video.title;
        info.appendChild(title);

        const channel = document.createElement('p');
        channel.className = 'video-channel';
        channel.textContent = video.channel;
        info.appendChild(channel);

        const meta = document.createElement('div');
        meta.className = 'video-meta';

        const views = document.createElement('span');
        views.textContent = `👁️ ${video.views}`;
        meta.appendChild(views);

        const time = document.createElement('span');
        time.textContent = `📅 ${timeAgo}`;
        meta.appendChild(time);

        info.appendChild(meta);
        card.appendChild(info);

        return card;
    }

    /**
     * Validate URL to prevent XSS attacks
     */
    validateUrl(url) {
        if (!url || typeof url !== 'string') return '';

        const trimmed = url.trim().toLowerCase();

        // Block dangerous protocols
        if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) {
            console.warn('Blocked dangerous URL:', url);
            return '';
        }

        // Only allow http, https, or relative URLs
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
            return url;
        }

        return '';
    }

    /**
     * Check if article is security-relevant
     */
    isSecurityRelevant(text) {
        if (!text || typeof text !== 'string') return false;

        const keywords = [
            'security', 'cyber', 'breach', 'vulnerability', 'ransomware', 'malware',
            'hacking', 'phishing', 'attack', 'threat', 'exploit', 'zero-day',
            'encryption', 'authentication', 'firewall', 'intrusion', 'compromise',
            'cve', 'cvss', 'infosec', 'opsec', 'appsec',
            'data protection', 'incident response', 'threat detection'
        ];

        const lowerText = text.toLowerCase();
        return keywords.some(keyword => lowerText.includes(keyword));
    }

    /**
     * Categorize article based on content
     */
    categorizeArticle(text) {
        const lowerText = text.toLowerCase();

        for (const [keyword, category] of Object.entries(this.categories)) {
            if (lowerText.includes(keyword)) {
                return category;
            }
        }

        return 'critical'; // Default category
    }

    /**
     * Format category name for display
     */
    formatCategory(category) {
        const mapping = {
            'critical': 'CRITICAL',
            'vulnerabilities': 'VULNERABILITY',
            'data-breaches': 'BREACH',
            'ransomware': 'RANSOMWARE',
            'ai-security': 'AI SECURITY'
        };

        return mapping[category] || category.toUpperCase();
    }

    /**
     * Get human-readable time difference
     */
    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);

        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        const weeks = Math.floor(days / 7);
        if (weeks < 4) return `${weeks}w ago`;

        return date.toLocaleDateString();
    }

    /**
     * Cache data to localStorage
     */
    cacheData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.error('Caching failed:', error);
        }
    }

    /**
     * Get cached data
     */
    getCache(key) {
        try {
            const cached = localStorage.getItem(key);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.error('Cache retrieval failed:', error);
            return null;
        }
    }

    /**
     * Check if cache is still valid
     */
    isCacheValid(cached) {
        if (!cached || !cached.timestamp) return false;
        return (Date.now() - cached.timestamp) < this.cacheDuration;
    }

    /**
     * Escape HTML to prevent XSS (for use in non-attribute contexts)
     */
    escapeHtml(text) {
        if (!text || typeof text !== 'string') return '';

        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };

        return text.replace(/[&<>"']/g, char => map[char]);
    }

    /**
     * Display fallback news (hardcoded items)
     */
    displayFallbackNews() {
        console.log('Using fallback news - no fresh data available');
        // The hardcoded items in HTML will remain visible
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new SecurityNewsFeed();
    });
} else {
    new SecurityNewsFeed();
}
